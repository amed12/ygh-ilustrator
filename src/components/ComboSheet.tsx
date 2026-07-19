'use client';

import React, { useState } from 'react';
import { ComboRoute, ComboHandContext, ComboStep, DeckList, YGOPROCardDetails } from '../types';
import { CardDisplay } from './CardDisplay';
import { TacticalBadge } from './TacticalBadge';
import { ActionTypeBadge } from './ActionTypeBadge';
import { resolveActionType } from '../data/actionTypes';
import { deriveStepCardFlow } from '../utils/stepCards';
import { mainSuccessLine } from '../utils/routeGraph';
import { formatTriggerLabel } from '../utils/triggerUi';
import { resolveCardName } from '../utils/cardName';
import { ArrowLeft, ArrowRight, Play, Printer, Hand, SunHorizon, MoonStars, Flag } from '@phosphor-icons/react';

interface ComboSheetProps {
  route: ComboRoute;
  handContext?: ComboHandContext;
  cardDetails?: Record<string, YGOPROCardDetails>;
  deckList?: DeckList;
  onBack: () => void;
  onPractice: (route: ComboRoute) => void;
  onCardMouseEnter?: (cardId: string, e: React.MouseEvent) => void;
  onCardMouseLeave?: () => void;
  onCardMouseMove?: (e: React.MouseEvent) => void;
}

/**
 * Read-only, scannable, printable view of a combo route: header (starting hand / end board /
 * required cards), then the numbered main line with source→result card flow per step and
 * OR-branches for non-success responses, then the final end board. Derived purely from props —
 * no persistence of its own.
 */
export function ComboSheet({
  route,
  handContext,
  cardDetails = {},
  onBack,
  onPractice,
  onCardMouseEnter,
  onCardMouseLeave,
  onCardMouseMove
}: ComboSheetProps) {
  const mainLine = mainSuccessLine(route);
  const mainLineIds = new Set(mainLine.map(s => s.id));
  const stepById = new Map(route.steps.map(s => [s.id, s]));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Chrome: back / practice / print — hidden when printing */}
      <div className="flex items-center justify-between print:hidden">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-all"
          >
            <Printer size={14} /> Print / Save PDF
          </button>
          <button
            type="button"
            onClick={() => onPractice(route)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition-all active:scale-[0.98]"
          >
            <Play size={14} weight="fill" /> Practice
          </button>
        </div>
      </div>

      <div className="space-y-1 print:text-black">
        <h2 className="font-sans text-xl font-bold text-zinc-100 print:text-black">{route.name}</h2>
        <p className="text-xs text-zinc-400 print:text-zinc-700 leading-relaxed">{route.description}</p>
      </div>

      {/* Header row: Starting Hand | End Board | Required Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 break-inside-avoid">
        <SheetHeaderCard title="Starting Hand" icon={<Hand size={12} weight="duotone" />}>
          {handContext ? (
            <>
              <div className="mb-2">
                {handContext.turnPosition === 'going-first' ? (
                  <span className="flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[9px] font-semibold text-amber-400 font-mono uppercase tracking-wider w-fit">
                    <SunHorizon size={10} weight="fill" /> Going First
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-[9px] font-semibold text-violet-400 font-mono uppercase tracking-wider w-fit">
                    <MoonStars size={10} weight="fill" /> Going Second
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {handContext.handCardIds.map((id, i) => (
                  <CardDisplay
                    key={`${id}-${i}`}
                    cardId={id}
                    size="xs"
                    details={cardDetails[id]}
                    onMouseEnter={onCardMouseEnter}
                    onMouseLeave={onCardMouseLeave}
                    onMouseMove={onCardMouseMove}
                  />
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-[9px] font-mono uppercase text-zinc-600 mb-1.5">Required Hand</p>
              <div className="flex flex-wrap gap-1.5">
                {route.requiredCards.map(id => (
                  <CardDisplay
                    key={id}
                    cardId={id}
                    size="xs"
                    details={cardDetails[id]}
                    onMouseEnter={onCardMouseEnter}
                    onMouseLeave={onCardMouseLeave}
                    onMouseMove={onCardMouseMove}
                  />
                ))}
              </div>
            </>
          )}
        </SheetHeaderCard>

        <SheetHeaderCard title="End Board">
          {route.endBoard ? (
            <div className="space-y-2">
              {[...route.endBoard.monsters, ...route.endBoard.spellsTraps].map(id => (
                <div key={id} className="flex flex-col items-center gap-1 inline-flex mr-1.5">
                  <CardDisplay
                    cardId={id}
                    size="sm"
                    details={cardDetails[id]}
                    glow={!!route.endBoard?.cardRoles?.[id]?.length}
                    onMouseEnter={onCardMouseEnter}
                    onMouseLeave={onCardMouseLeave}
                    onMouseMove={onCardMouseMove}
                  />
                  <div className="flex flex-wrap gap-0.5 justify-center">
                    {route.endBoard?.cardRoles?.[id]?.map(role => (
                      <TacticalBadge key={role} role={role} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-zinc-600 italic">No end board recorded.</p>
          )}
        </SheetHeaderCard>

        <SheetHeaderCard title="Required Cards">
          <div className="flex flex-wrap gap-1.5">
            {route.requiredCards.map(id => (
              <CardDisplay
                key={id}
                cardId={id}
                size="xs"
                details={cardDetails[id]}
                onMouseEnter={onCardMouseEnter}
                onMouseLeave={onCardMouseLeave}
                onMouseMove={onCardMouseMove}
              />
            ))}
          </div>
        </SheetHeaderCard>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {mainLine.map((step, idx) => (
          <SheetStepRow
            key={step.id}
            step={step}
            index={idx + 1}
            cardDetails={cardDetails}
            stepById={stepById}
            mainLineIds={mainLineIds}
            onCardMouseEnter={onCardMouseEnter}
            onCardMouseLeave={onCardMouseLeave}
            onCardMouseMove={onCardMouseMove}
          />
        ))}
      </div>

      {/* Final End Board */}
      {route.endBoard && (
        <div className="rounded-xl border border-zinc-900 bg-zinc-950/50 p-4 space-y-3 break-inside-avoid print:border-zinc-300">
          <h4 className="text-[10px] font-mono text-zinc-400 uppercase print:text-zinc-600">Final Board State</h4>
          {route.endBoard.interruptions.length > 0 && (
            <ul className="list-disc pl-4 text-xs text-zinc-300 print:text-zinc-800 space-y-0.5">
              {route.endBoard.interruptions.map((int, i) => (
                <li key={i}>{int}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SheetHeaderCard({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-3 print:border-zinc-300 print:bg-white">
      <div className="flex items-center gap-1.5 mb-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500 print:text-zinc-600">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

interface SheetStepRowProps {
  step: ComboStep;
  index: number;
  cardDetails: Record<string, YGOPROCardDetails>;
  stepById: Map<number, ComboStep>;
  mainLineIds: Set<number>;
  onCardMouseEnter?: (cardId: string, e: React.MouseEvent) => void;
  onCardMouseLeave?: () => void;
  onCardMouseMove?: (e: React.MouseEvent) => void;
}

function SheetStepRow({
  step,
  index,
  cardDetails,
  stepById,
  mainLineIds,
  onCardMouseEnter,
  onCardMouseLeave,
  onCardMouseMove
}: SheetStepRowProps) {
  const [activeBranch, setActiveBranch] = useState<string | null>(null);
  const actionType = resolveActionType(step);
  const { resultCardIds } = deriveStepCardFlow(step);
  const branches = (step.responses ?? []).filter(r => r.trigger !== 'success');

  if (actionType === 'phase_marker') {
    return (
      <div className="flex items-center gap-2 py-2 print:break-inside-avoid">
        <div className="flex-1 h-px bg-zinc-800 print:bg-zinc-300" />
        <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500 print:text-zinc-600">
          <Flag size={12} /> {step.action}
        </span>
        <div className="flex-1 h-px bg-zinc-800 print:bg-zinc-300" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-900 bg-zinc-950/40 p-3 break-inside-avoid print:border-zinc-300 print:bg-white">
      <div className="flex items-center gap-3">
        <span className="w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-mono border border-zinc-800 bg-zinc-900/60 text-zinc-400 shrink-0 print:border-zinc-400 print:text-zinc-700">
          {index}
        </span>

        <CardDisplay
          cardId={step.cardId}
          size="sm"
          details={cardDetails[step.cardId]}
          actionBadge={actionType}
          onMouseEnter={onCardMouseEnter}
          onMouseLeave={onCardMouseLeave}
          onMouseMove={onCardMouseMove}
        />

        {resultCardIds.length > 0 && (
          <>
            <ArrowRight size={16} className="text-zinc-600 shrink-0 print:text-zinc-400" />
            <div className="flex flex-wrap gap-1.5">
              {resultCardIds.map(id => (
                <CardDisplay
                  key={id}
                  cardId={id}
                  size="xs"
                  details={cardDetails[id]}
                  onMouseEnter={onCardMouseEnter}
                  onMouseLeave={onCardMouseLeave}
                  onMouseMove={onCardMouseMove}
                />
              ))}
            </div>
          </>
        )}

        <p className="flex-1 text-xs text-zinc-300 leading-relaxed print:text-zinc-800">{step.action}</p>

        {actionType && (
          <span className="shrink-0 hidden sm:inline-flex">
            <ActionTypeBadge actionType={actionType} size="sm" />
          </span>
        )}
      </div>

      {/* OR-branches for non-success responses */}
      {branches.length > 0 && (
        <div className="mt-2 pl-9 space-y-1.5">
          {branches.map(res => {
            const branchStart = res.next_step !== null ? stepById.get(res.next_step) : null;
            const isMainLineContinuation = branchStart && mainLineIds.has(branchStart.id);
            const isOpen = activeBranch === res.trigger;
            return (
              <div key={res.trigger} className="text-[10px]">
                <button
                  type="button"
                  onClick={() => setActiveBranch(isOpen ? null : res.trigger)}
                  className="flex items-center gap-1.5 text-orange-400 font-mono uppercase tracking-wider hover:text-orange-300 print:text-orange-700"
                >
                  <span>OR → {formatTriggerLabel(res.trigger)}</span>
                </button>
                {isOpen && (
                  <div className="mt-1 rounded border border-zinc-900 bg-zinc-950/60 p-2 text-zinc-400 print:border-zinc-300 print:text-zinc-700">
                    {!branchStart ? (
                      <span className="italic">End of line — no further plays.</span>
                    ) : isMainLineContinuation ? (
                      <span>Continues at step {Array.from(mainLineIds).indexOf(branchStart.id) + 1}.</span>
                    ) : (
                      <span title={branchStart.action}>{branchStart.action} ({resolveCardName(branchStart.cardId, cardDetails)})</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
