'use client';

import {
  createGameMachine,
  GameMachine,
  AudioError,
} from '@/lib/game';
import {
  createAudioEngine,
  AudioEngine,
  AudioClip,
  AudioErrorExt,
} from '@/lib/audio';
import {
  useCallback,
  useContext,
  createContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

interface GameContextValue {
  machine: GameMachine;
  engine: AudioEngine | null;
  clips: Map<string, AudioClip>;
  getClip: (id: string | null) => AudioClip | undefined;
  storeClip: (clip: AudioClip) => string;
  startRound: () => void;
  requestMicAndRecord: () => Promise<void>;
  finishOriginal: () => Promise<void>;
  recordImitation: () => Promise<void>;
  finishImitation: () => Promise<void>;
  playClip: (id: string | null) => Promise<void>;
  stopPlayback: () => void;
  revealAnswer: () => void;
  retryCurrentRecording: () => Promise<void>;
  discardAndRestart: () => void;
  backHome: () => void;
  error: AudioError | null;
  clearError: () => void;
}

const gameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const machineRef = useRef<GameMachine | null>(null);
  const engineRef = useRef<AudioEngine | null>(null);
  const clipsRef = useRef<Map<string, AudioClip>>(new Map());
  if (!machineRef.current) machineRef.current = createGameMachine();
  if (!engineRef.current && typeof window !== 'undefined') {
    engineRef.current = createAudioEngine();
  }

  const [version, setVersion] = useState(0);
  const [engineReady, setEngineReady] = useState(false);

  useEffect(() => {
    const m = machineRef.current;
    if (!m) return;
    if (!engineRef.current) engineRef.current = createAudioEngine();
    setEngineReady(true);
    const unsub = m.subscribe(() => setVersion((v) => v + 1));

    const handleVisibility = () => {
      if (document.hidden) engineRef.current?.stopPlayback();
    };
    document.addEventListener('visibilitychange', handleVisibility, { passive: true });

    return () => {
      unsub();
      document.removeEventListener('visibilitychange', handleVisibility);
      engineRef.current?.release();
    };
  }, []);

  const m = machineRef.current as GameMachine;
  const clips = clipsRef.current;

  const storeClip = useCallback((clip: AudioClip) => {
    clips.set(clip.id, clip);
    return clip.id;
  }, [clips]);

  const getClip = useCallback((id: string | null): AudioClip | undefined => {
    if (!id) return undefined;
    return clips.get(id);
  }, [clips]);

  const safeTransition = useCallback(
    (next: Parameters<GameMachine['transition']>[0]) => {
      try {
        if (m.canTransition(next)) m.transition(next);
      } catch { /* UI guards primary flow */ }
    },
    [m],
  );

  const startRound = useCallback(() => {
    clips.clear();
    engineRef.current?.stopPlayback();
    engineRef.current?.abortRecording();
    m.startNewRound();
  }, [m, clips]);

  const requestMicAndRecord = useCallback(async () => {
    const eng = engineRef.current;
    if (!eng) return;
    try {
      if (m.state === 'idle' && m.canTransition('requesting-microphone')) {
        m.transition('requesting-microphone');
      }
      await eng.requestMicrophone();
      safeTransition('recording-original');
      await eng.startRecording();
    } catch (err) {
      if (err instanceof AudioErrorExt) {
        m.setError(err.code, err.message, err.retryable);
      } else {
        m.setError('recording-failed', 'Unable to start recording. Please try again.', true);
      }
    }
  }, [m, safeTransition]);

  const finishOriginal = useCallback(async () => {
    const eng = engineRef.current;
    if (!eng) return;
    safeTransition('processing-original');
    try {
      const original = await eng.stopRecording();
      const originalId = storeClip(original);
      const reversed = eng.reverseClip(original);
      storeClip(reversed);
      m.updateRound({ originalClipId: originalId, reversedClipId: reversed.id });
      safeTransition('listening-to-reversed');
    } catch (err) {
      if (err instanceof AudioErrorExt) {
        m.setError(err.code, err.message, err.retryable);
      } else {
        m.setError('recording-failed', 'Failed to process the original recording.', true);
      }
    }
  }, [m, storeClip, safeTransition]);

  const recordImitation = useCallback(async () => {
    const eng = engineRef.current;
    if (!eng) return;
    try {
      safeTransition('recording-imitation');
      await eng.startRecording();
    } catch (err) {
      if (err instanceof AudioErrorExt) {
        m.setError(err.code, err.message, err.retryable);
      } else {
        m.setError('recording-failed', 'Unable to start imitation recording.', true);
      }
    }
  }, [m, safeTransition]);

  const finishImitation = useCallback(async () => {
    const eng = engineRef.current;
    if (!eng) return;
    safeTransition('processing-imitation');
    try {
      const imitation = await eng.stopRecording();
      const imitationId = storeClip(imitation);
      const reconstructed = eng.reverseClip(imitation);
      storeClip(reconstructed);
      m.updateRound({ imitationClipId: imitationId, reconstructedClipId: reconstructed.id });
      safeTransition('listening-to-reconstructed');
    } catch (err) {
      if (err instanceof AudioErrorExt) {
        m.setError(err.code, err.message, err.retryable);
      } else {
        m.setError('recording-failed', 'Failed to process your imitation.', true);
      }
    }
  }, [m, storeClip, safeTransition]);

  const playClip = useCallback(async (id: string | null) => {
    const eng = engineRef.current;
    if (!eng) return;
    const clip = getClip(id);
    if (!clip) return;
    try {
      await eng.play(clip);
    } catch (err) {
      if (err instanceof AudioErrorExt) m.setError(err.code, err.message, err.retryable);
    }
  }, [getClip, m]);

  const stopPlayback = useCallback(() => {
    engineRef.current?.stopPlayback();
  }, []);

  const revealAnswer = useCallback(() => {
    m.revealAnswer();
  }, [m]);

  const retryCurrentRecording = useCallback(async () => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.abortRecording();
    const s = m.state;
    if (s === 'recording-original') {
      safeTransition('requesting-microphone');
      try {
        await eng.requestMicrophone();
        safeTransition('recording-original');
        await eng.startRecording();
      } catch (err) {
        if (err instanceof AudioErrorExt) m.setError(err.code, err.message, err.retryable);
      }
    } else if (s === 'recording-imitation') {
      safeTransition('listening-to-reversed');
      try {
        await eng.startRecording();
        safeTransition('recording-imitation');
      } catch (err) {
        if (err instanceof AudioErrorExt) m.setError(err.code, err.message, err.retryable);
      }
    }
  }, [m, safeTransition]);

  const discardAndRestart = useCallback(() => {
    engineRef.current?.stopPlayback();
    engineRef.current?.abortRecording();
    m.restartRound();
    void requestMicAndRecord();
  }, [m, requestMicAndRecord]);

  const backHome = useCallback(() => {
    engineRef.current?.stopPlayback();
    engineRef.current?.abortRecording();
    clips.clear();
    try {
      if (m.state !== 'idle' && m.canTransition('idle')) m.transition('idle');
    } catch { /* ignore */ }
  }, [m, clips]);

  const ctxError: AudioError | null = m.error;
  const value = useMemo<GameContextValue>(
    () => ({
      machine: m,
      engine: engineRef.current,
      clips,
      getClip,
      storeClip,
      startRound,
      requestMicAndRecord,
      finishOriginal,
      recordImitation,
      finishImitation,
      playClip,
      stopPlayback,
      revealAnswer,
      retryCurrentRecording,
      discardAndRestart,
      backHome,
      error: ctxError,
      clearError: () => m.clearError(),
    }),
    [
      m,
      version,
      engineReady,
      clips,
      getClip,
      storeClip,
      startRound,
      requestMicAndRecord,
      finishOriginal,
      recordImitation,
      finishImitation,
      playClip,
      stopPlayback,
      revealAnswer,
      retryCurrentRecording,
      discardAndRestart,
      backHome,
      ctxError,
    ],
  );

  return <gameContext.Provider value={value}>{children}</gameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(gameContext);
  if (!ctx) throw new Error('useGame must be used within a GameProvider');
  return ctx;
}
