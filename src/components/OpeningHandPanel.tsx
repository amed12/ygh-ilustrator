'use client';

import React from 'react';
import { ComboHandContext } from '../types';
import { CardDisplay } from './CardDisplay';
import { Hand, SunHorizon, MoonStars, CalendarBlank } from '@phosphor-icons/react';

interface OpeningHandPanelProps {
  handContext?: ComboHandContext;
  onCardMouseEnter?: (cardId: string, e: React.MouseEvent) => void;
  onCardMouseLeave?: () => void;
  onCardMouseMove?: (e: React.MouseEvent) => void;
}

export function OpeningHandPanel({
  handContext,
  onCardMouseEnter,
  onCardMouseLeave,
  onCardMouseMove
}: OpeningHandPanelProps) {
  if (!handContext) return null;

  const dateStr = new Date(handContext.generatedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded bg-emerald-500/10 p-1.5 text-emerald-400 border border-emerald-500/20">
            <Hand size={14} weight="duotone" />
          </div>
          <span className="font-sans text-xs font-bold text-zinc-300 uppercase tracking-wider">
            Opening Hand
          </span>
        </div>

        {/* Turn Position Badge */}
        {handContext.turnPosition === 'going-first' ? (
          <span className="flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[9px] font-semibold text-amber-400 font-mono uppercase tracking-wider">
            <SunHorizon size={10} weight="fill" />
            <span>Going First</span>
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-[9px] font-semibold text-violet-400 font-mono uppercase tracking-wider">
            <MoonStars size={10} weight="fill" />
            <span>Going Second</span>
          </span>
        )}
      </div>

      {/* Horizontal hand scroll grid */}
      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {handContext.handCardIds.map((cardId, index) => (
          <div key={`hand-${cardId}-${index}`} className="relative shrink-0">
            <CardDisplay 
              cardId={cardId} 
              size="xs" 
              glow={false} 
              onMouseEnter={onCardMouseEnter}
              onMouseLeave={onCardMouseLeave}
              onMouseMove={onCardMouseMove}
            />
          </div>
        ))}
      </div>

      {/* Metadata Timestamp */}
      <div className="flex items-center gap-1 text-[9px] font-mono text-zinc-600">
        <CalendarBlank size={10} />
        <span>Generated: {dateStr}</span>
      </div>
    </div>
  );
}
