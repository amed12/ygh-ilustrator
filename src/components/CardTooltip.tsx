'use client';

import React from 'react';
import { YGOPROCardDetails } from '../types';
import { CARD_REGISTRY } from '../data/cards';
import { Shield, Sword, Star } from '@phosphor-icons/react';

interface CardTooltipProps {
  cardId: string | null;
  position: { x: number; y: number };
  details?: YGOPROCardDetails;
}

export function CardTooltip({ cardId, position, details }: CardTooltipProps) {
  if (!cardId) return null;

  // Fallback to registry info if full details are not yet loaded
  const fallbackInfo = CARD_REGISTRY[cardId] || {
    id: cardId,
    name: `Card #${cardId}`,
    imageUrl: ''
  };

  const name = details?.name || fallbackInfo.name;
  const isMonster = details?.type.toLowerCase().includes('monster');
  const isSpell = details?.type.toLowerCase().includes('spell');
  const isTrap = details?.type.toLowerCase().includes('trap');

  // Attribute badge color styles
  const getAttributeBadgeClass = (attr?: string) => {
    if (!attr) return 'bg-zinc-900 text-zinc-500 border-zinc-850';
    switch (attr.toUpperCase()) {
      case 'DARK': return 'bg-purple-950/30 text-purple-400 border-purple-900/30';
      case 'LIGHT': return 'bg-yellow-950/20 text-yellow-400 border-yellow-900/20';
      case 'FIRE': return 'bg-red-950/30 text-red-400 border-red-900/30';
      case 'WATER': return 'bg-blue-950/30 text-blue-400 border-blue-900/30';
      case 'WIND': return 'bg-emerald-950/30 text-emerald-400 border-emerald-900/30';
      case 'EARTH': return 'bg-amber-950/30 text-amber-500 border-amber-900/30';
      case 'DIVINE': return 'bg-yellow-950/30 text-yellow-500 border-yellow-800/30';
      default: return 'bg-zinc-900 text-zinc-400 border-zinc-850';
    }
  };

  // Adjust tooltip offset to prevent running off viewport edges
  const xOffset = 16;
  const yOffset = 16;
  let left = position.x + xOffset;
  let top = position.y + yOffset;

  // Screen safety bounds check (tooltip width is ~300px, height is ~240px)
  if (typeof window !== 'undefined') {
    if (left + 300 > window.innerWidth) {
      left = position.x - 300 - 10;
    }
    if (top + 240 > window.innerHeight) {
      top = position.y - 240 - 10;
    }
    if (top < 10) {
      top = 10;
    }
  }

  return (
    <div
      style={{ left, top }}
      className="fixed pointer-events-none z-[100] w-[300px] rounded-xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-md p-3.5 shadow-2xl shadow-black/80 flex flex-col gap-2 transition-all duration-75 ease-out"
    >
      {/* Title & Type Header */}
      <div>
        <h4 className="font-sans text-sm font-extrabold text-zinc-100 tracking-tight leading-tight">
          {name}
        </h4>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {/* Card Type Tag */}
          <span className={`text-[8.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${
            isMonster 
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
              : isSpell 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : isTrap
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800'
          }`}>
            {details?.type || 'Loading Info...'}
          </span>

          {/* Monster Attribute */}
          {details?.attribute && (
            <span className={`text-[8.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${
              getAttributeBadgeClass(details.attribute)
            }`}>
              {details.attribute}
            </span>
          )}

          {/* Level / Rank */}
          {details?.level !== undefined && (
            <span className="flex items-center gap-0.5 text-[8.5px] font-mono bg-zinc-900 border border-zinc-850 text-zinc-400 px-1.5 py-0.5 rounded">
              <Star size={9} weight="fill" className="text-yellow-500 animate-pulse" />
              <span>LV/RK {details.level}</span>
            </span>
          )}
        </div>
      </div>

      {/* Monster stats (ATK / DEF) */}
      {isMonster && details && (
        <div className="flex items-center gap-4 py-1 border-t border-b border-zinc-900 font-mono text-xs">
          <div className="flex items-center gap-1 text-zinc-300">
            <Sword size={12} className="text-red-400" />
            <span>ATK</span>
            <span className="font-bold text-zinc-100">{details.atk !== undefined ? details.atk : '?'}</span>
          </div>
          <div className="flex items-center gap-1 text-zinc-300">
            <Shield size={12} className="text-blue-400" />
            <span>DEF</span>
            <span className="font-bold text-zinc-100">{details.def !== undefined ? details.def : '?'}</span>
          </div>
        </div>
      )}

      {/* Card description text / effect */}
      <div className="text-[10px] text-zinc-400 leading-normal max-h-[120px] overflow-y-auto pr-0.5 custom-scrollbar">
        {details?.desc ? (
          <p className="whitespace-pre-wrap break-words">{details.desc}</p>
        ) : (
          <div className="space-y-2 py-1">
            <div className="h-2 bg-zinc-900 rounded animate-pulse w-full" />
            <div className="h-2 bg-zinc-900 rounded animate-pulse w-5/6" />
            <div className="h-2 bg-zinc-900 rounded animate-pulse w-4/5" />
          </div>
        )}
      </div>

      {/* Card Sub-details Footer */}
      {details && (
        <div className="flex items-center justify-between border-t border-zinc-900 pt-1.5 mt-0.5 text-[8.5px] font-mono text-zinc-600">
          <span>Race: {details.race}</span>
          {details.archetype && <span>{details.archetype}</span>}
        </div>
      )}
    </div>
  );
}
