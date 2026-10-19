'use client';

import { useState } from 'react';
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
import {
  Volume2,
  Play,
  RefreshCw,
  ArrowRight,
  Home,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function RevealScreen() {
  const {
    machine,
    engine,
    playClip,
    stopPlayback,
    selfReport,
    discardAndRestart,
    backHome,
    getClip,
    error,
  } = useGame();

  const round = machine.round;
  const secret = round?.secretAnswer;
  const guess = round?.guess ?? '';
  const result = round?.result;
  const revealed = round?.originalWordRevealed ?? false;
  const isCorrect = result?.correct;

  const [answered, setAnswered] = useState(false);

  const play = (id: string | null) => {
    void playClip(id);
  };

  const handleSelfReport = (correct: boolean) => {
    selfReport(correct);
    setAnswered(true);
  };

  const handlePlayAgain = () => { discardAndRestart(); };

  const handleNextRound = () => { discardAndRestart(); };

  const handleBackHome = () => { backHome(); };

  const showAnswer = revealed && secret ? secret : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 safe-area">
      <div className="w-full max-w-md space-y-4">
        <Card className="bg-gradient-to-b from-violet-900/40 to-navy/20 border-violet-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-coral" aria-hidden="true" />
              Reveal
            </CardTitle>
            <CardDescription>
              Compare the recordings and decide whether the guess was right.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {showAnswer && (
              <div className="rounded-xl bg-violet-500/20 border border-violet-500/30 p-4">
                <p className="text-xs font-medium text-violet-200 uppercase tracking-wider">
                  The secret word was
                </p>
                <p className="text-2xl font-bold text-white">{showAnswer}</p>
              </div>
            )}
            {!showAnswer && (
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-xs font-medium text-white/50 uppercase tracking-wider">
                  No secret answer entered
                </p>
                <p className="text-sm text-white/70">
                  Players can listen below and agree on the original word together.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-xs font-medium text-white/70">
                Guess:{' '}
                <span className="font-mono text-violet-300">
                  {guess || '<none>'}
                </span>
              </p>
              {answered && isCorrect !== null && (
                <div
                  className={cn(
                    'rounded-xl px-3 py-2 text-sm font-medium',
                    isCorrect
                      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                      : 'bg-red-500/20 text-red-300 border border-red-500/30',
                  )}
                >
                  {isCorrect ? (
                    <>
                      <Check className="h-4 w-4 mr-2" aria-hidden="true" />
                      Correct!
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4 mr-2" aria-hidden="true" />
                      Not quite.
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-white/70">Playbacks</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'original', id: round?.originalClipId },
                  { key: 'reversed', id: round?.reversedClipId },
                  { key: 'imitation', id: round?.imitationClipId },
                  { key: 'reconstructed', id: round?.reconstructedClipId },
                ].map(({ key, id }) => (
                  <Button
                    key={key}
                    onClick={() => play(id ?? null)}
                    variant="outline"
                    disabled={engine?.isPlaying() || !id}
                    className="text-xs py-2"
                  >
                    <Play className="h-4 w-4 mr-1.5" aria-hidden="true" />
                    {key}
                  </Button>
                ))}
              </div>
            </div>

            {!answered && isCorrect === null && secret !== null && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-medium text-white/70">
                  Was the guess correct? (self-reported)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleSelfReport(true)}
                    className="flex-1"
                  >
                    <Check className="h-4 w-4 mr-2" aria-hidden="true" />
                    Yes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleSelfReport(false)}
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" aria-hidden="true" />
                    No
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={handlePlayAgain}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                Play Again
              </Button>
              <Button
                onClick={handleNextRound}
                variant="outline"
                className="w-full"
              >
                Next Round <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <Button
              onClick={handleBackHome}
              variant="ghost"
              className="w-full"
            >
              <Home className="h-4 w-4 mr-2" aria-hidden="true" />
              Back Home
            </Button>
          </CardFooter>
        </Card>

        {error && (
          <Card className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" aria-hidden="true" />
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