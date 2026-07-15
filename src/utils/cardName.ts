import { CARD_REGISTRY } from '../data/cards';
import { YGOPROCardDetails } from '../types';

/**
 * Resolve a human-readable card name for a given card ID, using the same priority the
 * CardDisplay uses: live YGOPRODeck details first, then the static CARD_REGISTRY, then a
 * `Card #<id>` fallback. Reserved keywords (TOKEN/OPPONENT/NONE) are surfaced as a generic label.
 */
export function resolveCardName(
  cardId: string,
  cardDetails?: Record<string, YGOPROCardDetails>
): string {
  if (['TOKEN', 'OPPONENT', 'NONE'].includes(cardId.toUpperCase())) {
    return `Generic Action (${cardId})`;
  }
  return cardDetails?.[cardId]?.name || CARD_REGISTRY[cardId]?.name || `Card #${cardId}`;
}
