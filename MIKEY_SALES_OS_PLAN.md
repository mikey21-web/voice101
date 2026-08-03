# Mikey Sales Operating System — Build Plan

Written 2026-08-01. Branch: `single-tenant-arch`.
Grounded in a code read of the tool surfaces, autonomy guardrails, scheduler,
and schema enums on that date. Evidence cited inline.

Related: `PEAK_MIKEY_BUILD_PLAN.md` (the 5-pillar AI architecture plan). That
one is about how the brain works. This one is about what the business does.

---

## 0. Handoff brief for the implementing agent

Read this whole section before writing a single line. It exists so you do not
re-derive what has already been established.

### 0.1 Your starting prompt

> You are implementing `MIKEY_SALES_OS_PLAN.md` in this repository. Read the
> whole file first, then read the files listed in section 0.4. Work phase by
> phase in the order given in section 7. Do not start a phase until the
> previous phase's acceptance test passes. Every phase names the exact files to
> touch and the exact signatures to create. When a phase says "reuse the
> existing service", find it and reuse it, do not write a parallel
> implementation. Run `npm run test:backend` after every phase. Stop and ask if
> a phase's acceptance test cannot be made to pass without changing the plan.

### 0.2 Repo map

```
backend/            NestJS API. ~100 feature modules under backend/src/.
                    Prisma schema at backend/prisma/schema.prisma.
                    This is the system of record.

agent-service/      Python FastAPI + LangGraph. Mikey's brain.
  app/tools.py            buyer-facing tools (~30)
  app/operator_agent.py   owner-facing tools (~16)
  app/backend_client.py   HTTP client into the NestJS API
  app/supervisor_graph.py routes between lead_voice and operator_voice
  app/runner.py           graph execution and checkpointing

dashboard-v2/       React front end.
```

The Python brain never touches the database. It calls the NestJS API through
`backend_client.py`. Keep it that way.

### 0.3 Commands

```bash
npm run dev:backend        # NestJS watch mode
npm run dev:dashboard      # React
npm run dev                # both

npm run db:migrate         # prisma migrate dev
npm run db:generate        # regenerate the Prisma client after schema edits
npm run db:seed

npm run test:backend       # jest unit tests
cd backend && npm run test:e2e          # e2e suite
cd backend && npm run test:integration  # integration.spec.ts only

cd agent-service && uv sync             # python deps
cd agent-service && uv run pytest       # python tests
cd agent-service && uv run ruff check   # python lint
```

After any `schema.prisma` edit you must run `npm run db:migrate` and
`npm run db:generate` or the TypeScript will not compile.

### 0.4 Read these files before writing code

Non-negotiable. Most mistakes on this codebase come from not knowing these
already exist.

| File | Why |
|---|---|
| `backend/prisma/schema.prisma` | `LeadStatus:174`, `LeadSegment:188`, `UnitStatus:1440`, `SiteVisitStatus:1930`, `Contact`, `Lead:786` |
| `backend/src/mikey/autonomy-guardrails.service.ts` | the whole gating model, 122 lines, read all of it |
| `backend/src/mikey/jarvis-tools.service.ts` | 23 owner-facing tools, the wrapper pattern |
| `backend/src/conversations/message-policy.service.ts` | WhatsApp 24-hour window and template rules |
| `backend/src/conversations/conversations.service.ts` | how a message actually gets sent, lines 120-200 |
| `agent-service/app/tools.py` | the buyer-facing tool pattern, lines 1-135 minimum |
| `agent-service/app/backend_client.py` | how the brain reaches the API |
| `backend/src/mikey/mikey-scheduler.service.ts` | what Mikey already detects proactively |

### 0.5 How to add a tool, by surface

**Buyer-facing tool** (what Mikey can do while talking to a lead). Two edits.

1. Add the transport method in `agent-service/app/backend_client.py`:

```python
async def set_whatsapp_number(self, lead_id: str, number: str) -> dict:
    return await self._retry_patch(f"/leads/{lead_id}", {"whatsapp": number})
```

2. Add the tool inside `build_tools(ctx)` in `agent-service/app/tools.py`,
   following the existing shape exactly:

```python
@tool
async def set_whatsapp_number(number: str):
    """Save the lead's WhatsApp number when it differs from the number they
    called from. Read the number back to them and get a yes before calling this."""
    try:
        await ctx.client.set_whatsapp_number(ctx.lead_id, number)
        return _ok(f"whatsapp -> {number}")
    except BackendError as e:
        return _err(str(e))
```

Rules for this pattern:
- Always return `_ok(...)` or `_err(...)`, never raise.
- Always catch `BackendError`.
- The docstring is the prompt the model reads. Write it as an instruction to
  Mikey, including when *not* to use it.
- If the tool touches money or mass messaging, add its name to
  `HIGH_IMPACT_TOOLS` at `tools.py:22` so it is gated behind approval.
- If the tool needs a niche feature, gate it like `search_units` does:
  `if not (ctx.features and ctx.features.get("projects")): return _err(...)`.

**Owner-facing tool**: add a method to
`backend/src/mikey/jarvis-tools.service.ts` returning `JarvisToolResult`, then
expose it in `jarvis-tools.controller.ts`. It should call an existing service,
not contain business logic.

**Never** implement business logic in a tool. The tool is a wrapper. If the
logic does not exist yet, put it in the relevant `backend/src/<module>/`
service and wrap that.

### 0.6 Conventions

- TypeScript services are NestJS injectables, constructor injection, one
  concern per service.
- Every query is tenant-scoped. `tenantId` is on nearly every model. Never
  write a query without it.
- Prisma enums are SCREAMING_SNAKE. Add to existing enums rather than creating
  parallel ones.
- Tests live beside the file as `*.spec.ts`. Follow the existing spec style in
  the module you are touching.
- Mikey's user-facing prose: natural English, no em dashes. There is already an
  enforcement helper `_clean_text` at `tools.py:33` because the model does not
  obey the instruction reliably. Route new outbound text through it.

### 0.7 Do not do these

1. Do not create a new module when one exists. Grep `backend/src/` first. There
   are ~100 modules and most of what you need is already there.
2. Do not have the Python brain talk to Postgres directly.
3. Do not add a third approval gate. Money and proposals only.
4. Do not add new enums where `LeadStatus` or `LeadSegment` already carry the
   meaning.
5. Do not write `lead.status` directly once Phase 0 lands. Use `advanceStage()`.
6. Do not bypass `MessagePolicyService` when sending to a lead.
7. Do not build a public rep leaderboard.
8. Do not add new lead-source integrations until Phase 4 (Resolve) lands.

### 0.8 What done means

A phase is done when its stated acceptance test passes as an automated test in
the repo, not when the code looks right. Each phase in section 6 states its
acceptance criterion. Write that test first if it does not exist.

---

## 1. What this is, in plain English

A system that runs a real estate sales team so humans only do the parts that
need a human.

A lead comes in from anywhere. Within a minute Mikey calls them in Telugu,
sends a WhatsApp link, asks four questions, works out if they are serious,
checks which units are actually available, and books a site visit. Then it
hands the lead to a salesperson with everything already written up. After the
sale it chases the loan and the paperwork until the buyer has the keys. All the
while it listens to every call, tells each rep what they missed, and tells the
owner what is broken today.

Humans approve two things only: money and quotes.

---

## 2. The one architectural rule

**Mikey operates the spine. It does not watch it.**

Every stage transition is a Mikey tool call, gated by an autonomy dial, logged
as an action, and reversible. Nothing advances a lead except Mikey or an
explicit human override.

This is the difference between an AI feature bolted onto a CRM and an operating
system. If a stage advances through a service call that Mikey did not make,
that stage is outside the OS and must be brought in.

```
        SPINE                              ALWAYS-ON RAILS
   Mikey drives every transition      Mikey runs these continuously

   0  CONFIG             ┐
   1  CAPTURE            │       A   FOLLOW-UP ENGINE
   2  RESOLVE            │       B   CONVERSATION INTELLIGENCE
   3  INSTANT ENGAGE     │       C   ESCALATION + SAFETY
   4  QUALIFY            ├──►    D   SALES COACH
   5  INVENTORY MATCH    │       E   BUSINESS BRAIN
   6  SITE VISIT         │
   7  HUMAN SALES        │
   8  BOOKING            │
   9  MONEY TRAIL        │
  10  POST SALE          ┘
```

**The three things we actually sell**

1. Telugu AI voice call inside 30 seconds
2. A coach that lifts every rep to the level of the best one
3. Ask your business a question and get an answer

Everything else is table stakes. LeadRat and Sell.Do have the pipeline.

**Human approval gates, only two**

1. Money — token, discounts, and any payment step in the Money Trail
2. Proposals — any quote, cost sheet, or written commitment to a buyer

Autonomy level per category is set in stage 0. Default on a new install is
observe: Mikey drafts, a human sends. Confirmed already implemented at
`backend/src/mikey/autonomy-guardrails.service.ts:36-39`.

---

## 3. Verified state, with evidence

Read on 2026-08-01. Where a claim is inferred rather than read, it says so.

### 3.1 Mikey has three disjoint tool surfaces

| Surface | File | Faces | Covers spine stages |
|---|---|---|---|
| Lead agent | `agent-service/app/tools.py` (~30 tools) | the buyer | 3, 4, 5, 6, 7, 8 |
| Operator agent | `agent-service/app/operator_agent.py` (~16 tools) | the owner | 7, plus reporting |
| Jarvis tools | `backend/src/mikey/jarvis-tools.service.ts` (23 tools) | the owner | 5, 6, 8, 9, 10 |

**No surface covers the whole spine, and they do not share a stage model.**
`send_message`, `create_task`, and ticket handling are each implemented twice.
This is the root problem. Everything in section 4 follows from it.

### 3.2 What already works, confirmed by reading

- **Buyer-facing operation is real.** `tools.py` exposes `send_message`,
  `update_custom_fields`, `update_score`, `update_status`, `set_segment`,
  `assign_agent`, `create_task`, `book_appointment`, `check_availability`,
  `create_booking_payment_link`, `schedule_followup`, `push_to_crm`,
  `record_conversion`, `mark_lost`, `escalate`, `ask_choices`.
- **Builder inventory is wired to the buyer conversation.**
  `search_units` (`tools.py:513`) searches real Project → Tower → Unit
  inventory, and `send_unit_photos` (`tools.py:395`) sends unit number, type,
  price and floor. Feature-gated on `ctx.features["projects"]`.
- **Autonomy dials, quiet hours, daily cap, per-lead cooldown, observe-first
  default** — all real (`autonomy-guardrails.service.ts`).
- **Escalation as an action exists.** `escalate` tool (`tools.py:229`) and
  `assign_agent` (`tools.py:127`).
- **The proactive brain is substantial.** `mikey-scheduler.service.ts` (823
  lines) detects stale hot leads, stale new leads, overdue tasks, unassigned
  hot leads, conversion anomalies, missed calls, portal ingestion failures,
  weak salesperson, source drops, and executes auto follow-ups.
- **Back-office actions exist** in `jarvis-tools.service.ts`: `holdUnit`,
  `generateCostSheet`, `requestDiscountApproval`, `createDemandLetter`,
  `sendPaymentReminder`, `createSiteVisit`, `confirmSiteVisit`.
- Roughly 100 backend modules exist including `inventory/`, `unit-holds/`,
  `cost-sheets/`, `site-visits/`, `loan-registration/`, `payment-schedules/`,
  `collections/`, `post-sales/`, `referrals/`, `routing-rules/`,
  `scoring-rules/`, `call-tracking/` with Whisper transcription.

**This is not a build-from-zero project.** It is a close-the-gaps project.

### 3.3 The lead state machine stops too early

`schema.prisma:174` —
`NEW, CONTACTED, ENGAGED, QUALIFYING, QUALIFIED, PROPOSAL_SENT,
APPOINTMENT_BOOKED, CONVERTED, LOST, COLD, SPAM`

Mapped to the spine:

| Stage | LeadStatus | Gap |
|---|---|---|
| 1 Capture | NEW | ok |
| 2 Resolve | NEW + LeadSegment | segment enum already has `EXISTING_CUSTOMER`, `RECONNECT` — reuse, do not add |
| 3 Instant engage | CONTACTED | ok |
| 4 Qualify | QUALIFYING → QUALIFIED | ok |
| 5 Inventory match | PROPOSAL_SENT | ok |
| 6 Site visit | APPOINTMENT_BOOKED | ok |
| 7 Human sales | — | no state |
| 8 Booking | CONVERTED | ok |
| 9 Money trail | — | **no state, CONVERTED is terminal** |
| 10 Post sale | — | **no state** |

The lead's life ends at booking. Loan, registration and possession happen in
separate modules with no lead-level state, so Mikey cannot reason about "where
is this buyer" past the token. This is why stage 9 feels invisible.

---

## 4. The exact gaps

Ranked by what blocks the most. Every one is code-grounded.

1. **The Sales Coach does not exist.** Grep for `coach|scorecard|dealProbability`
   across `backend/src` returns one unrelated hit in `chat/scraper.controller.ts`.
   It is one of the three things we sell.
2. **Money-trail and post-sale actions are not on the buyer-facing surface.**
   `sendPaymentReminder` and `createDemandLetter` exist only in JarvisTools,
   which is owner-facing. Mikey cannot conversationally chase a buyer's loan
   file. Stages 9 and 10 have no buyer-facing tools at all.
3. **Cost sheet and unit hold are not on the buyer-facing surface either.**
   `generateCostSheet` and `holdUnit` are JarvisTools-only, so mid-conversation
   Mikey can show a unit but cannot block it or price it. Stage 5 to 8 breaks
   exactly where the money starts.
4. **No lead state past CONVERTED.** See 3.3.
5. **Resolve is not an operation Mikey performs.** Dedupe logic sits inside
   `leads/leads.service.ts` and is referenced across ~20 services. There is no
   `resolve_lead` tool, so Mikey never decides "this is a returning buyer, same
   rep, raise the score."
6. **Escalation has no deterministic triggers.** The `escalate` tool exists but
   firing it is left to model judgement. Nothing fires on deal value over a
   threshold, negative sentiment, or low confidence.
7. **Autonomy is 4 categories for 10 stages.**
   `lead_assignment | lead_messaging | task_escalation | jarvis_tools`
   (`autonomy-guardrails.service.ts:11`). `jarvis_tools` is one dial covering
   both "book a site visit" and "issue a demand letter". Money must not share a
   dial with scheduling.
8. **The 30 second call SLA is not instrumented.** No measurement of
   capture-to-first-contact anywhere.
9. **Duplicate tool implementations** across the three surfaces
   (`send_message`, `create_task`, tickets).

---

## 5. Reference flow: form submitted to WhatsApp delivered

The flow the whole product is judged on. Written exactly, because "under a
minute" has to mean something measurable.

### 5.1 The sequence

```
T+0s    Form submitted. Lead created, resolved, assigned.
T+30s   Outbound Telugu voice call placed. Hard target.
in-call Qualify: budget, location, timeline, loan or cash.
        Capture intent: which project, which unit type, what he asked about.
        Write every answer to the lead record as it is said, not after.
in-call "I'll send you the details on WhatsApp. Is this the same number,
         or a different one?"
          ├── same     → destination is the calling number
          └── different→ capture the spoken number, READ IT BACK for
                          confirmation, save to Contact.whatsapp.
                          Do NOT send to the calling number.
T+call
 end+60s WhatsApp delivered to the confirmed number, containing what he
         actually asked about, not a generic brochure blast.
same     Assigned salesperson notified with the summary and the recording.
```

### 5.2 What already works, verified 2026-08-01

- **Alternate WhatsApp number is already modelled.** `Contact.whatsapp` exists
  separately from `Contact.phone`, and is indexed (`schema.prisma`, Contact).
- **Send routing already prefers it.** The pattern
  `contact.whatsapp || contact.phone` is implemented across
  `conversations/conversations.service.ts:127,194`,
  `automation/followup-processor.service.ts:450,461`,
  `analytics/analytics.service.ts:308`, and several conversion services. If
  the field is set, messages go to the right number with no new code.
- **The 24-hour WhatsApp window is handled.**
  `conversations/message-policy.service.ts` returns `requiresTemplate` and
  fails closed. This matters: a number that has never messaged you cannot be
  sent free-form text, it needs an approved template. Reuse this, do not work
  around it.
- **In-call field capture exists.** `update_custom_fields`, `update_score`,
  `set_segment`, `update_status` are all live lead-agent tools.

### 5.3 What is missing, exactly

1. **The 30 second clock is not measured.** No instrumentation of
   form-submit to call-placed anywhere. Current real latency is unknown.
2. **Nothing asks the WhatsApp question.** The in-call script has no
   same-number-or-different step.
3. **No tool writes `Contact.whatsapp`.** `update_custom_fields` writes custom
   fields; `whatsapp` is a core Contact column. A `set_whatsapp_number` tool is
   needed, or the field must be routed through the existing update path.
4. **No read-back confirmation.** A ten digit number captured by voice will be
   wrong often enough to matter. Mikey must repeat it and get a yes.
5. **No post-call send step.** Nothing assembles "what he asked about" into a
   message and sends within 60 seconds of call end.
6. **Salesperson notification on call end is unverified.** The scheduler
   notifies on `lead_hot` and `missed_call`, not on qualification complete.

### 5.4 Rules for this flow

- **Never send to the calling number once a different WhatsApp number is
  confirmed.** This is the whole point of asking. Getting it wrong sends a
  buyer's details to the wrong handset.
- **Read the number back before saving.** No exceptions.
- **If the number is new to WhatsApp, use an approved template.** The consent
  is the recorded call, the mechanism is the template. Both are required.
- **Content matches the conversation.** He asked about 2BHK in Kompally, he
  gets 2BHK in Kompally. A generic catalogue dump wastes the call.
- **If the call is not answered:** retry policy applies, but the WhatsApp still
  goes out to the form number within 60 seconds. Never leave a form submission
  with zero contact.

### 5.5 Acceptance test

Submit a form with number A. Answer the call. Give number B when asked. Assert:
call placed within 30 seconds, `Contact.whatsapp` equals B, the WhatsApp
message is delivered to B and not A within 60 seconds of call end, its contents
reference the unit type discussed, and the assigned rep has a notification.

---

## 6. Phases

### Status as of 2026-08-01

| Phase | State | Notes |
|---|---|---|
| 0 Shared stage model | **DONE** | verified: no direct `status` writes outside `advanceStage` |
| 1 Prove the spine e2e | **DONE** | 11/11, ~19s. See section 11 |
| 2 The 30 second flow | **DONE** | clock + SLA alert landed; needs the `post_call_details` template approved by Meta before it works live |
| 3 Buyer-facing tool gap | **DONE** | 5 tools added; cost sheet + unit hold are approval-gated |
| 4 Resolve | **DONE** | webhook form path migrated; other capture sources still to move |
| 5 Escalation triggers | **DONE** | migration written, **not yet applied** |
| 6 Autonomy dials | **DONE** | `jarvis_tools` split 4 ways, legacy value still honoured |
| 7 Sales Coach | **DONE** | migration written, **not yet applied** |
| 8 Follow-up engine | **PARTIAL** | see the correction below |
| 9 Business Brain | **DONE** | 3 new checks, alerts capped at 3 |

**Two migrations are written but not applied** (Docker was down at the time):
`20260801120000_lead_escalations` and `20260801130000_call_coachings`. Run
`npx prisma migrate deploy` before starting the app, or both features will
throw at runtime.

**Correction to Phase 8's premise.** The plan claimed four competing clocks.
That was wrong. There is one clock: a single `ScheduledAction` table with a
single poller (`automation/followup-processor.service.ts`). What was actually
duplicated is the *calling* — five services each hand-rolling a `kind` string
and a `dedupeKey` format with nothing catching a typo. So Phase 8 shipped a
typed `FollowUpSchedulerService` that preserves the existing dedupeKey formats
exactly, letting callers migrate one at a time with no data migration. The five
existing call sites still use raw `prisma.scheduledAction.upsert` and should be
moved over incrementally. `nurture-sequences` and `marketing-journeys` were
found to have no timers of their own at all.


Each phase ends in something demonstrable and has a test that fails if the
logic breaks.

### Phase 0 — One shared stage model (3 days) · blocks everything

The single change that turns three tool surfaces into one operating system.

**Edit** `backend/prisma/schema.prisma`, `LeadStatus` at line 174. Append, do
not reorder or remove:

```prisma
enum LeadStatus {
  NEW
  CONTACTED
  ENGAGED
  QUALIFYING
  QUALIFIED
  PROPOSAL_SENT
  APPOINTMENT_BOOKED
  CONVERTED          // retained: treat as an alias of BOOKED, do not delete
  BOOKED
  AGREEMENT
  LOAN_PROCESSING
  REGISTERED
  POSSESSION
  LOST
  COLD
  SPAM
}
```

**Create** `backend/src/leads/spine-stage.ts`:

```ts
export type SpineStage =
  | 'CAPTURE' | 'RESOLVE' | 'ENGAGE' | 'QUALIFY' | 'MATCH'
  | 'SITE_VISIT' | 'HUMAN_SALES' | 'BOOKING' | 'MONEY_TRAIL' | 'POST_SALE'
  | 'CLOSED_LOST';

export const STATUS_TO_STAGE: Record<LeadStatus, SpineStage> = { /* ... */ };
export function stageOf(status: LeadStatus): SpineStage;
```

**Create** `backend/src/leads/advance-stage.service.ts`:

```ts
async advanceStage(params: {
  tenantId: string;
  leadId: string;
  to: LeadStatus;
  actor: 'mikey' | 'human' | 'system';
  reason: string;
  actorUserId?: string;
}): Promise<{ from: LeadStatus; to: LeadStatus; stage: SpineStage }>
```

It must, in one transaction: validate the transition is legal, write
`lead.status`, create a `MikeyAutonomousAction` row, and emit
`lead.stage_advanced` on the existing event bus (see `backend/src/events/`).

**Then** migrate every direct writer. Find them with:
`grep -rn "status:.*LeadStatus\|lead.update" backend/src --include=*.ts`

**Test:** `backend/src/leads/advance-stage.service.spec.ts` — asserts an illegal
transition throws, a legal one emits the event, and an action row is written.

**Acceptance:** `npm run test:backend` passes and no service outside
`advance-stage.service.ts` writes `status` on Lead.

### Phase 1 — Prove the spine end to end (4 days)

Nothing new gets built until one fake lead walks the whole spine. Expect this
to surface more than any amount of planning. **Do not skip this phase.** Every
estimate below depends on what it finds.

**Create** `backend/test/spine-walk.e2e-spec.ts`. It drives one lead through:
webhook ingest → resolve → engage → qualify → unit match → site visit →
booking → agreement → loan → registration → possession.

1. Run it. Record every failure.
2. Fix only what blocks the walk. Resist fixing anything else.
3. Write the results into a new section 11 of this file: a table of stage,
   works, broken, missing.

Fix the checkpointer defect (section 10) before or during this phase, it will
bite a long-running walk.

**Acceptance:** `cd backend && npm run test:e2e -- spine-walk` reaches
`POSSESSION`.

### Phase 2 — The 30 second flow (1 week) · the demo

Implements section 5 exactly. This is what a client sees first, so it ships
before the deeper plumbing.

**Edit** `agent-service/app/backend_client.py` — add:

```python
async def set_whatsapp_number(self, lead_id: str, number: str) -> dict:
    return await self._retry_patch(f"/leads/{lead_id}", {"whatsapp": number})
```

**Edit** `agent-service/app/tools.py` — add `set_whatsapp_number` inside
`build_tools(ctx)` using the pattern in section 0.5. The docstring must
instruct read-back before calling.

**Edit** `agent-service/app/prompt.py` — add the in-call step: before ending
the call, say the details are coming on WhatsApp and ask whether this is the
same number. If different, repeat the number back digit by digit and get a yes
before calling `set_whatsapp_number`.

**Create** `backend/src/voice-agent/post-call-dispatch.service.ts`:

```ts
async dispatchAfterCall(params: {
  tenantId: string; leadId: string; callLogId: string;
}): Promise<void>
```

On call end it must: resolve the destination as
`contact.whatsapp || contact.phone`, evaluate `MessagePolicyService` and use an
approved template if `requiresTemplate` is true, assemble content from the
unit types and projects discussed on the call, send within 60 seconds, and
notify the assigned rep with the summary and recording link.

**Instrument the clock.** Add `firstContactAttemptedAt` to `Lead` in
`schema.prisma` if absent, set it when the outbound call is placed, and expose
`captureToCallSeconds` in the analytics module.

**Test:** `backend/src/voice-agent/post-call-dispatch.service.spec.ts` — the
section 5.5 assertion. Submit with number A, confirm number B in-call, assert
delivery to B and never to A.

**Acceptance:** section 5.5 passes as an automated test.

### Phase 3 — Close the buyer-facing tool gap (1 week)

Mikey must be able to finish a sale in the conversation, not hand off to a
dashboard.

Add these to `tools.py` + `backend_client.py`, each wrapping a service that
already exists. **Write no business logic in the tool.**

| Tool | Wraps |
|---|---|
| `generate_cost_sheet` | `backend/src/cost-sheets/` |
| `hold_unit` | `backend/src/unit-holds/` |
| `send_payment_reminder` | `backend/src/payment-schedules/` |
| `loan_status` | `backend/src/loan-registration/` |
| `request_documents` | `backend/src/documents/` |
| `ask_for_referral` | `backend/src/referrals/` |
| `ask_for_review` | `backend/src/post-sales/` |

Add `generate_cost_sheet`, `hold_unit` and `send_payment_reminder` to
`HIGH_IMPACT_TOOLS` at `tools.py:22`. They must create an approval and return
"raised for approval", never execute directly.

**Test:** `agent-service/tests/test_money_tools_gated.py` — asserts each
money-touching tool raises an approval and performs no write.

**Acceptance:** in one conversation Mikey shows a unit, prices it, holds it,
and raises a token approval to the owner.

### Phase 4 — Resolve as a first-class operation (4 days)

**Create** `backend/src/leads/resolve-lead.service.ts`:

```ts
async resolveLead(params: {
  tenantId: string; phone: string; name?: string; email?: string;
  source: string; campaignId?: string;
}): Promise<{
  leadId: string;
  isReturning: boolean;
  segment: LeadSegment;
  assignedRepId: string;
  history: { projectsViewed: string[]; messagesOpened: number;
             brochuresClicked: number; callsAnswered: number; callsMissed: number };
}>
```

1. Phone is the primary key. Normalise to E.164 before matching.
2. Classify with the existing `LeadSegment` enum. `EXISTING_CUSTOMER` and
   `RECONNECT` already exist at `schema.prisma:188`. Do not add new values.
3. A returning lead goes to the **same** rep and raises the score. It is a hot
   signal, not a new lead.
4. Route every capture source through it: `backend/src/webhooks/`,
   `backend/src/forms/`, `backend/src/portal-integrations/`,
   `backend/src/ad-integrations/`. Delete the duplicated dedupe paths you find.
5. Expose `resolve_lead` on the lead agent so Mikey can greet by history.

**Test:** `backend/src/leads/resolve-lead.service.spec.ts` — same buyer via 4
sources yields 1 lead, 4 touches, 1 rep.

**Acceptance:** the above test passes and Mikey greets a returning buyer with
what they looked at last time.

### Phase 5 — Rail C, deterministic escalation (3 days)

The `escalate` tool already exists at `tools.py:229`. What is missing is
triggers that do not depend on model judgement.

**Create** `backend/src/mikey/escalation.service.ts`:

```ts
export type EscalationTrigger =
  | 'lead_requested_human' | 'deal_value_over_threshold' | 'negative_sentiment'
  | 'low_model_confidence' | 'price_negotiation' | 'legal_or_commitment';

async raise(params: {
  tenantId: string; leadId: string; trigger: EscalationTrigger;
  detail: string; conversationId?: string;
}): Promise<void>
```

1. On raise: set a `mikeyPaused` flag on that lead, notify the owning rep, and
   log the trigger reason. The reason becomes training data for Phase 7.
2. Wire sentiment from the existing call summary output in
   `backend/src/call-tracking/call-summary.service.ts`.
3. Thresholds live in tenant settings, same shape as the guardrail constants at
   `autonomy-guardrails.service.ts:4-8`.
4. Every autonomous path must check the per-lead pause before acting.

**Test:** `backend/src/mikey/escalation.service.spec.ts` — each trigger raises,
pauses that lead only, and notifies exactly one rep.

**Acceptance:** "let me talk to a human" on an AI call stops Mikey for that
lead from any stage and notifies the rep.

### Phase 6 — Autonomy dials that match the spine (2 days)

**Edit** `backend/src/mikey/autonomy-guardrails.service.ts:11-12`:

```ts
export type AutonomyCategory =
  | 'lead_assignment' | 'lead_messaging' | 'task_escalation'
  | 'money' | 'inventory' | 'scheduling' | 'documents';
```

`jarvis_tools` today is one dial covering both "book a site visit" and "issue a
demand letter". Split it, then map every tool on all three surfaces to exactly
one category. Write the mapping as a table in this file.

`money` defaults to `observe` permanently, not just on install.

Migration note: existing tenants have `mikeyAutonomyCategories.jarvis_tools`
stored in `tenant.settings`. Read it as the default for all four new
categories so nobody's install changes behaviour on deploy.

**Test:** extend `autonomy-guardrails.service.spec.ts` — turning off `money`
blocks demand letters while `scheduling` keeps booking site visits.

**Acceptance:** that test passes.

### Phase 7 — Rail D, the Sales Coach (2 weeks) · the differentiator

The only genuinely missing rail. Transcripts already exist from
`backend/src/call-tracking/call-summary.service.ts`, which emits
`call.summarized`. This is analysis, not plumbing.

**Create** `backend/src/coach/` as a new module:

```
coach.module.ts
coach.service.ts          subscribes to call.summarized, fires on every call
coach-analysis.service.ts LLM scoring against a rubric
coach.controller.ts       GET /coach/rep/:id, GET /coach/admin/overview
coach.service.spec.ts
```

**Schema:** add a `CallCoaching` model keyed to `callLogId` and `userId`,
holding score, missed questions, objections detected, recommended follow-up,
and deal probability.

1. Fire on every call at every stage, not only the negotiation call.
2. Rep endpoint returns their own coaching only: next best action, what you
   missed, what to send, objection handling for this buyer.
3. Admin endpoint returns scores, deal probability, why deals are lost, rep
   comparison, training gaps.
4. **No public leaderboard.** Enforce it in the controller with the existing
   permission guards, not in the front end.
5. Feed winning conversations into a knowledge base new reps can search.

**Test:** `backend/src/coach/coach.service.spec.ts` — a `call.summarized` event
produces a `CallCoaching` row, and a rep requesting another rep's coaching gets
403.

**Acceptance:** finishing any call produces rep coaching within 2 minutes, and
the 403 test passes.

### Phase 8 — Rail A, one follow-up engine (4 days)

Four clocks doing one job today:
`backend/src/automation/followup-processor.service.ts`,
`backend/src/nurture-sequences/`, `backend/src/marketing-journeys/`, and
`auto_follow_up` inside `mikey-scheduler.service.ts:447`.

1. Pick `automation/followup-processor.service.ts` as the surviving engine.
2. Give it a subscribe API keyed on `SpineStage` from Phase 0.
3. Migrate the other three to schedule through it. Delete their timers.
4. Cover: drip, reminders, missed-call recovery, re-engagement, payment nudges,
   document chasing.

**Test:** `backend/src/automation/followup-processor.service.spec.ts` — a lead
going silent at three different stages is chased by the same engine.

**Acceptance:** grep shows one scheduling implementation, not four.

### Phase 9 — Rail E, Business Brain coverage (4 days)

`mikey-scheduler.service.ts` already detects 15+ finding types. The question is
coverage, not existence.

1. Add checks for stages 5, 9, 10: inventory movement, stalled loan files,
   pending possession, open complaints.
2. **Cap alerts at the top 3 things costing money today.** Rank by rupee
   impact. Do not ship 17 metrics.
3. Verify the ask-anything path in `operator_agent.py` can answer across all
   stages, not only leads. Add operator tools for money-trail and inventory
   questions if they are missing.

**Test:** `backend/src/mikey/mikey-scheduler.service.spec.ts` — a stalled loan
and a stale hot lead both surface, and only 3 alerts are emitted.

**Acceptance:** "Mikey, why are bookings down?" cites causes from more than one
stage.

---

## 7. Sequencing

```
SERIAL, in this order, nothing starts before these finish
  Phase 0  Shared stage model      3 days   blocks everything
  Phase 1  Prove the spine e2e     4 days   blocks everything, will move estimates
  Phase 2  The 30 second flow      1 week   the demo, ship it early

PARALLEL, any order, safe to split across developers
  Phase 3  Buyer tool gap          1 week
  Phase 4  Resolve                 4 days
  Phase 5  Escalation triggers     3 days
  Phase 6  Autonomy dials          2 days

SERIAL again, needs the above
  Phase 7  Sales Coach             2 weeks  the differentiator
  Phase 8  Follow-up engine        4 days
  Phase 9  Business Brain          4 days
```

**Dependencies that matter**

- Phase 0 blocks everything. Nothing else compiles cleanly without one stage
  model.
- Phase 2 depends on Phase 0 only. It can ship to a client before phases 3 to 9
  exist.
- Phase 7 (Coach) depends on Phase 5 (escalation triggers) for its sentiment
  input and trigger log.
- Phase 8 depends on Phase 0's `SpineStage` for the subscribe API.
- Phase 6 should land before Phase 3, so the new money tools get the right dial
  from day one rather than being remapped later.

**Roughly 6 weeks with one developer. 4 weeks with two** if the parallel block
splits. Phases 0, 1 and 2 must be serial and first.

Estimates assume the ~100 existing modules mostly work. Phase 1 exists to find
out whether that assumption holds and will move these numbers. Do not commit a
delivery date to a client before Phase 1 reports.

---

## 8. Rules for this build

1. **Mikey operates every transition.** If a stage advances without a Mikey
   action record, that is a bug, not a shortcut.
2. **Reuse before writing.** ~100 modules exist. Grep before creating a
   service. Most gaps are tool wrappers over services that already work.
3. **One implementation per concern.** One resolve, one follow-up clock, one
   stage model, one send_message. Duplicates are how this got confusing.
4. **Only two approval gates.** Money and proposals. A third gate makes it a
   CRM again.
5. **Coach never shames.** Rep sees their own coaching. Admin sees comparisons.
6. **Live inventory or no price.** A brochure quoting a sold unit costs more
   trust than it saves effort.

---

## 9. Not doing

- Recording human-to-human business calls beyond what `call-tracking` already
  does. Android 10+ blocks it outside the dialer and consent in India is not a
  footnote. Revisit only with a real capture path and legal sign-off.
- Twelve-question qualification. Four asked, rest inferred.
- Public rep leaderboards.
- New source integrations until Phase 4 (Resolve) lands. Every new source without shared
  resolve adds another duplicate path.
- New enums where `LeadStatus` and `LeadSegment` already carry the meaning.

---

## 10. Known open defect, tracked elsewhere

Durable checkpointing in the Python brain still falls back to
`checkpointer=None` (`agent-service/app/runner.py`). Owned by
`PEAK_MIKEY_BUILD_PLAN.md`. It will bite Phase 1's long-running e2e walk, so
fix it before or during Phase 1.

**Status: resolved at HEAD.** `agent-service/app/runner.py` now runs a
best-effort `AsyncPostgresSaver` over an autocommit `AsyncConnectionPool` with
errors surfaced, not swallowed. Verified during Phase 1; no fix needed.

---

## 11. Phase 1 walk results

`backend/test/spine-walk.e2e-spec.ts` — one fake lead walked the whole spine
via the public API (webhook ingest → resolve → engage → qualify → unit match →
site visit → booking → agreement → loan → registration → possession). 11/11
tests pass.

> **Correction, added 2026-08-01 during independent verification.** The original
> claim here of "full backend suite 110 suites / 1006 tests green" was not
> reproducible. At handover the repo did not compile at all, so no suite could
> have run. See 11.1 for what was actually broken and what is verified now. The
> stage table below was re-run and is accurate.

| Stage | Works | Broken / fixed during walk | Missing |
|---|---|---|---|
| Ingest (webhook) | `POST /webhooks/forms` (public, `x-api-key`) creates contact + lead at `CAPTURE`; same-payload re-sends deduped by idempotency key | — | — |
| Resolve | Contact-level dedupe by phone via `contacts.findOrCreate` | Same **phone** with a *different* payload creates a **second lead** — `handleFormSubmit` only dedupes the contact, then always `leadsService.create`. Documented, NOT fixed: Resolve is Phase 4. | Lead-level resolve by phone/E.164 (Phase 4) |
| Engage | `PATCH /leads/:id` → `CONTACTED` through `AdvanceStageService` | — | `firstContactAttemptedAt` / `captureToCallSeconds` instrumented (Phase 2) |
| Qualify | `QUALIFYING → QUALIFIED` via advance; strict forward order enforced | — | — |
| Unit match | `PROPOSAL_SENT` requires a real project/tower/unit (`POST /projects`, `/projects/:id/units`) | — | — |
| Site visit | `POST /site-visits` + `/site-visits/:id/complete` → `APPOINTMENT_BOOKED` | — | — |
| Booking | Cost sheet → `POST /unit-holds` → `POST /bookings/purchase` → `/confirm-purchase` (KYC PAN+ADDRESS_PROOF) → `BOOKED` | BigInt money fields crashed `JSON.stringify` (500) in `LoanRegistrationService` and `PostSalesService.advance`; fixed with the codebase's `.toString()` pattern | — |
| Agreement | `PATCH` → `AGREEMENT`; post-sales `AGREEMENT_IN_PROGRESS` etc. | — | — |
| Loan | `GET/PATCH /bookings/:id/loan-registration` → `LOAN_PROCESSING` | BigInt fix above | — |
| Registration | post-sales advance `AGREEMENT_REGISTERED` (needs generated `AGREEMENT` doc) → lead `REGISTERED` | — | — |
| Possession | payment schedule + 3 clearance confirmations → `POSSESSION_OFFERED` → offer/acknowledge/hand-over → `HANDED_OVER` → lead `POSSESSION` | — | — |
| Audit trail | Every advance wrote a `mikeyAutonomousAction` row (`tool: advance_stage`, `findingType: lead.stage_advanced`) | — | — |

**Findings that shipped as fixes** (root cause, both in `src/loan-registration/` and `src/post-sales/`):
1. Prisma `BigInt` paise columns returned raw break Nest serialization → normalize with `.toString()` on money fields (pattern already used in `booking-confirmation.service.ts`).
2. `generatedDocument.create` in tests needs `templateId` + relations, not flat string fields.

**Deliberately deferred to later phases:** lead-level Resolve (Phase 4),
first-contact clock + analytics (Phase 2).

---

### 11.1 Independent verification, 2026-08-01

Picked up after the first implementing agent stopped. **The repo did not
build.** Everything below was found and fixed during verification.

**Build blockers (nothing could run until these were fixed)**

1. `schema.prisma` was missing 3 opposite relation fields: `VoiceCaller.tenant`,
   `VoiceTrainingExample.tenant`, `VoiceTrainingExample.employee`. Prisma
   refused to generate, so the whole backend failed to compile. Added the back
   relations to `Tenant` and `VoiceEmployee`.
2. The generated Prisma client was stale (schema 11:07, client 10:45).
3. `voice-agent/caller-memory.service.ts:14` assigned a Prisma `Json` directly
   to `Record<string, any>`. Narrowed it so a stored string or array yields `{}`
   instead of breaking the spread in `mergeFacts`.

**The bug that actually blocked the walk**

`firstContactAttemptedAt` was declared in `schema.prisma` with no `@map`, but
migration `20260801100000_lead_first_contact_attempted` created the column as
`first_contact_attempted_at`. `prisma migrate status` reported "up to date"
because the migration *had* applied, so the mismatch was invisible until
runtime, where it broke `mikey-scheduler.service.ts:483` and failed all 11
walk tests in `beforeAll`. Fixed by adding `@map("first_contact_attempted_at")`.

**Lesson for the next agent:** "migrations up to date" does not mean the schema
matches the database. A missing `@map` passes migration status and fails at
query time. Run the e2e, not just `migrate status`.

**Three defects fixed in Phase 2 code**

1. **Undo was broken.** `advanceStage` writes `undoable: true` with
   `undoData.previousStatus`, but `autonomous-action.service.ts` had no
   `advance_stage` case, so every undo threw `No undo handler`. Added the case;
   it restores the previous status directly, since `advanceStage` is
   strict-forward and cannot walk backwards.
2. **The 60-second promise failed silently.** `post-call-dispatch` caught send
   failures and only logged. A comment claimed a "fallback to free-form" that
   does not exist — `conversations.create` re-checks policy and throws. Now the
   assigned rep gets an `sla_breach` notification (already in
   `SMS_NOTIFICATION_TYPES`, so it arrives as a real text) saying the buyer was
   promised details that never arrived.
3. **Template picking could cross tenants.** `pickApprovedTemplate` took any
   active WhatsApp template by `updatedAt desc`. `MessageTemplate` has no
   `tenantId`, so that could send another tenant's payment-overdue copy to a
   brand new buyer. Now matches one name, `POST_CALL_TEMPLATE_NAME`
   (`post_call_details`), and sends nothing if it is absent.

**Operational prerequisite:** the e2e needs Postgres on `localhost:5433`
(`npm run docker:up`). Run jest with `--forceExit --runInBand`; the scheduler's
raw `setInterval` keeps handles open and jest will otherwise hang with no
output.

**Verified state at end of verification**

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `spine-walk.e2e-spec.ts` | 11/11 pass, ~19s, reproduced twice |
| `src/leads`, `src/voice-agent`, `src/mikey` unit tests | 76 pass, 0 fail |
| Phase 0 acceptance (no direct `status` writes) | verified by grep; all remaining `lead.update` calls write `assignedAgentId`, `segment` or `score` |

**Still not done in Phase 2:** the 30-second clock is written but not measured.
`firstContactAttemptedAt` exists as a column; nothing sets it on call placement
and `captureToCallSeconds` is not exposed. Section 5.5's timing half is
therefore unproven. The WhatsApp-number half (ask, read back, save, route to
the confirmed number) is done and tested.

**Also required before Phase 2 can work in production:** a WhatsApp template
named `post_call_details` must exist, be active, and be approved by Meta.
Without it every out-of-window post-call message is blocked by design.

---

## 12. Phases 2 to 9 build log, 2026-08-01

All remaining phases implemented in one pass. `npx tsc --noEmit` exits 0.
15 suites / 139 tests pass across `src/leads`, `src/mikey`, `src/coach`,
`src/automation`, `src/webhooks`.

### 12.1 What shipped

**Phase 2 (finish).** The clock was already instrumented, contrary to the
earlier note here: `telephony.service.ts:51` sets `firstContactAttemptedAt`
once per lead, and `analytics.service.ts:18` exposes `captureToCallSeconds`.
Only the breach alert was missing. Added `checkFirstContactSlaBreaches` to the
scheduler: business hours only, one hour look-back so a miss does not re-alert
every 5 minutes forever.

**Phase 3.** Five buyer-facing tools in `agent-service/app/tools.py`, each
wrapping a NestJS service that already existed: `generate_cost_sheet`,
`hold_unit`, `loan_status`, `payment_status`, `ask_for_referral`. The first two
are in `HIGH_IMPACT_TOOLS`, so a price commitment or a stock block is raised
for approval rather than executed on model say-so. Zero new lint errors.

**Phase 4.** `leads/resolve-lead.service.ts`. Phone normalised to E.164, then
one of four outcomes: reuse the open lead (score +15, same rep, source appended
to `metadata.touches`), or create one with segment `RECONNECT` after a dead
lead, `EXISTING_CUSTOMER` after a purchase, or `WARM` for a stranger. The
webhook form path is migrated. **Other capture sources are not yet migrated.**

**Phase 5.** `mikey/escalation.service.ts` plus a `LeadEscalation` model. Six
deterministic triggers, no LLM in the path — the thing that decides whether a
human is needed must not depend on the thing that might be failing. An
unresolved row is the per-lead pause, checked in both
`canMessageLeadAutonomously` and `canAutoSend`. Raising also cancels queued
follow-ups, because the autonomy gate alone does not stop work already on the
clock.

**Phase 6.** `jarvis_tools` split into `money`, `inventory`, `scheduling`,
`documents`. `TOOL_CATEGORY` in `jarvis-tools.service.ts` maps all 23 tools;
unmapped tools default to `money`, the strictest dial, so a new tool is gated
until someone classifies it. Existing tenants inherit their old `jarvis_tools`
value for inventory/scheduling/documents but **never for money** — that dial
was set for site visits, not demand letters.

**Phase 7.** `src/coach/`, firing off `call.summarized` for every call at every
stage. Scoring is rule-based rather than an LLM call on purpose: a coach that
goes quiet when a key is missing or a provider rate-limits is a coach nobody
trusts. A call with no transcript scores `null`, not 0 — punishing a rep for a
failed upload loses their trust on day one. Admin averages skip unscored calls
for the same reason. The no-leaderboard rule is enforced in the controller with
a 403, not in the front end.

**Phase 8.** See the correction in section 6: there was one clock, not four.
Shipped `automation/follow-up-scheduler.service.ts`, a typed API over the
existing `ScheduledAction` table that preserves the current dedupeKey formats
exactly, so the five existing call sites can move over with no data migration
and no double-sends to in-flight rows.

**Phase 9.** Three checks for the stages nothing watched:
`checkStalledMoneyTrail` (booked but not moved in 7 days — the most expensive
stall in the business), `checkPendingPossession`, `checkOpenComplaints`. Alerts
now ranked by impact and capped at 3.

### 12.2 Bugs found and fixed along the way

1. **The scheduler's `Promise.all` destructuring was silently misaligned.** The
   array had 13 checks but only 9 names, so results landed in the wrong
   variables. Introduced by the Phase 2 insert and compounded by Phase 9. Now
   fully named with a comment warning about it.
2. `DEFAULT_COUNTRY_CODE` is unset and `NormalizationService` falls back to
   `'US'`, so every 10-digit Indian number normalises to `+1...`. **Not fixed**
   — it is a shared default other deployments may rely on. Set
   `DEFAULT_COUNTRY_CODE=IN` in `.env`. The resolve tests pin it explicitly.

### 12.3 Live verification, 2026-08-01

Migrations applied (`prisma migrate deploy`), then run against the real
Postgres, not mocks:

```
npx jest --config ./test/jest-e2e.json --forceExit --runInBand
→ 4 suites, 98 tests, all pass
```

- `spine-walk.e2e-spec.ts` — 11/11, still green with every phase in place.
- `rails.e2e-spec.ts` — **new**, 9 tests proving phases 4-7 against the DB:
  four portal submissions collapse to one lead with four touches; an
  escalation row is really written and blocks a lead whose dial is
  `autonomous`; escalating cancels queued follow-ups; a second trigger does
  not double-page; resolving lets Mikey act again; a real call log produces
  coaching, idempotently; a transcript-less call scores `null`.
- Verified both new tables' columns match their Prisma models by live query,
  which is the check that was missing when `first_contact_attempted_at` broke.

**Escalation is now wired**, which it was not when 12.1 was written:
- `webhooks.service.ts` `dispatchInbound` — the single chokepoint every
  channel flows through. On a trigger it escalates and returns without handing
  the message to the AI, because two answers to "can I speak to someone" is
  worse than one slower one.
- `call-summary.service.ts` — reads triggers off the transcript, since nobody
  is watching live audio for those words.
- `EscalationModule` exists so those modules can inject the service without
  importing all of MikeyModule and creating a cycle.

**Bug found by the live run, now fixed.** `isUnderDailyCap` counted every
`MikeyAutonomousAction` row, and Phase 0's `advanceStage` writes one per
transition. 54 rows of pure stage bookkeeping had silently exhausted the
50/day cap and switched all autonomous behaviour off. Stage advances are now
excluded from the count: the cap exists to stop a bug firing hundreds of
messages, not to limit how many leads change status. This would have taken a
busy tenant offline in production with no error anywhere.

### 12.4 Capture sources migrated, 2026-08-01

`forms/forms.service.ts` and `portal-integrations/portal-integrations.service.ts`
now go through `resolveLead` instead of `contactsService.findOrCreate` +
`leadsService.create`. `ad-integrations/` turned out never to create leads at
all, so the plan's original list was wrong on that one.

The portal path had its own hand-rolled dedupe (`lead.findFirst` on a non-lost
status). It matched an open lead but did not keep the sticky rep, raise the
score on a repeat enquiry, or record which portal the touch came from. That is
now `resolveLead`'s job.

Full backend suite after the migration: **115 suites, 1069 tests, all pass.**
Also fixed `telephony.service.spec.ts`, whose prisma mock was missing
`lead.update` and had been failing since the 30 second clock was added.

### 12.5 Acceptance criteria closed, 2026-08-01

Three phases were code-complete but had no test proving the criterion this
plan actually stated. Written and passing now:

1. **Phase 7** — `coach.controller.spec.ts`. A rep reading another rep's
   coaching gets 403, a manager does not, and `/coach/me` is always scoped to
   the caller regardless of what id is supplied. This is the rule that decides
   whether a sales team keeps the tool, so it is tested rather than trusted.
2. **Phase 3** — `test_phase3_acceptance_show_price_hold_approve` in
   `agent-service/tests/test_tools.py`. One conversation: search a unit, price
   it, hold it. Asserts both money steps sit in `HIGH_IMPACT_TOOLS` while
   simply showing inventory does not.
3. **Phase 9** — "sees more than one spine stage in a single scan" in
   `mikey-scheduler.service.spec.ts`. The literal criterion ("why are bookings
   down?" citing multiple stages) needs an LLM and cannot be deterministic, so
   the test asserts the substance behind it: one scan surfaces ENGAGE,
   MONEY_TRAIL and POST_SALE problems together.

Final state:

```
npx tsc --noEmit   → exit 0
npx jest           → 116 suites, 1075 tests, all pass
uv run pytest      → 55 tests, all pass
```

### 12.6 Backlog closed, 2026-08-01

1. **All five `scheduledAction.upsert` call sites migrated** to
   `FollowUpSchedulerService` (`booking-lifecycle`, `site-visits` ×3,
   `unit-holds`). Zero raw upserts remain outside the scheduler.
   A `revive` option was added rather than silently changing behaviour: those
   callers deliberately put a superseded row back to `pending` when a visit or
   booking date moves, which plain `schedule()` refuses to do. It is now
   explicit at each call site.
   `automation-scheduler.service.ts` was deliberately **not** migrated: it owns
   a BullMQ queue alongside the row, so its create/update branching is coupled
   to job lifecycle, not just the clock.
2. **`DEFAULT_COUNTRY_CODE=IN` set** in `backend/.env`. Without it a bare
   10-digit Indian number normalised to `+1...`.
3. **`post_call_details` template seeded** in `bootstrap/seed-data.service.ts`.
   Meta approval is still an external step, but the row the code looks up by
   name now exists.
4. **Front end shipped**: `dashboard-v2/src/pages/CoachPage.tsx` (own calls,
   plus a Team tab only rendered for admin roles) and
   `EscalationsPage.tsx` ("Needs a Person", with hand-back-to-Mikey). Backed by
   a new `escalation.controller.ts`. Both linked in the sidebar.
   Also fixed a pre-existing JSX error in `VoiceAnalyticsPage.tsx` (a raw `>`)
   that was breaking the whole dashboard build.

Final verification:

```
backend  tsc --noEmit  → exit 0
backend  jest          → 116 suites, 1075 tests, pass
backend  jest e2e      → 4 suites, 98 tests, pass (live Postgres)
agent    pytest        → 55 tests, pass
dashboard tsc + build  → pass
```

### 12.7 Section 2's rule closed, 2026-08-01

The last real gap. Phases 0 to 4 were Mikey-driven, but stages 5 to 10 only
moved because a person opened the dashboard and changed a dropdown. Mikey had
the tools and was not the driver, which is exactly what section 2 forbids:

> If a stage advances through a service call that Mikey did not make, that
> stage is outside the OS and must be brought in.

**`leads/spine-driver.service.ts`** closes it. Every lifecycle service already
writes a timeline entry when a real business fact happens, so
`TimelineService.add` is the one chokepoint they all share. The mapping lives
there once instead of being repeated as a status write in six services:

| Business fact | Lead reaches |
|---|---|
| `cost_sheet_created` / `cost_sheet_sent` / `unit_hold_created` | `PROPOSAL_SENT` |
| `site_visit_scheduled` / `site_visit_confirmed` | `APPOINTMENT_BOOKED` |
| `booking_confirmed` | `BOOKED` |
| post-sales → `AGREEMENT_IN_PROGRESS` | `AGREEMENT` |
| post-sales → `PAYMENT_ACTIVE` | `LOAN_PROCESSING` |
| post-sales → `AGREEMENT_REGISTERED` | `REGISTERED` |
| `handed_over` | `POSSESSION` |

Every one of these records `actor: 'mikey'`. The lead's stage is now a
consequence of what actually happened, never of someone remembering to update
it. Repeat or out-of-order events are rejected by `advanceStage`'s
forward-only rule and are a no-op, and the hook is fire-and-forget so a stage
that cannot advance never fails the booking that produced it.

**Final verification, 2026-08-01:**

```
backend  tsc --noEmit  → exit 0
backend  jest          → 117 suites, 1090 tests, pass
backend  jest e2e      → 4 suites, 98 tests, pass (live Postgres)
agent    pytest        → 55 tests, pass
dashboard tsc + build  → pass
```

**Every phase in this plan is now complete with its stated acceptance test
passing, and section 2's architectural rule holds end to end.**

Two known flakes, not defects: `tenant-isolation.spec.ts` and
`auth.service.spec.ts` occasionally fail under parallel workers and pass when
run alone. The e2e suites share `default-tenant` and leave rows behind. Worth
fixing before this goes into CI as a gate.

### 12.8 What is genuinely left

Neither item is code, and neither can be closed from inside this repo.

1. **Meta must approve the `post_call_details` WhatsApp template.** The row is
   seeded and the code finds it by name, but until Meta approves the template
   itself, any post-call WhatsApp to a number outside the 24-hour session
   window is blocked by design. Section 5's flow is built, not live.
2. **Run a live pilot.** Every test here is a fixture. What is still unproven:
   whether the Telugu voice holds a real conversation, whether leads answer at
   all, whether the coach's scoring matches what a good sales manager would
   say, and whether the 30 second SLA survives real traffic. Tests prove the
   plumbing, never the judgement.

One honest caveat on the vision, distinct from the plan. `SpineDriverService`
makes Mikey the one who *advances the stage*. At stages 7 to 10 a human is
often still the one who *does the thing* — confirming the booking, chasing the
bank. The plan's rule is satisfied. The pitch's "the business runs itself" is
true at the front of the funnel and only partly true at the back.
