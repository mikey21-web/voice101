from __future__ import annotations

import asyncio
import uuid
from typing import Any

from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, ToolMessage
from langchain_core.runnables import RunnableConfig

from app.config import Settings, resolve_llm_credentials
from app.supervisor_graph import _get_langfuse_callbacks
from app.schemas import AgentState
from app.backend_client import BackendClient, BackendError
from app.niche_config import normalize_niche_config, load_niche_config_from_file
from app.prompt import build_system_prompt
from app.logging_config import utc_now_iso
from app.config_runtime import runtime_config

import structlog

logger = structlog.get_logger()

MAX_HISTORY_MESSAGES = 20


def build_graph(tools: list, settings: Settings, client: BackendClient):
    graph = StateGraph(AgentState)
    _tool_node = ToolNode(tools)

    async def _tools_node(state: AgentState, config: RunnableConfig) -> dict:
        result = await _tool_node.ainvoke(state)
        new_messages = result.get("messages", result) if isinstance(result, dict) else list(result)
        return {"messages": state.get("messages", []) + list(new_messages)}

    graph.add_node("load_context", _load_context)
    graph.add_node("agent", _agent_node)
    graph.add_node("tools", _tools_node)
    graph.add_node("persist", _persist_node)

    graph.set_entry_point("load_context")
    graph.add_edge("load_context", "agent")
    graph.add_conditional_edges(
        "agent",
        _should_continue,
        {"tools": "tools", "persist": "persist"},
    )
    graph.add_edge("tools", "agent")
    graph.add_edge("persist", END)

    return graph.compile()


async def _load_context(state: AgentState, config: RunnableConfig) -> AgentState:
    client: BackendClient = config["configurable"]["client"]

    lead_id = state["lead_id"]
    nich = state.get("niche_config")

    try:
        lead, conversations = await asyncio.gather(
            client._get(f"/leads/{lead_id}"),
            client._get(f"/leads/{lead_id}/conversations"),
        )
        niche_raw = load_niche_config_from_file()
    except BackendError as e:
        if e.status in (401, 403):
            logger.error("load_context_auth_failed", status=e.status, endpoint=e.endpoint)
            raise
        logger.error("load_context_failed", error=str(e))
        lead = {"id": lead_id, "status": "NEW", "score": 0, "segment": "COLD", "contact": {}}
        conversations = []
        niche_raw = {}
    except Exception as e:
        logger.error("load_context_failed", error=str(e))
        lead = {"id": lead_id, "status": "NEW", "score": 0, "segment": "COLD", "contact": {}}
        conversations = []
        niche_raw = {}

    if not nich:
        nich = niche_raw if niche_raw and "display_name" in niche_raw else normalize_niche_config(niche_raw)

    # Merge dashboard runtime config into niche config for prompt
    rc = runtime_config or {}
    if rc.get("businessName"):
        nich["display_name"] = rc["businessName"]
    if rc.get("industry"):
        nich["industry"] = rc["industry"]
    if rc.get("qualificationQuestions"):
        nich["qualification_questions"] = rc["qualificationQuestions"]
    if rc.get("toneStyle"):
        nich["tone_style"] = rc["toneStyle"]
    if rc.get("customPrompt"):
        nich["custom_prompt"] = rc["customPrompt"]

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
        if pm["role"] == "user":
            lc_messages.append(HumanMessage(content=pm["text"]))
        else:
            lc_messages.append(AIMessage(content=pm["text"]))

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

    # Propagate features to tool context so tools can check feature flags
    ctx_ = config["configurable"].get("ctx")
    if ctx_:
        ctx_.features = nich.get("features", {})
    state["steps"] = 0
    state["actions_taken"] = []
    state["terminate"] = False

    return state


async def _agent_node(state: AgentState, config: RunnableConfig) -> AgentState:
    settings: Settings = config["configurable"]["settings"]

    tools = config["configurable"]["tools"]

    if not settings.deepseek_api_key and not settings.openai_api_key:
        raise RuntimeError("Neither DEEPSEEK_API_KEY nor OPENAI_API_KEY configured — agent cannot run")
    api_key, base_url, model_name, supports_reasoning_effort = resolve_llm_credentials(settings)
    _lf_callbacks = _get_langfuse_callbacks(settings)
    model = ChatOpenAI(
        model=model_name,
        max_tokens=settings.agent_max_tokens,
        api_key=api_key,
        base_url=base_url,
        model_kwargs={"reasoning_effort": settings.agent_reasoning_effort} if supports_reasoning_effort else {},
        callbacks=_lf_callbacks if _lf_callbacks else None,
    ).bind_tools(tools)

    msg_types = [f"{type(m).__name__}(tool_calls={hasattr(m,'tool_calls') and bool(m.tool_calls)})" for m in state["messages"]]
    has_tool = any(isinstance(m, ToolMessage) for m in state["messages"])
    logger.warning("agent_node_call", msg_types=msg_types, has_tool_msg=has_tool, msg_count=len(state["messages"]))

    try:
        response = await model.ainvoke(state["messages"])
    except Exception as e:
        logger.error("agent_model_error", error=str(e), error_type=type(e).__name__,
                     lead_id=state.get("lead_id"), tenant_id=state.get("tenant_id"))
        response = AIMessage(
            content="Thanks for reaching out! I'll be right with you.",
            tool_calls=[],
        )

    has_content = bool(response.content)
    has_tc = bool(response.tool_calls) if hasattr(response, "tool_calls") else False
    content_preview = str(response.content)[:200] if response.content else "(empty)"
    logger.warning("agent_model_response", has_content=has_content, has_tool_calls=has_tc, content_preview=content_preview)

    # Fallback: if model returned empty content with no tool calls, use a generic hold message
    if not has_content and not has_tc:
        logger.warning("agent_empty_response_fallback", lead_id=state.get("lead_id"))
        response = AIMessage(
            content="Thanks for reaching out! I'll be right with you.",
            tool_calls=[],
        )

    state["messages"].append(response)
    state["steps"] = state.get("steps", 0) + 1

    if hasattr(response, "tool_calls") and response.tool_calls:
        for tc in response.tool_calls:
            state["actions_taken"].append({
                "id": tc.get("id", ""),
                "tool": tc.get("name", ""),
                "args": tc.get("args", {}),
                "status": "pending",
            })

    return state


def _should_continue(state: AgentState, config: RunnableConfig) -> str:
    messages = state.get("messages", [])
    settings: Settings = config["configurable"]["settings"]
    max_steps = settings.max_agent_steps

    if state.get("terminate"):
        return "persist"

    if state.get("steps", 0) >= max_steps:
        return "persist"

    if messages:
        last = messages[-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            for tc in last.tool_calls:
                name = tc.get("name", "")
                if name in ("escalate_to_human", "mark_lost"):
                    state["terminate"] = True
                    return "persist"

                send_count = sum(1 for a in state.get("actions_taken", []) if a.get("tool") == "send_message")
                if name == "send_message" and send_count >= 5:
                    state["terminate"] = True
                    return "persist"

            return "tools"

        # After tool results: if last AI msg had tool_calls, let it respond in text
        if isinstance(last, ToolMessage):
            for m in reversed(messages):
                if isinstance(m, AIMessage):
                    if m.tool_calls:
                        return "agent"
                    break

    return "persist"


async def _persist_node(state: AgentState, config: RunnableConfig) -> AgentState:
    client: BackendClient = config["configurable"]["client"]
    settings: Settings = config["configurable"]["settings"]
    run_id = state.get("run_id", str(uuid.uuid4()))

    # Resolve tool execution results from ToolMessages
    actions = state.get("actions_taken", [])
    messages = state.get("messages", [])
    resolved_actions = []
    has_send = False
    for act in actions:
        result_status = act.get("status", "called")
        if result_status == "pending":
            for mi in range(len(messages) - 1, -1, -1):
                if isinstance(messages[mi], ToolMessage) and messages[mi].tool_call_id == act.get("id"):
                    result_status = "success" if not (hasattr(messages[mi], "content") and str(messages[mi].content).startswith("error:")) else "error"
                    break
        if act.get("tool") == "send_message" and result_status == "success":
            has_send = True
        resolved_actions.append({**act, "status": result_status})

    # Auto-send last text-only AI response if no send_message was called
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
                        resolved_actions.append({"tool": "send_message", "args": {"text": str(m.content)[:100]}, "status": "auto"})
                    else:
                        logger.info("auto_send_blocked", reason=guard.get("reason", "guardrail"), lead_id=lead_id)
                except Exception as e:
                    logger.warning("auto_send_failed", error=str(e))
                break

    started_at = state.get("started_at", utc_now_iso())

    try:
        await client.post_run_summary({
            "runId": run_id,
            "leadId": state["lead_id"],
            "actions": resolved_actions,
            "model": settings.agent_model,
            "startedAt": started_at,
            "finishedAt": utc_now_iso(),
        })
    except Exception as e:
        logger.warning("persist_failed", error=str(e))

    return state
