'use client';

import { useGame } from '@/components/game-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Volume2, ArrowRight, AlertCircle } from 'lucide-react';

export function GuessScreen() {
  const { machine, engine, playClip, revealAnswer, error } = useGame();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 safe-area">
      <div className="w-full max-w-md space-y-4">
        <Card className="bg-gradient-to-b from-violet-900/40 to-navy/20 border-violet-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-cyan-400" aria-hidden="true" />
              Player B — Guess
            </CardTitle>
            <CardDescription>
              Listen to the result, then say your guess out loud. When everyone is ready, reveal the original.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => void playClip(machine.round?.reconstructedClipId ?? null)}
              variant="play"
              disabled={engine?.isPlaying()}
              className="w-full"
            >
              <Volume2 className="h-5 w-5 mr-2" aria-hidden="true" />
              Replay Result
            </Button>
            <Button
              onClick={revealAnswer}
              variant="reverse"
              size="lg"
              className="w-full"
            >
              Reveal Original <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
            </Button>
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
