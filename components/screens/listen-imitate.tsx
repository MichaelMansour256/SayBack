'use client';

import { useEffect, useState } from 'react';
import { useGame } from '@/components/game-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Waveform } from '@/components/ui/waveform';
import { Mic, StopCircle, RefreshCw, Play, Volume2, ArrowRight, AlertCircle, Headphones } from 'lucide-react';

type Stage = 'reversed' | 'recording' | 'reconstructed';

export function ListenImitateScreen({ stage }: { stage: Stage }) {
  const {
    machine,
    engine,
    recordImitation,
    finishImitation,
    playClip,
    retryCurrentRecording,
    error,
  } = useGame();

  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [, setTick] = useState(0);
  const state = machine.state;
  const isProcessing = state === 'processing-original' || state === 'processing-imitation';
  const elapsed = engine?.getElapsedMs() ?? 0;

  useEffect(() => {
    if (state !== 'recording-imitation') return;
    const t = setInterval(() => setTick((x) => x + 1), 250);
    return () => clearInterval(t);
  }, [state]);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  };

  if (isProcessing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 safe-area">
        <Card className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div
              className="h-6 w-6 rounded-full border-2 border-violet-400 border-t-transparent animate-[spin_1s_linear_infinite]"
              aria-hidden="true"
            />
          </div>
          <h3 className="font-semibold text-white">Processing audio…</h3>
          <p className="text-sm text-white/60 mt-2">Reversing the recording.</p>
        </Card>
      </div>
    );
  }

  const title =
    stage === 'reversed'
      ? 'Player B — Listen'
      : stage === 'recording'
        ? 'Player B — Imitate'
        : 'Listen to the Result';

  const hint =
    stage === 'reversed'
      ? "Listen to the reversed recording. Replay it as many times as you need, then imitate the sound."
      : stage === 'recording'
        ? "Record your best imitation of the reversed sound you just heard."
        : "This is your imitation reversed. Does it sound like the original word?";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 safe-area">
      <div className="w-full max-w-md space-y-4">
        <Card className="bg-gradient-to-b from-violet-900/40 to-navy/20 border-violet-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {stage === 'recording' ? (
                <Mic className="h-5 w-5 text-coral" aria-hidden="true" />
              ) : (
                <Headphones className="h-5 w-5 text-cyan-400" aria-hidden="true" />
              )}
              {title}
            </CardTitle>
            <CardDescription>{hint}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stage === 'reversed' && (
              <div className="space-y-3">
                <Button
                  onClick={() => void playClip(machine.round?.reversedClipId ?? null)}
                  variant="reverse"
                  disabled={engine?.isPlaying()}
                  className="w-full"
                >
                  <Play className="h-5 w-5 mr-2" aria-hidden="true" />
                  Play Reversed Recording
                </Button>
                <Button
                  onClick={() => void recordImitation()}
                  variant="record"
                  size="lg"
                  className="w-full"
                >
                  <Mic className="h-5 w-5 mr-2" aria-hidden="true" />
                  Record Imitation
                </Button>
              </div>
            )}

            {stage === 'recording' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-mono font-bold text-violet-300">
                    {formatTime(elapsed)}
                  </span>
                  <Waveform samples={null} active={true} />
                </div>
                <Button
                  onClick={() => void finishImitation()}
                  variant="destructive"
                  size="lg"
                  className="w-full"
                >
                  <StopCircle className="h-6 w-6 mr-2" aria-hidden="true" />
                  Stop Imitation
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!confirmDiscard) { setConfirmDiscard(true); return; }
                    setConfirmDiscard(false);
                    void retryCurrentRecording();
                  }}
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                  {confirmDiscard ? 'Tap again to confirm' : 'Retry'}
                </Button>
              </div>
            )}

            {stage === 'reconstructed' && (
              <div className="space-y-3">
                <Button
                  onClick={() => void playClip(machine.round?.reconstructedClipId ?? null)}
                  variant="play"
                  disabled={engine?.isPlaying()}
                  className="w-full"
                >
                  <Volume2 className="h-5 w-5 mr-2" aria-hidden="true" />
                  Play Result
                </Button>
                <Button
                  variant="reverse"
                  size="lg"
                  className="w-full"
                  onClick={() => machine.transition('guessing')}
                >
                  Make Your Guess <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <Card className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" aria-hidden="true" />
              <p className="font-medium text-red-300">{error.message}</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
