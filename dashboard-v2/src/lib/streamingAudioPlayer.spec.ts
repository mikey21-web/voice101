import { describe, it, expect } from 'vitest';
import { base64ToBytes, pcm16BytesToFloat32, parseSSEFrames } from './streamingAudioPlayer';

describe('base64ToBytes', () => {
  it('decodes back to the original bytes', () => {
    const original = new Uint8Array([0, 1, 127, 128, 255]);
    const b64 = btoa(String.fromCharCode(...original));
    expect(Array.from(base64ToBytes(b64))).toEqual(Array.from(original));
  });
});

describe('pcm16BytesToFloat32', () => {
  it('converts little-endian PCM16 samples into the -1..1 float range', () => {
    // 0, 32767 (max positive), -32768 (max negative), little-endian byte pairs.
    const bytes = new Uint8Array([0x00, 0x00, 0xff, 0x7f, 0x00, 0x80]);
    const floats = pcm16BytesToFloat32(bytes);
    expect(floats[0]).toBeCloseTo(0, 5);
    expect(floats[1]).toBeCloseTo(32767 / 32768, 4);
    expect(floats[2]).toBeCloseTo(-1, 4);
  });
});

describe('parseSSEFrames', () => {
  it('parses complete frames and keeps an incomplete trailing frame as remainder', () => {
    const buffered = 'data: {"seq":0,"audioBase64":"AA=="}\n\ndata: {"seq":1,"final":true}\n\ndata: {"seq":2,"audi';
    const { messages, remainder } = parseSSEFrames(buffered);
    expect(messages).toEqual([{ seq: 0, audioBase64: 'AA==' }, { seq: 1, final: true }]);
    expect(remainder).toBe('data: {"seq":2,"audi');
  });

  it('skips a malformed frame instead of throwing', () => {
    const buffered = 'data: not json\n\ndata: {"seq":1}\n\n';
    const { messages } = parseSSEFrames(buffered);
    expect(messages).toEqual([{ seq: 1 }]);
  });

  it('returns everything as remainder when no frame boundary has arrived yet', () => {
    const { messages, remainder } = parseSSEFrames('data: {"seq":0');
    expect(messages).toEqual([]);
    expect(remainder).toBe('data: {"seq":0');
  });
});
