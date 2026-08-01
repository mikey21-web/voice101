import { ConfigService } from '@nestjs/config';
import { DograhService } from './dograh.service';

/**
 * Guards the one structural invariant that silently broke live calls: a section must be a
 * conversational node, never a terminal one. When sections without outgoing edges compiled to
 * endCall, a single-section employee greeted the caller, spoke one line and hung up.
 */
describe('DograhService.compileEmployeeDefinition', () => {
  const svc = new DograhService(new ConfigService({}));

  const compile = (sections: any[]) =>
    svc.compileEmployeeDefinition({
      employeeId: 'emp-1',
      composedPersona: 'You are a test agent.',
      greeting: 'నమస్తే అండి!',
      sections,
      variables: [],
    });

  const section = (sectionKey: string, edges: any[] = []) => ({
    sectionKey, label: sectionKey, prompt: `Handle ${sectionKey}.`, enabled: true, order: 1, nodeType: 'llm', edges,
  });

  it('makes a lone edge-less section conversational, not a hang-up', () => {
    const { nodes, edges } = compile([section('greet')]);

    const greet = nodes.find((n: any) => n.data.name === 'greet');
    expect(greet.type).toBe('agentNode');

    // and it still has a way out of the graph
    const goodbye = nodes.find((n: any) => n.data.name === 'goodbye');
    expect(goodbye.type).toBe('endCall');
    expect(edges.some((e: any) => e.source === greet.id && e.target === goodbye.id)).toBe(true);
  });

  it('keeps authored branching and does not add a goodbye edge to a section that has one', () => {
    const { nodes, edges } = compile([
      section('qualify', [{ to_key: 'close', condition: 'they are interested' }]),
      { ...section('close'), order: 2 },
    ]);

    const qualify = nodes.find((n: any) => n.data.name === 'qualify');
    const close = nodes.find((n: any) => n.data.name === 'close');
    const goodbye = nodes.find((n: any) => n.data.name === 'goodbye');

    expect(qualify.type).toBe('agentNode');
    expect(close.type).toBe('agentNode');
    expect(edges.some((e: any) => e.source === qualify.id && e.target === close.id)).toBe(true);
    expect(edges.some((e: any) => e.source === qualify.id && e.target === goodbye.id)).toBe(false);
    expect(edges.some((e: any) => e.source === close.id && e.target === goodbye.id)).toBe(true);
  });
});
