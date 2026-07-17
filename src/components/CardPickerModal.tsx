'use client';

import React, { useMemo, useState } from 'react';
import { DeckList, DeckProfile, YGOPROCardDetails } from '../types';
import { CARD_REGISTRY } from '../data/cards';
import { CardDisplay } from './CardDisplay';
import { CardRoleBadge } from './CardRoleBadge';
import { X } from '@phosphor-icons/react';

interface CardPickerModalProps {
  isOpen: boolean;
  title: string;
  onPick: (cardId: string) => void;
  onClose: () => void;
  deck: DeckList;
  cardDetails?: Record<string, YGOPROCardDetails>;
  deckProfile?: DeckProfile;
  /** Show the NONE/TOKEN/OPPONENT preset row (for step card association). */
  showReserved?: boolean;
  onCardMouseEnter?: (cardId: string, e: React.MouseEvent) => void;
  onCardMouseLeave?: () => void;
  onCardMouseMove?: (e: React.MouseEvent) => void;
}

/** Searchable deck-card picker overlay, shared by the combo creator's step card,
 *  action composer card slots, and end-board quick add. */
export function CardPickerModal({
  isOpen,
  title,
  onPick,
  onClose,
  deck,
  cardDetails = {},
  deckProfile,
  showReserved = false,
  onCardMouseEnter,
  onCardMouseLeave,
  onCardMouseMove
}: CardPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const allUniqueDeckCards = useMemo(() => {
    const ids = Array.from(new Set([...deck.main, ...deck.extra]));
    return ids.map(id => ({
      id,
      name: cardDetails[id]?.name || CARD_REGISTRY[id]?.name || `Card #${id}`
    }));
  }, [deck, cardDetails]);

  if (!isOpen) return null;

  const pick = (cardId: string) => {
    onPick(cardId);
    setSearchQuery('');
  };

  const close = () => {
    onClose();
    setSearchQuery('');
  };

  const filtered = allUniqueDeckCards.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-xl max-h-[80vh] mx-4 rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-900 px-5 py-3.5 shrink-0">
          <h3 className="text-sm font-bold text-zinc-100">{title}</h3>
          <button
            onClick={close}
            className="rounded-md p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Presets Row */}
        {showReserved && (
          <div className="border-b border-zinc-900 px-5 py-3 flex gap-2 shrink-0 flex-wrap bg-zinc-950/80">
            {(['NONE', 'TOKEN', 'OPPONENT'] as const).map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => pick(preset)}
                className="px-3.5 py-1.5 rounded border border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 hover:bg-zinc-900 text-xs font-mono text-zinc-300 font-semibold transition-all active:scale-[0.97]"
              >
                {preset === 'NONE' ? 'NONE / GENERAL' : preset === 'TOKEN' ? 'TOKEN' : 'OPPONENT ACTION'}
              </button>
            ))}
          </div>
        )}

        {/* Search Input */}
        <div className="border-b border-zinc-900 px-5 py-3 shrink-0">
          <input
            type="text"
            autoFocus
            placeholder="Search card in deck by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-zinc-900 border border-zinc-850 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500 font-sans"
          />
        </div>

        {/* Scrollable Card Grid */}
        <div className="flex-1 overflow-y-auto p-5 bg-zinc-950/60 custom-scrollbar">
          <div className="grid grid-cols-4 gap-3">
            {filtered.map(card => (
              <div
                key={card.id}
                onClick={() => pick(card.id)}
                className="cursor-pointer hover:scale-[1.03] active:scale-[0.97] transition-all"
              >
                <CardDisplay
                  cardId={card.id}
                  size="sm"
                  details={cardDetails[card.id]}
                  onMouseEnter={onCardMouseEnter}
                  onMouseLeave={onCardMouseLeave}
                  onMouseMove={onCardMouseMove}
                />
                {deckProfile?.cards[card.id]?.roles?.length ? (
                  <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                    {deckProfile.cards[card.id].roles.map(role => (
                      <CardRoleBadge key={role} role={role} size="xs" />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-4 text-center text-xs font-mono text-zinc-600 py-8">
                No cards match your search criteria.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
