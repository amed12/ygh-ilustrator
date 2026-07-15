'use client';

import React, { useState } from 'react';
import { ComboRoute, YGOPROCardDetails } from '../types';
import { RouteMatch } from '../engine/adaptiveMatcher';
import { CardDisplay } from './CardDisplay';
import { TacticalBadge } from './TacticalBadge';
import { TurnPosition } from '../services/prompts';
import {
  Lightning, Trophy, Shield, Sword, Sparkle, Compass,
  SunHorizon, MoonStars, CheckCircle, WarningCircle, X
} from '@phosphor-icons/react';

interface ComboSolverProps {
  playableRoutes: ComboRoute[];        // From saved playbook (matches hand)
  reachableMatches?: RouteMatch[];     // Non-direct (searchable/partial) adaptive matches
  aiRoutes: ComboRoute[];              // From AI multi-combo generation
  handCards: string[];
  turnPosition: TurnPosition;
  isGenerating: boolean;
  aiError: string | null;
  hasAiConfig: boolean;
  cardDetails?: Record<string, YGOPROCardDetails>;
  onSelectCombo: (route: ComboRoute) => void;
  onGenerateAI: () => void;
  onClose: () => void;
  onCardMouseEnter?: (cardId: string, e: React.MouseEvent) => void;
  onCardMouseLeave?: () => void;
  onCardMouseMove?: (e: React.MouseEvent) => void;
}

const TAG_STYLES: Record<string, string> = {
  'going-first': 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  'going-second': 'bg-violet-500/10 text-violet-400 border-violet-500/25',
  'otk': 'bg-red-500/10 text-red-400 border-red-500/25',
  'grind': 'bg-blue-500/10 text-blue-400 border-blue-500/25',
  'defensive': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25',
  'side-in': 'bg-pink-500/10 text-pink-400 border-pink-500/25',
};

const EFFICIENCY_STYLES: Record<string, string> = {
  'optimal': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  'sub-optimal': 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  'brick': 'bg-rose-500/10 text-rose-400 border-rose-500/25',
};

const EFFICIENCY_ORDER: Record<string, number> = {
  'optimal': 0,
  'sub-optimal': 1,
  'brick': 2,
};

function ComboCard({
  route,
  handCards,
  isAI,
  onSelect,
  cardDetails = {},
  matchInfo,
  onCardMouseEnter,
  onCardMouseLeave,
  onCardMouseMove,
}: {
  route: ComboRoute;
  handCards: string[];
  isAI: boolean;
  onSelect: () => void;
  cardDetails?: Record<string, YGOPROCardDetails>;
  matchInfo?: RouteMatch;
  onCardMouseEnter?: (cardId: string, e: React.MouseEvent) => void;
  onCardMouseLeave?: () => void;
  onCardMouseMove?: (e: React.MouseEvent) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const handSet = new Set(handCards);
  const starters = route.requiredCards.filter(id => handSet.has(id));

  return (
    <div className={`group relative rounded-xl border transition-all duration-200 ${
      isAI
        ? 'border-indigo-900/60 bg-indigo-950/10 hover:border-indigo-700/60'
        : 'border-emerald-900/60 bg-emerald-950/10 hover:border-emerald-700/60'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isAI && (
              <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 px-1.5 py-0.5 rounded">
                <Sparkle size={9} weight="fill" /> AI Generated
              </span>
            )}
            {route.efficiency && (
              <span className={`text-[9px] font-mono uppercase tracking-widest border px-1.5 py-0.5 rounded ${EFFICIENCY_STYLES[route.efficiency]}`}>
                {route.efficiency.replace(/-/g, ' ')}
              </span>
            )}
            {route.tags?.map(tag => (
              <span key={tag} className={`text-[9px] font-mono uppercase tracking-widest border px-1.5 py-0.5 rounded ${TAG_STYLES[tag] || 'bg-zinc-900 text-zinc-500 border-zinc-800'}`}>
                {tag.replace(/-/g, ' ')}
              </span>
            ))}
          </div>
          <h3 className="text-sm font-bold text-zinc-100 group-hover:text-white leading-tight line-clamp-2">
            {route.name}
          </h3>
          <p className="text-[11px] text-zinc-500 font-mono uppercase tracking-wider">{route.archetype}</p>
        </div>
      </div>

      {/* Starter Cards in Hand */}
      {starters.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">Starter Cards in Hand</p>
          <div className="flex gap-1.5 flex-wrap">
            {starters.map(id => (
              <div
                key={id}
                onMouseEnter={e => onCardMouseEnter?.(id, e)}
                onMouseLeave={onCardMouseLeave}
                onMouseMove={onCardMouseMove}
              >
                <CardDisplay cardId={id} size="xs" glow details={cardDetails[id]} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Adaptive match info (searchable/partial routes only) */}
      {matchInfo && matchInfo.playability !== 'direct' && (
        <div className="mx-4 mb-3 rounded-lg bg-zinc-950/60 border border-zinc-900 p-3 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Compass size={12} className={matchInfo.playability === 'searchable' ? 'text-amber-400' : 'text-orange-400'} weight="duotone" />
            <span className={`text-[9px] font-mono uppercase tracking-wider font-bold ${matchInfo.playability === 'searchable' ? 'text-amber-400' : 'text-orange-400'}`}>
              {matchInfo.playability === 'searchable' ? 'Reachable via Search' : 'Partial Match'}
            </span>
            <span className="ml-auto text-[9px] font-mono text-zinc-500">
              {matchInfo.satisfied.length + matchInfo.reachable.length}/{matchInfo.satisfied.length + matchInfo.reachable.length + matchInfo.missing.length} pieces
            </span>
          </div>
          {matchInfo.reachable.map(r => (
            <p key={r.missingCardId} className="text-[10px] text-zinc-400 leading-snug">
              <span className="text-zinc-300">{cardDetails[r.missingCardId]?.name || `Card #${r.missingCardId}`}</span>
              {' '}← via{' '}
              <span className="text-amber-300">{cardDetails[r.viaHandCardId]?.name || `Card #${r.viaHandCardId}`}</span>
            </p>
          ))}
          {matchInfo.missing.map(id => (
            <p key={id} className="text-[10px] text-red-400/80 leading-snug">
              Missing: {cardDetails[id]?.name || `Card #${id}`}
            </p>
          ))}
        </div>
      )}

      {/* Description */}
      <div className="px-4 pb-3">
        <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-3">{route.description}</p>
      </div>

      {/* End Board interruptions */}
      {route.endBoard?.interruptions && route.endBoard.interruptions.length > 0 && (
        <div className="mx-4 mb-3 rounded-lg bg-zinc-950/60 border border-zinc-900 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Shield size={12} className="text-cyan-400" weight="duotone" />
            <span className="text-[9px] font-mono uppercase tracking-wider text-cyan-400 font-bold">End Board</span>
            <span className="ml-auto text-[9px] font-mono text-zinc-500">{route.endBoard.interruptions.length} interruption{route.endBoard.interruptions.length > 1 ? 's' : ''}</span>
          </div>
          <ul className="space-y-1">
            {(expanded ? route.endBoard.interruptions : route.endBoard.interruptions.slice(0, 2)).map((int, i) => (
              <li key={i} className="text-[10px] text-zinc-300 leading-snug flex items-start gap-1.5">
                <CheckCircle size={10} className="text-emerald-400 mt-0.5 shrink-0" weight="fill" />
                <span>{int}</span>
              </li>
            ))}
            {!expanded && route.endBoard.interruptions.length > 2 && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
                className="text-[9px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors mt-1"
              >
                +{route.endBoard.interruptions.length - 2} more...
              </button>
            )}
          </ul>
          {route.endBoard.cardRoles && Object.keys(route.endBoard.cardRoles).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-zinc-900">
              {Object.entries(route.endBoard.cardRoles).flatMap(([cardId, roles]) =>
                roles.map(role => <TacticalBadge key={`${cardId}-${role}`} role={role} />)
              )}
            </div>
          )}
        </div>
      )}

      {/* Step count */}
      <div className="px-4 pb-3">
        <span className="text-[9px] font-mono text-zinc-600">
          {route.steps.length} step{route.steps.length !== 1 ? 's' : ''} in sequence
        </span>
      </div>

      {/* Practice Button */}
      <div className="border-t border-zinc-900/60 px-4 py-3">
        <button
          onClick={onSelect}
          className={`w-full flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all active:scale-[0.98] ${
            isAI
              ? 'bg-indigo-600/80 hover:bg-indigo-600 text-white shadow-indigo-600/10 shadow-lg'
              : 'bg-emerald-600/80 hover:bg-emerald-600 text-white shadow-emerald-600/10 shadow-lg'
          }`}
        >
          <Lightning size={14} weight="fill" />
          Practice This Line
        </button>
      </div>
    </div>
  );
}

export function ComboSolver({
  playableRoutes,
  reachableMatches = [],
  aiRoutes,
  handCards,
  turnPosition,
  isGenerating,
  aiError,
  hasAiConfig,
  cardDetails = {},
  onSelectCombo,
  onGenerateAI,
  onClose,
  onCardMouseEnter,
  onCardMouseLeave,
  onCardMouseMove,
}: ComboSolverProps) {
  const totalCombos = playableRoutes.length + reachableMatches.length + aiRoutes.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-900 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gradient-to-br from-amber-500/20 to-indigo-500/20 p-2 border border-zinc-800">
              <Lightning size={20} weight="duotone" className="text-amber-400" />
            </div>
            <div>
              <h2 className="font-sans text-base font-bold text-zinc-100">
                All Possible Combo Lines
              </h2>
              <p className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-2">
                {turnPosition === 'going-first'
                  ? <><SunHorizon size={11} className="text-amber-400" /> Going First</>
                  : <><MoonStars size={11} className="text-violet-400" /> Going Second</>
                }
                <span className="text-zinc-700">·</span>
                <span>{handCards.length} cards in hand</span>
                {totalCombos > 0 && (
                  <>
                    <span className="text-zinc-700">·</span>
                    <span className="text-emerald-400 font-semibold">{totalCombos} line{totalCombos !== 1 ? 's' : ''} found</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasAiConfig && (
              <button
                onClick={onGenerateAI}
                disabled={isGenerating}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed px-4 py-2 text-xs font-semibold text-white transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/15"
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin inline-block w-3 h-3 rounded-full border-2 border-zinc-500 border-t-white" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Sparkle size={14} weight="fill" />
                    <span>{aiRoutes.length > 0 ? 'Re-analyze' : 'AI Analyze All Lines'}</span>
                  </>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="rounded-lg p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-all disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Hand Preview */}
        <div className="border-b border-zinc-900/50 px-6 py-3 shrink-0 flex items-center gap-3">
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider shrink-0">Hand</span>
          <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-0.5">
            {handCards.map((id, i) => (
              <div
                key={`${id}-${i}`}
                onMouseEnter={e => onCardMouseEnter?.(id, e)}
                onMouseLeave={onCardMouseLeave}
                onMouseMove={onCardMouseMove}
                className="shrink-0"
              >
                <CardDisplay cardId={id} size="xs" details={cardDetails[id]} />
              </div>
            ))}
          </div>
        </div>

        {/* AI Error Banner */}
        {aiError && (
          <div className="border-b border-red-900/40 bg-red-950/20 px-6 py-3 shrink-0">
            <div className="flex items-center gap-2">
              <WarningCircle size={16} className="text-red-400 shrink-0" weight="duotone" />
              <p className="text-xs text-red-300">The AI couldn&apos;t generate a combo. You can try again below.</p>
            </div>
            <details className="mt-1.5 pl-6">
              <summary className="text-[10px] text-zinc-600 hover:text-zinc-400 cursor-pointer select-none">
                Show technical details
              </summary>
              <p className="mt-1 text-[10px] text-zinc-500 font-mono whitespace-pre-wrap break-words">{aiError}</p>
            </details>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar space-y-6">

          {/* Saved Playbook Matches */}
          {playableRoutes.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Trophy size={14} weight="duotone" className="text-emerald-400" />
                <h3 className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">
                  Playbook Matches ({playableRoutes.length})
                </h3>
                <span className="text-[9px] text-zinc-600 font-mono">from saved combo routes</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {playableRoutes.map(route => (
                  <ComboCard
                    key={route.id}
                    route={route}
                    handCards={handCards}
                    isAI={false}
                    onSelect={() => onSelectCombo(route)}
                    cardDetails={cardDetails}
                    onCardMouseEnter={onCardMouseEnter}
                    onCardMouseLeave={onCardMouseLeave}
                    onCardMouseMove={onCardMouseMove}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Reachable Lines (searchable/partial adaptive matches) */}
          {reachableMatches.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Compass size={14} weight="duotone" className="text-amber-400" />
                <h3 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold">
                  Reachable Lines ({reachableMatches.length})
                </h3>
                <span className="text-[9px] text-zinc-600 font-mono">not a direct match, but reachable via search</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {reachableMatches.map(match => (
                  <ComboCard
                    key={match.route.id}
                    route={match.route}
                    handCards={handCards}
                    isAI={false}
                    matchInfo={match}
                    onSelect={() => onSelectCombo(match.route)}
                    cardDetails={cardDetails}
                    onCardMouseEnter={onCardMouseEnter}
                    onCardMouseLeave={onCardMouseLeave}
                    onCardMouseMove={onCardMouseMove}
                  />
                ))}
              </div>
            </section>
          )}

          {/* AI Generated Routes */}
          {aiRoutes.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Sparkle size={14} weight="duotone" className="text-indigo-400" />
                <h3 className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-bold">
                  AI-Analyzed Lines ({aiRoutes.length})
                </h3>
                <span className="text-[9px] text-zinc-600 font-mono">generated from hand analysis</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...aiRoutes].sort((a, b) => {
                  const aOrder = a.efficiency ? EFFICIENCY_ORDER[a.efficiency] : 3;
                  const bOrder = b.efficiency ? EFFICIENCY_ORDER[b.efficiency] : 3;
                  return aOrder - bOrder;
                }).map(route => (
                  <ComboCard
                    key={route.id}
                    route={route}
                    handCards={handCards}
                    isAI={true}
                    onSelect={() => onSelectCombo(route)}
                    cardDetails={cardDetails}
                    onCardMouseEnter={onCardMouseEnter}
                    onCardMouseLeave={onCardMouseLeave}
                    onCardMouseMove={onCardMouseMove}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Empty State */}
          {!isGenerating && totalCombos === 0 && !aiError && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <Sword size={28} className="text-zinc-600" weight="duotone" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-400">No Combo Lines Found for This Hand</h3>
                <p className="text-xs text-zinc-600 mt-1 max-w-sm mx-auto leading-relaxed">
                  No saved playbook combo directly matches or is reachable via search from this hand.
                  {hasAiConfig
                    ? ' Use the AI Analyze button to discover all possible lines.'
                    : ' Configure an AI provider in settings to auto-generate lines.'}
                </p>
              </div>
              {hasAiConfig && (
                <button
                  onClick={onGenerateAI}
                  disabled={isGenerating}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/15"
                >
                  <Sparkle size={16} weight="fill" />
                  AI Analyze All Lines
                </button>
              )}
            </div>
          )}

          {/* Loading State */}
          {isGenerating && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-indigo-950/30 border border-indigo-800/30 flex items-center justify-center">
                <span className="w-8 h-8 rounded-full border-4 border-indigo-800 border-t-indigo-400 animate-spin" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-300">Analyzing All Combo Lines...</h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  AI is reading every card effect and computing all possible lines from your hand. This may take 15-30 seconds.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
