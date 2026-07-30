import pytest
import httpx
import respx
from app.backend_client import BackendClient
from app.tools import build_tools, ToolContext
from app.config import Settings


@pytest.fixture
def tool_ctx():
    s = Settings(
        backend_api_url="http://test:3001",
        agent_service_jwt="test-jwt",
        anthropic_api_key="test-key",
    )
    client = BackendClient(s)
    return ToolContext(client=client, lead_id="lead-1", tenant_id="tenant-1")


@pytest.mark.asyncio
async def test_send_message_ok(tool_ctx):
    tools = build_tools(tool_ctx)
    send_msg = next(t for t in tools if t.name == "send_message")
    with respx.mock:
        respx.post("http://test:3001/conversations/messages").mock(
            return_value=httpx.Response(201, json={"id": "msg-1"})
        )
        result = await send_msg.ainvoke({"text": "Hello"})
    assert result == "ok: message sent"


@pytest.mark.asyncio
async def test_tool_returns_error_on_failure(tool_ctx):
    tools = build_tools(tool_ctx)
    send_msg = next(t for t in tools if t.name == "send_message")
    with respx.mock:
        respx.post("http://test:3001/conversations/messages").mock(
            return_value=httpx.Response(500, json={"message": "down"})
        )
        result = await send_msg.ainvoke({"text": "Hello"})
    assert result.startswith("error:")


@pytest.mark.asyncio
async def test_extract_fields(tool_ctx):
    tools = build_tools(tool_ctx)
    ef = next(t for t in tools if t.name == "extract_fields")
    with respx.mock:
        respx.get("http://test:3001/leads/lead-1").mock(
            return_value=httpx.Response(200, json={"id": "lead-1", "metadata": {}})
        )
        respx.patch("http://test:3001/leads/lead-1").mock(
            return_value=httpx.Response(200, json={"ok": True})
        )
        # extract_fields re-scores the lead after saving (see the comment above that
        # call in tools.py) — a real, deliberate follow-up request, not something
        # this test can leave unmocked.
        respx.post("http://test:3001/leads/lead-1/score").mock(
            return_value=httpx.Response(200, json={"score": 42, "segment": "warm"})
        )
        result = await ef.ainvoke({"fields": [{"key": "email", "value": "a@b.com"}]})
    assert result.startswith("ok:")


@pytest.mark.asyncio
async def test_mark_lost(tool_ctx):
    tools = build_tools(tool_ctx)
    ml = next(t for t in tools if t.name == "mark_lost")
    with respx.mock:
        respx.patch("http://test:3001/leads/lead-1").mock(
            return_value=httpx.Response(200, json={"status": "LOST"})
        )
        result = await ml.ainvoke({"reason": "not interested"})
    assert "LOST" in result or "ok:" in result


@pytest.mark.asyncio
async def test_book_appointment(tool_ctx):
    tools = build_tools(tool_ctx)
    ba = next(t for t in tools if t.name == "book_appointment")
    with respx.mock:
        respx.post("http://test:3001/leads/lead-1/conversions").mock(
            return_value=httpx.Response(201, json={"id": "conv-1"})
        )
        result = await ba.ainvoke({"booking_type": "Consultation"})
    assert "appointment" in result or "ok:" in result
