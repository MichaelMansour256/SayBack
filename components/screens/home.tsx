'use client';

import { useState } from 'react';
import {
  Mic,
  Headphones,
  Volume2,
  Play,
  ArrowRight,
  Info,
  ShieldCheck,
} from 'lucide-react';

export function HomeScreen() {
  const [showHow, setShowHow] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 safe-area">
      <div className="w-full max-w-md glass-card px-6 py-10 text-center space-y-6">
        <div className="flex items-center justify-center gap-2 text-violet-400">
          <Mic className="h-8 w-8" aria-hidden="true" />
          <span className="text-3xl font-display font-bold tracking-tight">SAYBACK</span>
        </div>

        <p className="text-cyan-300 text-sm font-medium tracking-wider uppercase">
          Hear it backwards. Say it back!
        </p>

        <CardConcept />

        <div className="space-y-3">
          <button
            onClick={() => {
              // Navigation is handled by the game shell; here we just mark intent.
              // The actual start is wired via the form action below.
              (document.getElementById('start-form') as HTMLFormElement)?.requestSubmit();
            }}
            className="w-full py-4 px-6 bg-violet-600 hover:bg-violet-500 rounded-2xl font-bold text-lg shadow-glow-violet transition-colors flex items-center justify-center"
          >
            Start Playing <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
          </button>

          <form id="start-form" action="/game" method="GET" style={{ display: 'none' }}>
            <button type="submit">Start</button>
          </form>

          <button
            onClick={() => setShowHow(true)}
            className="w-full py-3.5 px-6 border border-white/20 bg-white/5 rounded-2xl font-medium text-white hover:bg-white/10 transition-colors flex items-center justify-center"
          >
            <Info className="h-4 w-4 mr-2" aria-hidden="true" />
            How to Play
          </button>
        </div>

        {showHow && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <h3 className="font-bold text-violet-300 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              How to Play
            </h3>
            <ol className="text-sm text-white/70 space-y-2 list-disc list-inside">
              <li>Player A records a secret word or phrase.</li>
              <li>We play it <strong>backwards</strong> to Player B.</li>
              <li>Player B imitates the sound they hear.</li>
              <li>We reverse the imitation — you try to guess the original word.</li>
              <li>Reveal, compare, and play again!</li>
            </ol>
            <p className="text-xs text-white/50 mt-2">
              No accounts. No uploads. Everything stays on this device.
            </p>
            <button
              onClick={() => setShowHow(false)}
              className="text-xs underline text-violet-300 hover:text-violet-200"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CardConcept() {
  return (
    <div className="bg-white/4 border border-white/10 rounded-xl p-4 text-left">
      <div className="flex items-center gap-2 mb-2">
        <Headphones className="h-5 w-5 text-cyan-400" aria-hidden="true" />
        <h4 className="text-sm font-semibold text-white">The concept</h4>
      </div>
      <p className="text-xs text-white/60 leading-relaxed">
        A two-or-more-player party game sharing one device. Record a secret, hear it
        reversed, imitate it, reverse the imitation, and guess the original word.
        Speech stays on-device — no AI, no uploads.
      </p>
    </div>
  );
}
