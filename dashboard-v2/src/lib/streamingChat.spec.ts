import { describe, it, expect } from 'vitest';
import { extractSpeakableSegment } from './streamingChat';

describe('extractSpeakableSegment', () => {
  it('returns null while no boundary has arrived and not forced', () => {
    expect(extractSpeakableSegment('You have 12 hot leads', false)).toBeNull();
  });

  it('extracts up to the last sentence boundary and keeps the rest buffered', () => {
    const result = extractSpeakableSegment('You have 12 hot leads. Three are ', false);
    expect(result).toEqual({ segment: 'You have 12 hot leads.', rest: 'Three are ' });
  });

  it('extracts multiple complete sentences together when both arrived at once', () => {
    const result = extractSpeakableSegment('Done! Anything else? ', false);
    expect(result?.segment).toBe('Done! Anything else?');
    expect(result?.rest).toBe('');
  });

  it('flushes the remaining buffer when forced even without a boundary', () => {
    expect(extractSpeakableSegment('Sure, one moment', true)).toEqual({ segment: 'Sure, one moment', rest: '' });
  });

  it('returns null when forced on an empty/whitespace-only buffer', () => {
    expect(extractSpeakableSegment('', true)).toBeNull();
    expect(extractSpeakableSegment('   ', true)).toBeNull();
  });

  it('cuts a long clause with no punctuation at the cap instead of waiting forever', () => {
    const longClause = 'a '.repeat(150); // 300 chars, no sentence boundary anywhere
    const result = extractSpeakableSegment(longClause, false);
    expect(result).not.toBeNull();
    expect(result!.segment.length).toBeLessThan(longClause.length);
    expect(result!.segment + ' ' + result!.rest.trim()).not.toBe('');
  });
});
