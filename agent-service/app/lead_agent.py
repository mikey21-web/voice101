from __future__ import annotations

import asyncio
from typing import Any

from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, ToolMessage

from app.schemas import AgentState
from app.config import Settings, resolve_llm_credentials
from app.backend_client import BackendClient
from app.tools import build_tools, ToolContext, HIGH_IMPACT_TOOLS
from app.prompt import build_system_prompt
from app.niche_config import normalize_niche_config, load_niche_config_from_file
from app.logging_config import utc_now_iso
from app.config_runtime import runtime_config

MAX_HISTORY_MESSAGES = 20


def build_lead_graph(tools: list, settings: Settings, client: BackendClient):
    graph = StateGraph(AgentState)
    _tool_node = ToolNode(tools)

    async def _tools_node(state: AgentState, config) -> dict:
        # Now that operator tools (campaigns, payments, bulk send, email) are merged
        # into this graph's tool set too, a manipulated conversation can't walk one
        # through unconfirmed: split those out and stub a pending-approval ToolMessage
        # instead of letting ToolNode actually execute them, mirroring operator_voice_node.
        messages = state.get("messages", [])
        last = messages[-1] if messages else None
        tool_calls = list(getattr(last, "tool_calls", None) or [])

        def _name(tc):
            return tc.get("name") if isinstance(tc, dict) else tc.name

        def _id(tc):
            return tc.get("id") if isinstance(tc, dict) else tc.id

        high_impact_calls = [tc for tc in tool_calls if _name(tc) in HIGH_IMPACT_TOOLS]
        normal_calls = [tc for tc in tool_calls if _name(tc) not in HIGH_IMPACT_TOOLS]

        actions_taken = state.get("actions_taken", [])
        new_messages: list = []

        if high_impact_calls:
            for tc in high_impact_calls:
                tc_id = _id(tc)
                new_messages.append(ToolMessage(
                    content=f"pending confirmation: {_name(tc)} requires human approval",
                    tool_call_id=tc_id,
                ))
                for a in actions_taken:
                    if a.get("id") == tc_id:
                        a["status"] = "pending_confirmation"

        if normal_calls:
            patched_last = last.copy(update={"tool_calls": normal_calls})
            patched_state = {**state, "messages": messages[:-1] + [patched_last]}
            result = await _tool_node.ainvoke(patched_state)
            result_messages = result.get("messages", result) if isinstance(result, dict) else list(result)
            new_messages.extend(result_messages)

        return {
            "messages": messages + new_messages,
            "actions_taken": actions_taken,
            "terminate": True if high_impact_calls else state.get("terminate", False),
        }

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

    # webhooks.service.ts saves the inbound message to the DB before triggering this
    # run, so it's already the last entry in prior_messages — appending it again as
    # incoming would show the model the same line twice.
    already_logged = bool(prior_messages) and incoming and prior_messages[-1]["role"] == "user" and prior_messages[-1]["text"] == incoming

    # A lead with no conversation history yet is talking to Mikey for the first time —
    # without this, the model just answers whatever they said (e.g. "hey") without ever
    # naming itself or the business, which reads as a generic, uninformed reply.
    if len(prior_messages) <= 1:
        lc_messages.append(SystemMessage(content=(
            f"This is {{lead}}'s very first message to you, ever — you have never spoken before. "
            f"Before anything else, naturally work into your reply who you are (Mikey) and that you're "
            f"with {nich.get('display_name', 'this business')}, then respond to what they actually said. "
            f"Keep it in one warm, casual message, not a formal announcement."
        ).replace("{lead}", lead.get("contact", {}).get("name", "they"))))

    if incoming and not already_logged:
        lc_messages.append(HumanMessage(content=incoming))
    elif not incoming and state.get("trigger") == "lead_created":
        lc_messages.append(HumanMessage(content="A new lead was created. Introduce yourself and start the conversation."))
    elif not prior_messages:
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

    if not settings.deepseek_api_key and not settings.openai_api_key:
        raise RuntimeError("Neither DEEPSEEK_API_KEY nor OPENAI_API_KEY configured")
    api_key, base_url, model_name, supports_reasoning_effort = resolve_llm_credentials(settings)
    model = ChatOpenAI(
        model=model_name,
        max_tokens=settings.agent_max_tokens,
        api_key=api_key,
        base_url=base_url,
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
