# n8n → In-App Workflow Engine Migration Plan

## Strategy: No rush, co-exist until parity

The in-app engine (Phase 1+2) already covers most n8n capabilities. Each n8n
workflow gets rebuilt as an in-app WorkflowDefinition with triggers, steps, and
edges — then tested side-by-side before decommissioning the n8n copy.

## Workflow-by-Workflow Mapping

### 1. Lead Intake (webhook trigger)
n8n: Universal webhook → validate → store via backend API  
In-app: `MANUAL` / `WEBHOOK` trigger + `CREATE_RECORD(Lead)` + `HTTP_REQUEST`  
Status: ✅ Buildable now (CREATE_RECORD + HTTP_REQUEST exist)

### 2. WhatsApp Incoming (webhook trigger)  
n8n: WhatsApp webhook → normalize → store message → auto-reply  
In-app: Handled by agent-service (lead_voice) — n8n only exists for failover  
Status: ✅ Already in-app (agent-service handles this)

### 3. Send Message (called by other workflows)
n8n: Render template → send via WhatsApp/Email → log  
In-app: `SEND_MESSAGE` + `SEND_EMAIL` actions  
Status: ✅ Buildable now

### 4. Follow-up Runner (cron schedule)
n8n: Every 15min → fetch due steps → execute  
In-app: `CRON` trigger + `SCHEDULED` trigger in engine  
Status: ✅ Buildable now (trigger service checks every minute)

### 5. Hot Lead Alert (DB event)
n8n: On `lead.hot` event → fetch lead → notify agent  
In-app: `DB_EVENT` trigger (table: lead, event: STATUS_CHANGED, filters: {segment: "HOT"}) + `SEND_MESSAGE`  
Status: ✅ Buildable now

### 6. CRM Push (DB event)
n8n: On `crm.push_requested` → transform → push external CRM  
In-app: `DB_EVENT` trigger + `HTTP_REQUEST` (POST to external CRM API)  
Status: ✅ Buildable now

### 7. Appointment Booking (DB event)
n8n: On `appointment.requested` → send booking link → await webhook  
In-app: `DB_EVENT` + `SEND_MESSAGE` with booking link  
Status: ⚠️ Needs `SEND_WHATSAPP_TEMPLATE` action for rich booking links

### 8. Quote Request (DB event)
n8n: On `quote.requested` → create task → notify team  
In-app: `DB_EVENT` + `CREATE_TASK` + `SEND_MESSAGE`  
Status: ✅ Buildable now

### 9. Payment Success (webhook)
n8n: Payment provider webhook → verify → update → confirm  
In-app: `WEBHOOK` trigger + `UPDATE_RECORD` + `SEND_MESSAGE`  
Status: ✅ Buildable now

### 10. Digital Download (DB event)
n8n: On `download.requested` → get signed URL → send  
In-app: `DB_EVENT` + `HTTP_REQUEST` (get URL from backend) + `SEND_MESSAGE`  
Status: ⚠️ Needs `CODE` action or custom `HTTP_REQUEST` transform for signed URL flow

### 11. Daily Summary (cron)
n8n: Daily at 9am → query analytics → send email  
In-app: `CRON` trigger + `HTTP_REQUEST` (analytics endpoint) + `SEND_EMAIL`  
Status: ✅ Buildable now

### 12. Error Alert (n8n internal)
n8n: On workflow error → notify admin  
In-app: Not needed — engine logs all failures to WorkflowStepRun; alerting via built-in monitoring  
Status: 🔜 Future — add error notification as optional step in executor

## Migration Order

| Wave | Workflows | Risk | When |
|------|-----------|------|------|
| 1 | 1 (Lead Intake), 3 (Send Message), 5 (Hot Lead) | Low — simple linear steps | Now |
| 2 | 8 (Quote), 9 (Payment), 11 (Daily Summary) | Low-medium — cron + webhook triggers | Week 1 |
| 3 | 4 (Follow-up), 6 (CRM Push), 7 (Booking) | Medium — nested state | Week 2 |
| 4 | 10 (Digital Download) | Medium — needs CODE action | Week 2-3 |
| 5 | 2 (WhatsApp), 12 (Error) | Low — already handled in-app | Week 3 |

## Cutover

1. Rebuild n8n workflow as in-app WorkflowDefinition via the API or AI copilot
2. Test with staging data — both fire same trigger, compare outputs
3. Deactivate n8n workflow, keep in-app active
4. Monitor WorkflowInstance logs for failures
5. After 1 week with no issues, delete n8n workflow JSON

## What's NOT covered by the in-app engine (yet)

- Rich WhatsApp template buttons (needs SEND_WHATSAPP_TEMPLATE action type)
- Multi-step conditional loops with complex state (add LOOP action type)
- External API rate limiting / retry strategies (BullMQ handles retries, rate-limit middleware needed)
