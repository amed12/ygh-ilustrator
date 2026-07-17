'use client';

import React from 'react';
import { ShieldStar, Bomb, Crosshair, ShieldCheck, LockKey, Sword, Heart, Prohibit, CastleTurret, ArrowClockwise, Fire } from '@phosphor-icons/react';
import { TacticalRole } from '../types';

const ROLE_STYLES: Record<TacticalRole, string> = {
  'omni-negate': 'bg-amber-500/10 text-amber-300 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.35)]',
  'negate-monster': 'bg-amber-500/10 text-amber-300 border-amber-500/25',
  'negate-spell-trap': 'bg-amber-500/10 text-amber-300 border-amber-500/25',
  'board-wipe': 'bg-red-500/10 text-red-300 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.35)]',
  'targeted-removal': 'bg-orange-500/10 text-orange-300 border-orange-500/25',
  'protection': 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25',
  'floodgate': 'bg-purple-500/10 text-purple-300 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.35)]',
  'attacker': 'bg-rose-500/10 text-rose-300 border-rose-500/25',
  'recovery': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
  'towers': 'bg-sky-500/10 text-sky-300 border-sky-500/30 shadow-[0_0_10px_rgba(14,165,233,0.35)]',
  'follow-up': 'bg-teal-500/10 text-teal-300 border-teal-500/25',
  'burn': 'bg-orange-500/10 text-orange-300 border-orange-500/30',
};

const ROLE_ICONS: Record<TacticalRole, React.ElementType> = {
  'omni-negate': ShieldStar,
  'negate-monster': Prohibit,
  'negate-spell-trap': Prohibit,
  'board-wipe': Bomb,
  'targeted-removal': Crosshair,
  'protection': ShieldCheck,
  'floodgate': LockKey,
  'attacker': Sword,
  'recovery': Heart,
  'towers': CastleTurret,
  'follow-up': ArrowClockwise,
  'burn': Fire,
};

const ROLE_LABELS: Record<TacticalRole, string> = {
  'omni-negate': 'Omni-Negate',
  'negate-monster': 'Negate Monster',
  'negate-spell-trap': 'Negate S/T',
  'board-wipe': 'Board Wipe',
  'targeted-removal': 'Removal',
  'protection': 'Protection',
  'floodgate': 'Floodgate',
  'attacker': 'Attacker',
  'recovery': 'Recovery',
  'towers': 'Towers',
  'follow-up': 'Follow-Up',
  'burn': 'Burn',
};

interface TacticalBadgeProps {
  role: TacticalRole;
  size?: 'xs' | 'sm';
}

export function TacticalBadge({ role, size = 'xs' }: TacticalBadgeProps) {
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
