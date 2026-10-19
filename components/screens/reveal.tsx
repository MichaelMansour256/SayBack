'use client';

import { useGame } from '@/components/game-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Play, RefreshCw, Home, Mic } from 'lucide-react';

export function RevealScreen() {
  const { machine, engine, playClip, discardAndRestart, backHome, error } = useGame();

  const round = machine.round;

  const clips = [
    { key: 'Original', id: round?.originalClipId },
    { key: 'Reversed', id: round?.reversedClipId },
    { key: 'Imitation', id: round?.imitationClipId },
    { key: 'Result', id: round?.reconstructedClipId },
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 safe-area">
      <div className="w-full max-w-md space-y-4">
        <Card className="bg-gradient-to-b from-violet-900/40 to-navy/20 border-violet-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-coral" aria-hidden="true" />
              Reveal
            </CardTitle>
            <CardDescription>
              Player A reveals the original word. Compare the recordings and see how close it got!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {clips.map(({ key, id }) => (
                <Button
                  key={key}
                  onClick={() => void playClip(id ?? null)}
                  variant="outline"
                  disabled={engine?.isPlaying() || !id}
                  className="text-xs py-2"
                >
                  <Play className="h-4 w-4 mr-1.5" aria-hidden="true" />
                  {key}
                </Button>
              ))}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button onClick={discardAndRestart} variant="record" className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
              Next Round
            </Button>
            <Button onClick={backHome} variant="ghost" className="w-full">
              <Home className="h-4 w-4 mr-2" aria-hidden="true" />
              Back Home
            </Button>
          </CardFooter>
        </Card>

        {error && (
          <Card className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <p className="font-medium text-red-300">{error.message}</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
