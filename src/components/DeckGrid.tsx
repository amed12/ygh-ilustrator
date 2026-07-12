'use client';

import React, { useState } from 'react';
import { CardDisplay } from './CardDisplay';
import { DeckList, YGOPROCardDetails } from '../types';
import { SquareHalf } from '@phosphor-icons/react';

interface DeckGridProps {
  deck: DeckList;
  highlightedCards?: string[]; // Cards used in the current combo
  cardDetails?: Record<string, YGOPROCardDetails>;
  onCardMouseEnter?: (cardId: string, e: React.MouseEvent) => void;
  onCardMouseLeave?: () => void;
  onCardMouseMove?: (e: React.MouseEvent) => void;
}

export function DeckGrid({
  deck,
  highlightedCards = [],
  cardDetails = {},
  onCardMouseEnter,
  onCardMouseLeave,
  onCardMouseMove
}: DeckGridProps) {
  const [activeTab, setActiveTab] = useState<'main' | 'extra' | 'side'>('main');

  const highlightSet = new Set(highlightedCards);

  const getSectionCards = () => {
    switch (activeTab) {
      case 'main': return deck.main;
      case 'extra': return deck.extra;
      case 'side': return deck.side;
    }
  };

  const getHighlightCount = (ids: string[]) => {
    return ids.filter(id => highlightSet.has(id)).length;
  };

  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 space-y-4">
      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
        <div className="flex gap-1 bg-zinc-900/40 p-1 rounded-lg border border-zinc-900">
          <button
            onClick={() => setActiveTab('main')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider transition-all ${
              activeTab === 'main' 
                ? 'bg-zinc-800 text-zinc-100 shadow' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span>Main</span>
            <span className="rounded bg-zinc-950 px-1 py-0.5 text-[10px] text-zinc-400">
              {deck.main.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('extra')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider transition-all ${
              activeTab === 'extra' 
                ? 'bg-zinc-800 text-zinc-100 shadow' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span>Extra</span>
            <span className="rounded bg-zinc-950 px-1 py-0.5 text-[10px] text-zinc-400">
              {deck.extra.length}
            </span>
          </button>

          {deck.side.length > 0 && (
            <button
              onClick={() => setActiveTab('side')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider transition-all ${
                activeTab === 'side' 
                  ? 'bg-zinc-800 text-zinc-100 shadow' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <span>Side</span>
              <span className="rounded bg-zinc-950 px-1 py-0.5 text-[10px] text-zinc-400">
                {deck.side.length}
              </span>
            </button>
          )}
        </div>

        {/* Legend */}
        {highlightedCards.length > 0 && (
          <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 bg-zinc-900/20 px-2 py-1 rounded border border-zinc-900">
            <span className="inline-block w-2 h-2 rounded bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
            <span>
              Combo Cards ({getHighlightCount(getSectionCards())} in view)
            </span>
          </div>
        )}
      </div>

      {/* Grid Container */}
      <div className="max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
        {getSectionCards().length > 0 ? (
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2.5 py-1">
            {getSectionCards().map((cardId, index) => {
              const shouldHighlight = highlightSet.has(cardId);
              return (
                <div key={`${cardId}-${index}`} className="relative">
                  <CardDisplay
                    cardId={cardId}
                    size="sm"
                    glow={shouldHighlight}
                    details={cardDetails[cardId]}
                    onMouseEnter={onCardMouseEnter}
                    onMouseLeave={onCardMouseLeave}
                    onMouseMove={onCardMouseMove}
                  />
                  {shouldHighlight && (
                    <span className="absolute -top-1 -right-1 z-10 w-2.5 h-2.5 rounded-full bg-indigo-500 border border-zinc-950 shadow shadow-indigo-500/50" />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-zinc-600 space-y-2 border border-dashed border-zinc-900 rounded-xl bg-zinc-950">
            <SquareHalf size={24} />
            <span className="text-xs font-mono uppercase tracking-wider">No Cards in this Section</span>
          </div>
        )}
      </div>
    </div>
  );
}
