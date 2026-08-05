/**
 * Updates the existing Priya employee (0ecaf8b6-7b28-455d-884f-473fe530f05a) from
 * priya-config.ts, then republishes. Run from backend dir:
 *   npx ts-node -T scripts/update-priya.ts
 * Env: PREMA_JWT (fresh owner JWT for tenant df7e0da9-d289-484d-9e7e-64fd96981f2a)
 */
import { PRIYA_PERSONA, PRIYA_WELCOME_MESSAGE, PRIYA_SECTIONS, PRIYA_VARIABLES, PRIYA_KNOWLEDGE_BASE, PRIYA_OBJECTION_TEMPLATES, PRIYA_TONALITY_RULES } from '../src/voice-agent/priya-config';

const BASE = process.env.API_BASE || 'http://localhost:3001';
const TOKEN = process.env.PREMA_JWT || '';
const EMPLOYEE_ID = process.env.EMPLOYEE_ID || '0ecaf8b6-7b28-455d-884f-473fe530f05a';

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

  console.log(`Updating employee ${EMPLOYEE_ID}…`);
  const patchRes = await fetch(`${BASE}/voice-employees/${EMPLOYEE_ID}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      name: PRIYA_PERSONA.name,
      role: PRIYA_PERSONA.title,
      welcomeMessage: PRIYA_WELCOME_MESSAGE,
      agentInformation,
      sections,
      variables,
    }),
  });
  if (!patchRes.ok) {
    console.error('PATCH failed:', patchRes.status, await patchRes.text());
    process.exit(1);
  }
  const employee = await patchRes.json();
  console.log('PATCH ok — sections:', employee.sections.length, 'variables:', employee.variables.length);

  console.log('Publishing…');
  const pubRes = await fetch(`${BASE}/voice-employees/${EMPLOYEE_ID}/publish`, { method: 'POST', headers });
  if (!pubRes.ok) {
    console.error('PUBLISH failed:', pubRes.status, await pubRes.text());
    process.exit(1);
  }
  const published = await pubRes.json();
  console.log('PUBLISH ok — workflow:', published.dograhWorkflowId, 'uuid:', published.dograhWorkflowUuid, 'revision:', published.revision);
}

main().catch((e) => { console.error(e); process.exit(1); });
