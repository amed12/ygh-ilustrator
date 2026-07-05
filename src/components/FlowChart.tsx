'use client';

import React from 'react';
import { ComboRoute, ComboStep } from '../types';
import { CARD_REGISTRY } from '../data/cards';
import { ArrowDown, ArrowRight } from '@phosphor-icons/react';

interface FlowChartProps {
  route: ComboRoute;
  currentStepId: number;
  history: { step: ComboStep; outcome: 'success' | 'negated' }[];
}

export function FlowChart({ route, currentStepId, history }: FlowChartProps) {
  const historySet = new Set(history.map(h => h.step.id));
  const successPointers = new Set(history.filter(h => h.outcome === 'success').map(h => h.step.id));
  const negatedPointers = new Set(history.filter(h => h.outcome === 'negated').map(h => h.step.id));

  // Partition steps into main line (usually low IDs) and fallback lines (usually high IDs, >= 10)
  const mainLineSteps = route.steps.filter(s => s.id < 10);
  const fallbackSteps = route.steps.filter(s => s.id >= 10);



  const getStepStatusClass = (stepId: number) => {
    if (stepId === currentStepId) {
      return 'border-indigo-500 bg-indigo-950/20 text-indigo-200 ring-1 ring-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.2)] font-semibold';
    }
    if (historySet.has(stepId)) {
      return 'border-zinc-800 bg-zinc-900/40 text-zinc-500';
    }
    return 'border-zinc-900 bg-zinc-950 text-zinc-400';
  };

  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar">
      <div>
        <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-500">
          Combo Path Architecture
        </h4>
      </div>

      <div className="space-y-4">
        {/* Main Line Column */}
        <div className="space-y-3">
          <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">Main Sequence</div>
          {mainLineSteps.map((step, idx) => {
            const isCurrent = step.id === currentStepId;
            const hasPassed = historySet.has(step.id);
            const isSuccessNode = successPointers.has(step.id);
            const isNegatedNode = negatedPointers.has(step.id);
            
            // Find if there is a matching fallback step for this step
            const fallbackNode = step.next_negated 
              ? fallbackSteps.find(f => f.id === step.next_negated)
              : null;

            return (
              <div key={step.id} className="relative space-y-2">
                <div className="flex items-center gap-3">
                  {/* Step Node Card */}
                  <div className={`flex-1 flex items-center justify-between gap-3 p-3 rounded-lg border text-xs leading-normal transition-all ${
                    getStepStatusClass(step.id)
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-mono border ${
                        isCurrent 
                          ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300' 
                          : hasPassed
                            ? 'border-zinc-800 bg-zinc-900/60 text-zinc-500'
                            : 'border-zinc-800 bg-zinc-900/20 text-zinc-400'
                      }`}>
                        {step.id}
                      </span>
                      <span className="font-medium truncate max-w-[120px] sm:max-w-[160px] block" title={step.action}>
                        {step.action}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-zinc-600 shrink-0">
                      {CARD_REGISTRY[step.cardId]?.name.split('-').pop()?.trim().substring(0, 10) || 'Card'}
                    </span>
                  </div>

                  {/* Branching pointer indicator */}
                  {step.next_negated && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="flex flex-col items-center">
                        <span className="text-[8px] font-mono uppercase tracking-wider text-red-500">Negated</span>
                        <ArrowRight size={14} className={isNegatedNode ? 'text-red-400' : 'text-zinc-700'} />
                      </div>
                      
                      {/* Mini Fallback Card */}
                      {fallbackNode && (
                        <div className={`p-2 rounded border text-[10px] max-w-[110px] truncate leading-tight ${
                          getStepStatusClass(fallbackNode.id)
                        }`} title={fallbackNode.action}>
                          {fallbackNode.action}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Arrow down to next step */}
                {idx < mainLineSteps.length - 1 && (
                  <div className="flex pl-5">
                    <ArrowDown size={14} className={isSuccessNode ? 'text-emerald-400' : 'text-zinc-800'} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
