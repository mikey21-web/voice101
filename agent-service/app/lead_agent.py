from __future__ import annotations

import asyncio
from typing import Any

from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, ToolMessage

from app.schemas import AgentState
from app.config import Settings
from app.backend_client import BackendClient
from app.tools import build_tools, ToolContext
from app.prompt import build_system_prompt
from app.niche_config import normalize_niche_config, load_niche_config_from_file
from app.logging_config import utc_now_iso
from app.config_runtime import runtime_config

MAX_HISTORY_MESSAGES = 20


def build_lead_graph(tools: list, settings: Settings, client: BackendClient):
    graph = StateGraph(AgentState)
    _tool_node = ToolNode(tools)

    async def _tools_node(state: AgentState, config) -> dict:
        result = await _tool_node.ainvoke(state)
        new_messages = result.get("messages", result) if isinstance(result, dict) else list(result)
        return {"messages": state.get("messages", []) + list(new_messages)}

    graph.add_node("load_context", _load_context)
    graph.add_node("agent", _agent_node)
    graph.add_node("tools", _tools_node)
    graph.add_node("persist", _persist_node)

    graph.set_entry_point("load_context")
    graph.add_edge("load_context", "agent")
    graph.add_conditional_edges("agent", _should_continue, {"tools": "tools", "persist": "persist"})
    graph.add_edge("tools", "agent")
    graph.add_edge("persist", END)

    return graph.compile()


async def _load_context(state: AgentState, config) -> AgentState:
    client: BackendClient = config["configurable"]["client"]
    lead_id = state["lead_id"]
    nich = state.get("niche_config")

    try:
        lead, conversations = await asyncio.gather(
            client._get(f"/leads/{lead_id}"),
            client._get(f"/leads/{lead_id}/conversations"),
        )
        niche_raw = load_niche_config_from_file()
    except Exception:
        lead = {"id": lead_id, "status": "NEW", "score": 0, "segment": "COLD", "contact": {}}
        conversations = []
        niche_raw = {}

    if not nich:
        nich = niche_raw if niche_raw and "display_name" in niche_raw else normalize_niche_config(niche_raw)

    rc = runtime_config or {}
    if rc.get("businessName"): nich["display_name"] = rc["businessName"]
    if rc.get("industry"): nich["industry"] = rc["industry"]
    if rc.get("qualificationQuestions"): nich["qualification_questions"] = rc["qualificationQuestions"]
    if rc.get("toneStyle"): nich["tone_style"] = rc["toneStyle"]
    if rc.get("customPrompt"): nich["custom_prompt"] = rc["customPrompt"]

    prior_messages: list[dict] = []
    messages_list = conversations if isinstance(conversations, list) else conversations.get("data", [])
    for msg in messages_list[-MAX_HISTORY_MESSAGES:]:
        role = "user" if msg.get("direction") == "INBOUND" else "assistant"
        prior_messages.append({"role": role, "text": msg.get("text", "")})

    system_prompt = build_system_prompt(nich, lead)
    lc_messages: list[Any] = [SystemMessage(content=system_prompt)]

    procedural_rules = state.get("procedural_rules")
    if procedural_rules:
        rules_text = "\n".join(
            f"- {r.get('rule', r.get('value', ''))} (category: {r.get('category', 'general')}, score: {r.get('score', 'N/A')})"
            if r.get('score') else f"- {r.get('rule', r.get('value', ''))} (category: {r.get('category', 'general')})"
            for r in procedural_rules
        )
        lc_messages.append(SystemMessage(content=f"Active learned rules (follow these, highest relevance first):\n{rules_text}"))

    for pm in prior_messages:
        lc_messages.append(HumanMessage(content=pm["text"]) if pm["role"] == "user" else AIMessage(content=pm["text"]))

    incoming = state.get("incoming_text")
    if incoming:
        lc_messages.append(HumanMessage(content=incoming))
    elif state.get("trigger") == "lead_created":
        lc_messages.append(HumanMessage(content="A new lead was created. Introduce yourself and start the conversation."))
    else:
        lc_messages.append(HumanMessage(content="Check in with the lead."))

    state["lead_context"] = lead
    state["conversation"] = prior_messages
    state["niche_config"] = nich
    state["messages"] = lc_messages
    state["steps"] = 0
    state["actions_taken"] = []
    state["terminate"] = False

    ctx = config["configurable"].get("ctx")
    if ctx:
        ctx.features = nich.get("features", {})

    return state


async def _agent_node(state: AgentState, config) -> AgentState:
    settings: Settings = config["configurable"]["settings"]
    tools = config["configurable"]["tools"]

    if not settings.deepseek_api_key:
        raise RuntimeError("DEEPSEEK_API_KEY not configured")
    # reasoning_effort is a DeepSeek-reasoner param; passing it to non-reasoning
    # OpenAI models (gpt-4o-mini, gpt-4.1, etc.) gets rejected with a 400.
    supports_reasoning_effort = settings.agent_model.startswith(("deepseek", "o1", "o3", "o4", "gpt-5"))
    model = ChatOpenAI(
        model=settings.agent_model,
        max_tokens=settings.agent_max_tokens,
        api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url,
        model_kwargs={"reasoning_effort": settings.agent_reasoning_effort} if supports_reasoning_effort else {},
    ).bind_tools(tools)

    try:
        response = await model.ainvoke(state["messages"])
    except Exception as e:
        response = AIMessage(content="Thanks for reaching out! I'm here to help you.", tool_calls=[])

    if not response.content and not getattr(response, "tool_calls", None):
        response = AIMessage(content="Thanks for messaging! How can I help you today?", tool_calls=[])

    state["messages"].append(response)
    state["steps"] = state.get("steps", 0) + 1

    if hasattr(response, "tool_calls") and response.tool_calls:
        for tc in response.tool_calls:
            state["actions_taken"].append({
                "id": tc.get("id", ""), "tool": tc.get("name", ""),
                "args": tc.get("args", {}), "status": "pending",
            })
    return state


def _should_continue(state: AgentState, config) -> str:
    messages = state.get("messages", [])
    settings: Settings = config["configurable"]["settings"]
    max_steps = settings.max_agent_steps

    if state.get("terminate") or state.get("steps", 0) >= max_steps:
        return "persist"
    if messages:
        last = messages[-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            for tc in last.tool_calls:
                name = tc.get("name", "")
                if name in ("escalate_to_human", "mark_lost"):
                    state["terminate"] = True
                    return "persist"
            return "tools"
        if isinstance(last, ToolMessage):
            for m in reversed(messages):
                if isinstance(m, AIMessage) and m.tool_calls:
                    return "agent"
    return "persist"


async def _persist_node(state: AgentState, config) -> AgentState:
    client: BackendClient = config["configurable"]["client"]
    settings: Settings = config["configurable"]["settings"]

    actions = state.get("actions_taken", [])
    messages = state.get("messages", [])
    resolved = []
    has_send = False
    for act in actions:
        status = act.get("status", "called")
        if status == "pending":
            for m in reversed(messages):
                if isinstance(m, ToolMessage) and m.tool_call_id == act.get("id"):
                    status = "success" if not str(m.content).startswith("error:") else "error"
                    break
        if act.get("tool") == "send_message" and status == "success":
            has_send = True
        resolved.append({**act, "status": status})

    if not has_send and messages:
        for m in reversed(messages):
            if isinstance(m, AIMessage) and m.content and not m.tool_calls:
                try:
                    lead_id = state["lead_id"]
                    channel = state.get("channel", "WHATSAPP")
                    tenant_id = state.get("tenant_id", "")
                    guard = await client.check_auto_send(tenant_id, lead_id)
                    if guard.get("allowed", True):
                        await client.send_message(lead_id, channel, str(m.content), None)
                        resolved.append({"tool": "send_message", "args": {"text": str(m.content)[:100]}, "status": "auto"})
                    else:
                        logger.info("auto_send_blocked", reason=guard.get("reason", "guardrail"), lead_id=lead_id)
                except Exception:
                    pass
                break

    try:
        await client.post_run_summary({
            "runId": state.get("run_id", ""),
            "leadId": state["lead_id"],
            "actions": resolved,
            "model": settings.agent_model,
            "startedAt": state.get("started_at", utc_now_iso()),
            "finishedAt": utc_now_iso(),
        })
    except Exception:
        pass
    return state
