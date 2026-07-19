import type { ComponentType } from 'react';
import {
  Crown,
  Sparkle,
  Intersect,
  LinkSimple,
  MagnifyingGlass,
  Lightning,
  Archive,
  EyeSlash,
  Fire,
  ArrowUUpLeft,
  FlagCheckered,
  Question,
  type IconProps
} from '@phosphor-icons/react';
import { ComboStep, ActionType } from '../types';

export type { ActionType };

export const VALID_ACTION_TYPES = new Set<ActionType>([
  'normal_summon',
  'special_summon',
  'xyz',
  'synchro',
  'link',
  'fusion',
  'ritual',
  'activate',
  'search',
  'send_gy',
  'discard',
  'banish',
  'set',
  'tribute',
  'return_hand',
  'phase_marker',
  'other'
]);

interface ActionTypeMeta {
  label: string;
  Icon: ComponentType<IconProps>;
  colorClass: string;
}

export const ACTION_TYPE_META: Record<ActionType, ActionTypeMeta> = {
  normal_summon: { label: 'Normal Summon', Icon: Crown, colorClass: 'text-amber-400 bg-amber-500/20' },
  special_summon: { label: 'Special Summon', Icon: Sparkle, colorClass: 'text-violet-400 bg-violet-500/20' },
  xyz: { label: 'Xyz Summon', Icon: Intersect, colorClass: 'text-neutral-300 bg-neutral-700/60' },
  synchro: { label: 'Synchro Summon', Icon: Sparkle, colorClass: 'text-white bg-neutral-500/40' },
  link: { label: 'Link Summon', Icon: LinkSimple, colorClass: 'text-sky-400 bg-sky-500/20' },
  fusion: { label: 'Fusion Summon', Icon: Intersect, colorClass: 'text-purple-400 bg-purple-500/20' },
  ritual: { label: 'Ritual Summon', Icon: Sparkle, colorClass: 'text-blue-400 bg-blue-500/20' },
  activate: { label: 'Activate Effect', Icon: Lightning, colorClass: 'text-yellow-400 bg-yellow-500/20' },
  search: { label: 'Search / Add', Icon: MagnifyingGlass, colorClass: 'text-emerald-400 bg-emerald-500/20' },
  send_gy: { label: 'Send to GY', Icon: Archive, colorClass: 'text-neutral-400 bg-neutral-600/40' },
  discard: { label: 'Discard', Icon: Archive, colorClass: 'text-neutral-400 bg-neutral-600/40' },
  banish: { label: 'Banish', Icon: EyeSlash, colorClass: 'text-orange-400 bg-orange-500/20' },
  set: { label: 'Set', Icon: Fire, colorClass: 'text-neutral-300 bg-neutral-700/60' },
  tribute: { label: 'Tribute', Icon: Fire, colorClass: 'text-red-400 bg-red-500/20' },
  return_hand: { label: 'Return to Hand', Icon: ArrowUUpLeft, colorClass: 'text-cyan-400 bg-cyan-500/20' },
  phase_marker: { label: 'Phase', Icon: FlagCheckered, colorClass: 'text-neutral-200 bg-neutral-800' },
  other: { label: 'Other', Icon: Question, colorClass: 'text-neutral-400 bg-neutral-700/40' }
};

/**
 * First-match regex ladder over free-text action strings. Order matters: summon-mechanic
 * types (xyz/synchro/link/fusion/ritual) must be checked before the generic "special summon"
 * catch-all, since those actions almost always also contain the words "special summon".
 */
export function inferActionType(action: string): ActionType | undefined {
  const text = action.toLowerCase();

  if (/\bxyz summon\b|\boverlay\b/.test(text)) return 'xyz';
  if (/\bsynchro summon\b/.test(text)) return 'synchro';
  if (/\blink summon\b/.test(text)) return 'link';
  if (/\bfusion summon\b/.test(text)) return 'fusion';
  if (/\britual summon\b/.test(text)) return 'ritual';
  if (/\bnormal summon\b/.test(text) && !/additional normal summon|cannot normal summon/.test(text)) {
    return 'normal_summon';
  }
  if (/\bspecial summon\b/.test(text)) return 'special_summon';
  if (/\bsearch\b|\badd\b.*\bfrom your deck\b|\bdraw\b/.test(text)) return 'search';
  if (/\bsend\b.*\bto (the |your )?gy\b|\bsend\b.*\bgraveyard\b/.test(text)) return 'send_gy';
  if (/\bdiscard\b/.test(text)) return 'discard';
  if (/\bbanish\b/.test(text)) return 'banish';
  if (/\btribute\b/.test(text)) return 'tribute';
  if (/\breturn\b.*\bto (the |your )?hand\b/.test(text)) return 'return_hand';
  if (/\bset\b/.test(text)) return 'set';
  if (/\bactivate\b/.test(text)) return 'activate';

  return undefined;
}

/** Single place inference lives — all UI/validator code should call this instead of inferActionType directly. */
export function resolveActionType(step: Pick<ComboStep, 'actionType' | 'action'>): ActionType | undefined {
  return step.actionType ?? inferActionType(step.action);
}
