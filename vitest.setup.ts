import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// Clean up DOM after each test.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Minimal jsdom-friendly AudioContext mock.
// Real AudioContext requires an audio device; jsdom has none.
class MockAudioNode {
  connect() { return this; }
  disconnect() {}
  addEventListener() {}
  removeEventListener() {}
}

class MockAudioBuffer {
  constructor(public readonly numberOfChannels: number, public readonly length: number, public readonly sampleRate: number) {
    this._channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  private _channels: Float32Array[];
  getChannelData(channel: number): Float32Array {
    return this._channels[channel]!;
  }
  copyFromChannel(destination: Float32Array, channel: number): void {
    destination.set(this._channels[channel]!);
  }
  copyToChannel(source: Float32Array, channel: number): void {
    this._channels[channel]!.set(source);
  }
}

class MockAudioContext {
  state = 'running';
  sampleRate = 44100;
  currentTime = 0;
  destination = new MockAudioNode();
  createBuffer() { return new MockAudioBuffer(1, 1, this.sampleRate); }
  createBufferSource() {
    const source = new MockAudioNode() as MockAudioNode & { buffer: MockAudioBuffer | null; start: () => void; stop: () => void };
    source.buffer = null;
    source.start = () => {};
    source.stop = () => {};
    return source;
  }
  createAnalyser() {
    return {
      connect: () => {},
      disconnect: () => {},
      getByteTimeDomainData: () => {},
      getFloatTimeDomainData: (arr: Float32Array) => { arr.fill(0); },
      fftSize: 2048,
    } as unknown as AnalyserNode;
  }
  createGain() {
    const gain = new MockAudioNode() as MockAudioNode & { gain: { value: number; setValueAtTime: () => void; linearRampToValueAtTime: () => void } };
    gain.gain = { value: 1, setValueAtTime: () => {}, linearRampToValueAtTime: () => {} };
    return gain;
  }
  createMediaStreamSource() {
    return new MockAudioNode();
  }
  decodeAudioData() {
    return Promise.resolve(new MockAudioBuffer(1, 1024, this.sampleRate));
  }
  resume() { return Promise.resolve(); }
  suspend() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}

// Spec-compatible global AudioBuffer mock (jsdom provides none).
// Constructor takes an options object like the real Web Audio API.
class MockGlobalAudioBuffer {
  readonly numberOfChannels: number;
  readonly length: number;
  readonly sampleRate: number;
  private _channels: Float32Array[];
  constructor(options: { numberOfChannels: number; length: number; sampleRate: number }) {
    this.numberOfChannels = options.numberOfChannels;
    this.length = options.length;
    this.sampleRate = options.sampleRate;
    this._channels = Array.from(
      { length: options.numberOfChannels },
      () => new Float32Array(options.length),
    );
  }
  get duration(): number {
    return this.length / this.sampleRate;
  }
  getChannelData(channel: number): Float32Array {
    return this._channels[channel]!;
  }
  copyFromChannel(destination: Float32Array, channel: number): void {
    destination.set(this._channels[channel]!);
  }
  copyToChannel(source: Float32Array, channel: number): void {
    this._channels[channel]!.set(source);
  }
}

Object.defineProperty(globalThis, 'AudioBuffer', {
  writable: true,
  configurable: true,
  value: MockGlobalAudioBuffer,
});

Object.defineProperty(globalThis, 'AudioContext', {
  writable: true,
  configurable: true,
  value: MockAudioContext,
});
Object.defineProperty(globalThis, 'webkitAudioContext', {
  writable: true,
  configurable: true,
  value: MockAudioContext,
});

// MediaRecorder mock
const fakeChunks: Uint8Array[] = [];
class MockMediaRecorder {
  state = 'inactive';
  stream: MediaStream;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((e: Error) => void) | null = null;

  constructor(stream: MediaStream) {
    this.stream = stream;
  }

  start() {
    this.state = 'recording';
    fakeChunks.length = 0;
  }

  stop() {
    this.state = 'inactive';
    const blob = new Blob(fakeChunks as unknown as BlobPart[], { type: 'audio/webm' });
    if (this.ondataavailable) {
      this.ondataavailable({ data: blob } as unknown as BlobEvent);
    }
    if (this.onstop) {
      this.onstop();
    }
  }

  addTrack() {}
  requestData() {
    if (this.ondataavailable) {
      this.ondataavailable({ data: new Blob(fakeChunks as unknown as BlobPart[], { type: 'audio/webm' }) } as unknown as BlobEvent);
    }
  }

  static isTypeSupported() { return true; }
}

Object.defineProperty(globalThis, 'MediaRecorder', {
  writable: true,
  configurable: true,
  value: MockMediaRecorder,
});

(globalThis as any).__FAKE_CHUNKS__ = fakeChunks;
(globalThis as any).__MOCK_MEDIA_RECORDER__ = MockMediaRecorder;
