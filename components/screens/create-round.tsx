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
import { Mic, MicOff, StopCircle, AlertCircle } from 'lucide-react';

export function CreateRoundScreen() {
  const {
    machine,
    engine,
    requestMicAndRecord,
    finishOriginal,
    startRound,
    error,
  } = useGame();

  const [, setTick] = useState(0);

  const state = machine.state;
  const recording = state === 'recording-original';
  const requesting = state === 'requesting-microphone';
  const elapsed = engine?.getElapsedMs() ?? 0;

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setTick((x) => x + 1), 250);
    return () => clearInterval(t);
  }, [recording]);

  const handleStart = () => {
    startRound();
    void requestMicAndRecord();
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 safe-area">
      <div className="w-full max-w-md space-y-4">
        <Card className="bg-gradient-to-b from-violet-900/40 to-navy/20 border-violet-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-coral" aria-hidden="true" />
              Player A — Record
            </CardTitle>
            <CardDescription>
              Think of any word or phrase. Don&apos;t say it out loud — just record it when ready.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {requesting ? (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-6 text-center">
                <p className="text-violet-300 font-medium mb-2">Setting up microphone…</p>
                <p className="text-xs text-white/60">Please allow microphone access when prompted.</p>
              </div>
            ) : recording ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-mono font-bold text-violet-300">
                    {formatTime(elapsed)}
                  </span>
                  <Waveform samples={null} active={true} />
                </div>
                <Button
                  onClick={() => void finishOriginal()}
                  variant="destructive"
                  size="lg"
                  className="w-full"
                >
                  <StopCircle className="h-6 w-6 mr-2" aria-hidden="true" />
                  Stop Recording
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleStart}
                variant="record"
                size="lg"
                className="w-full"
                disabled={engine?.isRecording()}
              >
                <Mic className="h-5 w-5 mr-2" aria-hidden="true" />
                Start Recording
              </Button>
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
