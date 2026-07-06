'use client';

import React, { useState } from 'react';
import { CARD_REGISTRY } from '../data/cards';

interface CardDisplayProps {
  cardId: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  glow?: boolean;
  onMouseEnter?: (cardId: string, e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
  onMouseMove?: (e: React.MouseEvent) => void;
}

export function CardDisplay({
  cardId,
  size = 'md',
  glow = false,
  onMouseEnter,
  onMouseLeave,
  onMouseMove
}: CardDisplayProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const cardInfo = CARD_REGISTRY[cardId] || {
    id: cardId,
    name: `Card #${cardId}`,
    imageUrl: `https://images.ygoprodeck.com/images/cards/${cardId}.jpg`
  };

  const sizeClasses = {
    xs: 'w-10 h-14 text-[8px]',
    sm: 'w-12 h-18 text-[10px]',
    md: 'w-24 h-36 text-xs',
    lg: 'w-48 h-72 text-sm'
  };

  return (
    <div 
      onMouseEnter={(e) => onMouseEnter?.(cardId, e)}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
      className={`relative select-none overflow-hidden rounded-lg bg-zinc-900 border transition-all duration-300 flex flex-col justify-center items-center text-center p-1 ${
        sizeClasses[size]
      } ${
        glow 
          ? 'border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)] scale-[1.02]' 
          : 'border-zinc-800 hover:border-zinc-700'
      }`}
    >
      {/* Glow highlight node */}
      {glow && (
        <span className="absolute -inset-0.5 -z-10 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 opacity-75 blur animate-pulse" />
      )}

      {/* Loading Skeleton */}
      {!imageLoaded && !loadError && (
        <div className="absolute inset-0 bg-zinc-900 animate-pulse flex items-center justify-center">
          <span className="text-zinc-700 font-mono text-[10px]">Loading...</span>
        </div>
      )}

      {/* Card Image */}
      {!loadError ? (
        <img
          src={cardInfo.imageUrl}
          alt={cardInfo.name}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            setLoadError(true);
            setImageLoaded(true);
          }}
          className={`w-full h-full object-cover rounded transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : (
        /* Fallback Text card if broken link / offline */
        <div className="w-full h-full flex flex-col justify-between p-2 bg-gradient-to-b from-zinc-850 to-zinc-950 rounded border border-zinc-800 text-zinc-300 overflow-hidden">
          <div className="font-mono text-[9px] text-zinc-500 text-left">#{cardInfo.id}</div>
          <div className="font-bold leading-tight line-clamp-4 break-words">
            {cardInfo.name}
          </div>
          <div className="text-[8px] uppercase tracking-wider text-indigo-400 font-mono">
            {cardInfo.id in CARD_REGISTRY ? 'Database Match' : 'Unknown Card'}
          </div>
        </div>
      )}

      {/* Tooltip Overlay on hover */}
      <div className="absolute inset-0 bg-black/80 opacity-0 hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2 text-[10px] text-zinc-200 font-sans pointer-events-none">
        <span className="font-semibold line-clamp-2">{cardInfo.name}</span>
        <span className="font-mono text-zinc-500 mt-1">ID: {cardInfo.id}</span>
      </div>
    </div>
  );
}
