from __future__ import annotations

import uuid as _uuid
import os

import structlog

from app.config import Settings
from app.schemas import AgentRunRequest, SharedMikeyState
from app.backend_client import BackendClient
from app.supervisor_graph import build_supervisor
from app.memory_client import MemoryClient, MemoryEntry
from app.lead_agent import build_lead_graph
from app.tools import build_tools, ToolContext
from app.logging_config import utc_now_iso
from app.idempotency import already_processed, mark_processing, mark_done
from app.khoj_client import KhojClient

logger = structlog.get_logger()

USE_SUPERVISOR = os.environ.get("MIKEY_USE_SUPERVISOR", "true").lower() == "true"
USE_CHECKPOINTING = os.environ.get("MIKEY_USE_CHECKPOINTING", "true").lower() == "true"
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/virtual-assistant")


async def _build_checkpointer() -> tuple[object | None, str | None]:
    """Best-effort Postgres checkpointer. Returns (None, error) if Postgres is
    unreachable or setup fails — the caller surfaces the error in the run
    summary so a persistent outage is visible in ops, not just agent-service logs."""
    if not USE_CHECKPOINTING:
        return None, None
    try:
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
        from psycopg_pool import AsyncConnectionPool
        # autocommit=True is required: checkpointer.setup() runs CREATE INDEX
        # CONCURRENTLY, which Postgres refuses to run inside a transaction block.
        pool = AsyncConnectionPool(DATABASE_URL, min_size=1, max_size=4, kwargs={"autocommit": True}, open=False)
        await pool.open()
        await pool.wait()
        checkpointer = AsyncPostgresSaver(pool)
        await checkpointer.setup()
        await checkpointer.aget_tuple({"configurable": {"thread_id": "probe"}})
        logger.info("checkpointer_enabled", db_url=DATABASE_URL.split("@")[-1] if "@" in DATABASE_URL else "local")
        return checkpointer, None
    except Exception as e:
        error = f"{type(e).__name__}: {e}"
        logger.error("checkpointer_failed_fallback_to_none", error=str(e), error_type=type(e).__name__)
        return None, error


async def execute_run(settings: Settings, req: AgentRunRequest) -> str:
    run_id = req.triggerId or str(_uuid.uuid4())
    started_at = utc_now_iso()

    if await already_processed(req.triggerId):
        logger.info("run_skipped_duplicate", triggerId=req.triggerId)
        return run_id

    acquired = await mark_processing(req.triggerId)
    if not acquired:
        logger.info("run_skipped_concurrent", triggerId=req.triggerId)
        return run_id

    logger.info("run_started", leadId=req.leadId, trigger=req.trigger, supervisor=USE_SUPERVISOR)

    client = BackendClient(settings)
    memory = MemoryClient(settings, req.tenantId)
    khoj = KhojClient(settings) if settings.khoj_api_url else None
    ctx = ToolContext(client=client, lead_id=req.leadId, tenant_id=req.tenantId, channel=req.channel)

    checkpointer_error: str | None = None
    try:
        if USE_SUPERVISOR:
            checkpointer, checkpointer_error = await _build_checkpointer()

            graph = build_supervisor(
                settings=settings,
                client=client,
                tenant_id=req.tenantId,
                memory=memory,
                checkpointer=checkpointer,
            )

            initial_state: SharedMikeyState = {
                "tenant_id": req.tenantId,
                "lead_id": req.leadId,
                "trigger_id": req.triggerId,
                "channel": req.channel,
                "trigger": req.trigger,
                "incoming_text": req.messageText,
                "run_id": run_id,
                "started_at": started_at,
            }

            # Stable per-conversation thread so the checkpointer (when up) actually
            # accumulates state across turns instead of starting a fresh thread every run.
            config = {
                "configurable": {
                    "settings": settings,
                    "client": client,
                    "thread_id": f"{req.tenantId}:{req.leadId}",
                },
            }
            final_state = await graph.ainvoke(initial_state, config)
        else:
            tools = build_tools(ctx)
            graph = build_lead_graph(tools=tools, settings=settings, client=client)

            initial_state = {
                "tenant_id": req.tenantId,
                "lead_id": req.leadId,
                "trigger_id": req.triggerId,
                "channel": req.channel,
                "trigger": req.trigger,
                "incoming_text": req.messageText,
                "run_id": run_id,
                "started_at": started_at,
            }

            config = {
                "configurable": {
                    "settings": settings,
                    "client": client,
                    "tools": tools,
                    "ctx": ctx,
                },
            }
            final_state = await graph.ainvoke(initial_state, config)

        logger.info("run_completed", leadId=req.leadId)
        if checkpointer_error:
            logger.error("run_completed_degraded_no_checkpointing", leadId=req.leadId, reason=checkpointer_error)
            try:
                await memory.store(MemoryEntry(
                    type="EPISODIC",
                    key=f"checkpointer_failure:{req.tenantId}:{started_at}",
                    value=f"Checkpointer failed — conversation state not persisted for lead {req.leadId}. Error: {checkpointer_error}",
                    source="system",
                    lead_id=req.leadId,
                ))
            except Exception:
                pass
        await mark_done(req.triggerId, success=True)

        if memory and final_state:
            messages = final_state.get("messages", [])
            ai_messages = [m for m in messages if hasattr(m, "type") and m.type == "ai"]
            if ai_messages:
                summary = (
                    f"## Agent Conversation Summary\n\n"
                    f"- **Lead ID**: {req.leadId}\n"
                    f"- **Tenant**: {req.tenantId}\n"
                    f"- **Channel**: {req.channel}\n"
                    f"- **Trigger**: {req.trigger}\n"
                    f"- **Incoming**: {req.messageText[:500]}\n\n"
                )
                for i, m in enumerate(ai_messages[-3:]):
                    content = (m.content or "")[:500]
                    summary += f"### AI Response {i+1}\n{content}\n\n"
                await memory.store(MemoryEntry(
                    type="EPISODIC",
                    key=f"conversation:{req.leadId}:{started_at}",
                    value=summary,
                    source="supervisor",
                    lead_id=req.leadId,
                ))

    except Exception as e:
        logger.error("run_failed", error=str(e), error_type=type(e).__name__, leadId=req.leadId)
        await mark_done(req.triggerId, success=False)
    finally:
        await client.close()

    return run_id


async def execute_run_and_get_response(settings: Settings, req: AgentRunRequest) -> str:
    run_id = req.triggerId or str(_uuid.uuid4())
    started_at = utc_now_iso()
    response_text = ""

    client = BackendClient(settings)
    memory = MemoryClient(settings, req.tenantId)
    khoj = KhojClient(settings) if settings.khoj_api_url else None
    ctx = ToolContext(client=client, lead_id=req.leadId, tenant_id=req.tenantId, channel=req.channel)

    checkpointer_error: str | None = None
    try:
        if USE_SUPERVISOR:
            checkpointer, checkpointer_error = await _build_checkpointer()

            graph = build_supervisor(
                settings=settings,
                client=client,
                tenant_id=req.tenantId,
                memory=memory,
                checkpointer=checkpointer,
                khoj=khoj,
            )

            initial_state: SharedMikeyState = {
                "tenant_id": req.tenantId,
                "lead_id": req.leadId,
                "trigger_id": req.triggerId,
                "channel": req.channel,
                "trigger": req.trigger,
                "incoming_text": req.messageText,
                "run_id": run_id,
                "started_at": started_at,
            }

            # Stable per-conversation thread so the checkpointer (when up) actually
            # accumulates state across turns instead of starting a fresh thread every run.
            config = {
                "configurable": {
                    "settings": settings,
                    "client": client,
                    "thread_id": f"{req.tenantId}:{req.leadId}",
                },
            }
            final_state = await graph.ainvoke(initial_state, config)
        else:
            tools = build_tools(ctx)
            original_send = None
            for t in tools:
                if t.name == "send_message":
                    original_send = t
                    break

            if original_send:
                async def send_message_wrapper(message_text: str) -> str:
                    nonlocal response_text
                    response_text = message_text
                    return await original_send.coroutine(message_text)

                import langchain_core.tools as lc_tools
                for i, t in enumerate(tools):
                    if t.name == "send_message":
                        tools[i] = lc_tools.StructuredTool(
                            name="send_message", description=t.description,
                            coroutine=send_message_wrapper,
                        )

            from app.lead_agent import build_lead_graph
            graph = build_lead_graph(tools=tools, settings=settings, client=client)

            initial_state = {
                "tenant_id": req.tenantId, "lead_id": req.leadId,
                "trigger_id": req.triggerId, "channel": req.channel,
                "trigger": req.trigger, "incoming_text": req.messageText,
                "run_id": run_id, "started_at": started_at,
            }

            config = {
                "configurable": {
                    "settings": settings, "client": client, "tools": tools, "ctx": ctx,
                },
            }
            final_state = await graph.ainvoke(initial_state, config)

            if not response_text and final_state:
                messages = final_state.get("messages", [])
                for msg in reversed(messages):
                    if hasattr(msg, "type") and msg.type == "ai" and msg.content:
                        response_text = msg.content
                        break

        if not response_text and final_state:
            messages = final_state.get("messages", [])
            for msg in reversed(messages):
                if hasattr(msg, "type") and msg.type == "ai" and msg.content:
                    response_text = msg.content
                    break

        if not response_text:
            response_text = "Thanks for reaching out! I'm here to help. What can I assist you with today?"

        if checkpointer_error:
            logger.error("run_completed_degraded_no_checkpointing", leadId=req.leadId, reason=checkpointer_error)

        return response_text

    except Exception as e:
        logger.error("sync_chat_failed", error=str(e), leadId=req.leadId)
        return "I appreciate your patience! Let me connect you with a team member who can help."
    finally:
        await client.close()
