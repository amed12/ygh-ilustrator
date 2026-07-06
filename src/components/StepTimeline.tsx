'use client';

import React from 'react';
import { ComboStep } from '../types';

interface StepTimelineProps {
  history: { step: ComboStep; trigger: string }[];
  currentStep: ComboStep | null;
}

export function StepTimeline({ history, currentStep }: StepTimelineProps) {
  
  const renderMutations = (step: ComboStep) => {
    if (!step.stateMutations) return null;
    const muts = step.stateMutations;
    const badges = [];

    if (muts.hand?.remove?.length) badges.push(`Hand -${muts.hand.remove.length}`);
    if (muts.hand?.add?.length) badges.push(`Hand +${muts.hand.add.length}`);
    if (muts.field?.add?.length) badges.push(`Field +${muts.field.add.length}`);
    if (muts.gy?.add?.length) badges.push(`GY +${muts.gy.add.length}`);
    if (muts.banished?.add?.length) badges.push(`Banished +${muts.banished.add.length}`);

    if (badges.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {badges.map((b, i) => (
          <span key={i} className="text-[9px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
            {b}
          </span>
        ))}
      </div>
    );
  };

  const formatTrigger = (trigger: string) => {
    return trigger.replace(/_/g, ' ').toUpperCase();
  };

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
          const isSuccess = item.trigger === 'success';
          return (
            <div key={`${item.step.id}-${index}`} className="relative flex gap-3 text-xs leading-normal">
              {/* Timeline marker node */}
              <span className={`absolute -left-4 mt-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border bg-zinc-950 ${
                isSuccess 
                  ? 'border-emerald-500 text-emerald-400' 
                  : 'border-orange-500 text-orange-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  isSuccess ? 'bg-emerald-500' : 'bg-orange-500'
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
                      : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                  }`}>
                    {formatTrigger(item.trigger)}
                  </span>
                </div>
                <p className="text-zinc-300 font-sans">{item.step.action}</p>
                {renderMutations(item.step)}
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
              {renderMutations(currentStep)}
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
