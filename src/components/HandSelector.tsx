'use client';

import React, { useState, useMemo } from 'react';
import { CardDisplay } from './CardDisplay';
import { DeckList, ComboRoute } from '../types';
import { TurnPosition } from '../services/prompts';
import { CARD_REGISTRY } from '../data/cards';
import { findPlayableRoutes } from '../engine/comboEngine';
import { X, Shuffle, Sparkle, SunHorizon, MoonStars, Hand } from '@phosphor-icons/react';

interface HandSelectorProps {
  deck: DeckList;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (handCards: string[], turnPosition: TurnPosition) => void;
  availableRoutes: ComboRoute[];
  onSelectCombo: (route: ComboRoute) => void;
  isGenerating: boolean;
  onCardMouseEnter?: (cardId: string, e: React.MouseEvent) => void;
  onCardMouseLeave?: () => void;
  onCardMouseMove?: (e: React.MouseEvent) => void;
}

export function HandSelector({
  deck,
  isOpen,
  onClose,
  onConfirm,
  availableRoutes,
  onSelectCombo,
  isGenerating,
  onCardMouseEnter,
  onCardMouseLeave,
  onCardMouseMove
}: HandSelectorProps) {
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [turnPosition, setTurnPosition] = useState<TurnPosition>('going-first');

  // Build a deduplicated list with counts for display
  const mainDeckEntries = useMemo(() => {
    const countMap = new Map<string, number>();
    deck.main.forEach(id => {
      countMap.set(id, (countMap.get(id) || 0) + 1);
    });
    return Array.from(countMap.entries()).map(([id, deckCount]) => ({
      id,
      deckCount,
      name: CARD_REGISTRY[id]?.name || `Card #${id}`
    }));
  }, [deck.main]);

  const toggleCard = (cardId: string) => {
    setSelectedCards(prev => {
      const currentCount = prev.filter(id => id === cardId).length;
      const maxCopies = deck.main.filter(id => id === cardId).length;

      if (currentCount >= maxCopies) {
        // Remove one copy
        const idx = prev.indexOf(cardId);
        if (idx !== -1) {
          const next = [...prev];
          next.splice(idx, 1);
          return next;
        }
        return prev;
      }
      // Add one copy
      return [...prev, cardId];
    });
  };

  const removeCard = (index: number) => {
    setSelectedCards(prev => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const drawRandom = (count: number) => {
    // Simulate a real draw: shuffle main deck copy and take N
    const shuffled = [...deck.main].sort(() => Math.random() - 0.5);
    setSelectedCards(shuffled.slice(0, count));
  };

  const clearAll = () => setSelectedCards([]);

  const getSelectedCount = (cardId: string) => {
    return selectedCards.filter(id => id === cardId).length;
  };

  // Find combos whose main-deck starters are a subset of the selected hand.
  // (Extra/Side Deck pieces in requiredCards can never be drawn, so they're excluded — see findPlayableRoutes.)
  const validCombos = useMemo(() => {
    if (selectedCards.length === 0) return [];
    return findPlayableRoutes(selectedCards, availableRoutes, deck);
  }, [selectedCards, availableRoutes, deck]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl max-h-[90vh] mx-4 rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/40 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-900 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400 border border-emerald-500/20">
              <Hand size={20} weight="duotone" />
            </div>
            <div>
              <h2 className="font-sans text-base font-bold text-zinc-100">Select Your Opening Hand</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Pick the cards in your hand, then generate a combo. No card limit — include Maxx &quot;C&quot; draws too!
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="rounded-lg p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-all disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Turn Position Selector */}
        <div className="border-b border-zinc-900 px-6 py-3 flex items-center justify-between shrink-0">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Turn Position</span>
          <div className="flex gap-1 bg-zinc-900/60 p-1 rounded-lg border border-zinc-800">
            <button
              onClick={() => setTurnPosition('going-first')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                turnPosition === 'going-first'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <SunHorizon size={14} weight="duotone" />
              <span>Going First</span>
            </button>
            <button
              onClick={() => setTurnPosition('going-second')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                turnPosition === 'going-second'
                  ? 'bg-violet-500/15 text-violet-400 border border-violet-500/30 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <MoonStars size={14} weight="duotone" />
              <span>Going Second</span>
            </button>
          </div>
        </div>

        {/* Selected Hand Preview Bar */}
        <div className="border-b border-zinc-900 px-6 py-3 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Your Hand</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold border ${
                selectedCards.length > 0
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-zinc-900 text-zinc-500 border-zinc-800'
              }`}>
                {selectedCards.length} card{selectedCards.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => drawRandom(5)}
                disabled={isGenerating}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-all disabled:opacity-50"
              >
                <Shuffle size={12} />
                <span>Draw 5</span>
              </button>
              <button
                onClick={() => drawRandom(6)}
                disabled={isGenerating}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-all disabled:opacity-50"
              >
                <Shuffle size={12} />
                <span>Draw 6</span>
              </button>
              {selectedCards.length > 0 && (
                <button
                  onClick={clearAll}
                  disabled={isGenerating}
                  className="px-2.5 py-1 rounded-md text-[10px] font-semibold text-red-400 hover:text-red-300 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 transition-all disabled:opacity-50"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Hand cards horizontal scroll */}
          {selectedCards.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {selectedCards.map((cardId, index) => (
                <div
                  key={`hand-${cardId}-${index}`}
                  className="relative shrink-0 cursor-pointer group"
                  onClick={() => removeCard(index)}
                >
                  <CardDisplay 
                    cardId={cardId} 
                    size="xs" 
                    glow 
                    onMouseEnter={onCardMouseEnter}
                    onMouseLeave={onCardMouseLeave}
                    onMouseMove={onCardMouseMove}
                  />
                  <div className="absolute inset-0 rounded-lg bg-red-500/0 group-hover:bg-red-500/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <X size={16} className="text-red-400" weight="bold" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-4 text-zinc-600 border border-dashed border-zinc-900 rounded-lg">
              <span className="text-xs font-mono">Click cards below to add them to your hand</span>
            </div>
          )}
        </div>

        {/* Card Grid — Main Deck cards to pick from */}
        <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider mb-3">
            Main Deck — click to add / remove copies
          </p>
          <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
            {mainDeckEntries.map((entry) => {
              const selected = getSelectedCount(entry.id);
              const isSelected = selected > 0;
              return (
                <div
                  key={entry.id}
                  onClick={() => !isGenerating && toggleCard(entry.id)}
                  className={`relative cursor-pointer rounded-lg transition-all ${
                    isGenerating ? 'opacity-50 cursor-not-allowed' : ''
                  } ${
                    isSelected
                      ? 'ring-2 ring-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                      : 'hover:ring-1 hover:ring-zinc-700'
                  }`}
                >
                  <CardDisplay 
                    cardId={entry.id} 
                    size="sm" 
                    glow={isSelected} 
                    onMouseEnter={onCardMouseEnter}
                    onMouseLeave={onCardMouseLeave}
                    onMouseMove={onCardMouseMove}
                  />

                  {/* Selection badge */}
                  {isSelected && (
                    <span className="absolute -top-1 -right-1 z-10 flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 border-2 border-zinc-950 text-[9px] font-bold text-white shadow-lg">
                      {selected}
                    </span>
                  )}

                  {/* Deck count indicator */}
                  {entry.deckCount > 1 && (
                    <span className="absolute bottom-0.5 right-0.5 z-10 rounded bg-zinc-900/90 border border-zinc-800 px-1 py-[1px] text-[8px] font-mono text-zinc-400">
                      ×{entry.deckCount}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Valid Combos Section */}
        {validCombos.length > 0 && (
          <div className="border-t border-zinc-900 bg-emerald-950/10 px-6 py-4 shrink-0">
            <p className="text-[10px] font-mono text-emerald-500 uppercase tracking-wider mb-3 font-bold">
              {validCombos.length} Matching Combo{validCombos.length !== 1 ? 's' : ''} Available for this Hand
            </p>
            <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2">
              {validCombos.map(combo => (
                <button
                  key={combo.id}
                  onClick={() => onSelectCombo(combo)}
                  className="shrink-0 group flex flex-col text-left p-3 rounded-lg border border-emerald-900/50 bg-emerald-950/20 hover:bg-emerald-950/40 hover:border-emerald-700 transition-all active:scale-[0.98] w-64"
                >
                  <span className="text-[10px] font-mono text-emerald-400 mb-1 line-clamp-1">{combo.archetype}</span>
                  <span className="text-sm font-bold text-zinc-200 line-clamp-1 group-hover:text-white">{combo.name}</span>
                  <span className="text-[10px] text-zinc-400 mt-1 line-clamp-2 leading-snug">{combo.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer — Generate Button */}
        <div className="border-t border-zinc-900 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-zinc-500">
            {turnPosition === 'going-first' ? (
              <span className="flex items-center gap-1.5">
                <SunHorizon size={14} className="text-amber-400" />
                Build end board with max negates
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <MoonStars size={14} className="text-violet-400" />
                Break board &amp; push for OTK
              </span>
            )}
          </div>

          <button
            onClick={() => onConfirm(selectedCards, turnPosition)}
            disabled={selectedCards.length === 0 || isGenerating}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] shadow-lg shadow-emerald-600/15"
          >
            {isGenerating ? (
              <>
                <span className="animate-spin inline-block w-3.5 h-3.5 rounded-full border-2 border-zinc-500 border-t-white" />
                <span>Analyzing Hand...</span>
              </>
            ) : (
              <>
                <Sparkle size={16} weight="fill" />
                <span>Analyze Hand Possibilities ({selectedCards.length})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
