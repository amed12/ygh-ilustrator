import { ComboStep } from '../types';

const PSEUDO_IDS = new Set(['TOKEN', 'OPPONENT', 'NONE']);
const MAX_RESULT_CARDS = 4;

export interface StepCardFlow {
  sourceCardId: string;
  resultCardIds: string[];
}

/**
 * Derives the "source card → result card(s)" flow for a combo step from its stateMutations.
 * Results are cards newly present on the field or in hand as a consequence of this step —
 * field additions first (summons/searches-to-field), then hand additions (searches/draws) —
 * deduped, with pseudo-IDs and the step's own source card (when it merely moved zones) excluded.
 * Legacy steps without stateMutations yield no result cards, so callers just render the source.
 */
export function deriveStepCardFlow(step: ComboStep): StepCardFlow {
  const sourceCardId = step.cardId;
  const mut = step.stateMutations;

  if (!mut) {
    return { sourceCardId, resultCardIds: [] };
  }

  const candidates = [...mut.field.add, ...mut.hand.add];
  const seen = new Set<string>();
  const resultCardIds: string[] = [];

  for (const id of candidates) {
    const upper = id.toUpperCase();
    if (PSEUDO_IDS.has(upper)) continue;
    if (id === sourceCardId) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    resultCardIds.push(id);
    if (resultCardIds.length >= MAX_RESULT_CARDS) break;
  }

  return { sourceCardId, resultCardIds };
}
