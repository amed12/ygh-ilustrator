'use client';

import React from 'react';
import { ComboStep } from '../types';


interface StepTimelineProps {
  history: { step: ComboStep; outcome: 'success' | 'negated' }[];
  currentStep: ComboStep | null;
}

export function StepTimeline({ history, currentStep }: StepTimelineProps) {
  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar">
      <div>
        <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-500">
          Step Execution History
        </h4>
      </div>

      <div className="relative pl-4 space-y-4 before:absolute before:inset-y-1 before:left-1.5 before:w-0.5 before:bg-zinc-900">
        {/* Past History */}
        {history.map((item, index) => {
          const isSuccess = item.outcome === 'success';
          return (
            <div key={`${item.step.id}-${index}`} className="relative flex gap-3 text-xs leading-normal">
              {/* Timeline marker node */}
              <span className={`absolute -left-4 mt-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border bg-zinc-950 ${
                isSuccess 
                  ? 'border-emerald-500 text-emerald-400' 
                  : 'border-red-500 text-red-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  isSuccess ? 'bg-emerald-500' : 'bg-red-500'
                }`} />
              </span>

              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-zinc-500">
                    Step {item.step.id}
                  </span>
                  <span className={`text-[9px] font-mono uppercase tracking-wider px-1 rounded ${
                    isSuccess 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {item.outcome}
                  </span>
                </div>
                <p className="text-zinc-300 font-sans">{item.step.action}</p>
              </div>
            </div>
          );
        })}

        {/* Current Active Step */}
        {currentStep && (
          <div className="relative flex gap-3 text-xs leading-normal">
            <span className="absolute -left-4 mt-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-indigo-500 bg-zinc-950">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
              <span className="absolute w-1.5 h-1.5 rounded-full bg-indigo-500" />
            </span>

            <div className="flex-1 space-y-1 bg-indigo-950/10 border border-indigo-950/40 p-2.5 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-indigo-400 font-semibold">
                  Current Step {currentStep.id}
                </span>
                <span className="text-[9px] font-mono uppercase tracking-wider bg-indigo-500/10 text-indigo-400 px-1 rounded border border-indigo-500/20 animate-pulse">
                  Pending
                </span>
              </div>
              <p className="text-zinc-200 font-sans font-medium">{currentStep.action}</p>
            </div>
          </div>
        )}

        {history.length === 0 && !currentStep && (
          <div className="text-xs text-zinc-600 font-mono italic py-4">
            No steps executed yet.
          </div>
        )}
      </div>
    </div>
  );
}
