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


# --- Phase 3: buyer-facing money-trail tools ---

@pytest.fixture
def realestate_ctx():
    s = Settings(
        backend_api_url="http://test:3001",
        agent_service_jwt="test-jwt",
        anthropic_api_key="test-key",
    )
    return ToolContext(
        client=BackendClient(s), lead_id="lead-1", tenant_id="tenant-1",
        features={"projects": True},
    )


def test_money_tools_are_approval_gated():
    """A price commitment or a stock block must never run on model say-so."""
    from app.tools import HIGH_IMPACT_TOOLS
    assert "generate_cost_sheet" in HIGH_IMPACT_TOOLS
    assert "hold_unit" in HIGH_IMPACT_TOOLS


@pytest.mark.asyncio
async def test_generate_cost_sheet(realestate_ctx):
    tools = build_tools(realestate_ctx)
    tool = next(t for t in tools if t.name == "generate_cost_sheet")
    with respx.mock:
        respx.post("http://test:3001/cost-sheets").mock(
            return_value=httpx.Response(201, json={"id": "cs-1"})
        )
        result = await tool.ainvoke({"unit_id": "u-1", "project_id": "p-1"})
    assert result.startswith("ok:")
    assert "cs-1" in result


@pytest.mark.asyncio
async def test_hold_unit(realestate_ctx):
    tools = build_tools(realestate_ctx)
    tool = next(t for t in tools if t.name == "hold_unit")
    with respx.mock:
        respx.post("http://test:3001/unit-holds").mock(
            return_value=httpx.Response(201, json={"id": "h-1"})
        )
        result = await tool.ainvoke({"unit_id": "u-1", "hold_hours": 48})
    assert "48h" in result


@pytest.mark.asyncio
async def test_inventory_tools_off_for_non_project_niches(tool_ctx):
    """A broker niche has no Project->Tower->Unit inventory to price or hold."""
    tools = build_tools(tool_ctx)
    tool = next(t for t in tools if t.name == "hold_unit")
    result = await tool.ainvoke({"unit_id": "u-1"})
    assert result.startswith("error:")


@pytest.mark.asyncio
async def test_payment_status_with_no_schedule(realestate_ctx):
    tools = build_tools(realestate_ctx)
    tool = next(t for t in tools if t.name == "payment_status")
    with respx.mock:
        respx.get("http://test:3001/payment-schedules?leadId=lead-1").mock(
            return_value=httpx.Response(200, json=[])
        )
        result = await tool.ainvoke({})
    assert "no payment schedule" in result


@pytest.mark.asyncio
async def test_loan_status_reports_backend_value(realestate_ctx):
    tools = build_tools(realestate_ctx)
    tool = next(t for t in tools if t.name == "loan_status")
    with respx.mock:
        respx.get("http://test:3001/bookings/b-1/loan-registration").mock(
            return_value=httpx.Response(200, json={"status": "SANCTIONED"})
        )
        result = await tool.ainvoke({"booking_id": "b-1"})
    assert "SANCTIONED" in result
