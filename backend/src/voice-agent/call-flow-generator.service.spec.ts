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

const validSections = [
  { sectionKey: 'greeting', label: 'Greeting', prompt: 'Say hi and confirm they have a minute.', enabled: true, order: 1, nodeType: 'agentNode', edges: [{ to_key: 'qualify', condition: 'once they confirm' }] },
  { sectionKey: 'qualify', label: 'Qualify', prompt: 'Ask their budget.', enabled: true, order: 2, nodeType: 'agentNode', edges: [] },
];

describe('CallFlowGeneratorService.editFlow', () => {
  it('throws when no API key is configured', async () => {
    const svc = new CallFlowGeneratorService({ get: () => undefined } as any);
    await expect(svc.editFlow(validSections, 'add urgency')).rejects.toThrow('AI API key not configured');
  });

  it('throws on an empty instruction', async () => {
    const svc = makeService(JSON.stringify({ sections: validSections }));
    await expect(svc.editFlow(validSections, '')).rejects.toThrow('Instruction is required');
  });

  it('throws when there are no existing sections to edit', async () => {
    const svc = makeService(JSON.stringify({ sections: validSections }));
    await expect(svc.editFlow([], 'add urgency')).rejects.toThrow('no sections to edit');
  });

  it('accepts a well-formed edited section list', async () => {
    const edited = [
      ...validSections.map((s) => (s.sectionKey === 'qualify' ? { ...s, edges: [{ to_key: 'urgency', condition: 'once budget given' }] } : s)),
      { sectionKey: 'urgency', label: 'Urgency', prompt: 'Mention limited slots.', enabled: true, order: 3, nodeType: 'agentNode', edges: [] },
    ];
    const svc = makeService(JSON.stringify({ sections: edited }));
    const result = await svc.editFlow(validSections, 'add urgency before closing');
    expect(result.sections).toHaveLength(3);
    expect(result.sections.map((s) => s.sectionKey)).toContain('urgency');
  });

  it('rejects malformed JSON from the model', async () => {
    const svc = makeService('not json {');
    await expect(svc.editFlow(validSections, 'add urgency')).rejects.toThrow('malformed JSON');
  });

  it('rejects an edit with a dangling edge to a nonexistent section', async () => {
    const bad = [{ ...validSections[0], edges: [{ to_key: 'ghost_section', condition: 'x' }] }, validSections[1]];
    const svc = makeService(JSON.stringify({ sections: bad }));
    await expect(svc.editFlow(validSections, 'add urgency')).rejects.toThrow(/unknown section/);
  });

  it('rejects an edit with duplicate section keys', async () => {
    const bad = [validSections[0], { ...validSections[0], order: 2 }];
    const svc = makeService(JSON.stringify({ sections: bad }));
    await expect(svc.editFlow(validSections, 'add urgency')).rejects.toThrow(/duplicate sectionKey/);
  });

  it('rejects an empty sections array', async () => {
    const svc = makeService(JSON.stringify({ sections: [] }));
    await expect(svc.editFlow(validSections, 'add urgency')).rejects.toThrow(/non-empty array/);
  });
});
