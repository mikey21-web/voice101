// Rebuilds the Telugu workflow using Outpero's captured content verbatim: their master
// prompt (style/safety/grounding layer), their exact section scripts, greeting, and
// variable set for "Prema" / Skyline Heights, Kokapet — reverse-engineered and captured
// with the account owner's explicit authorization for this project.
//
// Kept from the ORIGINAL build-telugu.mjs (infra, not Outpero content, still required
// because we're hosting this on Dograh's node/edge model, which Outpero's own engine
// doesn't need to expose): the startCall call_status branch and the wrongNumberOrBusy/
// voicemail endCall nodes. Also added (additive, not present in Outpero's own data):
// a wants_site_visit boolean at book_visit, so our own lead-orchestrator.service.ts
// post-call outcome parsing keeps working unchanged.
//
// Safe to re-run — always does a full rebuild + publish.

import { DograhClient, Workflow } from '@dograh/sdk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const contentDir = join(__dirname, 'outpero-content');

const client = new DograhClient({
  baseUrl: process.env.DOGRAH_API_URL || 'http://localhost:8010',
  apiKey: process.env.DOGRAH_API_KEY,
});

const wf = new Workflow({ client, name: 'real-estate-lead-qualifier-te' });

// Outpero's compiled master prompt, up to (not including) the per-section content —
// grounding, safety, priority hierarchy, spoken-Telugu style rules, turn discipline,
// AI disclosure, script-adherence framing. Captured verbatim.
const GLOBAL_LAYER = readFileSync(join(contentDir, 'global-layer.txt'), 'utf8').trim();

// Outpero's FAQ section + the trailing "always apply" rule blocks (TURN CHECK, LANGUAGE,
// CAPTURING DETAILS, తెలుగు RULES) — these apply globally in their engine too, not just
// to one call step, so they belong on the globalNode alongside GLOBAL_LAYER.
const TRAILER = readFileSync(join(contentDir, 'trailer.txt'), 'utf8').trim();

const persona = await wf.add({
  type: 'globalNode',
  name: 'persona',
  prompt: `${GLOBAL_LAYER}\n\n${TRAILER}`,
});

const start = await wf.add({
  type: 'startCall',
  name: 'greeting',
  add_global_prompt: true,
  greeting_type: 'text',
  // Prema's exact welcome_message.
  greeting: 'హలో అండి, {{first_name}} తో మాట్లాడుతున్నానా?',
  prompt:
    'Confirm they are the right person and have a couple of minutes, in Telugu. ' +
    'If wrong number, acknowledge and prepare to end the call politely. ' +
    'If busy, offer to call back later and prepare to end the call politely. ' +
    'If they confirm interest and have time, move on.',
  extraction_enabled: true,
  extraction_variables: [
    { name: 'call_status', type: 'string', prompt: "one of: 'interested', 'busy', 'wrong_number'" },
  ],
});

// --- Prema's 5 sequential sections, exact prompt text, exact edges/conditions ---

const orientLead = await wf.add({
  type: 'agentNode',
  name: 'orient_lead',
  add_global_prompt: true,
  prompt:
    "Once they confirm their identity, clearly say you're ప్రీమా from స్కైలైన్ హైట్స్, Kokapet, and mention their enquiry about our project (reference {{project_enquired}} if available). Quickly highlight it's a premium gated community with 100% RERA approval and mention the main unit (1840 SFT 3BHK, base price), but keep it short and conversational. Your job is to remind them what this is about, not to pitch yet. End by asking if they're looking for investment or own use — one question only, no bundling. For example you might say: 'నేను ప్రీమా, స్కైలైన్ హైట్స్ కోకాపేట్ నుంచి మాట్లాడుతున్నాను అండి. మీరు మా ప్రాజెక్ట్ గురించి enquiry చేసారు కదా — premium gated community, HMDA & RERA approved. మీకు investment కోసం చూస్తున్నారా, లేక own use కోసం?'",
  extraction_enabled: true,
  extraction_variables: [
    { name: 'intent', type: 'string', prompt: 'Investment or Own Use' },
  ],
});

const qualifyNeed = await wf.add({
  type: 'agentNode',
  name: 'qualify_need',
  add_global_prompt: true,
  prompt:
    "Depending on their answer, ask follow-up questions ONE at a time to qualify their requirement: first, what size/unit type they're looking for (e.g. 2BHK or 3BHK); once they answer, ask their preferred facing (East or West); then ask if they have any specific budget in mind. Always react quickly to each answer ('Got it sir', 'Done sir') before moving to the next. NEVER ask all at once, and SKIP any question if already answered or if you have the info from {{unit_type}} or {{budget}}. For example: 'సరే అండి, మీకు 2BHK కావాలా, లేక 3BHK చూస్తున్నారా?'",
  extraction_enabled: true,
  extraction_variables: [
    { name: 'preferred_facing', type: 'string', prompt: 'East or West' },
  ],
});

const pitchObjections = await wf.add({
  type: 'agentNode',
  name: 'handle_objections_pitch',
  add_global_prompt: true,
  prompt:
    "Now, briefly highlight the key USPs matching their need: mention Mivan construction, RERA approval, clubhouse, location (Financial District proximity), and the 20:80 subvention scheme. If they raise an objection (price, WhatsApp, legal), handle it as follows: If price is high, mention Mivan quality and Kokapet's 15% yearly appreciation, and say negotiation is possible after site visit. If they ask to WhatsApp, say you're sending the brochure right now but ask a follow-up to keep them talking. If legal, promise to check with your senior and WhatsApp them in 10 minutes. End by inviting them for a site visit this weekend with free cab pickup. For example: 'మా ప్రాజెక్ట్ లో 100% మివాన్ construction, రేరా approved, clubhouse, financial district కి దగ్గర. ఇప్పుడు weekend site visit కి family తో రావొచ్చా? Free cab pickup arrange చేస్తాం.'",
  extraction_enabled: true,
  extraction_variables: [
    { name: 'objection', type: 'string', prompt: 'Objection or concern raised, if any' },
  ],
});

const bookVisit = await wf.add({
  type: 'agentNode',
  name: 'book_visit',
  add_global_prompt: true,
  prompt:
    "Lock in an exact date and time for their site visit, preferably this weekend. Offer free cab pickup, confirm the number of people coming, and check their preferred time slot. Once confirmed, repeat the details back and promise to WhatsApp the location and cab details. For example: 'సరే అండి, మీకు ఎప్పుడు సౌకర్యంగా ఉంటుంది? Saturday morning slot బుక్ చేయొచ్చా? Free cab pickup arrange చేస్తాం.'",
  extraction_enabled: true,
  extraction_variables: [
    { name: 'site_visit_time', type: 'string', prompt: 'Agreed site visit date/time' },
    { name: 'num_persons_visiting', type: 'string', prompt: 'Number of people visiting' },
    // Not in Outpero's own variable set — added so lead-orchestrator.service.ts's
    // existing outcome parsing (mapStructuredOutcome) keeps working unchanged.
    { name: 'wants_site_visit', type: 'boolean', prompt: 'true if a site visit was agreed and scheduled' },
  ],
});

const close = await wf.add({
  type: 'endCall',
  name: 'close',
  add_global_prompt: true,
  prompt:
    "Warmly thank them for booking the visit, confirm you'll WhatsApp all details (brochure, location, cab info), and remind them they can call anytime with questions. If they have any last questions, answer briefly. For example: 'Thank you అండి, details మొత్తం వాట్సాప్ చేస్తాను. ఏదైనా doubt ఉంటే, నాకు కాల్ చేయొచ్చు.'",
});

const wrongNumberOrBusy = await wf.add({
  type: 'endCall',
  name: 'wrong_number_or_busy',
  add_global_prompt: true,
  prompt: 'In Telugu: if wrong number, apologize briefly and end the call. If busy, confirm you will call back later and end the call politely.',
});

const voicemail = await wf.add({
  type: 'endCall',
  name: 'voicemail',
  prompt: "Leave a brief, friendly message in Telugu as Prema from Skyline Heights, Kokapet: mention you called about their project enquiry and that you'll try again later. Keep it under 10 seconds worth of speech.",
});

const outcomeWebhook = await wf.add({
  type: 'webhook',
  name: 'post_call_outcome',
  http_method: 'POST',
  endpoint_url: process.env.OUTCOME_WEBHOOK_URL || 'http://host.docker.internal:3001/voice-agent/webhook/call-completed',
  custom_headers: [{ key: 'X-Webhook-Secret', value: process.env.OUTCOME_WEBHOOK_SECRET || '' }],
  payload_template: {
    call_sid: '{{workflow_run_id}}',
    lead_id: '{{initial_context.lead_id}}',
    status: 'completed',
    outcome: {
      call_status: '{{gathered_context.call_status}}',
      intent: '{{gathered_context.intent}}',
      preferred_facing: '{{gathered_context.preferred_facing}}',
      objection: '{{gathered_context.objection}}',
      site_visit_time: '{{gathered_context.site_visit_time}}',
      num_persons_visiting: '{{gathered_context.num_persons_visiting}}',
      wants_site_visit: '{{gathered_context.wants_site_visit}}',
      wants_human: '{{gathered_context.wants_human}}',
    },
  },
});

wf.edge(start, orientLead, { label: 'interested', condition: "call_status is 'interested'" });
wf.edge(start, wrongNumberOrBusy, { label: 'busy_or_wrong_number', condition: "call_status is 'busy' or 'wrong_number'" });
wf.edge(start, voicemail, { label: 'voicemail', condition: "answered_by is 'machine_start', 'machine_end_beep', 'machine_end_silence', 'machine_end_other', or 'fax'" });

// Prema's exact chain: orient_lead -> qualify_need -> handle_objections_pitch -> book_visit -> close
wf.edge(orientLead, qualifyNeed, { label: 'next', condition: 'once they say investment or own use' });
wf.edge(qualifyNeed, pitchObjections, { label: 'next', condition: 'after qualifying questions are answered' });
wf.edge(pitchObjections, bookVisit, { label: 'next', condition: 'once they show interest in visiting' });
wf.edge(bookVisit, close, { label: 'next', condition: 'after site visit is scheduled' });

// Updates the EXISTING workflow in place (DOGRAH_WORKFLOW_ID_TE, currently 4) rather than
// creating a new one — that ID/UUID is what backend/.env's DOGRAH_WORKFLOW_UUID_TE and every
// live call trigger already point at, so an in-place update means no env change and no
// backend restart is needed for the new content to take effect on the next call.
const baseUrl = process.env.DOGRAH_API_URL || 'http://localhost:8010';
const workflowId = process.env.DOGRAH_WORKFLOW_ID || '4';

const putRes = await fetch(`${baseUrl}/api/v1/workflow/${workflowId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.DOGRAH_API_KEY },
  body: JSON.stringify({ name: wf.name, workflow_definition: wf.toJson() }),
});
console.log('PUT status:', putRes.status);
if (!putRes.ok) throw new Error(await putRes.text());

const publishRes = await fetch(`${baseUrl}/api/v1/workflow/${workflowId}/publish`, {
  method: 'POST',
  headers: { 'X-API-Key': process.env.DOGRAH_API_KEY },
});
console.log('Publish status:', publishRes.status, await publishRes.text());
