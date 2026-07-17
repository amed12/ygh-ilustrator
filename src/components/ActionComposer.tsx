'use client';

import React, { useState } from 'react';
import { DeckList, DeckProfile, YGOPROCardDetails } from '../types';
import { ACTION_TEMPLATES, ActionTemplate } from '../data/actionTemplates';
import { CardPickerModal } from './CardPickerModal';
import { resolveCardName } from '../utils/cardName';
import { X } from '@phosphor-icons/react';

interface ActionComposerProps {
  /** The composed action string (source of truth, stored in ComboStep.action). */
  value: string;
  onChange: (text: string) => void;
  /** Called when a card is picked into a phrase slot (lets the parent auto-set step.cardId). */
  onCardMentioned?: (cardId: string) => void;
  deck: DeckList;
  cardDetails?: Record<string, YGOPROCardDetails>;
  deckProfile?: DeckProfile;
  onCardMouseEnter?: (cardId: string, e: React.MouseEvent) => void;
  onCardMouseLeave?: () => void;
  onCardMouseMove?: (e: React.MouseEvent) => void;
}

/** Joins phrase segments into one readable sentence: connectors starting with
 *  punctuation attach to the previous segment without a space. */
function joinSegments(segments: string[]): string {
  let out = '';
  for (const seg of segments) {
    if (!out) {
      out = seg;
    } else if (/^[,;.]/.test(seg)) {
      out += seg;
    } else {
      out += ' ' + seg;
    }
  }
  return out;
}

/**
 * Click-to-compose builder for combo step action descriptions. The user taps
 * template chips ("Special Summon", "tribute it", ", then") to assemble the
 * sentence; phrases with a {card} slot open the deck card picker and get the
 * real card name inserted. Output is a plain string — the manual textarea
 * below always works as a fallback/refinement.
 *
 * NOTE: mount with a React `key` per step so segments reset when switching steps.
 */
export function ActionComposer({
  value,
  onChange,
  onCardMentioned,
  deck,
  cardDetails = {},
  deckProfile,
  onCardMouseEnter,
  onCardMouseLeave,
  onCardMouseMove
}: ActionComposerProps) {
  // Pre-existing text (typed or AI-generated) loads as one editable segment.
  const [segments, setSegments] = useState<string[]>(() => (value.trim() ? [value.trim()] : []));
  // Template awaiting a card pick for its {card} slot.
  const [pendingTemplate, setPendingTemplate] = useState<ActionTemplate | null>(null);

  const commit = (next: string[]) => {
    setSegments(next);
    onChange(joinSegments(next));
  };

  const handleTemplateClick = (tpl: ActionTemplate) => {
    if (tpl.phrase.includes('{card}')) {
      setPendingTemplate(tpl);
    } else {
      commit([...segments, tpl.phrase]);
    }
  };

  const handleCardPicked = (cardId: string) => {
    if (!pendingTemplate) return;
    const cardName = resolveCardName(cardId, cardDetails);
    commit([...segments, pendingTemplate.phrase.replace('{card}', `"${cardName}"`)]);
    setPendingTemplate(null);
    onCardMentioned?.(cardId);
  };

  const removeSegment = (index: number) => {
    commit(segments.filter((_, i) => i !== index));
  };

  const handleManualEdit = (text: string) => {
    // Manual typing takes over: collapse to a single segment holding the full text.
    setSegments(text.trim() ? [text] : []);
    onChange(text);
  };

  return (
    <div className="space-y-3">
      {/* Template chip groups */}
      <div className="space-y-2 rounded-lg border border-zinc-900 bg-zinc-950/60 p-3 max-h-[190px] overflow-y-auto custom-scrollbar">
        {ACTION_TEMPLATES.map(group => (
          <div key={group.group} className="flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-600 w-24 shrink-0">
              {group.group}
            </span>
            {group.templates.map(tpl => (
              <button
                key={tpl.label}
                type="button"
                onClick={() => handleTemplateClick(tpl)}
                className={`px-2 py-0.5 rounded-full border text-[10px] font-medium transition-all active:scale-[0.95] ${
                  tpl.phrase.includes('{card}')
                    ? 'border-indigo-800/60 bg-indigo-950/30 text-indigo-300 hover:bg-indigo-950/60 hover:border-indigo-600'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-900 hover:border-zinc-700'
                }`}
                title={tpl.phrase}
              >
                {tpl.label}
                {tpl.phrase.includes('{card}') && <span className="text-indigo-500/80 ml-0.5">▸🂠</span>}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Assembled segments */}
      {segments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {segments.map((seg, i) => (
            <span
              key={`${i}-${seg}`}
              className="inline-flex items-center gap-1 rounded bg-zinc-900 border border-zinc-800 px-2 py-1 text-[11px] text-zinc-200 max-w-full"
            >
              <span className="truncate max-w-[320px]">{seg}</span>
              <button
                type="button"
                onClick={() => removeSegment(i)}
                className="text-zinc-600 hover:text-red-400 shrink-0"
                title="Remove phrase"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Manual fallback / final text */}
      <div>
        <label className="block text-[10px] font-mono text-zinc-500 uppercase mb-1">
          Action Description (result — editable)
        </label>
        <textarea
          value={value}
          onChange={(e) => handleManualEdit(e.target.value)}
          rows={2}
          placeholder='Click the template chips above, or type manually — e.g. Normal Summon "Zeta" & activate effect, tribute it'
          className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
        />
      </div>

      {/* Card slot picker */}
      <CardPickerModal
        isOpen={pendingTemplate !== null}
        title={pendingTemplate ? `Pick a card for: ${pendingTemplate.phrase.replace('{card}', '…')}` : ''}
        onPick={handleCardPicked}
        onClose={() => setPendingTemplate(null)}
        deck={deck}
        cardDetails={cardDetails}
        deckProfile={deckProfile}
        onCardMouseEnter={onCardMouseEnter}
        onCardMouseLeave={onCardMouseLeave}
        onCardMouseMove={onCardMouseMove}
      />
    </div>
  );
}
