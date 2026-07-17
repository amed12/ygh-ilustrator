import { DeckList, DeckProfile } from '../types';

// v2: profile now covers main + extra + side, so the hash includes all three sections —
// old main-only v1 cache entries are naturally orphaned and a re-analysis is triggered.
const CACHE_KEY_PREFIX = 'ygo_deck_profile_v2_';

/**
 * A stable, order-independent hash of the full deck composition (main/extra/side, including
 * copy counts), used to key the cached profile and detect when a re-analysis is needed after
 * a deck edit. Not cryptographic — just needs to be deterministic and cheap.
 */
export function hashDeck(deck: DeckList): string {
  let hash = 0;
  for (const section of [deck.main, deck.extra, deck.side]) {
    for (const id of [...section].sort()) {
      for (let i = 0; i < id.length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) | 0;
      }
      hash = (hash * 31 + 44) | 0; // separator so ['1','23'] != ['12','3']
    }
    hash = (hash * 31 + 59) | 0; // section separator
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
