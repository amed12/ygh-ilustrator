'use client';

import React, { useState, useEffect } from 'react';
import { Sparkle, Warning } from '@phosphor-icons/react';

interface ComboGeneratorProps {
  isGenerating: boolean;
  error: string | null;
  onClearError: () => void;
}

const PROGRESS_TIPS = [
  'Parsing card IDs and indexing deck list...',
  'Analyzing Extra Deck synergies...',
  'Extracting primary archetype and key starter cards...',
  'Calculating optimal summon sequencing...',
  'Mapping "Once Per Turn" activation constraints...',
  'Simulating Hand Trap negation scenarios...',
  'Designing defensive pivot routes...',
  'Structuring branch nodes (Success vs Negate paths)...',
  'Enforcing validation layers against card hallucinations...',
  'Compiling final interactive Combo Route...'
];

export function ComboGenerator({ isGenerating, error, onClearError }: ComboGeneratorProps) {
  const [tipIndex, setTipIndex] = useState(0);

  // Cycle tips during generation
  useEffect(() => {
    if (!isGenerating) return;
    
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % PROGRESS_TIPS.length);
    }, 2800);

    return () => {
      clearInterval(interval);
      setTipIndex(0);
    };
  }, [isGenerating]);

  if (!isGenerating && !error) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      {/* Content Container */}
      <div className="relative w-full max-w-md rounded-xl border border-zinc-900 bg-zinc-950 p-8 text-center shadow-2xl transition-all duration-300">
        
        {isGenerating && (
          <div className="space-y-6">
            {/* Spinning Sparkle icon */}
            <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
              {/* Pulsing ring */}
              <span className="absolute inset-0 rounded-full bg-indigo-500/10 animate-ping" />
              {/* Spinning border ring */}
              <span className="absolute inset-0 rounded-full border border-zinc-800 border-t-indigo-500 animate-spin" />
              
              <div className="text-indigo-400">
                <Sparkle size={28} weight="fill" className="animate-pulse" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-sans text-lg font-bold text-zinc-100">
                AI Solver Active
              </h3>
              <div className="h-10 flex items-center justify-center">
                <p className="text-xs text-zinc-400 font-mono italic animate-fade-in transition-all">
                  {PROGRESS_TIPS[tipIndex]}
                </p>
              </div>
            </div>

            {/* Simulated progress bar */}
            <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ 
                  width: `${((tipIndex + 1) / PROGRESS_TIPS.length) * 100}%` 
                }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="space-y-6">
            <div className="mx-auto w-12 h-12 flex items-center justify-center rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
              <Warning size={24} weight="duotone" />
            </div>

            <div className="space-y-2">
              <h3 className="font-sans text-base font-bold text-zinc-100">
                Generation Failed
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-mono bg-zinc-900/50 p-3 rounded-lg border border-zinc-900 max-h-[160px] overflow-y-auto text-left whitespace-pre-wrap">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={onClearError}
              className="w-full rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 px-4 py-2.5 text-xs font-semibold text-zinc-200 transition-all active:scale-[0.98]"
            >
              Clear Error & Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
