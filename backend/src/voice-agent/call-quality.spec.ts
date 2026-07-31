import { lintTranscript, normalizeTranscript, summarizeQuality } from './call-quality';

describe('normalizeTranscript', () => {
  it('handles an array of message objects', () => {
    const turns = normalizeTranscript([
      { role: 'assistant', content: 'హలో అండి' },
      { role: 'user', content: 'చెప్పండి' },
    ]);
    expect(turns).toEqual([
      { role: 'agent', content: 'హలో అండి' },
      { role: 'user', content: 'చెప్పండి' },
    ]);
  });

  it('handles a flat "Agent: / User:" log', () => {
    const turns = normalizeTranscript('Agent: హలో అండి\nUser: చెప్పండి');
    expect(turns.map((t) => t.role)).toEqual(['agent', 'user']);
  });

  it('handles a JSON string', () => {
    const turns = normalizeTranscript(JSON.stringify([{ role: 'bot', text: 'హలో' }]));
    expect(turns).toEqual([{ role: 'agent', content: 'హలో' }]);
  });

  it('returns empty for null/garbage rather than throwing', () => {
    expect(normalizeTranscript(null)).toEqual([]);
    expect(normalizeTranscript(42)).toEqual([]);
  });
});

describe('lintTranscript', () => {
  const clean = [
    { role: 'agent', content: 'హలో అండి, Rahul గారితో మాట్లాడుతున్నానా?' },
    { role: 'user', content: 'ఆ చెప్పండి' },
    { role: 'agent', content: 'నేను ప్రీమా AI. మీరు investment కోసం చూస్తున్నారా?' },
    { role: 'user', content: 'own use కోసం' },
    { role: 'agent', content: 'ఓకే అండి. మీకు 2BHK కావాలా?' },
  ];

  it('gives a clean conversation a high score', () => {
    const r = lintTranscript(clean);
    expect(r.violations).toHaveLength(0);
    expect(r.score).toBe(100);
    expect(r.agentTurns).toBe(3);
  });

  it('flags two questions in one turn', () => {
    const r = lintTranscript([{ role: 'agent', content: 'మీకు 2BHK కావాలా? బడ్జెట్ ఎంత?' }]);
    expect(r.violations.map((v) => v.rule)).toContain('multiple-questions');
  });

  it('flags reading a caller-supplied number back', () => {
    const r = lintTranscript([
      { role: 'agent', content: 'మీ number చెప్తారా?' },
      { role: 'user', content: 'నా number 9398310517' },
      { role: 'agent', content: 'సరే, 9398310517 కరెక్ట్ ఆ?' },
    ]);
    expect(r.violations.map((v) => v.rule)).toContain('readback');
  });

  it('flags literary Telugu where a spoken form exists', () => {
    const r = lintTranscript([{ role: 'agent', content: 'క్షమించండి, ఆ వివరాలు నాకు తెలియదు' }]);
    const rules = r.violations.map((v) => v.rule);
    expect(rules.filter((x) => x === 'literary-word').length).toBeGreaterThanOrEqual(2);
  });

  it('flags the same acknowledgement twice in a row', () => {
    const r = lintTranscript([
      { role: 'agent', content: 'సరే అండి, అది చూద్దాం' },
      { role: 'user', content: 'ok' },
      { role: 'agent', content: 'సరే అండి, ఇంకా ఏమైనా కావాలా' },
    ]);
    expect(r.violations.map((v) => v.rule)).toContain('repeated-ack-consecutive');
  });

  it('flags a verbatim repeated line', () => {
    const line = 'మీకు ఏ ఏరియా లో కావాలో చెప్తారా అండి';
    const r = lintTranscript([
      { role: 'agent', content: line },
      { role: 'user', content: 'హా' },
      { role: 'agent', content: line },
    ]);
    expect(r.violations.map((v) => v.rule)).toContain('repeated-sentence');
  });

  it('flags numerals that should be spoken as words', () => {
    const r = lintTranscript([{ role: 'agent', content: 'ధర 4527 rupees అండి' }]);
    expect(r.violations.map((v) => v.rule)).toContain('digits-not-words');
  });

  it('flags over-apologising across the call', () => {
    const r = lintTranscript([
      { role: 'agent', content: 'సారీ అండి, అది తెలియదు' },
      { role: 'user', content: 'ok' },
      { role: 'agent', content: 'సారీ, ఒక్క నిమిషం' },
    ]);
    expect(r.violations.map((v) => v.rule)).toContain('over-apologising');
  });

  it('scores a bad call materially lower than a clean one', () => {
    const bad = lintTranscript([
      { role: 'agent', content: 'క్షమించండి. మీకు 2BHK కావాలా? బడ్జెట్ ఎంత?' },
      { role: 'user', content: 'నా budget 5000000' },
      { role: 'agent', content: 'సరే, 5000000 కరెక్ట్ ఆ? వివరాలు చెప్తాను.' },
    ]);
    expect(bad.score).toBeLessThan(lintTranscript(clean).score);
    expect(bad.violationsPerTurn).toBeGreaterThan(1);
  });

  it('reports an empty transcript rather than silently passing', () => {
    const r = lintTranscript([]);
    expect(r.score).toBe(0);
    expect(r.violations[0].rule).toBe('empty');
  });
});

describe('summarizeQuality', () => {
  it('says clean when there is nothing to report', () => {
    expect(summarizeQuality(lintTranscript([{ role: 'agent', content: 'హలో అండి' }]))).toMatch(/^Clean/);
  });

  it('summarises severity counts otherwise', () => {
    const r = lintTranscript([{ role: 'agent', content: 'మీకు 2BHK కావాలా? బడ్జెట్ ఎంత?' }]);
    expect(summarizeQuality(r)).toMatch(/Score \d+\/100/);
  });
});
