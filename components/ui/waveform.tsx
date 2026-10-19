'use client';

import { useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface WaveformProps {
  /** Live Float32Array samples (from analyser) or null. */
  samples: Float32Array | null;
  /** Number of bars to render. */
  barCount?: number;
  /** Minimum bar height (0-1). */
  minHeight?: number;
  /** Whether the waveform is active (recording/playing). */
  active?: boolean;
  className?: string;
}

export function Waveform({
  samples,
  barCount = 24,
  minHeight = 0.15,
  active = false,
  className,
}: WaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const valuesRef = useRef<number[]>(Array(barCount).fill(0));

  // Smooth the values toward the target for a nicer visual.
  const update = useCallback(() => {
    if (!containerRef.current || !samples) return;
    const { clientWidth } = containerRef.current;
    const next: number[] = [];
    const step = samples.length / barCount;
    for (let i = 0; i < barCount; i++) {
      const start = Math.floor(i * step);
      const end = Math.ceil((i + 1) * step);
      let max = 0;
      for (let j = start; j < end; j++) {
        max = Math.max(max, Math.abs(samples[j] ?? 0));
      }
      // Decay previous value slightly toward target.
      const prev = valuesRef.current[i] ?? 0;
      const target = Math.max(minHeight, max);
      const smoothed = prev * 0.55 + target * 0.45;
      next.push(smoothed);
    }
    valuesRef.current = next;
    rafRef.current = requestAnimationFrame(update);
  }, [samples, barCount, minHeight]);

  useEffect(() => {
    if (active && samples) {
      rafRef.current = requestAnimationFrame(update);
    } else {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, samples, update]);

  return (
    <div
      ref={containerRef}
      className={cn('flex items-end gap-1 h-12 w-full', className)}
      aria-label="Audio waveform"
      role="img"
    >
      {valuesRef.current.map((v, i) => (
        <div
          key={i}
          className={cn(
            'bg-violet-400/80 rounded-md transition-all duration-100 origin-bottom',
            active ? 'animate-wave' : '',
            'style-[--h:' + (v * 100) + '%]',
          )}
          style={{
            height: `max(${minHeight * 100}%, var(--h))`,
            opacity: active ? 1 : 0.5,
          }}
        />
      ))}
    </div>
  );
}
