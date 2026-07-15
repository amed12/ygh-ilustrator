'use client';

import React from 'react';
import { CardRole, DeckList, DeckProfile, YGOPROCardDetails } from '../types';
import { CardDisplay } from './CardDisplay';
import { CardRoleBadge } from './CardRoleBadge';
import { resolveCardName } from '../utils/cardName';

interface DeckRoleBreakdownProps {
  deckProfile: DeckProfile;
  deck: DeckList;
  cardDetails?: Record<string, YGOPROCardDetails>;
  onCardMouseEnter?: (cardId: string, e: React.MouseEvent) => void;
  onCardMouseLeave?: () => void;
  onCardMouseMove?: (e: React.MouseEvent) => void;
}

// Display order + human labels for each functional category.
const CATEGORY_ORDER: { role: CardRole; label: string }[] = [
  { role: 'starter', label: 'Starters' },
  { role: 'extender', label: 'Extenders' },
  { role: 'searcher', label: 'Searchers' },
  { role: 'hand-trap', label: 'Hand-Traps' },
  { role: 'board-breaker', label: 'Board-Breakers' },
  { role: 'brick', label: 'Bricks' },
];

export function DeckRoleBreakdown({
  deckProfile,
  deck,
  cardDetails,
  onCardMouseEnter,
  onCardMouseLeave,
  onCardMouseMove
}: DeckRoleBreakdownProps) {
  // Unique Main Deck card IDs, preserving order.
  const uniqueMain = deck.main.filter((id, i) => deck.main.indexOf(id) === i);

  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 space-y-4">
      <div className="space-y-0.5">
        <h4 className="text-xs font-semibold text-zinc-300">Card Roles by Category</h4>
        <p className="text-[10px] text-zinc-500">
          What each Main Deck card does, grouped by its AI-classified function. Hover a card for its search targets.
        </p>
      </div>

      {CATEGORY_ORDER.map(({ role, label }) => {
        const cards = uniqueMain.filter(id => deckProfile.cards[id]?.roles?.includes(role));
        if (cards.length === 0) return null;

        return (
          <div key={role} className="space-y-2">
            <div className="flex items-center gap-2">
              <CardRoleBadge role={role} size="sm" />
              <span className="text-[10px] font-semibold text-zinc-400">{label}</span>
              <span className="text-[10px] font-mono text-zinc-600">{cards.length}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {cards.map(id => {
                const searches = deckProfile.cards[id]?.searches ?? [];
                return (
                  <div key={id} className="flex flex-col items-center gap-1 w-16">
                    <CardDisplay
                      cardId={id}
                      size="sm"
                      details={cardDetails?.[id]}
                      onMouseEnter={onCardMouseEnter}
                      onMouseLeave={onCardMouseLeave}
                      onMouseMove={onCardMouseMove}
                    />
                    <span className="text-[9px] text-zinc-400 text-center leading-tight line-clamp-2">
                      {resolveCardName(id, cardDetails)}
                    </span>
                    {role === 'searcher' && searches.length > 0 && (
                      <span className="text-[8px] font-mono text-emerald-400/70 text-center leading-tight line-clamp-2">
                        → {searches.map(sid => resolveCardName(sid, cardDetails)).join(', ')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
