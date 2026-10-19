'use client';

import { useEffect, useState } from 'react';
import { useGame, type Difficulty, type WordMode } from '@/components/game-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Waveform } from '@/components/ui/waveform';
import {
  Mic,
  MicOff,
  StopCircle,
  RefreshCw,
  Play,
  ArrowRight,
  Volume2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function CreateRoundScreen() {
  const {
    machine,
    engine,
    requestMicAndRecord,
    finishOriginal,
    retryCurrentRecording,
    playClip,
    stopPlayback,
    startRound,
    error,
    getClip,
  } = useGame();

  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [wordMode, setWordMode] = useState<WordMode>('custom');
  const [secretAnswer, setSecretAnswer] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false); const [, setTick] = useState(0);

  const state = machine.state;
  const recording = state === 'recording-original';
  const requesting = state === 'requesting-microphone';
  const originalClip = getClip(machine.round?.originalClipId ?? null);
  const hasOriginal = !!originalClip;
  const elapsed = engine?.getElapsedMs() ?? 0; useEffect(() => { if (!recording) return; const t = setInterval(() => setTick((x) => x + 1), 250); return () => clearInterval(t); }, [recording]);

  const handleStart = () => {
    const answer = wordMode === 'custom' ? (secretAnswer.trim() || null) : null;
    startRound(
      { difficulty, wordMode, maxReversedPlays: 3, maxReconstructedPlays: 3 },
      answer,
    );
    void requestMicAndRecord();
  };

  const handleStop = async () => {
    await finishOriginal();
  };

  const handleRetry = async () => {
    setConfirmDiscard(false);
    if (hasOriginal && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    await retryCurrentRecording();
  };

  const handleReplayOriginal = async () => {
    await playClip(machine.round?.originalClipId ?? null);
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const difficultyLabels: Record<Difficulty, string> = {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
  };

  const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 safe-area">
      <div className="w-full max-w-md space-y-4">
        <Card className="bg-gradient-to-b from-violet-900/40 to-navy/20 border-violet-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-coral" aria-hidden="true" />
              Create a Round
            </CardTitle>
            <CardDescription>
              Player A: record the secret word or phrase the other player must guess.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    'py-2.5 rounded-xl text-sm font-semibold transition-colors border',
                    difficulty === d
                      ? 'bg-violet-500 text-white border-violet-500'
                      : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10',
                  )}
                >
                  {difficultyLabels[d]}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-white/90 cursor-pointer select-none">
                <input
                  type="radio"
                  name="word-mode"
                  checked={wordMode === 'custom'}
                  onChange={() => setWordMode('custom')}
                  className="accent-violet-500"
                  readOnly
                />
                Custom word
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-white/90 cursor-pointer select-none">
                <input
                  type="radio"
                  name="word-mode"
                  checked={wordMode === 'preset'}
                  onChange={() => setWordMode('preset')}
                  className="accent-violet-500"
                  readOnly
                />
                Preset word
              </label>
            </div>

            {wordMode === 'custom' && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-white/70 block">
                  Secret answer (optional)
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={secretAnswer}
                    onChange={(e) => setSecretAnswer(e.target.value)}
                    placeholder="e.g. strawberry"
                    className="w-full py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-violet-400 focus:ring-1 focus:ring-violet-400 outline-none"
                  />
                  <button
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-violet-300 hover:text-violet-200"
                  >
                    {showSecret ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="text-[10px] text-white/50">
                  Hidden from the guessing player until the reveal.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {requesting ? (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6 text-center">
            <p className="text-violet-300 font-medium mb-2">Setting up microphone…</p>
            <p className="text-xs text-white/60">
              Please allow microphone access when prompted.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recording ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-mono font-bold text-violet-300">
                      {formatTime(elapsed)}
                    </span>
                    <Waveform samples={null} active={recording} />
                  </div>
                  <Button
                    onClick={handleStop}
                    variant="destructive"
                    size="lg"
                    className="flex-1"
                  >
                    <StopCircle className="h-6 w-6 mr-2" aria-hidden="true" />
                    Stop Recording
                  </Button>
                </div>
                {hasOriginal && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleReplayOriginal}
                    disabled={engine?.isPlaying()}
                  >
                    <Volume2 className="h-4 w-4 mr-2" aria-hidden="true" />
                    Replay Original
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleRetry}
                    disabled={!confirmDiscard && hasOriginal}
                    className="flex-1"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                    Retry
                  </Button>
                </div>
                )}
                {confirmDiscard && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-300 text-center">
                    Discarding your recording. Tap Retry again to confirm.
                  </div>
                )}
                {hasOriginal && !recording && (
                  <p className="text-xs text-white/60 text-center">Saved — stopping takes you to the reversed clip.</p>
                )}
              </>
            ) : (
              <Button
                onClick={handleStart}
                variant="record"
                size="lg"
                className="w-full"
                disabled={requesting || engine?.isRecording()}
              >
                {requesting ? (
                  <>
                    <MicOff className="h-5 w-5 mr-2" aria-hidden="true" />
                    Setting Up Microphone…
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5 mr-2" aria-hidden="true" />
                    Record Secret
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {error && (
          <Card className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-medium text-red-300">{error.message}</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}