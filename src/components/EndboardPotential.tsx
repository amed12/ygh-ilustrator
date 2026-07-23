'use client';

import React from 'react';
import { EndboardScenarioDef, EndboardScenarioId, ScenarioCatalog, YGOPROCardDetails } from '../types';
import { ENDBOARD_SCENARIOS, ENDBOARD_SCENARIO_DESCRIPTIONS } from '../data/endboardScenarios';
import { CardDisplay } from './CardDisplay';
import { resolveCardName } from '../utils/cardName';
import { Sparkle, FileText, Info } from '@phosphor-icons/react';

interface EndboardPotentialProps {
  scenarioCatalog: ScenarioCatalog | null;
  generatingScenarioId: EndboardScenarioId | null;
  onGenerateScenario: (scenario: EndboardScenarioDef) => void;
  onOpenScenarioSheet: (scenarioId: EndboardScenarioId) => void;
  cardDetails?: Record<string, YGOPROCardDetails>;
  onCardMouseEnter?: (cardId: string, e: React.MouseEvent) => void;
  onCardMouseLeave?: () => void;
  onCardMouseMove?: (e: React.MouseEvent) => void;
}

export function EndboardPotential({
  scenarioCatalog,
  generatingScenarioId,
  onGenerateScenario,
  onOpenScenarioSheet,
  cardDetails = {},
  onCardMouseEnter,
  onCardMouseLeave,
  onCardMouseMove
}: EndboardPotentialProps) {
  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 space-y-4">
      <div className="space-y-0.5">
        <h4 className="text-xs font-semibold text-zinc-300">Endboard Potential</h4>
        <p className="text-[10px] text-zinc-500 flex items-start gap-1">
          <Info size={12} className="shrink-0 mt-0.5 text-zinc-600" />
          <span>
            AI picks its own hypothetical opening hand per scenario and builds the deepest honest line from it.
            Generated on-demand per scenario — each one can take 30-90s.
          </span>
        </p>
      </div>

      <div className="space-y-3">
        {ENDBOARD_SCENARIOS.map(scenario => {
          const result = scenarioCatalog?.results[scenario.id];
          const isGenerating = generatingScenarioId === scenario.id;

          return (
            <div key={scenario.id} className="rounded-lg border border-zinc-900 bg-zinc-900/30 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-zinc-200">{scenario.label}</span>
                  <p className="text-[10px] text-zinc-500">{ENDBOARD_SCENARIO_DESCRIPTIONS[scenario.id]}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onGenerateScenario(scenario)}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 shrink-0 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-all active:scale-[0.98]"
                >
                  {isGenerating ? (
                    <span className="animate-spin inline-block w-3 h-3 rounded-full border-2 border-zinc-500 border-t-white" />
                  ) : (
                    <Sparkle size={12} />
                  )}
                  <span>{result ? 'Re-generate' : 'Generate'}</span>
                </button>
              </div>

              {result && (
                <div className="space-y-2 border-t border-zinc-900 pt-2.5">
                  <div className="space-y-1">
                    <p
                      className="text-[9px] font-mono uppercase text-zinc-600"
                      title={result.handRationale}
                    >
                      AI-picked hand (not drawn)
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.hypotheticalHand.map((id, i) => (
                        <CardDisplay
                          key={`${scenario.id}-${id}-${i}`}
                          cardId={id}
                          size="xs"
                          details={cardDetails[id]}
                          onMouseEnter={onCardMouseEnter}
                          onMouseLeave={onCardMouseLeave}
                          onMouseMove={onCardMouseMove}
                        />
                      ))}
                    </div>
                    {result.handRationale && (
                      <p className="text-[9px] text-zinc-500 italic leading-snug">{result.handRationale}</p>
                    )}
                  </div>

                  <div className="space-y-0.5">
                    <p className="text-[9px] font-mono uppercase text-zinc-600">End board</p>
                    <p className="text-[10px] text-zinc-400 leading-snug line-clamp-2">{result.route.description}</p>
                    {result.route.endBoard && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {[...result.route.endBoard.monsters, ...result.route.endBoard.spellsTraps].map((id, i) => (
                          <span key={`${id}-${i}`} className="text-[9px] rounded bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-zinc-400">
                            {resolveCardName(id, cardDetails)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenScenarioSheet(scenario.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900 px-3 py-1.5 text-[10px] font-semibold text-zinc-300 transition-all active:scale-[0.98]"
                  >
                    <FileText size={12} />
                    <span>Open Full Sheet</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
