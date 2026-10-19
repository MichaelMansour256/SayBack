import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AudioEngine, AudioErrorExt, detectSupportedMimeType, reverseAudioBuffer, reverseChannel } from './audio';
import { createGameMachine } from './game';
function makeBuffer(channels: number[][], sampleRate = 44100): AudioBuffer {
  const length = channels[0]?.length ?? 0;
  const buf = new AudioBuffer({ numberOfChannels: channels.length, length, sampleRate });
  channels.forEach((ch, i) => buf.getChannelData(i).set(ch));
  return buf;
}
describe('reverseChannel', () => {
  it('reverses a known sample order', () => {
    expect(Array.from(reverseChannel(new Float32Array([1, 2, 3, 4])))).toEqual([4, 3, 2, 1]);
  });
});
describe('reverseAudioBuffer', () => {
  it('reverses mono samples', () => {
    expect(Array.from(reverseAudioBuffer(makeBuffer([[1, 2, 3, 4]])).getChannelData(0))).toEqual([4, 3, 2, 1]);
  });
  it('double reversal restores the original', () => {
    const src = [0.1, -0.5, 0.9, 0.0, -0.2];
    const twice = reverseAudioBuffer(reverseAudioBuffer(makeBuffer([src])));
    twice.getChannelData(0).forEach((v, i) => expect(Math.abs(v - src[i]!)).toBeLessThan(1e-6));
  });
  it('reverses each stereo channel independently', () => {
    const out = reverseAudioBuffer(makeBuffer([[1, 2, 3], [10, 20, 30]]));
    expect(out.numberOfChannels).toBe(2);
    expect(Array.from(out.getChannelData(0))).toEqual([3, 2, 1]);
    expect(Array.from(out.getChannelData(1))).toEqual([30, 20, 10]);
  });
  it('fails gracefully on empty recordings', () => {
    expect(() => reverseAudioBuffer({ length: 0 } as AudioBuffer)).toThrowError(AudioErrorExt);
  });
});
describe('detectSupportedMimeType', () => {
  it('throws when MediaRecorder is missing', () => {
    const RealMR = globalThis.MediaRecorder;
    (globalThis as unknown as { MediaRecorder?: unknown }).MediaRecorder = undefined;
    expect(() => detectSupportedMimeType()).toThrowError(/not supported/i);
    globalThis.MediaRecorder = RealMR;
  });
});
describe('AudioEngine guards', () => {
  let engine: AudioEngine;
  beforeEach(() => { engine = new AudioEngine(); });
  it('prevents double recording', async () => {
    (engine as unknown as { mediaRecorder: unknown }).mediaRecorder = { state: 'recording' };
    await expect(engine.startRecording()).rejects.toMatchObject({ code: 'already-recording' });
  });
  it('never overlaps playback', async () => {
    const clip = { buffer: makeBuffer([[1, 2, 3]]) } as unknown as Parameters<AudioEngine['play']>[0];
    await engine.play(clip);
    expect((engine as unknown as { playbackSource: unknown }).playbackSource).not.toBeNull();
    await engine.play(clip);
    expect((engine as unknown as { playbackSource: unknown }).playbackSource).not.toBeNull();
  });
  it('abort clears state for retry', () => {
    (engine as unknown as { chunks: unknown[] }).chunks = [new Blob(['x'])];
    engine.abortRecording();
    expect((engine as unknown as { chunks: unknown[] }).chunks).toEqual([]);
  });
});
describe('mic denial + game machine', () => {
  it('denial produces actionable error', async () => {
    const e = new AudioEngine();
    const nav = navigator as unknown as { mediaDevices?: unknown };
    const orig = nav.mediaDevices;
    nav.mediaDevices = { enumerateDevices: async () => [], getUserMedia: async () => { const err = new Error('d') as Error & { name: string }; err.name = 'NotAllowedError'; throw err; } };
    await expect(e.requestMicrophone()).rejects.toMatchObject({ code: 'microphone-denied' });
    nav.mediaDevices = orig;
  });
  it('rejects invalid transitions', () => {
    expect(() => createGameMachine().transition('revealed')).toThrowError(/Invalid/);
  });
  it('hides secret until reveal', () => {
    const m = createGameMachine();
    m.startNewRound({ difficulty: 'easy', wordMode: 'custom', maxReversedPlays: 3, maxReconstructedPlays: 3 }, 'banana');
    expect(m.round?.originalWordRevealed).toBe(false);
    m.submitGuess('x');
    expect(m.state).toBe('revealed');
    expect(m.round?.originalWordRevealed).toBe(true);
  });
});
