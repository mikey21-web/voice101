import { describe, it, expect } from 'vitest';
import { float32ToPCM16, rms, resolveSocketConfig } from './voiceSession';

describe('resolveSocketConfig', () => {
  it('routes through a relative API prefix (production, behind a reverse proxy)', () => {
    expect(resolveSocketConfig('/api')).toEqual({ url: '/realtime', path: '/api/socket.io/' });
  });

  it('uses the default socket.io path for an absolute origin (local dev)', () => {
    expect(resolveSocketConfig('http://localhost:3001')).toEqual({
      url: 'http://localhost:3001/realtime',
      path: '/socket.io/',
    });
  });
});

describe('float32ToPCM16', () => {
  it('encodes full-scale and mid-scale samples as little-endian PCM16', () => {
    const buf = float32ToPCM16(Float32Array.from([0, 1, -1, 0.5]));
    const view = new DataView(buf);
    expect(buf.byteLength).toBe(8);
    expect(view.getInt16(0, true)).toBe(0);
    expect(view.getInt16(2, true)).toBe(32767);
    expect(view.getInt16(4, true)).toBe(-32768);
    expect(view.getInt16(6, true)).toBe(Math.trunc(0.5 * 32767));
  });

  it('clamps out-of-range samples instead of overflowing', () => {
    const view = new DataView(float32ToPCM16(Float32Array.from([2, -2])));
    expect(view.getInt16(0, true)).toBe(32767);
    expect(view.getInt16(2, true)).toBe(-32768);
  });
});

describe('rms', () => {
  it('is zero for silence', () => {
    expect(rms(new Float32Array(100))).toBe(0);
  });

  it('is 1 for a full-scale constant signal', () => {
    expect(rms(Float32Array.from({ length: 10 }, () => 1))).toBeCloseTo(1, 5);
  });

  it('is higher for a louder signal than a quieter one', () => {
    const quiet = rms(Float32Array.from({ length: 100 }, () => 0.01));
    const loud = rms(Float32Array.from({ length: 100 }, () => 0.5));
    expect(loud).toBeGreaterThan(quiet);
  });
});
