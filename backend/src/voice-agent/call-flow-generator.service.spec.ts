import { CallFlowGeneratorService } from './call-flow-generator.service';

/** ConfigService stub: just enough to satisfy the constructor's api-key lookup. */
const fakeConfig = {
  get: (key: string) => (key === 'OPENAI_API_KEY' ? 'test-key' : undefined),
} as any;

const validDraft = {
  name: 'lead_qualifier',
  role: 'Sales Executive',
  persona: 'You are Riya, a sales executive.',
  greeting: 'Hi {{first_name}}, got a minute?',
  steps: [
    { key: 'budget', label: 'Budget', prompt: 'Ask their budget.', extract: [{ name: 'budget', type: 'string', prompt: 'their budget' }] },
    { key: 'timeline', label: 'Timeline', prompt: 'Ask when they plan to buy.', extract: [{ name: 'timeline', type: 'string', prompt: 'purchase timeline' }] },
  ],
  outcomes: [
    { key: 'qualified', label: 'Qualified', condition: "timeline is 'immediate'", closingPrompt: 'Thank them and confirm next steps.' },
    { key: 'not_interested', label: 'Not interested', condition: "timeline is 'browsing'", closingPrompt: 'Thank them politely.' },
  ],
};

/** Stubs the OpenAI client's chat completion to return a fixed JSON string, bypassing network
 * calls entirely — this only tests the validation logic, not the model. */
function makeService(responseJson: string) {
  const svc = new CallFlowGeneratorService(fakeConfig);
  (svc as any).client = {
    chat: { completions: { create: async () => ({ choices: [{ message: { content: responseJson } }] }) } },
  };
  return svc;
}

describe('CallFlowGeneratorService', () => {
  it('throws when no API key is configured', async () => {
    const svc = new CallFlowGeneratorService({ get: () => undefined } as any);
    await expect(svc.generate('some description')).rejects.toThrow('AI API key not configured');
  });

  it('throws on an empty description', async () => {
    const svc = makeService(JSON.stringify(validDraft));
    await expect(svc.generate('')).rejects.toThrow('Description is required');
  });

  it('accepts and returns a well-formed draft', async () => {
    const svc = makeService(JSON.stringify(validDraft));
    const draft = await svc.generate('qualify real estate leads');
    expect(draft.name).toBe('lead_qualifier');
    expect(draft.steps).toHaveLength(2);
    expect(draft.outcomes).toHaveLength(2);
  });

  it('rejects malformed JSON from the model rather than crashing downstream', async () => {
    const svc = makeService('not json at all {');
    await expect(svc.generate('qualify leads')).rejects.toThrow('malformed JSON');
  });

  it('rejects a draft missing steps', async () => {
    const bad = { ...validDraft, steps: [] };
    const svc = makeService(JSON.stringify(bad));
    await expect(svc.generate('qualify leads')).rejects.toThrow(/steps must be a non-empty array/);
  });

  it('rejects a draft missing outcomes', async () => {
    const bad = { ...validDraft, outcomes: undefined };
    const svc = makeService(JSON.stringify(bad));
    await expect(svc.generate('qualify leads')).rejects.toThrow(/outcomes must be a non-empty array/);
  });

  it('rejects a step missing a prompt', async () => {
    const bad = { ...validDraft, steps: [{ key: 'x', extract: [] }] };
    const svc = makeService(JSON.stringify(bad));
    await expect(svc.generate('qualify leads')).rejects.toThrow(/missing key\/prompt/);
  });

  it('rejects an outcome missing a condition', async () => {
    const bad = { ...validDraft, outcomes: [{ key: 'x', label: 'X', closingPrompt: 'bye' }] };
    const svc = makeService(JSON.stringify(bad));
    await expect(svc.generate('qualify leads')).rejects.toThrow(/missing key\/condition\/closingPrompt/);
  });

  it('rejects an empty AI response', async () => {
    const svc = new CallFlowGeneratorService(fakeConfig);
    (svc as any).client = { chat: { completions: { create: async () => ({ choices: [{ message: {} }] }) } } };
    await expect(svc.generate('qualify leads')).rejects.toThrow('AI returned an empty response');
  });
});
