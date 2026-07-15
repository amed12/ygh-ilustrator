'use client';

import React, { useRef } from 'react';
import { ComboRoute, DeckList, YGOPROCardDetails } from '../types';
import { CARD_REGISTRY } from '../data/cards';
import { probabilityToOpenCombo, probabilityToBrick } from '../engine/probability';
import { Play, Tag, Lightbulb, Sparkle, UploadSimple, DownloadSimple, ShareNetwork, Plus, ChartBar, Brain } from '@phosphor-icons/react';

const EFFICIENCY_STYLES: Record<string, string> = {
  'optimal': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  'sub-optimal': 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  'brick': 'bg-rose-500/10 text-rose-400 border-rose-500/25',
};

interface ComboSelectorProps {
  matchingRoutes: ComboRoute[];
  onSelectRoute: (route: ComboRoute) => void;
  onGenerateAI: () => void;
  isAiGenerating: boolean;
  hasAiConfig: boolean;
  onExportRoute?: (route: ComboRoute) => void;
  onShareRoute?: (route: ComboRoute) => void;
  sharedRouteId?: string | null;
  onImportCombo?: (files: File[]) => void;
  onExportPlaybook?: () => void;
  onCreateCombo?: () => void;
  customRouteIds?: Set<string>;
  deckCardIds?: Set<string>;
  deck?: DeckList;
  cardDetails?: Record<string, YGOPROCardDetails>;
  hasDeckProfile?: boolean;
  isProfileGenerating?: boolean;
  onAnalyzeDeckRoles?: () => void;
}

export function ComboSelector({
  matchingRoutes,
  onSelectRoute,
  onGenerateAI,
  isAiGenerating,
  hasAiConfig,
  onExportRoute,
  onShareRoute,
  sharedRouteId,
  onImportCombo,
  onExportPlaybook,
  onCreateCombo,
  customRouteIds = new Set(),
  deckCardIds = new Set(),
  deck,
  cardDetails = {},
  hasDeckProfile = false,
  isProfileGenerating = false,
  onAnalyzeDeckRoles
}: ComboSelectorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && onImportCombo) {
      onImportCombo(Array.from(files));
    }
    // Reset file input value so same file can be uploaded again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
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
        {deck && matchingRoutes.length > 0 && deck.main.length > 0 && (() => {
          const brick5 = probabilityToBrick(deck, matchingRoutes, 5);
          const brick6 = probabilityToBrick(deck, matchingRoutes, 6);
          return (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded bg-zinc-900/60 border border-zinc-800 px-2 py-1 text-[10px] font-mono text-zinc-400">
              <ChartBar size={12} className="text-zinc-500" />
              <span>Brick chance: {(brick5 * 100).toFixed(1)}% (1st) / {(brick6 * 100).toFixed(1)}% (2nd)</span>
            </div>
          );
        })()}
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
                  <div className="flex items-center gap-1.5 shrink-0">
                    {onShareRoute && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onShareRoute(route);
                        }}
                        className="rounded p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-all"
                        title="Copy a shareable link to this combo (bundles the deck)"
                      >
                        <ShareNetwork size={12} className={sharedRouteId === route.id ? 'text-emerald-400' : ''} />
                      </button>
                    )}
                    {onExportRoute && customRouteIds.has(route.id) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onExportRoute(route);
                        }}
                        className="rounded p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-all"
                        title="Export Combo JSON"
                      >
                        <DownloadSimple size={12} />
                      </button>
                    )}
                    <span className="rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
                      {route.steps.length} Steps
                    </span>
                  </div>
                </div>

                {(() => {
                  const missingCards = deckCardIds.size > 0 
                    ? route.requiredCards.filter(id => !deckCardIds.has(id))
                    : [];
                  if (missingCards.length === 0) return null;
                  
                  const missingCardNames = missingCards
                    .map(id => cardDetails[id]?.name || CARD_REGISTRY[id]?.name || `Card #${id}`)
                    .join(', ');
                    
                  return (
                    <div 
                      className="inline-flex items-center gap-1 rounded bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[9px] font-semibold text-red-400 font-mono w-fit"
                      title={`Missing: ${missingCardNames}`}
                    >
                      <span>⚠️ Missing {missingCards.length} starter card{missingCards.length !== 1 ? 's' : ''}</span>
                    </div>
                  );
                })()}

                <p className="text-xs text-zinc-400 leading-relaxed">
                  {route.description}
                </p>

                {deck && deck.main.length > 0 && (() => {
                  const open5 = probabilityToOpenCombo(deck, route, 5);
                  const open6 = probabilityToOpenCombo(deck, route, 6);
                  return (
                    <div
                      className="inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-semibold text-emerald-400 font-mono w-fit"
                      title="Chance this exact hand of starters is drawn naturally, going first (5 cards) vs going second (6 cards)"
                    >
                      <ChartBar size={10} />
                      <span>Open odds: {(open5 * 100).toFixed(1)}% (1st) / {(open6 * 100).toFixed(1)}% (2nd)</span>
                    </div>
                  );
                })()}
              </div>

              {/* Footer Meta */}
              <div className="mt-4 flex items-center justify-between border-t border-zinc-900/60 pt-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Tag size={12} className="text-zinc-500" />
                  {route.efficiency && (
                    <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${EFFICIENCY_STYLES[route.efficiency]}`}>
                      {route.efficiency.replace(/-/g, ' ')}
                    </span>
                  )}
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

      {/* Playbook Import/Export Panel */}
      {onImportCombo && (
        <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h4 className="text-xs font-semibold text-zinc-300">Playbook Configuration</h4>
              <p className="text-[10px] text-zinc-500">Import or export your custom combos as one `.json` playbook file.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={handleImportClick}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-all active:scale-[0.98]"
              >
                <UploadSimple size={12} />
                <span>Import</span>
              </button>
              {onExportPlaybook && customRouteIds.size > 0 && (
                <button
                  type="button"
                  onClick={onExportPlaybook}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-900/60 bg-emerald-950/15 hover:bg-emerald-950/30 text-emerald-400 px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.98]"
                  title="Export all your custom/AI-generated combos as one Playbook JSON file"
                >
                  <DownloadSimple size={12} />
                  <span>Export Playbook</span>
                </button>
              )}
            </div>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            multiple
            className="hidden"
          />
        </div>
      )}

      {/* Deck Profile Analysis Panel — one-shot AI compile powering the offline adaptive matcher */}
      {onAnalyzeDeckRoles && (
        <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h4 className="text-xs font-semibold text-zinc-300">Deck Role Analysis</h4>
            <p className="text-[10px] text-zinc-500">
              {hasDeckProfile
                ? 'AI has classified every card\'s role/search targets — reachable-line matching uses this.'
                : 'One-time AI pass to classify each card\'s role and search targets, cached for this deck. Improves how many reachable lines get found — no AI needed afterward.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onAnalyzeDeckRoles}
            disabled={isProfileGenerating}
            className="flex items-center gap-1.5 shrink-0 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-all active:scale-[0.98]"
          >
            {isProfileGenerating ? (
              <span className="animate-spin inline-block w-3 h-3 rounded-full border-2 border-zinc-500 border-t-white" />
            ) : (
              <Brain size={12} />
            )}
            <span>{hasDeckProfile ? 'Re-analyze' : 'Analyze Deck Roles'}</span>
          </button>
        </div>
      )}

      {/* Manual Combo Creator Panel */}
      {onCreateCombo && (
        <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h4 className="text-xs font-semibold text-zinc-300">Create Custom Combo</h4>
            <p className="text-[10px] text-zinc-500">Build your own playbook steps manually.</p>
          </div>
          <button
            type="button"
            onClick={onCreateCombo}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-all active:scale-[0.98]"
          >
            <Plus size={12} />
            <span>Create</span>
          </button>
        </div>
      )}
    </div>
  );
}
