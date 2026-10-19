/**

 * SayBack — Audio Engine

 *

 * Dedicated, reusable audio processing module. All processing happens locally

 * in the browser (Web Audio API + MediaRecorder). Nothing is uploaded.

 *

 * Pure functions (decodeAudio, reverseAudioBuffer, reverseChannel) are exported

 * so they can be unit-tested in isolation with mocked AudioBuffer/AudioContext.

 */



export const MIME_CANDIDATES: readonly string[] = [

  'audio/webm;codecs=opus',

  'audio/webm',

  'audio/ogg;codecs=opus',

  'audio/ogg',

  'audio/mp4',

  'audio/wav',

];



/** A decoded, ready-to-play audio clip with its playback object URL. */

export interface AudioClip {

  id: string;

  buffer: AudioBuffer;

  url: string;

  duration: number;

  sampleRate: number;

  mimeType: string;

  createdAt: number;

}



/** Runtime error info surfaced to the UI in a friendly, actionable way. */

export interface AudioError {

  code: 'microphone-denied' | 'microphone-missing' | 'unsupported-format' |

    'recording-failed' | 'empty-recording' | 'playback-failed' |

    'audio-context-failed' | 'already-recording' | 'already-playing';

  message: string;

  retryable: boolean;

}



export class AudioErrorExt extends Error {

  constructor(public readonly code: AudioError['code'], message: string, public readonly retryable: boolean) {

    super(message);

    this.name = 'AudioErrorExt';

  }

}



/**

 * Detect the first MediaRecorder MIME type the browser supports.

 * Never assume a single format works everywhere.

 */

export function detectSupportedMimeType(candidates: readonly string[] = MIME_CANDIDATES): string {

  if (typeof MediaRecorder === 'undefined') {

    throw new AudioErrorExt('unsupported-format', 'MediaRecorder is not supported in this browser.', false);

  }

  for (const type of candidates) {

    try {

      const supportsFn = (MediaRecorder as unknown as { isTypeSupported?: (t: string) => boolean }).isTypeSupported;
      if (typeof supportsFn === 'function' ? supportsFn.call(MediaRecorder, type) : true) {

        return type;

      }

    } catch {

      // isTypeSupported can throw on some browsers for exotic types; skip.

    }

  }

  throw new AudioErrorExt(

    'unsupported-format',

    'No supported audio recording format found in this browser.',

    false,

  );

}



/** Reverse a single channel's PCM samples in place (returns a new Float32Array). */

export function reverseChannel(channel: Float32Array): Float32Array {

  const reversed = new Float32Array(channel.length);

  const len = channel.length;

  for (let i = 0; i < len; i++) {

    const value = channel[len - 1 - i];

    reversed[i] = value === undefined ? 0 : value;

  }

  return reversed;

}



/**

 * Reverse decoded PCM samples for every channel independently.

 * Preserves duration, sample rate, and channel count (mono or stereo).

 */

export function reverseAudioBuffer(buffer: AudioBuffer): AudioBuffer {
  if (!buffer || buffer.length === 0) throw new AudioErrorExt('empty-recording', 'Cannot reverse an empty recording.', true);

  const { numberOfChannels, length, sampleRate, duration } = buffer;

  const w = typeof window !== 'undefined' ? window : null; const AudioBufferCtor = (w as unknown as { AudioBuffer?: typeof AudioBuffer })?.AudioBuffer;

  const reversed = AudioBufferCtor

    ? new AudioBufferCtor({ numberOfChannels, length, sampleRate })

    : new AudioBuffer({ numberOfChannels, length, sampleRate });



  for (let ch = 0; ch < numberOfChannels; ch++) {

    const input = buffer.getChannelData(ch);

    const output = reversed.getChannelData(ch);

    output.set(reverseChannel(input));

  }



  try { Object.defineProperty(reversed, 'duration', { value: duration, configurable: true }); } catch { /* read-only in some impls */ }

  return reversed;

}



/**

 * Decode an ArrayBuffer (e.g. from a recorded Blob) into an AudioBuffer.

 */

export async function decodeAudio(

  arrayBuffer: ArrayBuffer,

  context: AudioContext,

): Promise<AudioBuffer> {

  return context.decodeAudioData(arrayBuffer.slice(0));

}



/**

 * Create a singleton-ish engine factory. Components should hold one engine

 * instance for the duration of a game session and call release() on unmount.

 */

export function createAudioEngine(): AudioEngine {

  return new AudioEngine();

}



/**

 * AudioEngine manages the microphone, recording, decoding, reversal, and playback

 * lifecycle for a single game session. One instance per session; call release()

 * when the user exits the flow.

 */

export class AudioEngine {

  private context: AudioContext | null = null;

  private analyser: AnalyserNode | null = null;

  private streamSource: MediaStreamAudioSourceNode | null = null;

  private gain: GainNode | null = null;

  private playbackSource: AudioBufferSourceNode | null = null;

  private mediaRecorder: MediaRecorder | null = null;

  private stream: MediaStream | null = null;

  private chunks: Blob[] = [];
  private stopPromise: Promise<void> | null = null; // resolves on MediaRecorder onstop
  private stopResolve: (() => void) | null = null;

  private recordingStart = 0;

  private recordingTimer: ReturnType<typeof setInterval> | null = null;

  private mimeType = '';

  private visibilityHandler: (() => void) | null = null;



  /** Whether a recording session is currently active. */

  isRecording(): boolean {

    return this.mediaRecorder?.state === 'recording';

  }



  /** Whether audio is currently playing back. */

  isPlaying(): boolean {

    return this.playbackSource !== null;

  }



  /** Elapsed recording time in milliseconds. */

  getElapsedMs(): number {

    if (!this.recordingStart) return 0;

    return Date.now() - this.recordingStart;

  }



  /** Current mime type being used for recording. */

  getMimeType(): string {

    return this.mimeType;

  }



  /** Ensure an AudioContext exists, resuming if suspended (user gesture required). */

  private async ensureContext(): Promise<AudioContext> {

    if (this.context) { if (this.context.state === 'suspended') { try { await this.context.resume(); } catch { /* retry on gesture */ } } return this.context; }



    if (typeof window === 'undefined') throw new AudioErrorExt('audio-context-failed', 'Web Audio API is not available.', false);

    const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;



    if (!AudioContextCtor) {

      throw new AudioErrorExt('audio-context-failed', 'Web Audio API is not available in this browser.', false);

    }



    this.context = new AudioContextCtor();



    if (!this.visibilityHandler && typeof document !== 'undefined') {

      this.visibilityHandler = () => this.handleVisibilityChange();

      document.addEventListener('visibilitychange', this.visibilityHandler, { passive: true });

    }



    if (this.context.state === 'suspended') {

      try {

        await this.context.resume();

      } catch {

        // Resume may fail without a gesture; the next user interaction retries.

      }

    }



    return this.context;

  }



  private handleVisibilityChange(): void {

    if (document.hidden) {

      this.stopPlayback();

    } else if (this.context?.state === 'suspended') {

      void this.context.resume();

    }

  }



  /** Request microphone access only after a clear user action. */

  async requestMicrophone(): Promise<MediaStream> {

    await this.ensureContext();



    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {

      throw new AudioErrorExt('microphone-missing', 'This browser does not provide microphone access.', false);

    }



    try {

      const devices = await navigator.mediaDevices.enumerateDevices();

      const hasInput = devices.length === 0 || devices.some((d) => d.kind === 'audioinput');

      if (!hasInput) {

        throw new AudioErrorExt('microphone-missing', 'No microphone was found on this device.', false);

      }

    } catch (err) {

      if (err instanceof AudioErrorExt) throw err;

    }



    let stream: MediaStream;

    try {

      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    } catch (err) {

      const isDenied =

        err instanceof Error &&

        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' ||

          (err as unknown as { code?: number }).code === 1);

      if (isDenied) {

        throw new AudioErrorExt(

          'microphone-denied',

          'Microphone access was denied. SayBack needs the microphone to record. ' +

            'Please allow microphone access in your browser settings and try again.',

          true,

        );

      }

      throw new AudioErrorExt(

        'microphone-missing',

        'Could not access the microphone. Make sure a microphone is connected and not muted.',

        true,

      );

    }



    this.stream = stream;

    return stream;

  }



  /**

   * Start recording from the already-requested microphone stream.

   * Throws if a recording is already in progress (prevents double recording).

   */

  async startRecording(): Promise<{ mimeType: string; sampleRate: number }> {

    if (this.isRecording()) {

      throw new AudioErrorExt('already-recording', 'A recording is already in progress.', true);

    }



    const context = await this.ensureContext();

    let mimeType = '';
    try { mimeType = detectSupportedMimeType(); } catch { mimeType = ''; }

    this.mimeType = mimeType;



    if (!this.stream) {

      await this.requestMicrophone();

    }



    this.streamSource = context.createMediaStreamSource(this.stream!);

    this.analyser = context.createAnalyser();

    this.analyser.fftSize = 2048;

    this.streamSource.connect(this.analyser);



    this.gain = context.createGain();

    this.gain.gain.value = 0;

    this.streamSource.connect(this.gain);

    this.gain.connect(context.destination);



    this.chunks = [];

    this.recordingStart = Date.now();
    this.stopPromise = new Promise<void>((resolve) => { this.stopResolve = resolve; });



    try {

      this.mediaRecorder = this.mimeType ? new MediaRecorder(this.stream!, { mimeType: this.mimeType }) : new MediaRecorder(this.stream!);

    } catch (err) {

      throw new AudioErrorExt(

        'unsupported-format',

        'Could not create a recorder for the detected audio format.',

        false,

      );

    }



    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {

      if (event.data && event.data.size > 0) {

        this.chunks.push(event.data);

      }

    };



    this.mediaRecorder.onstop = () => {

      // Recording finalised; resolve the stop promise so stopRecording() can decode.
      const resolveStop = this.stopResolve;
      this.stopResolve = null;
      this.stopPromise = null;
      resolveStop?.();

    };



    this.mediaRecorder.onerror = () => {

      this.cleanupRecordingResources();

      this.cleanupRecordingResources();
      const resolveStop = this.stopResolve;
      this.stopResolve = null;
      this.stopPromise = null;
      resolveStop?.();

    };



    try { this.mediaRecorder.start(250); } catch { this.cleanupRecordingResources(); throw new AudioErrorExt('recording-failed', 'Unable to start recording. Please try again.', true); }



    this.recordingTimer = setInterval(() => {

      void this.readWaveform();

    }, 33);



    return { mimeType, sampleRate: context.sampleRate };

  }



  /** Read current waveform samples for visualization (caller polls). */

  readWaveform(): Float32Array | null {

    if (!this.analyser) return null;

    const data = new Float32Array(this.analyser.fftSize);

    this.analyser.getFloatTimeDomainData(data);

    return data;

  }



  /**

   * Stop recording, decode the captured audio, reverse it, and return an AudioClip.

   * Releases microphone tracks immediately after capture.

   */

  async stopRecording(): Promise<AudioClip> {

    if (!this.isRecording() && this.chunks.length === 0) {

      throw new AudioErrorExt('empty-recording', 'No audio was recorded.', true);

    }



    if (this.mediaRecorder) {

      try {

        this.mediaRecorder.stop();
        const pendingStop = this.stopPromise;
        if (pendingStop) {
          await Promise.race([pendingStop, new Promise<void>((resolve) => setTimeout(resolve, 1500))]);
        }
        try { this.mediaRecorder?.requestData(); } catch { /* ignore */ }
        await new Promise<void>((resolve) => setTimeout(resolve, 50));

      } catch {

        // ignore double-stop

      }

    }

    if (this.recordingTimer) {

      clearInterval(this.recordingTimer);

      this.recordingTimer = null;

    }



    const context = await this.ensureContext();



    // Release microphone tracks as soon as capture stops.

    this.releaseMicrophoneStream();



    const blob = new Blob(this.chunks, { type: this.mimeType || 'audio/webm' });

    if (blob.size === 0) {

      throw new AudioErrorExt('empty-recording', 'The recording contained no audio data. Please try again.', true);

    }



    const arrayBuffer = await blob.arrayBuffer();

    let buffer: AudioBuffer;

    try {

      buffer = await decodeAudio(arrayBuffer, context);

    } catch {

      throw new AudioErrorExt('recording-failed', 'Failed to decode the recorded audio. Please try again.', true);

    }



    if (buffer.length === 0 || buffer.duration <= 0) {

      throw new AudioErrorExt('empty-recording', 'The recording was empty. Please try again.', true);

    }



    const clip: AudioClip = {

      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `clip-${Date.now()}-${Math.random().toString(36).slice(2)}`,

      buffer,

      url: '',

      duration: buffer.duration,

      sampleRate: buffer.sampleRate,

      mimeType: this.mimeType || 'audio/webm',

      createdAt: Date.now(),

    };



    this.chunks = [];

    this.mediaRecorder = null;

    this.recordingStart = 0;

    this.mimeType = '';



    this.stopPromise = null;
    this.stopResolve = null;
    return clip;

  }



  /** Abort an in-progress recording and release all mic resources without keeping audio. */

  abortRecording(): void {

    if (this.recordingTimer) {

      clearInterval(this.recordingTimer);

      this.recordingTimer = null;

    }

    if (this.mediaRecorder) {

      try {

        if (this.mediaRecorder.state === 'recording') this.mediaRecorder.stop();

      } catch {

        /* ignore */

      }

      this.mediaRecorder = null;

    }

    this.releaseMicrophoneStream();

    this.chunks = [];

    this.recordingStart = 0;

    this.mimeType = '';

  }



  private releaseMicrophoneStream(): void {

    this.stream?.getTracks().forEach((track) => {

      track.stop();

    });

    this.stream = null;

    if (this.streamSource) { try { this.streamSource.disconnect(); } catch { /* ignore */ } }
    this.streamSource = null;

    this.analyser = null;

    if (this.gain) {

      try { this.gain.disconnect(); } catch { /* ignore */ }

      this.gain = null;

    }

  }



  private cleanupRecordingResources(): void {

    this.mediaRecorder = null;

    this.recordingTimer = null;

    this.releaseMicrophoneStream();

    this.chunks = [];

    this.recordingStart = 0;

    this.mimeType = '';

  }



  /**

   * Play an AudioClip or raw AudioBuffer. Stops any active playback first so

   * playback never overlaps.

   */

  async play(clipOrBuffer: AudioClip | AudioBuffer): Promise<void> {

    this.stopPlayback();



    const context = await this.ensureContext();

    const buffer = typeof AudioBuffer !== 'undefined' && clipOrBuffer instanceof AudioBuffer ? clipOrBuffer : (clipOrBuffer as AudioClip).buffer;



    if (!this.gain) {

      this.gain = context.createGain();

      this.gain.gain.value = 1;

      this.gain.connect(context.destination);

    }



    const source = context.createBufferSource();

    source.buffer = buffer;

    source.connect(this.gain);



    let finished = false;

    const onEnded = () => {

      if (finished) return;

      finished = true;

      if (this.playbackSource === source) {

        this.playbackSource = null;

      }

      try { source.disconnect(); } catch { /* ignore */ }

    };

    source.onended = onEnded;




    this.playbackSource = source;



    try {

      source.start(0);

    } catch (err) {

      this.playbackSource = null;

      throw new AudioErrorExt('playback-failed', 'Unable to start playback.', true);

    }

  }

  stopPlayback(): void {

    if (this.playbackSource) {

      try {

        this.playbackSource.stop(0);

      } catch {

        /* source may already be finished */

      }

      try { this.playbackSource.disconnect(); } catch { /* ignore */ }

      this.playbackSource = null;

    }

  }



  /**

   * Reverse an AudioClip's buffer and return a new clip whose buffer holds the

   * reversed PCM samples.

   */

  reverseClip(clip: AudioClip): AudioClip {

    const reversedBuffer = reverseAudioBuffer(clip.buffer);

    return {

      ...clip,

      id: `rev-${clip.id}`,

      buffer: reversedBuffer,

      url: '',

      duration: reversedBuffer.duration,

      createdAt: Date.now(),

    };

  }



  /**

   * Release all audio resources: stop playback, release mic, close context.

   * Call when the user exits the recording flow or the app unloads.

   */

  release(): void {

    this.stopPlayback();

    this.abortRecording();

    this.releaseMicrophoneStream();

    if (this.context) {

      try {

        void this.context.close();

      } catch {

        /* ignore */

      }

      this.context = null;

    }

    if (this.visibilityHandler && typeof document !== 'undefined') {

      document.removeEventListener('visibilitychange', this.visibilityHandler);

      this.visibilityHandler = null;

    }

  }

}
