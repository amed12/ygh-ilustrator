import { DeckList, DeckProfile } from '../types';

const CACHE_KEY_PREFIX = 'ygo_deck_profile_v1_';

/**
 * A stable, order-independent hash of a deck's main deck composition (including copy counts),
 * used to key the cached profile and detect when a re-analysis is needed after a deck edit.
 * Not cryptographic — just needs to be deterministic and cheap.
 */
export function hashDeck(deck: DeckList): string {
  const sorted = [...deck.main].sort();
  let hash = 0;
  for (const id of sorted) {
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) | 0;
    }
    hash = (hash * 31 + 44) | 0; // separator so ['1','23'] != ['12','3']
  }
  return (hash >>> 0).toString(36);
}

export function getCachedDeckProfile(deckHash: string): DeckProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(CACHE_KEY_PREFIX + deckHash);
    if (!stored) return null;
    const profile: DeckProfile = JSON.parse(stored);
    return profile.deckHash === deckHash ? profile : null;
  } catch (e) {
    console.error('Failed to read cached deck profile:', e);
    return null;
  }
}

export function putCachedDeckProfile(profile: DeckProfile) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY_PREFIX + profile.deckHash, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to cache deck profile:', e);
  }
}
