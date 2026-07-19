'use client';

import React from 'react';
import { ComboRoute, ComboStep, ComboHandContext, ComboResponse, DeckProfile, YGOPROCardDetails } from '../types';
import { CardDisplay } from './CardDisplay';
import { TacticalBadge } from './TacticalBadge';
import { CARD_REGISTRY } from '../data/cards';
import { StepTimeline } from './StepTimeline';
import { FlowChart } from './FlowChart';
import { OpeningHandPanel } from './OpeningHandPanel';
import { ArrowLeft, ArrowCounterClockwise, DownloadSimple, ShareNetwork, Check, Trophy, SmileySad, XCircle, WarningCircle, PencilSimple, ArrowRight, FileText } from '@phosphor-icons/react';
import { deriveStepCardFlow } from '../utils/stepCards';
import { resolveActionType, ACTION_TYPE_META } from '../data/actionTypes';
import { formatTriggerLabel, getTriggerColor } from '../utils/triggerUi';

interface ComboNavigatorProps {
  route: ComboRoute;
  currentStep: ComboStep | null;
  history: { step: ComboStep; trigger: string }[];
  isComplete: boolean;
  progress: { current: number; total: number };
  onAdvance: (trigger: string) => void;
  onReset: () => void;
  onEdit?: () => void;
  onOpenSheet?: () => void;
  onBackToDeck: () => void;
  handContext?: ComboHandContext;
  onExport?: () => void;
  onShare?: () => void;
  justCopied?: boolean;
  onStepClick?: (historyIndex: number) => void;
  cardDetails?: Record<string, YGOPROCardDetails>;
  deckProfile?: DeckProfile | null;
  /** Required starters not actually in the practiced hand — this line assumes they're drawn/searched. */
  assumedMissingCards?: string[];
  onCardMouseEnter?: (cardId: string, e: React.MouseEvent) => void;
  onCardMouseLeave?: () => void;
  onCardMouseMove?: (e: React.MouseEvent) => void;
}

export function ComboNavigator({
  route,
  currentStep,
  history,
  isComplete,
  progress,
  onAdvance,
  onReset,
  onEdit,
  onOpenSheet,
  onBackToDeck,
  handContext,
  onExport,
  onShare,
  justCopied,
  onStepClick,
  cardDetails = {},
  deckProfile,
  assumedMissingCards = [],
  onCardMouseEnter,
  onCardMouseLeave,
  onCardMouseMove
}: ComboNavigatorProps) {

  const resolveCardName = (cardId: string): string => {
    if (['TOKEN', 'OPPONENT', 'NONE'].includes(cardId.toUpperCase())) return cardId;
    return cardDetails[cardId]?.name || CARD_REGISTRY[cardId]?.name || `Card #${cardId}`;
  };

  const getTriggerIcon = (trigger: string) => {
    if (trigger === 'success') return <Check size={18} weight="bold" className="group-hover:scale-110 transition-transform" />;
    return <XCircle size={18} weight="bold" className="group-hover:scale-110 transition-transform" />;
  };

  return (
    <div className="space-y-6">
      {/* Assumed-reachable-cards warning banner */}
      {assumedMissingCards.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-3">
          <WarningCircle size={16} className="text-amber-400 shrink-0 mt-0.5" weight="duotone" />
          <p className="text-xs text-amber-300 leading-relaxed">
            This line assumes you draw or search: {assumedMissingCards.map(id => resolveCardName(id)).join(', ')}.
          </p>
        </div>
      )}

      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
        <div className="space-y-1">
          <button
            onClick={onBackToDeck}
            className="group flex items-center gap-1 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Deck Grid</span>
          </button>
          <h2 className="font-sans text-xl font-bold tracking-tight text-zinc-100 mt-1">
            {route.name}
          </h2>
          <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
            Archetype: {route.archetype}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenSheet && (
            <button
              onClick={onOpenSheet}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 transition-all active:scale-[0.98]"
              title="Open scannable Combo Sheet"
            >
              <FileText size={14} />
              <span>Sheet</span>
            </button>
          )}

          {onShare && (
            <button
              onClick={onShare}
              disabled={justCopied}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900 disabled:opacity-60 px-3.5 py-2 text-xs font-semibold text-zinc-300 transition-all active:scale-[0.98]"
              title="Copy a shareable link to this combo (bundles the deck so a friend can open and practice it directly)"
            >
              <ShareNetwork size={14} />
              <span>{justCopied ? 'Copied!' : 'Share Link'}</span>
            </button>
          )}

          {onExport && (
            <button
              onClick={onExport}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 transition-all active:scale-[0.98]"
              title="Export this custom combo to a JSON file"
            >
              <DownloadSimple size={14} />
              <span>Export</span>
            </button>
          )}

          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 transition-all active:scale-[0.98]"
              title="Edit this combo"
            >
              <PencilSimple size={14} />
              <span>Edit</span>
            </button>
          )}

          <button
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 transition-all active:scale-[0.98]"
          >
            <ArrowCounterClockwise size={14} />
            <span>Reset Combo</span>
          </button>
        </div>
      </div>

      {/* Main Cockpit Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Timeline (Col 3) */}
        <div className="lg:col-span-3 space-y-4">
          <StepTimeline history={history} currentStep={currentStep} onStepClick={onStepClick} />
          <OpeningHandPanel
            handContext={handContext}
            cardDetails={cardDetails}
            onCardMouseEnter={onCardMouseEnter}
            onCardMouseLeave={onCardMouseLeave}
            onCardMouseMove={onCardMouseMove}
          />
        </div>

        {/* Center Column: Control Room (Col 5) */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 rounded-xl border border-zinc-900 bg-zinc-950 text-center space-y-6 min-h-[460px]">
          
          {!isComplete && currentStep ? (
            <>
              {/* Progress and card type tags */}
              <div className="flex items-center justify-between w-full border-b border-zinc-900 pb-2">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                  Instruction {progress.current} of {progress.total}
                </span>
                <span className="text-[10px] font-mono text-indigo-400 font-semibold uppercase tracking-wider truncate max-w-[60%]">
                  {resolveCardName(currentStep.cardId)}
                </span>
              </div>

              {/* Central Card Display with Glow (+ source → result cards row when derivable) */}
              {(() => {
                const stepActionType = resolveActionType(currentStep);
                const { resultCardIds } = deriveStepCardFlow(currentStep);
                return (
                  <div className="flex justify-center items-center gap-3 py-2">
                    <CardDisplay
                      cardId={currentStep.cardId}
                      size="lg"
                      glow={true}
                      details={cardDetails[currentStep.cardId]}
                      roles={deckProfile?.cards[currentStep.cardId]?.roles}
                      actionBadge={stepActionType}
                      onMouseEnter={onCardMouseEnter}
                      onMouseLeave={onCardMouseLeave}
                      onMouseMove={onCardMouseMove}
                    />
                    {resultCardIds.length > 0 && (
                      <>
                        <ArrowRight size={20} className="text-zinc-600 shrink-0" />
                        <div className="flex flex-wrap gap-2 max-w-[140px]">
                          {resultCardIds.map(id => (
                            <CardDisplay
                              key={id}
                              cardId={id}
                              size="sm"
                              details={cardDetails[id]}
                              onMouseEnter={onCardMouseEnter}
                              onMouseLeave={onCardMouseLeave}
                              onMouseMove={onCardMouseMove}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* Step Action Text */}
              <div className="space-y-1 max-w-sm">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                  {resolveActionType(currentStep) ? ACTION_TYPE_META[resolveActionType(currentStep)!].label : 'Action Required'}
                </span>
                <p className="text-base font-bold text-zinc-200 leading-normal">
                  {currentStep.action}
                </p>
              </div>

              {/* Action Buttons Panel */}
              <div className="w-full flex flex-wrap justify-center gap-3 border-t border-zinc-900 pt-4">
                {currentStep.responses?.map((res: ComboResponse) => (
                  <button
                    key={res.trigger}
                    onClick={() => onAdvance(res.trigger)}
                    className={`group flex flex-col items-center justify-center gap-1 p-3 min-w-[100px] rounded-lg border transition-all active:scale-[0.98] active:translate-y-[1px] cursor-pointer ${getTriggerColor(res.trigger)}`}
                  >
                    {getTriggerIcon(res.trigger)}
                    <span className="text-xs uppercase tracking-wider font-mono mt-1">{formatTriggerLabel(res.trigger)}</span>
                    <span className="text-[9px] opacity-60 font-normal">
                      {res.next_step ? 'Pivot' : 'End Line'}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* Combo Completed State */
            <div className="w-full flex flex-col items-center justify-center py-10 space-y-6">
              {/* Check if last action outcome was success or failure */}
              {history.length > 0 && history[history.length - 1].trigger === 'success' ? (
                <>
                  <div className="w-16 h-16 flex items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.2)] animate-bounce">
                    <Trophy size={32} weight="duotone" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-sans text-xl font-bold text-zinc-100">
                      Combo Completed!
                    </h3>
                    <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                      You successfully navigated all the steps and established your final board. Well played!
                    </p>
                  </div>
                  
                  {/* End Board Summary */}
                  {route.endBoard && (
                    <div className="w-full mt-4 text-left border border-zinc-800 bg-zinc-900/50 rounded-lg p-4">
                      <h4 className="text-[10px] font-mono text-zinc-400 uppercase mb-3">Final Board State</h4>
                      <div className="space-y-3">
                        {route.endBoard.interruptions && route.endBoard.interruptions.length > 0 && (
                          <div>
                            <span className="text-[10px] text-emerald-400 uppercase font-bold block mb-1">Interruptions</span>
                            <ul className="list-disc pl-4 text-xs text-zinc-300">
                              {route.endBoard.interruptions.map((int, i) => (
                                <li key={i}>{int}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <span className="text-[10px] text-indigo-400 uppercase block mb-1">Monsters</span>
                            <div className="flex flex-wrap gap-3">
                              {route.endBoard.monsters?.map((id, i) => (
                                <div key={i} className="flex flex-col items-center gap-1">
                                  <CardDisplay cardId={id} size="sm" details={cardDetails[id]} glow={!!route.endBoard?.cardRoles?.[id]?.length} />
                                  {route.endBoard?.cardRoles?.[id]?.map(role => (
                                    <TacticalBadge key={role} role={role} />
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="w-16 h-16 flex items-center justify-center rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                    <SmileySad size={32} weight="duotone" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-sans text-xl font-bold text-zinc-100">
                      Combo Blocked
                    </h3>
                    <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                      Your combo path was negated and you have no remaining recovery moves. Pass your turn.
                    </p>
                  </div>
                </>
              )}

              <div className="flex gap-3 w-full border-t border-zinc-900 pt-6">
                <button
                  onClick={onReset}
                  className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 py-2.5 text-xs font-semibold text-zinc-300 transition-all active:scale-[0.98]"
                >
                  Restart Practicing
                </button>
                <button
                  onClick={onBackToDeck}
                  className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 py-2.5 text-xs font-semibold text-white transition-all active:scale-[0.98]"
                >
                  Back to Deck
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: FlowChart (Col 4) */}
        <div className="lg:col-span-4 space-y-4">
          <FlowChart route={route} currentStepId={currentStep?.id || 0} history={history} cardDetails={cardDetails} />
        </div>
      </div>
    </div>
  );
}
