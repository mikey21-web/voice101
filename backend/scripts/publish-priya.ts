/**
 * Creates the Priya (Hindi) employee from priya-config.ts, then publishes it.
 * Run from backend dir:  npx ts-node -T scripts/publish-priya.ts
 * Env: PREMA_JWT (owner JWT), API_BASE default http://localhost:3001
 */
import { PRIYA_PERSONA, PRIYA_WELCOME_MESSAGE, PRIYA_SECTIONS, PRIYA_VARIABLES, PRIYA_KNOWLEDGE_BASE, PRIYA_OBJECTION_TEMPLATES, PRIYA_TONALITY_RULES } from '../src/voice-agent/priya-config';

const BASE = process.env.API_BASE || 'http://localhost:3001';
const TOKEN = process.env.PREMA_JWT || '';

if (!TOKEN) {
  console.error('Set PREMA_JWT (a fresh owner JWT for tenant df7e0da9-d289-484d-9e7e-64fd96981f2a).');
  process.exit(1);
}

const sections = PRIYA_SECTIONS.map((s: any, idx: number) => {
  const edges = Array.isArray(s.edges)
    ? s.edges
    : s.nextKey
      ? [{ to_key: s.nextKey, condition: s.condition || 'move to next step' }]
      : [];
  return { sectionKey: s.key, label: s.label, prompt: s.prompt, enabled: true, order: idx + 1, nodeType: 'llm', edges };
});

const variables = PRIYA_VARIABLES.map((v: any) => ({
  key: v.key, label: v.label, source: v.source || 'capture', required: false, extractHint: v.label,
}));

const objectionScript = Object.values(PRIYA_OBJECTION_TEMPLATES).join('\n\n');
const agentInformation = [
  `You are ${PRIYA_PERSONA.name}, ${PRIYA_PERSONA.title} at ${PRIYA_PERSONA.company}, selling ${PRIYA_PERSONA.project}.`,
  PRIYA_KNOWLEDGE_BASE.trim(),
  'Below are the exact objection-handling scripts to use verbatim when the corresponding objection arises:',
  objectionScript,
  PRIYA_TONALITY_RULES.trim(),
].filter(Boolean).join('\n\n');

async function main() {
  const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

  console.log('Creating Priya employee…');
  const createRes = await fetch(`${BASE}/voice-employees`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: PRIYA_PERSONA.name,
      role: PRIYA_PERSONA.title,
      voiceProvider: 'smallest',
      voiceId: 'niharika',
      voiceName: 'Niharika (Hindi)',
      ttsSpeed: 1,
      language: 'hi-IN',
      welcomeMessage: PRIYA_WELCOME_MESSAGE,
      agentInformation,
      sections,
      variables,
    }),
  });
  if (!createRes.ok) {
    console.error('CREATE failed:', createRes.status, await createRes.text());
    process.exit(1);
  }
  const employee = await createRes.json();
  console.log('CREATE ok — id:', employee.id);

  console.log('Publishing…');
  const pubRes = await fetch(`${BASE}/voice-employees/${employee.id}/publish`, { method: 'POST', headers });
  if (!pubRes.ok) {
    console.error('PUBLISH failed:', pubRes.status, await pubRes.text());
    process.exit(1);
  }
  const published = await pubRes.json();
  console.log('PUBLISH ok — workflow:', published.dograhWorkflowId, 'uuid:', published.dograhWorkflowUuid, 'revision:', published.revision);
  console.log('Employee ID:', employee.id);
}

main().catch((e) => { console.error(e); process.exit(1); });
