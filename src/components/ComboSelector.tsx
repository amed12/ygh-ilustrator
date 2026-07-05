'use client';

import React from 'react';
import { ComboRoute } from '../types';
import { Play, Tag, Lightbulb, Sparkle } from '@phosphor-icons/react';

interface ComboSelectorProps {
  matchingRoutes: ComboRoute[];
  onSelectRoute: (route: ComboRoute) => void;
  onGenerateAI: () => void;
  isAiGenerating: boolean;
  hasAiConfig: boolean;
}

export function ComboSelector({
  matchingRoutes,
  onSelectRoute,
  onGenerateAI,
  isAiGenerating,
  hasAiConfig
}: ComboSelectorProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="font-sans text-sm font-bold tracking-wider text-zinc-400 uppercase">
          Available Combos
        </h3>
        <p className="text-xs text-zinc-500 mt-1 leading-normal">
          Select a pre-configured playbook route below or generate a dynamic one with AI.
        </p>
      </div>

      {/* Grid of Combos */}
      {matchingRoutes.length > 0 ? (
        <div className="grid gap-3">
          {matchingRoutes.map((route) => (
            <div
              key={route.id}
              onClick={() => onSelectRoute(route)}
              className="group relative flex flex-col justify-between p-4 rounded-xl border border-zinc-900 bg-zinc-950 hover:border-indigo-500/50 hover:bg-zinc-900/10 cursor-pointer transition-all active:scale-[0.99]"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="font-sans text-base font-bold text-zinc-100 group-hover:text-indigo-400 transition-colors">
                    {route.name}
                  </h4>
                  <span className="rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-400 shrink-0">
                    {route.steps.length} Steps
                  </span>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed">
                  {route.description}
                </p>
              </div>

              {/* Footer Meta */}
              <div className="mt-4 flex items-center justify-between border-t border-zinc-900/60 pt-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Tag size={12} className="text-zinc-500" />
                  {route.tags.map((tag) => (
                    <span 
                      key={tag} 
                      className="text-[9px] font-mono uppercase tracking-wider bg-zinc-900/50 text-zinc-500 px-1.5 py-0.5 rounded border border-zinc-900"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-1 text-xs font-semibold text-indigo-400 group-hover:translate-x-0.5 transition-transform">
                  <span>Start Practice</span>
                  <Play size={12} weight="fill" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-zinc-900 rounded-xl bg-zinc-950/40 text-zinc-500 space-y-2">
          <Lightbulb size={24} className="text-zinc-600" />
          <span className="text-xs font-semibold text-zinc-400">No Offline Combos Found</span>
          <p className="text-[10px] text-zinc-500 leading-normal max-w-xs">
            This deck list does not match our preloaded offline plays. Try using AI to analyze and generate a custom combo route!
          </p>
        </div>
      )}

      {/* AI Generator Panel Trigger */}
      <div className="rounded-xl border border-indigo-950 bg-indigo-950/5 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="rounded bg-indigo-500/10 p-2 text-indigo-400 shrink-0">
            <Sparkle size={18} weight="duotone" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-zinc-200">Dynamic AI Combo Solver</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
              Generate a custom combo path specifically tailored to the cards inside this deck, complete with branching recovery steps.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onGenerateAI}
          disabled={isAiGenerating}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed py-2 text-xs font-semibold text-white transition-all active:scale-[0.98] shadow-md shadow-indigo-600/10"
        >
          {isAiGenerating ? (
            <>
              <span className="animate-spin inline-block w-3 h-3 rounded-full border-2 border-zinc-500 border-t-white" />
              <span>Analyzing & Solving Combo...</span>
            </>
          ) : (
            <>
              <Sparkle size={14} weight="fill" />
              <span>{hasAiConfig ? 'Generate Combo with AI' : 'Generate with AI (Using Demo)'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
