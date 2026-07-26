import re
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from langchain_core.tools import tool
from app.backend_client import BackendClient, BackendError


@dataclass
class ToolContext:
    client: BackendClient
    lead_id: str
    tenant_id: str
    channel: str = "WHATSAPP"
    features: dict = None


def _ok(msg: str) -> str:
    return f"ok: {msg}"


def _err(msg: str) -> str:
    return f"error: {msg}"


def _clean_text(text: str) -> str:
    """Model instruction ("never use em dashes") isn't reliably obeyed, so enforce it
    deterministically here instead of trusting the prompt. Every outgoing message/caption
    routes through this."""
    if not text:
        return text
    text = text.replace('—', ', ').replace('–', ', ')
    return re.sub(r' {2,}', ' ', text)


def build_tools(ctx: ToolContext) -> list:
    @tool
    async def send_message(text: str, template_id: str | None = None):
        """Send a message to the lead. Use to reply conversationally or follow up."""
        try:
            await ctx.client.send_message(ctx.lead_id, ctx.channel, _clean_text(text), template_id)
            return _ok("message sent")
        except BackendError as e:
            return _err(str(e))

    @tool
    async def extract_fields(fields: list[dict]):
        """Save facts the lead revealed. fields: [{"key":"email","value":"a@b.com"}, ...]"""
        try:
            if not isinstance(fields, list):
                return _err("fields must be a list")
            field_map = {}
            for f in fields:
                if not isinstance(f, dict):
                    continue
                k = str(f.get("key", "")).strip()
                v = str(f.get("value", ""))
                if not k or len(k) > 100:
                    continue
                if len(v) > 5000:
                    v = v[:5000]
                field_map[k] = v
            if not field_map:
                return _err("no valid fields to store")
            await ctx.client.update_custom_fields(ctx.lead_id, field_map)
            return _ok(f"stored {len(field_map)} field(s)")
        except BackendError as e:
            return _err(str(e))

    @tool
    async def update_score():
        """Re-score the lead based on scoring rules in the backend."""
        try:
            result = await ctx.client.update_score(ctx.lead_id)
            return _ok(f"score={result.get('score', '?')}, segment={result.get('segment', '?')}")
        except BackendError as e:
            return _err(str(e))

    @tool
    async def update_status(status: str):
        """Move the lead to a new pipeline stage (NEW, QUALIFIED, LOST, etc.)"""
        try:
            await ctx.client.update_status(ctx.lead_id, status)
            return _ok(f"status \u2192 {status}")
        except BackendError as e:
            return _err(str(e))

    @tool
    async def set_segment(segment: str):
        """Tag the lead as HOT, WARM, COLD, or UNQUALIFIED."""
        try:
            await ctx.client.set_segment(ctx.lead_id, segment)
            return _ok(f"segment \u2192 {segment}")
        except BackendError as e:
            return _err(str(e))

    @tool
    async def assign_agent(reason: str):
        """Route this lead to a human sales agent. Use when the lead asks for a human or needs specialist help."""
        try:
            await ctx.client.assign_agent(ctx.lead_id)
            await ctx.client.create_task(ctx.lead_id, f"Escalation: {reason}", "high")
            return _ok(f"assigned \u2014 {reason}")
        except BackendError as e:
            return _err(str(e))

    @tool
    async def create_task(title: str, due_in_hours: int | None = None):
        """Create a follow-up task for this lead."""
        try:
            due_at = None
            if due_in_hours:
                due_at = (datetime.now(timezone.utc) + timedelta(hours=due_in_hours)).isoformat()
            await ctx.client.create_task(ctx.lead_id, title, "medium", due_at)
            return _ok(f"task created: {title}")
        except BackendError as e:
            return _err(str(e))

    @tool
    async def book_appointment(booking_type: str, start_time: str | None = None, description: str | None = None):
        """Book an appointment / consultation for the lead. If start_time is provided, creates a real booking. Otherwise records a conversion request."""
        try:
            has_booking = ctx.features and ctx.features.get("booking")
            if start_time and has_booking:
                result = await ctx.client.create_booking(ctx.lead_id, f"{booking_type} - {ctx.lead_id}", start_time, description=description)
                return _ok(f"booking created: {result.get('id', '')} at {start_time}")
            await ctx.client.book_appointment(ctx.lead_id, booking_type)
            return _ok(f"appointment requested: {booking_type}")
        except BackendError as e:
            return _err(str(e))

    @tool
    async def check_availability(start_time: str, duration_minutes: int = 60):
        """Check if a time slot is available for booking. Returns available slots and conflicts."""
        if not (ctx.features and ctx.features.get("booking")):
            return _err("booking feature is not enabled for this niche")
        try:
            result = await ctx.client.check_availability(start_time, duration_minutes)
            if result.get("available"):
                return _ok(f"slot available at {start_time}")
            conflicts = result.get("conflicts", [])
            return _err(f"slot not available: {len(conflicts)} conflict(s)")
        except BackendError as e:
            return _err(str(e))

    @tool
    async def create_payment_link(booking_id: str):
        """Generate a payment link for an existing booking. Call after the booking is created and confirmed."""
        if not (ctx.features and ctx.features.get("booking")):
            return _err("booking feature is not enabled for this niche")
        try:
            result = await ctx.client.create_booking_payment_link(booking_id)
            url = result.get("url", "")
            return _ok(f"payment link: {url}")
        except BackendError as e:
            return _err(str(e))

    @tool
    async def schedule_follow_up(days_from_now: int = 7, message: str = ""):
        """Schedule a follow-up message to be sent later. Use when the lead needs time to decide."""
        try:
            due = (datetime.now(timezone.utc) + timedelta(days=days_from_now)).isoformat()
            title = f"Follow up: {message[:100]}" if message else "Follow up with lead"
            await ctx.client.create_task(ctx.lead_id, title, "medium", due)
            return _ok(f"follow-up scheduled in {days_from_now} day(s)")
        except BackendError as e:
            return _err(str(e))

    @tool
    async def push_to_crm():
        """Push this qualified lead to the CRM."""
        try:
            await ctx.client.push_to_crm(ctx.lead_id)
            return _ok("pushed to CRM")
        except BackendError as e:
            return _err(str(e))

    @tool
    async def record_conversion(destination: str):
        """Record a conversion (use: QUOTE_REQUEST, PURCHASE_ONLINE, BOOKING_MADE). Call ONLY ONE per run."""
        try:
            await ctx.client.record_conversion(ctx.lead_id, destination)
            return _ok(f"conversion recorded: {destination}")
        except BackendError as e:
            return _err(str(e))

    @tool
    async def mark_lost(reason: str):
        """Mark the lead as LOST and terminate the conversation. Provide a reason."""
        try:
            if not reason or reason.strip() == "":
                reason = "unspecified"
            await ctx.client.update_status(ctx.lead_id, "LOST")
            await ctx.client.set_segment(ctx.lead_id, "UNQUALIFIED")
            return _ok(f"marked lost \u2014 {reason}")
        except BackendError as e:
            return _err(str(e))

    @tool
    async def escalate_to_human(reason: str):
        """Escalate to a human agent. Call this then STOP — do not call send_message after this."""
        try:
            await ctx.client.assign_agent(ctx.lead_id)
            await ctx.client.create_task(ctx.lead_id, f"Escalation: {reason}", "high")
            return _ok(f"escaped \u2014 {reason}")
        except BackendError as e:
            return _err(str(e))

    @tool
    async def get_quote(origin: str, destination: str, weight: float, shipment_type: str = "FTL", cargo_type: str = "GENERAL"):
        """Generate a shipment quote based on origin, destination, weight, shipment type, and cargo type. Returns price and transit time."""
        if not (ctx.features and ctx.features.get("shipments")):
            return _err("shipments feature is not enabled for this niche")
        try:
            result = await ctx.client.get_quote(origin, destination, weight, shipment_type, cargo_type)
            total = result.get("total", 0)
            transit = result.get("estimatedTransitTime", "N/A")
            return _ok(f"Quote: \u20B9{total:,.2f} | Transit: {transit} | Route: {origin} \u2192 {destination} | Weight: {weight}kg")
        except BackendError as e:
            return _err(str(e))

    @tool
    async def create_shipment(origin: str, destination: str, weight: float, shipment_type: str = "FTL", cargo_type: str = "GENERAL", pickup_date: str = "", notes: str = ""):
        """Create a shipment record after the lead accepts the quote. Provide origin, destination, weight, shipment type, cargo type, and optionally pickup date."""
        if not (ctx.features and ctx.features.get("shipments")):
            return _err("shipments feature is not enabled for this niche")
        try:
            quote = await ctx.client.get_quote(origin, destination, weight, shipment_type, cargo_type)
            price = quote.get("total", 0)
            result = await ctx.client.create_shipment(ctx.lead_id, origin, destination, weight, shipment_type, cargo_type, price, pickup_date or None, notes or None)
            tracking = result.get("trackingNumber", "")
            return _ok(f"Shipment created! Tracking: {tracking} | Amount: \u20B9{price:,.2f} | Route: {origin} \u2192 {destination}")
        except BackendError as e:
            return _err(str(e))

    @tool
    async def update_shipment_status(shipment_id: str, status: str, notes: str = "", location: str = ""):
        """Update the status of a shipment by its ID. Use status values: PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, EXCEPTION. The shipment_id is returned by create_shipment."""
        if not (ctx.features and ctx.features.get("shipments")):
            return _err("shipments feature is not enabled for this niche")
        try:
            result = await ctx.client.update_shipment_status(shipment_id, status, notes or None, location or None)
            return _ok(f"Status updated to {status}")
        except BackendError as e:
            return _err(str(e))

    @tool
    async def create_event_draft(event_type: str, title: str, event_date: str = "", venue: str = "", expected_guests: int = 0, budget: float = 0, description: str = ""):
        """Create a draft event record in the system. Use when the lead confirms they want to proceed with event planning. Provide event type, title for the event, and optionally date, venue, guest count, budget."""
        if not (ctx.features and ctx.features.get("booking")):
            return _err("booking feature is not enabled for this niche")
        try:
            result = await ctx.client.create_event(
                ctx.tenant_id, ctx.lead_id, title or f"{event_type} Event",
                event_type, event_date or None, venue or None,
                expected_guests or None, budget or None, description or None,
            )
            return _ok(f"Event draft created: {result.get('id', '')} — {title}")
        except BackendError as e:
            return _err(str(e))

    @tool
    async def search_properties(location: str = "", budget_max: float = 0, bedrooms: int = 0, property_type: str = ""):
        """Search available property listings. Search matching properties by location, max budget, bedrooms, or property type. Returns matching listings with title, price, location, bedrooms, and features."""
        if not (ctx.features and ctx.features.get("properties")):
            return _err("properties feature is not enabled for this niche")
        try:
            query = {}
            if location: query["location"] = location
            if budget_max > 0: query["maxPrice"] = budget_max
            if bedrooms > 0: query["bedrooms"] = bedrooms
            if property_type: query["propertyType"] = property_type.upper()
            results = await ctx.client.search_properties(ctx.tenant_id, query)
            if not results:
                return _ok("no properties found matching your criteria")
            summary = "\n".join(
                f"- {p['title']} | \u20B9{p.get('price', 'N/A')} | {p.get('location', '')} | {p.get('bedrooms', '?')}BHK"
                for p in results[:5]
            )
            return _ok(f"found {len(results)} properties:\n{summary}")
        except BackendError as e:
            return _err(str(e))

    @tool
    async def send_options(question: str, options: list[str]):
        """Ask the lead a closed-set question as tappable buttons instead of typing it out (e.g. "Buy or Rent?", "Which type: Apartment, Villa, Plot?", "Budget: Under 50L, 50L-1Cr, 1Cr+"). Use this for any question where the answer is one of a small fixed set of choices — it's faster and less error-prone for the lead than typing. Sends up to 10 options; on WhatsApp 3 or fewer render as buttons, more as a tappable list. Whatever they tap comes back to you as a normal text reply with that option's label, so just keep the conversation going as usual."""
        try:
            # WhatsApp caps button titles at 20 chars, list row titles at 24.
            title_limit = 20 if len(options) <= 3 else 24
            opts = [{"id": o[:title_limit], "title": o[:title_limit]} for o in options[:10]]
            await ctx.client.send_message(ctx.lead_id, ctx.channel, question, options=opts)
            return _ok(f"sent {len(opts)} option(s) for: {question}")
        except BackendError as e:
            return _err(str(e))

    @tool
    async def send_listing_link(property_id: str):
        """Send the lead a shareable listing page link for one property (photos, price, description, brochure all in one page they can browse or forward). Use this instead of, or in addition to, raw photos once the lead shows real interest in a specific property — a link is easier for them to revisit and share than loose chat images."""
        if not (ctx.features and ctx.features.get("properties")):
            return _err("properties feature is not enabled for this niche")
        try:
            url = await ctx.client.get_property_public_link(property_id)
            if not url:
                return _err("could not generate a listing link for this property")
            await ctx.client.send_message(ctx.lead_id, ctx.channel, f"Here's the full listing: {url}")
            return _ok(f"sent listing link: {url}")
        except BackendError as e:
            return _err(str(e))

    @tool
    async def send_listing_collection(property_ids: list[str]):
        """Send the lead one shareable link bundling 2-3 properties together (a "collection") when they're comparing several options rather than fixed on one. Use instead of calling send_listing_link repeatedly for each — one link, all the properties, easier for the lead to browse and forward. Sends at most 6 properties."""
        if not (ctx.features and ctx.features.get("properties")):
            return _err("properties feature is not enabled for this niche")
        try:
            url = await ctx.client.get_property_collection_link(property_ids[:6])
            if not url:
                return _err("could not generate a collection link")
            await ctx.client.send_message(ctx.lead_id, ctx.channel, f"Here are the options together: {url}")
            return _ok(f"sent collection link: {url}")
        except BackendError as e:
            return _err(str(e))

    @tool
    async def send_property_photos(property_ids: list[str]):
        """Send photos of one or more properties to the lead over WhatsApp, each with a caption (title, price, location). Use after search_properties finds good matches and the lead seems interested. Sends at most 2 photos per property and 3 properties per call to avoid spamming."""
        if not (ctx.features and ctx.features.get("properties")):
            return _err("properties feature is not enabled for this niche")
        sent = 0
        errors = []
        for prop_id in property_ids[:3]:
            try:
                prop = await ctx.client.get_property(prop_id)
                images = (prop.get("images") or [])[:2]
                caption = f"{prop.get('title', 'Property')} | ₹{prop.get('price', 'N/A')} | {prop.get('location', '')}"
                if not images:
                    await ctx.client.send_message(ctx.lead_id, ctx.channel, caption)
                    sent += 1
                    continue
                for img in images:
                    await ctx.client.send_message(
                        ctx.lead_id, ctx.channel, caption,
                        media_url=img.get("url"), media_type="image", caption=caption,
                    )
                    sent += 1
            except BackendError as e:
                errors.append(f"{prop_id}: {e}")
        if sent == 0:
            return _err(f"no photos sent; errors: {'; '.join(errors) or 'unknown'}")
        return _ok(f"sent {sent} photo(s) across {len(property_ids[:3])} propert(y/ies)" + (f" (errors: {'; '.join(errors)})" if errors else ""))

    @tool
    async def send_unit_photos(unit_ids: list[str]):
        """Send photos/floor-plans/brochures for one or more units to the lead over WhatsApp, each with a caption (unit number, type, price, floor). Use after search_units finds good matches. Falls back to the project's brochure images since individual units don't have their own photos. Sends at most 2 images per unit and 3 units per call to avoid spamming."""
        if not (ctx.features and ctx.features.get("projects")):
            return _err("project/unit inventory is not enabled for this niche")
        sent = 0
        errors = []
        for unit_id in unit_ids[:3]:
            try:
                unit = await ctx.client.get_unit(unit_id)
                project = unit.get("project") or {}
                images = (project.get("images") or [])[:2]
                caption = (
                    f"Unit {unit.get('unitNumber', '?')} ({project.get('name', '')}) | "
                    f"{unit.get('unitType', '')} | ₹{unit.get('price', 'N/A')} | Floor {unit.get('floor', '?')}"
                )
                if not images:
                    await ctx.client.send_message(ctx.lead_id, ctx.channel, caption)
                    sent += 1
                    continue
                for img in images:
                    img_url = img.get("url") if isinstance(img, dict) else img
                    await ctx.client.send_message(
                        ctx.lead_id, ctx.channel, caption,
                        media_url=img_url, media_type="image", caption=caption,
                    )
                    sent += 1
            except BackendError as e:
                errors.append(f"{unit_id}: {e}")
        if sent == 0:
            return _err(f"no photos sent; errors: {'; '.join(errors) or 'unknown'}")
        return _ok(f"sent {sent} photo(s) across {len(unit_ids[:3])} unit(s)" + (f" (errors: {'; '.join(errors)})" if errors else ""))

    @tool
    async def send_area_collection(area: str, max_properties: int = 3):
        """Send a curated collection of photos and brochures for all available properties in an area/locality to the lead over WhatsApp. Use when the lead asks about a neighborhood broadly (e.g. "what do you have in Whitefield") rather than one specific listing. Sends one primary photo plus brochure (if available) per property, for up to 3 properties in that area."""
        if not (ctx.features and ctx.features.get("properties")):
            return _err("properties feature is not enabled for this niche")
        try:
            results = await ctx.client.search_properties(ctx.tenant_id, {"location": area})
        except BackendError as e:
            return _err(str(e))
        if not results:
            return _ok(f"no properties found in {area}")

        limit = max(1, min(max_properties, 5))
        sent = 0
        errors = []
        for prop in results[:limit]:
            try:
                full = await ctx.client.get_property(prop["id"])
                caption = _clean_text(f"{full.get('title', 'Property')} | ₹{full.get('price', 'N/A')} | {full.get('location', '')}")
                images = (full.get("images") or [])[:1]
                if images:
                    await ctx.client.send_message(
                        ctx.lead_id, ctx.channel, caption,
                        media_url=images[0].get("url"), media_type="image", caption=caption,
                    )
                else:
                    await ctx.client.send_message(ctx.lead_id, ctx.channel, caption)
                sent += 1
                if full.get("brochureUrl"):
                    brochure_caption = _clean_text(f"{full.get('title', 'Property')} brochure")
                    await ctx.client.send_message(
                        ctx.lead_id, ctx.channel, brochure_caption,
                        media_url=full["brochureUrl"], media_type="document", caption=brochure_caption,
                    )
                    sent += 1
            except BackendError as e:
                errors.append(f"{prop.get('id', '?')}: {e}")
        if sent == 0:
            return _err(f"no items sent; errors: {'; '.join(errors) or 'unknown'}")
        return _ok(
            f"sent collection for {area}: {sent} item(s) across {len(results[:limit])} propert(y/ies)"
            + (f" (errors: {'; '.join(errors)})" if errors else "")
        )

    @tool
    async def search_media_file(query: str):
        """Search uploaded media files (images, brochures, floor plans, documents) by filename or tag. Use when the lead asks about specific visuals, photos, or documents related to a project, property, or unit. Returns matching file names and IDs."""
        try:
            results = await ctx.client.search_media(ctx.tenant_id, query)
            if not results:
                return _ok("no media files found matching your query")
            summary = "\n".join(
                f"- {m.get('originalName', '?')} (id: {m.get('id', '?')}) | {m.get('fileType', '')} | {m.get('tags', [])}"
                for m in results[:10]
            )
            return _ok(f"found {len(results)} media file(s):\n{summary}")
        except BackendError as e:
            return _err(str(e))

    @tool
    async def send_media_file(media_id: str, caption: str = ""):
        """Send a specific media file (image, brochure, floor plan, etc.) to the lead over WhatsApp. Use after search_media_file finds the matching file. Provide the media_id from the search results and an optional caption. Sends the image with the caption."""
        try:
            media = await ctx.client.get_media_download_url(media_id)
            url = media.get("url")
            if not url:
                return _err("could not get download URL for this media file")
            mime = media.get("mimeType") or ""
            if mime.startswith("image/"):
                media_type = "image"
            elif mime.startswith("video/"):
                media_type = "video"
            elif mime.startswith("audio/"):
                media_type = "audio"
            else:
                media_type = "document"
            display_caption = _clean_text(caption) or "Here is the file you asked about"
            await ctx.client.send_message(
                ctx.lead_id, ctx.channel, display_caption,
                media_url=url, media_type=media_type, caption=display_caption,
            )
            return _ok(f"sent media file to lead")
        except BackendError as e:
            return _err(str(e))

    @tool
    async def search_units(project_id: str | None = None, unit_type: str | None = None, budget_max: float = 0, min_area: float = 0):
        """Search available units across builder projects (Project -> Tower -> Unit inventory, distinct from standalone Property listings). Filter by project, unit type (e.g. '2BHK'), max budget, or min area. Returns unit number, tower, floor, price, and status."""
        if not (ctx.features and ctx.features.get("projects")):
            return _err("project/unit inventory is not enabled for this niche")
        try:
            query: dict = {"status": "AVAILABLE"}
            if project_id: query["projectId"] = project_id
            if unit_type: query["unitType"] = unit_type
            if budget_max > 0: query["maxPrice"] = budget_max
            if min_area > 0: query["minArea"] = min_area
            results = await ctx.client.search_units(query)
            if not results:
                return _ok("no available units found matching your criteria")
            summary = "\n".join(
                f"- Unit {u.get('unitNumber', '?')} ({u.get('project', {}).get('name', '')}"
                f"{', ' + u['tower']['name'] if u.get('tower') else ''}) | "
                f"{u.get('unitType', '')} | ₹{u.get('price', 'N/A')} | {u.get('areaSqft', '?')} sqft"
                for u in results[:5]
            )
            return _ok(f"found {len(results)} available units:\n{summary}")
        except BackendError as e:
            return _err(str(e))

    return [
        send_message,
        extract_fields,
        update_score,
        update_status,
        set_segment,
        assign_agent,
        create_task,
        book_appointment,
        check_availability,
        create_payment_link,
        schedule_follow_up,
        push_to_crm,
        record_conversion,
        mark_lost,
        escalate_to_human,
        send_options,
        search_properties,
        search_units,
        send_listing_link,
        send_listing_collection,
        send_property_photos,
        send_unit_photos,
        send_area_collection,
        search_media_file,
        send_media_file,
        get_quote,
        create_shipment,
        update_shipment_status,
        create_event_draft,
    ]
