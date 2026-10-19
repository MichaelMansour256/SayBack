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
    nav.mediaDevices = {
      enumerateDevices: async () => [],
      getUserMedia: async () => {
        const err = new Error('d') as Error & { name: string };
        err.name = 'NotAllowedError';
        throw err;
      },
    };
    await expect(e.requestMicrophone()).rejects.toMatchObject({ code: 'microphone-denied' });
    nav.mediaDevices = orig;
  });

  it('rejects invalid transitions', () => {
    expect(() => createGameMachine().transition('revealed')).toThrowError(/Invalid/);
  });
});

describe('simplified game flow', () => {
  it('startNewRound sets state to requesting-microphone with clean round', () => {
    const m = createGameMachine();
    m.startNewRound();
    expect(m.state).toBe('requesting-microphone');
    expect(m.round).not.toBeNull();
    expect(m.round?.originalClipId).toBeNull();
    expect(m.round?.reversedClipId).toBeNull();
    expect(m.round?.imitationClipId).toBeNull();
    expect(m.round?.reconstructedClipId).toBeNull();
  });

  it('full happy-path transitions succeed', () => {
    const m = createGameMachine();
    m.startNewRound();
    m.transition('recording-original');
    m.transition('processing-original');
    m.transition('listening-to-reversed');
    m.transition('recording-imitation');
    m.transition('processing-imitation');
    m.transition('listening-to-reconstructed');
    m.transition('guessing');
    m.revealAnswer();
    expect(m.state).toBe('revealed');
    expect(m.round?.completedAt).not.toBeNull();
  });

  it('restartRound resets to requesting-microphone with fresh round', () => {
    const m = createGameMachine();
    m.startNewRound();
    const firstId = m.round?.id;
    m.transition('recording-original');
    m.restartRound();
    expect(m.state).toBe('requesting-microphone');
    expect(m.round?.id).not.toBe(firstId);
    expect(m.round?.originalClipId).toBeNull();
  });

  it('updateRound stores clip IDs', () => {
    const m = createGameMachine();
    m.startNewRound();
    m.updateRound({ originalClipId: 'clip-1', reversedClipId: 'rev-clip-1' });
    expect(m.round?.originalClipId).toBe('clip-1');
    expect(m.round?.reversedClipId).toBe('rev-clip-1');
  });

  it('error state clears on clearError', () => {
    const m = createGameMachine();
    m.setError('recording-failed', 'oops', true);
    expect(m.state).toBe('error');
    m.clearError();
    expect(m.state).toBe('idle');
    expect(m.error).toBeNull();
  });

  it('no secretAnswer, guess, or difficulty on round', () => {
    const m = createGameMachine();
    m.startNewRound();
    const round = m.round as unknown as Record<string, unknown>;
    expect(round['secretAnswer']).toBeUndefined();
    expect(round['guess']).toBeUndefined();
    expect(round['difficulty']).toBeUndefined();
    expect(round['wordMode']).toBeUndefined();
  });

  it('subscribers are notified on transitions', () => {
    const m = createGameMachine();
    const spy = vi.fn();
    const unsub = m.subscribe(spy);
    m.startNewRound();
    expect(spy).toHaveBeenCalledTimes(1);
    m.transition('recording-original');
    expect(spy).toHaveBeenCalledTimes(2);
    unsub();
    m.transition('processing-original');
    expect(spy).toHaveBeenCalledTimes(2); // no more calls after unsub
  });
});
