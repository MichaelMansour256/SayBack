'use client';

import { useState, FormEvent } from 'react';
import { useGame } from '@/components/game-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Volume2, Play, ArrowRight, AlertCircle } from 'lucide-react';

export function GuessScreen() {
  const {
    machine,
    engine,
    playClip,
    submitGuessAndReveal,
    revealWithoutGuess,
    error,
  } = useGame();

  const [guess, setGuess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reconstructedClipId = machine.round?.reconstructedClipId ?? null;

  const handlePlayReconstructed = async () => {
    await playClip(machine.round?.reconstructedClipId ?? null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!guess.trim() || isSubmitting) return;
    setIsSubmitting(true);
    submitGuessAndReveal(guess);
    setIsSubmitting(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 safe-area">
      <div className="w-full max-w-md space-y-4">
        <Card className="bg-gradient-to-b from-violet-900/40 to-navy/20 border-violet-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-cyan-400" aria-hidden="true" />
              Guess the Word
            </CardTitle>
            <CardDescription>
              Player B: listen to the reconstructed audio and type your best guess.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-white/60">
              Replays left:{' '}
              <span className="font-mono font-bold text-cyan-300">
                {machine.reconstructedPlays}/{machine.config.maxReconstructedPlays}
              </span>
            </p>
            <Button
              onClick={handlePlayReconstructed}
              variant="play"
              disabled={engine?.isPlaying()}
              className="w-full"
            >
              <Play className="h-5 w-5 mr-2" aria-hidden="true" />
              Play Reconstructed Audio
            </Button>
            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="block text-sm font-medium text-white/90">
                Your guess
              </label>
              <input
                autoFocus
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="e.g. banana"
                className="w-full py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-violet-400 focus:ring-1 focus:ring-violet-400 outline-none"
              />
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={!guess.trim() || isSubmitting}
                  variant="reverse"
                  className="flex-1"
                >
                  {isSubmitting ? 'Submitting…' : 'Submit Guess'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    revealWithoutGuess();
                  }}
                  className="flex-1"
                >
                  Reveal Answer
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

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
