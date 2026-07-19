'use client';

import React from 'react';
import { ComboRoute, ComboStep, YGOPROCardDetails } from '../types';
import { CARD_REGISTRY } from '../data/cards';
import { ArrowDown, ArrowRight, GitBranch } from '@phosphor-icons/react';
import { mainSuccessLine } from '../utils/routeGraph';
import { formatTriggerLabel } from '../utils/triggerUi';

interface FlowChartProps {
  route: ComboRoute;
  currentStepId: number;
  history: { step: ComboStep; trigger: string }[];
  cardDetails?: Record<string, YGOPROCardDetails>;
}

export function FlowChart({ route, currentStepId, history, cardDetails = {} }: FlowChartProps) {
  const resolveCardShortName = (cardId: string): string => {
    const fullName = cardDetails[cardId]?.name || CARD_REGISTRY[cardId]?.name;
    if (!fullName) return `#${cardId}`;
    return fullName.split('-').pop()?.trim().substring(0, 10) || fullName.substring(0, 10);
  };
  const historySet = new Set(history.map(h => h.step.id));
  const successPointers = new Set(history.filter(h => h.trigger === 'success').map(h => h.step.id));
  
  // Track all non-success triggers taken
  const alternativeTriggers = new Map<number, string>();
  history.forEach(h => {
    if (h.trigger !== 'success') {
      alternativeTriggers.set(h.step.id, h.trigger);
    }
  });

  // Dynamically trace the main success line from the first step in the route
  const mainLineSteps: ComboStep[] = mainSuccessLine(route);
  const mainSet = new Set(mainLineSteps.map(s => s.id));
  const fallbackSteps = new Map<number, ComboStep>();
  route.steps.forEach(s => {
    if (!mainSet.has(s.id)) {
      fallbackSteps.set(s.id, s);
    }
  });

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
        <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-2">
          <GitBranch size={16} /> Combo Path Architecture
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
            const triggeredAlternative = alternativeTriggers.get(step.id);
            
            // Find non-success responses
            const altResponses = step.responses?.filter(r => r.trigger !== 'success') || [];

            return (
              <div key={step.id} className="relative space-y-2">
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-3">
                    {/* Step Node Card */}
                    <div className={`flex-1 flex items-center justify-between gap-3 p-3 rounded-lg border text-xs leading-normal transition-all ${
                      getStepStatusClass(step.id)
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-mono border shrink-0 ${
                          isCurrent 
                            ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300' 
                            : hasPassed
                              ? 'border-zinc-800 bg-zinc-900/60 text-zinc-500'
                              : 'border-zinc-800 bg-zinc-900/20 text-zinc-400'
                        }`}>
                          {step.id}
                        </span>
                        <span className="font-medium truncate block" title={step.action}>
                          {step.action}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-zinc-600 shrink-0 hidden sm:block">
                        {resolveCardShortName(step.cardId)}
                      </span>
                    </div>
                  </div>

                  {/* Branching pointer indicators */}
                  {altResponses.length > 0 && (
                    <div className="flex flex-col gap-2 pl-8 border-l border-zinc-800 ml-2 mt-1 mb-2">
                      {altResponses.map(res => {
                        const fallbackNode = res.next_step ? fallbackSteps.get(res.next_step) : null;
                        const isTriggered = triggeredAlternative === res.trigger;
                        
                        return (
                          <div key={res.trigger} className="flex items-center gap-2">
                            <div className="flex items-center gap-1 shrink-0 w-24">
                              <ArrowRight size={14} className={isTriggered ? 'text-orange-400' : 'text-zinc-700'} />
                              <span className={`text-[8px] font-mono uppercase tracking-wider ${isTriggered ? 'text-orange-400 font-bold' : 'text-zinc-600'}`}>
                                {formatTriggerLabel(res.trigger)}
                              </span>
                            </div>
                            
                            {/* Mini Fallback Card */}
                            {fallbackNode ? (
                              <div className={`flex-1 p-2 rounded border text-[10px] truncate leading-tight ${
                                getStepStatusClass(fallbackNode.id)
                              }`} title={fallbackNode.action}>
                                {fallbackNode.action}
                              </div>
                            ) : (
                              <div className="flex-1 p-2 rounded border border-zinc-800 bg-zinc-900/50 text-zinc-500 text-[10px] italic">
                                End of Line
                              </div>
                            )}
                          </div>
                        );
                      })}
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
