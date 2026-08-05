/**
 * Publishes a Prema config onto an employee via the backend API: PATCH the
 * employee's sections/variables/greeting/persona, then POST publish.
 * Run with ts-node from the backend directory.
 *
 * Default deploys the Telugu config (prema-config.ts) onto Prema-v2.
 * Set CONFIG=prema-hindi to deploy the Hindi Prema variant.
 * Set CONFIG=priya to deploy the Priya Hinglish spec.
 *
 * Usage:
 *   $env:JWT = "..."; npx ts-node -T scripts/publish-prema.ts
 *   $env:JWT = "..."; $env:CONFIG = "prema-hindi"; $env:PREMA_EMPLOYEE_ID = "<hindi-employee-id>"; npx ts-node -T scripts/publish-prema.ts
 *   $env:JWT = "..."; $env:CONFIG = "priya"; $env:PREMA_EMPLOYEE_ID = "<priya-employee-id>"; npx ts-node -T scripts/publish-prema.ts
 */
import * as telugu from '../src/voice-agent/prema-config';
import * as hindi from '../src/voice-agent/prema-hindi-config';
import * as priya from '../src/voice-agent/priya-config';

const BASE = process.env.API_BASE || 'http://localhost:3001';
const EMPLOYEE_ID = process.env.PREMA_EMPLOYEE_ID || 'ac43fe86-4b79-47f4-997e-82f86b3b6344';
const TOKEN = process.env.PREMA_JWT || '';

const prefix = process.env.CONFIG === 'prema-hindi' ? 'PREMA_HINDI' : process.env.CONFIG === 'priya' ? 'PRIYA' : 'PREMA';
const cfg: any = process.env.CONFIG === 'priya' ? priya : process.env.CONFIG === 'prema-hindi' ? hindi : telugu;
const P = (name: string) => cfg[`${prefix}_${name}`];
const {
  PERSONA,
  SECTIONS,
  VARIABLES,
  KNOWLEDGE_BASE,
  OBJECTION_TEMPLATES,
  TONALITY_RULES,
  WELCOME_MESSAGE,
} = {
  PERSONA: P('PERSONA'),
  SECTIONS: P('SECTIONS'),
  VARIABLES: P('VARIABLES'),
  KNOWLEDGE_BASE: P('KNOWLEDGE_BASE'),
  OBJECTION_TEMPLATES: P('OBJECTION_TEMPLATES'),
  TONALITY_RULES: P('TONALITY_RULES'),
  WELCOME_MESSAGE: P('WELCOME_MESSAGE'),
};

if (!TOKEN) {
  console.error('Set PREMA_JWT (a JWT for tenant df7e0da9-d289-484d-9e7e-64fd96981f2a).');
  process.exit(1);
}

/** Convert prema-config section shape (nextKey+condition or edges) to EmployeeInput
 * SectionInput shape (edges array). */
function toSections() {
  return SECTIONS.map((s: any, idx: number) => {
    const edges = Array.isArray(s.edges)
      ? s.edges
      : s.nextKey
        ? [{ to_key: s.nextKey, condition: s.condition || 'move to next step' }]
        : [];
    return {
      sectionKey: s.key,
      label: s.label,
      prompt: s.prompt,
      enabled: true,
      order: idx + 1,
      nodeType: 'llm',
      edges,
    };
  });
}

function toVariables() {
  return VARIABLES.map((v: any) => ({
    key: v.key,
    label: v.label,
    source: v.source || 'capture',
    required: false,
    extractHint: v.label,
  }));
}

async function main() {
  const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
  const sections = toSections();
  const variables = toVariables();

  const objectionScript = Object.values(OBJECTION_TEMPLATES).join('\n\n');
  const agentInformation = [
    PERSONA.name && `You are ${PERSONA.name}, ${PERSONA.title} for ${PERSONA.project}.`,
    KNOWLEDGE_BASE.trim(),
    'Below are the exact objection-handling scripts to use verbatim when the corresponding objection arises:',
    objectionScript,
    TONALITY_RULES.trim(),
  ].filter(Boolean).join('\n\n');

  // 1. Update the employee draft (sections, variables, persona, greeting).
  console.log(`PATCH employee… (config: ${process.env.CONFIG || 'prema-telugu'})`);
  const patchRes = await fetch(`${BASE}/voice-employees/${EMPLOYEE_ID}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      name: PERSONA.name,
      role: PERSONA.title,
      agentInformation,
      welcomeMessage: WELCOME_MESSAGE,
      sections,
      variables,
    }),
  });
  if (!patchRes.ok) {
    console.error('PATCH failed:', patchRes.status, await patchRes.text());
    process.exit(1);
  }
  const patched = await patchRes.json();
  console.log('PATCH ok — sections:', patched.sections?.length, 'variables:', patched.variables?.length);

  // 2. Publish the draft to the Dograh workflow.
  console.log('POST publish…');
  const pubRes = await fetch(`${BASE}/voice-employees/${EMPLOYEE_ID}/publish`, {
    method: 'POST',
    headers,
  });
  if (!pubRes.ok) {
    console.error('PUBLISH failed:', pubRes.status, await pubRes.text());
    process.exit(1);
  }
  const published = await pubRes.json();
  console.log('PUBLISH ok — workflow:', published.dograhWorkflowId, 'uuid:', published.dograhWorkflowUuid, 'revision:', published.revision);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
