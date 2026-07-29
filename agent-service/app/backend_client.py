from __future__ import annotations

from typing import Any, Coroutine
import re
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception
from app.config import Settings


def strip_dashes(text: str) -> str:
    """The "never use em/en dashes" prompt rule isn't reliably obeyed by the model, and
    several send paths (tools, supervisor auto-send, flow runtime) reach the backend
    independently. This is the one choke point every outbound message passes through,
    so enforce it here rather than trusting each caller to remember."""
    if not text:
        return text
    return re.sub(r' {2,}', ' ', text.replace('—', ', ').replace('–', ', '))


class BackendError(Exception):
    def __init__(self, status: int, message: str, endpoint: str):
        self.status = status
        self.message = message
        self.endpoint = endpoint
        super().__init__(f"Backend {endpoint}: [{status}] {message}")


def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, (httpx.TimeoutException, httpx.ConnectError)):
        return True
    if isinstance(exc, BackendError) and (exc.status == 409 or exc.status >= 500):
        return True
    return False


class BackendClient:
    def __init__(self, settings: Settings):
        self.base = settings.backend_api_url.rstrip("/")
        self.service_key = settings.agent_service_jwt
        self.timeout = settings.request_timeout_seconds
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(self.timeout),
            headers={
                "x-service-key": self.service_key,
                "Content-Type": "application/json",
            },
        )

    async def close(self):
        await self.client.aclose()

    def _retry_get(self, url: str) -> Coroutine[Any, Any, dict]:
        @retry(
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=0.5, min=0.5, max=5),
            retry=retry_if_exception(_is_retryable),
            reraise=True,
        )
        async def _do_get():
            return await self._get(url)
        return _do_get()

    def _retry_post(self, url: str, body: dict | None = None) -> Coroutine[Any, Any, dict]:
        @retry(
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=0.5, min=0.5, max=5),
            retry=retry_if_exception(_is_retryable),
            reraise=True,
        )
        async def _do_post():
            return await self._post(url, body)
        return _do_post()

    def _retry_patch(self, url: str, body: dict) -> Coroutine[Any, Any, dict]:
        @retry(
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=0.5, min=0.5, max=5),
            retry=retry_if_exception(_is_retryable),
            reraise=True,
        )
        async def _do_patch():
            return await self._patch(url, body)
        return _do_patch()

    async def _get(self, path: str) -> dict:
        r = await self.client.get(f"{self.base}{path}")
        if r.status_code >= 400:
            msg = "unknown"
            try:
                msg = r.json().get("message", r.text)
            except Exception:
                pass
            raise BackendError(r.status_code, msg, path)
        return r.json()

    async def _post(self, path: str, body: dict | None = None) -> dict:
        r = await self.client.post(f"{self.base}{path}", json=body or {})
        if r.status_code >= 400:
            msg = "unknown"
            try:
                msg = r.json().get("message", r.text)
            except Exception:
                pass
            raise BackendError(r.status_code, msg, path)
        return r.json()

    async def _patch(self, path: str, body: dict) -> dict:
        r = await self.client.patch(f"{self.base}{path}", json=body)
        if r.status_code >= 400:
            msg = "unknown"
            try:
                msg = r.json().get("message", r.text)
            except Exception:
                pass
            raise BackendError(r.status_code, msg, path)
        return r.json()

    async def get_lead(self, lead_id: str) -> dict:
        return await self._retry_get(f"/leads/{lead_id}")

    async def get_lead_timeline(self, lead_id: str) -> dict:
        return await self._retry_get(f"/leads/{lead_id}/timeline")

    async def get_conversation(self, lead_id: str) -> list:
        return await self._retry_get(f"/leads/{lead_id}/conversations")

    async def get_niche_config(self, client_key: str = "default") -> dict:
        return await self._retry_get(f"/niche-templates/client/current?clientKey={client_key}")

    async def send_message(
        self,
        lead_id: str,
        channel: str,
        text: str,
        template_id: str | None = None,
        media_url: str | None = None,
        media_type: str | None = None,
        caption: str | None = None,
        options: list[dict] | None = None,
    ) -> dict:
        text = strip_dashes(text)
        caption = strip_dashes(caption) if caption else caption
        body = {
            "leadId": lead_id,
            "channel": channel,
            "direction": "OUTBOUND",
            "text": text,
        }
        if template_id:
            body["messageTemplateId"] = template_id
        if media_url and media_type:
            body["metadata"] = {"mediaUrl": media_url, "mediaType": media_type, "caption": caption or text}
        if options:
            body["metadata"] = {**(body.get("metadata") or {}), "options": options}
        return await self._retry_post("/conversations/messages", body)

    async def update_custom_fields(self, lead_id: str, fields: dict) -> dict:
        """Extracted {key: value} pairs that match one of this tenant's LEAD custom-field
        definitions (by key, e.g. "property_type", "budget_range") get written as real
        custom_field_values rows — what the CRM's Custom Fields panel actually reads.
        Anything left over still goes into lead.metadata so it isn't silently dropped."""
        try:
            defs_resp = await self._retry_get("/custom-fields/definitions?target=LEAD")
            key_to_id = {d["key"]: d["id"] for d in defs_resp.get("data", [])}
        except Exception:
            key_to_id = {}

        matched = {k: v for k, v in fields.items() if k in key_to_id}
        unmatched = {k: v for k, v in fields.items() if k not in key_to_id}

        if matched:
            values = [{"definitionId": key_to_id[k], "value": v} for k, v in matched.items()]
            await self._retry_post(f"/custom-fields/values/lead/{lead_id}", {"values": values})

        if unmatched:
            r = await self._retry_get(f"/leads/{lead_id}")
            current_meta = dict(r.get("metadata") or {})
            current_meta.update(unmatched)
            await self._retry_patch(f"/leads/{lead_id}", {"metadata": current_meta})

        return {"matchedFields": list(matched.keys()), "unmatchedFields": list(unmatched.keys())}

    async def update_score(self, lead_id: str) -> dict:
        return await self._retry_post(f"/leads/{lead_id}/score")

    async def update_status(self, lead_id: str, status: str) -> dict:
        return await self._retry_patch(f"/leads/{lead_id}", {"status": status})

    async def set_segment(self, lead_id: str, segment: str) -> dict:
        return await self._retry_patch(f"/leads/{lead_id}", {"segment": segment})

    async def assign_agent(self, lead_id: str, agent_id: str | None = None) -> dict:
        body = {"agentId": agent_id} if agent_id else {}
        return await self._retry_post(f"/leads/{lead_id}/assign", body)

    async def create_task(self, lead_id: str, title: str, priority: str = "medium", due_at: str | None = None) -> dict:
        body = {"title": title, "priority": priority, "leadId": lead_id}
        if due_at:
            body["dueAt"] = due_at
        return await self._retry_post("/tasks", body)

    async def book_appointment(self, lead_id: str, booking_type: str) -> dict:
        return await self._retry_post(f"/leads/{lead_id}/conversions", {
            "destination": "APPOINTMENT_BOOKING",
            "metadata": {"bookingType": booking_type},
        })

    async def push_to_crm(self, lead_id: str) -> dict:
        return await self._retry_post(f"/leads/{lead_id}/conversions", {
            "destination": "CRM_QUALIFIED_PUSH",
        })

    async def record_conversion(self, lead_id: str, destination: str) -> dict:
        return await self._retry_post(f"/leads/{lead_id}/conversions", {
            "destination": destination,
        })

    async def check_auto_send(self, tenant_id: str, lead_id: str) -> dict:
        return await self._retry_get(f"/mikey/guardrails/auto-send/{tenant_id}/{lead_id}")

    async def post_run_summary(self, payload: dict) -> dict:
        return await self._retry_post("/agent/run-summary", payload)

    async def check_availability(self, start_time: str, duration_minutes: int = 60) -> dict:
        return await self._retry_post("/bookings/check-availability", {
            "startTime": start_time,
            "durationMinutes": duration_minutes,
        })

    async def create_booking(self, lead_id: str, title: str, start_time: str, end_time: str | None = None,
                             description: str | None = None, price: float | None = None) -> dict:
        body = {
            "leadId": lead_id,
            "title": title,
            "startTime": start_time,
        }
        if end_time: body["endTime"] = end_time
        if description: body["description"] = description
        if price is not None: body["price"] = price
        return await self._retry_post(f"/leads/{lead_id}/bookings", body)

    async def create_booking_payment_link(self, booking_id: str) -> dict:
        return await self._retry_post(f"/bookings/{booking_id}/payment-link")

    async def get_quote(self, origin: str, destination: str, weight: float, shipment_type: str = "FTL", cargo_type: str = "GENERAL") -> dict:
        return await self._retry_post("/shipments/quote", {
            "origin": origin, "destination": destination, "weight": weight,
            "shipmentType": shipment_type, "cargoType": cargo_type,
        })

    async def create_shipment(self, lead_id: str, origin: str, destination: str, weight: float, shipment_type: str, cargo_type: str, quoted_price: float, pickup_date: str | None = None, notes: str | None = None) -> dict:
        body = {
            "leadId": lead_id, "origin": origin, "destination": destination,
            "weight": weight, "shipmentType": shipment_type, "cargoType": cargo_type,
            "quotedPrice": quoted_price,
        }
        if pickup_date: body["pickupDate"] = pickup_date
        if notes: body["notes"] = notes
        return await self._retry_post(f"/leads/{lead_id}/shipments", body)

    async def update_shipment_status(self, shipment_id: str, status: str, notes: str | None = None, location: str | None = None) -> dict:
        body = {"status": status}
        if notes: body["notes"] = notes
        if location: body["location"] = location
        return await self._retry_patch(f"/shipments/{shipment_id}/status", body)

    async def create_event(self, tenant_id: str, lead_id: str, title: str, event_type: str, event_date: str | None = None,
                           venue: str | None = None, expected_guests: int | None = None, budget: float | None = None,
                           description: str | None = None) -> dict:
        body = {
            "tenantId": tenant_id, "leadId": lead_id,
            "title": title, "type": event_type,
        }
        if event_date: body["eventDate"] = event_date
        if venue: body["venue"] = venue
        if expected_guests: body["expectedGuests"] = expected_guests
        if budget: body["budget"] = budget
        if description: body["description"] = description
        return await self._retry_post("/events-ops", body)

    async def search_media(self, tenant_id: str, query: str, project_id: str | None = None) -> list:
        q = 'q=' + query
        if project_id:
            q += '&projectId=' + project_id
        result = await self._retry_get('/media/search/ai?' + q)
        return result if isinstance(result, list) else []

    async def get_media_download_url(self, media_id: str) -> dict:
        result = await self._get('/media/' + media_id + '/download-url')
        data = result.get('data', result)
        return {'url': data.get('url', ''), 'mimeType': data.get('mimeType', '')}

    async def search_properties(self, tenant_id: str, query: dict) -> list:
        params = [f"tenantId={tenant_id}"]
        for k, v in query.items():
            if v is not None:
                params.append(f"{k}={v}")
        result = await self._retry_get(f"/properties/search?{'&'.join(params)}")
        return result if isinstance(result, list) else result.get("data", [])

    async def get_property_public_link(self, property_id: str) -> str:
        result = await self._get(f"/properties/{property_id}/public-link")
        data = result.get('data', result)
        return data.get('url', '')

    async def get_property_collection_link(self, property_ids: list[str]) -> str:
        result = await self._post("/properties/collection-link", {"propertyIds": property_ids})
        data = result.get('data', result)
        return data.get('url', '')

    async def get_property(self, property_id: str) -> dict:
        return await self._retry_get(f"/properties/{property_id}")

    async def get_unit(self, unit_id: str) -> dict:
        return await self._retry_get(f"/units/{unit_id}")

    async def search_units(self, query: dict) -> list:
        params = [f"{k}={v}" for k, v in query.items() if v is not None]
        result = await self._retry_get(f"/units?{'&'.join(params)}")
        return result.get("data", []) if isinstance(result, dict) else result

    async def create_workflow(self, name: str, tenant_id: str, tags: list[str] | None = None) -> dict:
        return await self._retry_post("/workflows", {"name": name, "tags": tags or []})

    async def get_workflow(self, workflow_id: str) -> dict:
        return await self._retry_get(f"/workflows/{workflow_id}")

    async def list_workflows(self) -> dict:
        return await self._retry_get("/workflows")

    async def create_workflow_version(self, workflow_id: str, steps: list[dict], edges: list[dict], triggers: list[dict] | None = None) -> dict:
        return await self._retry_post(f"/workflows/{workflow_id}/versions", {
            "steps": steps, "edges": edges, "triggers": triggers or [],
        })

    async def publish_workflow(self, workflow_id: str) -> dict:
        return await self._retry_post(f"/workflows/{workflow_id}/publish")
