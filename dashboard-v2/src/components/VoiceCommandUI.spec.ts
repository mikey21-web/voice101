import { describe, it, expect } from 'vitest';
import { matchCommand, encodeWav } from './VoiceCommandUI';
import { resolvePage } from '../lib/pageMap';

describe('resolvePage', () => {
  it('resolves the exact slugs the AI actually returns for navigate_ui', () => {
    // Reproduces a live bug: the model returned "qr_codes" (underscore), which
    // isn't a PAGE_MAP key, so the raw string was used as the hash directly —
    // an unmatched route that left the page exactly where it was while Mikey
    // still reported "You're now on the QR codes page."
    expect(resolvePage('qr_codes')).toBe('qr-codes');
    expect(resolvePage('QR Codes')).toBe('qr-codes');
    expect(resolvePage('leads')).toBe('leads');
  });
});

describe('encodeWav', () => {
  const rate = 16000;
  const wav = new DataView(encodeWav(Float32Array.from([0, 1, -1, 0.5]), rate));
  const ascii = (o: number, n: number) =>
    Array.from({ length: n }, (_, i) => String.fromCharCode(wav.getUint8(o + i))).join('');

  it('writes a RIFF/WAVE PCM header libsndfile can read', () => {
    expect(ascii(0, 4)).toBe('RIFF');
    expect(ascii(8, 8)).toBe('WAVEfmt ');
    expect(ascii(36, 4)).toBe('data');
    expect(wav.getUint16(20, true)).toBe(1);   // PCM, not compressed
    expect(wav.getUint16(22, true)).toBe(1);   // mono
    expect(wav.getUint16(34, true)).toBe(16);  // 16-bit
  });

  it('declares the sample rate and derived sizes consistently', () => {
    expect(wav.getUint32(24, true)).toBe(rate);
    expect(wav.getUint32(28, true)).toBe(rate * 2);  // byte rate
    expect(wav.getUint16(32, true)).toBe(2);         // block align
    expect(wav.getUint32(40, true)).toBe(4 * 2);     // data size
    expect(wav.getUint32(4, true)).toBe(36 + 4 * 2); // RIFF size
    expect(wav.byteLength).toBe(44 + 4 * 2);
  });

  it('encodes samples as little-endian PCM16 without wrapping at full scale', () => {
    expect(wav.getInt16(44, true)).toBe(0);
    expect(wav.getInt16(46, true)).toBe(32767);
    expect(wav.getInt16(48, true)).toBe(-32768);
    expect(wav.getInt16(50, true)).toBe(Math.trunc(0.5 * 32767));
  });

  it('clamps out-of-range samples instead of overflowing', () => {
    const clipped = new DataView(encodeWav(Float32Array.from([2, -2]), rate));
    expect(clipped.getInt16(44, true)).toBe(32767);
    expect(clipped.getInt16(46, true)).toBe(-32768);
  });
});

describe('matchCommand', () => {
  it('matches explicit navigation phrases', () => {
    expect(matchCommand('go to leads')?.page).toBe('leads');
    expect(matchCommand('show me the tickets')?.page).toBe('tickets');
    expect(matchCommand('open qr codes')?.page).toBe('qr-codes');
    expect(matchCommand('pull up my invoices')?.page).toBe('invoices');
  });

  it('matches a bare page name', () => {
    expect(matchCommand('analytics')?.page).toBe('analytics');
    expect(matchCommand('inbox')?.page).toBe('inbox');
  });

  it('tolerates voice-transcript typos', () => {
    expect(matchCommand('go to campains')?.page).toBe('campaigns');
    expect(matchCommand('open analitycs')?.page).toBe('analytics');
  });

  it('carries a filter through', () => {
    expect(matchCommand('show me hot leads')).toEqual({ page: 'leads', filter: 'hot' });
  });

  it('sends questions to the copilot instead of navigating', () => {
    expect(matchCommand('how many leads do we have')).toBeNull();
    expect(matchCommand('what is the status of tickets?')).toBeNull();
  });

  it('sends real requests to the copilot instead of hijacking them as navigation', () => {
    expect(matchCommand('call ravi back this afternoon')).toBeNull();
    expect(matchCommand('draft a follow up for the sharma family')).toBeNull();
    expect(matchCommand('remind me to send the brochure tomorrow')).toBeNull();
  });

  it('does not treat addressing the assistant by name as navigation', () => {
    // Reproduces a live bug: "hi mikey" fuzzy-matched the word "mikey" itself
    // against a "mikey" PAGE_MAP entry pointing at a standalone page that's
    // feature-gated off for this niche, landing on a real "Page not found".
    // "mikey" is the assistant's own name, not a page — it should never be
    // a nav target, whatever page or feature state a niche is in.
    expect(matchCommand('hi mikey')).toBeNull();
    expect(matchCommand('thanks mikey')).toBeNull();
    expect(matchCommand('mikey are you there')).toBeNull();
  });
});
