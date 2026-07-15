'use client';

import React from 'react';
import { Rocket, ArrowsOut, MagnifyingGlass, HandPalm, Hammer, Warning } from '@phosphor-icons/react';
import { CardRole } from '../types';

const ROLE_STYLES: Record<CardRole, string> = {
  'starter': 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.35)]',
  'extender': 'bg-sky-500/10 text-sky-300 border-sky-500/25',
  'searcher': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
  'hand-trap': 'bg-amber-500/10 text-amber-300 border-amber-500/25',
  'board-breaker': 'bg-red-500/10 text-red-300 border-red-500/25',
  'brick': 'bg-zinc-700/20 text-zinc-400 border-zinc-600/30',
};

const ROLE_ICONS: Record<CardRole, React.ElementType> = {
  'starter': Rocket,
  'extender': ArrowsOut,
  'searcher': MagnifyingGlass,
  'hand-trap': HandPalm,
  'board-breaker': Hammer,
  'brick': Warning,
};

const ROLE_LABELS: Record<CardRole, string> = {
  'starter': 'Starter',
  'extender': 'Extender',
  'searcher': 'Searcher',
  'hand-trap': 'Hand-Trap',
  'board-breaker': 'Breaker',
  'brick': 'Brick',
};

interface CardRoleBadgeProps {
  role: CardRole;
  size?: 'xs' | 'sm';
}

export function CardRoleBadge({ role, size = 'xs' }: CardRoleBadgeProps) {
  const Icon = ROLE_ICONS[role];
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5 gap-1' : 'text-[9px] px-1 py-0.5 gap-0.5';

  return (
    <span
      className={`inline-flex items-center font-mono uppercase tracking-wide border rounded ${sizeClasses} ${ROLE_STYLES[role] || 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}
    >
      <Icon size={size === 'sm' ? 11 : 10} weight="fill" />
      {ROLE_LABELS[role] || role}
    </span>
  );
}
