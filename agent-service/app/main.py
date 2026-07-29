from __future__ import annotations

import asyncio
import json
import sys
import uuid as _uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, BackgroundTasks, HTTPException, Header
from fastapi.responses import StreamingResponse

from app.logging_config import setup_logging, new_run_id
from app.config import Settings
from app.schemas import AgentRunRequest, AgentRunResponse
from app.runner import execute_run, execute_run_and_get_response
from app.config_runtime import runtime_config
from app.idempotency import init as idempotency_init, close as idempotency_close

import httpx
import structlog

logger = structlog.get_logger()
settings = Settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    await idempotency_init(settings.redis_url)

    if not settings.agent_inbound_key:
        logger.error("agent_inbound_key_not_set", help="Set AGENT_INBOUND_KEY in environment")
        sys.exit(1)

    if not settings.deepseek_api_key:
        logger.error("deepseek_api_key_not_set", help="Set DEEPSEEK_API_KEY in environment")
        sys.exit(1)

    logger.info("agent_service_started", model=settings.agent_model)
    yield
    await idempotency_close()
    logger.info("agent_service_stopped")


app = FastAPI(title="AI Lead Agent Service", version="1.0.0", lifespan=lifespan)

# Runs are dispatched as fire-and-forget background tasks per inbound message, so two
# messages arriving close together for the same lead (e.g. "/start" then "Hi") would
# otherwise run concurrently, each reading the same empty history and independently
# generating its own greeting, both getting sent. Serialize per lead so the second run
# always sees the first one's reply already in history.
# ponytail: grows one entry per distinct lead for the process lifetime, never evicted.
# Fine at demo scale; switch to an LRU or TTL cache if lead volume gets large.
_lead_locks: dict[str, asyncio.Lock] = {}


def _lock_for(lead_id: str) -> asyncio.Lock:
    lock = _lead_locks.get(lead_id)
    if lock is None:
        lock = asyncio.Lock()
        _lead_locks[lead_id] = lock
    return lock


async def _retry_execute_run(settings: Settings, req: AgentRunRequest) -> None:
    """Run execute_run with a single retry on failure."""
    async with _lock_for(req.leadId):
        try:
            await execute_run(settings, req)
        except Exception:
            logger.exception("execute_run_failed_first_attempt", lead_id=req.leadId)
            try:
                await asyncio.sleep(2)
                await execute_run(settings, req)
            except Exception:
                logger.exception("execute_run_failed_retry", lead_id=req.leadId)


@app.post("/agent/run", response_model=AgentRunResponse, status_code=202)
async def agent_run(req: AgentRunRequest, background_tasks: BackgroundTasks, x_agent_key: str = Header(None)):
    if settings.agent_inbound_key and x_agent_key != settings.agent_inbound_key:
        raise HTTPException(status_code=401, detail="Invalid agent key")

    run_id = new_run_id()

    background_tasks.add_task(_retry_execute_run, settings, req)

    return AgentRunResponse(accepted=True, runId=run_id)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/health/deep")
async def health_deep(x_agent_key: str = Header(None)):
    if settings.agent_inbound_key and x_agent_key != settings.agent_inbound_key:
        raise HTTPException(status_code=401, detail="Invalid agent key")
    checks = {}
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{settings.backend_api_url.rstrip('/')}/health")
            checks["backend"] = "ok" if r.status_code == 200 else f"HTTP {r.status_code}"
    except Exception as e:
        checks["backend"] = f"error: {e}"

    checks["model_key_present"] = bool(settings.deepseek_api_key)
    checks["model"] = settings.agent_model

    return {
        "status": "ok" if checks.get("backend") == "ok" and checks["model_key_present"] else "degraded",
        "checks": checks,
    }


@app.post("/agent/config")
async def agent_config(body: dict, x_agent_key: str = Header(None)):
    """Receive agent config from the NestJS backend dashboard."""
    if settings.agent_inbound_key and x_agent_key != settings.agent_inbound_key:
        raise HTTPException(status_code=401, detail="Invalid agent key")

    from app.config_runtime import runtime_config as rc

    rc.update(body)
    logger.info("agent_config_updated", keys=list(body.keys()))
    return {"status": "ok", "accepted": list(body.keys())}


@app.get("/agent/config")
async def agent_get_config(x_agent_key: str = Header(None)):
    """Return the current runtime agent config."""
    if settings.agent_inbound_key and x_agent_key != settings.agent_inbound_key:
        raise HTTPException(status_code=401, detail="Invalid agent key")
    return runtime_config


@app.post("/agent/chat")
async def agent_chat(req: AgentRunRequest, x_agent_key: str = Header(None)):
    """Synchronous chat endpoint — runs the agent and returns the response."""
    if settings.agent_inbound_key and x_agent_key != settings.agent_inbound_key:
        raise HTTPException(status_code=401, detail="Invalid agent key")

    try:
        response_text = await asyncio.wait_for(
            execute_run_and_get_response(settings, req),
            timeout=25.0,
        )
        return {"response": response_text}
    except asyncio.TimeoutError:
        logger.warning("agent_chat_timeout", lead_id=req.leadId)
        return await _agent_test_response_fallback(req.messageText or "")


async def _build_copilot_run(body: dict):
    """Shared setup for /agent/copilot/chat and its streaming twin: builds the LangChain
    message history, a BackendClient/MemoryClient pair, the compiled supervisor graph, and
    the initial graph state. Callers own closing client/memory and building the per-call
    `config` dict (the streaming endpoint needs to add a stream_callback the non-streaming
    one doesn't)."""
    from app.supervisor_graph import build_supervisor
    from app.backend_client import BackendClient
    from app.memory_client import MemoryClient
    from app.schemas import SharedMikeyState
    from app.logging_config import utc_now_iso
    from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

    tenant_id = body.get("tenantId", "default")
    message = body.get("message", "")
    conversation_history = body.get("conversationHistory", [])
    business_settings = body.get("businessSettings", {})
    khoj_context = body.get("khojContext", "")
    memory_context = body.get("memoryContext", "")
    benchmark_context = body.get("benchmarkContext", "")

    messages_lc = []
    for msg in conversation_history:
        role = msg.get("role", "")
        content = msg.get("content", "")
        if role == "user":
            messages_lc.append(HumanMessage(content=content))
        elif role == "assistant":
            messages_lc.append(AIMessage(content=content))
        elif role == "tool":
            messages_lc.append(ToolMessage(content=content, tool_call_id=msg.get("tool_call_id", "")))
    messages_lc.append(HumanMessage(content=message))

    client = BackendClient(settings)
    # Without a real MemoryClient, the copilot/voice path never sees active
    # procedural rules (things Mikey has learned from reflexion) — this was
    # the one channel where memory never fired, even though the same rules
    # already flow into lead_voice conversations via runner.py.
    memory = MemoryClient(settings, tenant_id)
    graph = build_supervisor(settings=settings, client=client, tenant_id=tenant_id, memory=memory)

    initial_state: SharedMikeyState = {
        "tenant_id": tenant_id,
        "lead_id": f"copilot-{tenant_id}",
        "trigger": "copilot_chat",
        "channel": "DASHBOARD",
        "messages": messages_lc,
        "incoming_text": message,
        "copilot_context": {
            "business_name": business_settings.get("businessName", ""),
            "industry": business_settings.get("industry", ""),
            "tone_examples": business_settings.get("toneExamples", []),
            "goals": business_settings.get("goals", []),
            "compliance": business_settings.get("compliance", []),
            "khoj_context": khoj_context,
            "memory_context": memory_context,
            "benchmark_context": benchmark_context,
        },
        "run_id": str(_uuid.uuid4()),
        "started_at": utc_now_iso(),
    }

    return client, memory, graph, initial_state, tenant_id


def _extract_response_and_actions(final_state: dict) -> tuple[str, list[dict]]:
    # OpenAI models routinely return prose *and* a tool call (e.g. navigate_ui) in the
    # same message, unlike DeepSeek which tends to separate them into different turns —
    # requiring an absence of tool_calls here silently dropped that prose to "Done."
    # Streamed turns also produce AIMessageChunk (type "AIMessageChunk"), not AIMessage
    # (type "ai") — checking only "ai" silently dropped every streamed reply too.
    response_text = ""
    for m in reversed(final_state.get("messages", [])):
        if getattr(m, "type", None) in ("ai", "AIMessageChunk") and m.content:
            response_text = m.content
            break

    if not response_text:
        response_text = "Done."

    actions = []
    for a in final_state.get("actions_taken", []):
        tool_name = a.get("tool", "")
        if not tool_name:
            continue
        status = "pending" if a.get("status") == "pending_confirmation" else a.get("status", "success")
        actions.append({
            "tool": tool_name,
            "args": a.get("args", {}),
            "status": status,
            "result": a.get("result", ""),
        })
    return response_text, actions


@app.post("/agent/copilot/chat")
async def agent_copilot_chat(body: dict, x_agent_key: str = Header(None)):
    """Unified copilot chat — routes staff dashboard queries through the supervisor graph."""
    if settings.agent_inbound_key and x_agent_key != settings.agent_inbound_key:
        raise HTTPException(status_code=401, detail="Invalid agent key")

    client, memory, graph, initial_state, tenant_id = await _build_copilot_run(body)
    try:
        config = {
            "configurable": {
                "settings": settings,
                "client": client,
                "thread_id": f"copilot-{tenant_id}",
            },
        }
        final_state = await graph.ainvoke(initial_state, config)
        response_text, actions = _extract_response_and_actions(final_state)
        return {"response": response_text, "actions": actions}

    except Exception:
        logger.exception("copilot_chat_failed")
        return {"response": "I'm having trouble connecting to the AI service. Please try again.", "actions": []}
    finally:
        await client.close()
        await memory.close()


@app.post("/agent/copilot/chat/stream")
async def agent_copilot_chat_stream(body: dict, x_agent_key: str = Header(None)):
    """Same as /agent/copilot/chat, but relays text deltas as Server-Sent Events while the
    graph runs (see operator_voice_node's streaming branch in supervisor_graph.py), instead
    of waiting for the whole reply. Final frame carries the same {response, actions} shape
    the non-streaming endpoint returns in one shot."""
    if settings.agent_inbound_key and x_agent_key != settings.agent_inbound_key:
        raise HTTPException(status_code=401, detail="Invalid agent key")

    client, memory, graph, initial_state, tenant_id = await _build_copilot_run(body)

    async def event_stream():
        # A queue bridges the graph's plain async/await execution (graph.ainvoke runs to
        # completion, it doesn't yield mid-run) to this generator: the streamed token
        # callback and the final result both just push onto the same queue, this generator
        # only has to drain it in order.
        queue: asyncio.Queue = asyncio.Queue()
        DONE = object()

        def on_token(text: str):
            queue.put_nowait({"type": "token", "text": text})

        config = {
            "configurable": {
                "settings": settings,
                "client": client,
                "thread_id": f"copilot-{tenant_id}",
                "stream_callback": on_token,
            },
        }

        async def run_graph():
            try:
                final_state = await graph.ainvoke(initial_state, config)
                response_text, actions = _extract_response_and_actions(final_state)
                queue.put_nowait({"type": "done", "response": response_text, "actions": actions})
            except Exception:
                logger.exception("copilot_chat_stream_failed")
                queue.put_nowait({"type": "error", "message": "I'm having trouble connecting to the AI service. Please try again."})
            finally:
                queue.put_nowait(DONE)

        task = asyncio.create_task(run_graph())
        try:
            while True:
                item = await queue.get()
                if item is DONE:
                    break
                yield f"data: {json.dumps(item)}\n\n"
        finally:
            await task
            await client.close()
            await memory.close()

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/agent/test")
async def agent_test(body: dict, x_agent_key: str = Header(None)):
    """Test endpoint that returns a response without running full agent."""
    if settings.agent_inbound_key and x_agent_key != settings.agent_inbound_key:
        raise HTTPException(status_code=401, detail="Invalid agent key")

    return await _agent_test_response_fallback(body.get("message", ""))


async def _agent_test_response_fallback(message: str = ""):
    biz_name = runtime_config.get("businessName", "our service")
    industry = runtime_config.get("industry", "this space")
    tone = runtime_config.get("toneStyle", "professional")
    custom_prompt = runtime_config.get("customPrompt", "")
    questions = runtime_config.get("qualificationQuestions", [])

    question_hint = ""
    if questions:
        question_hint = f" You might want to ask about {questions[0].lower()}."

    if custom_prompt:
        response = custom_prompt.replace("{message}", message).replace("{businessName}", biz_name).replace("{industry}", industry)
    else:
        response = (
            f"Hey! Thanks for reaching out to {biz_name}. "
            f"I'd love to help you out. "
            f"{'We specialize in ' + industry + '.' if industry else ''} "
            f"{question_hint} "
            f"What's on your mind?"
        )

    return {"response": response, "config": {"tone": tone, "businessName": biz_name}}
