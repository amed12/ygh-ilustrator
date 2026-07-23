import { DeckProfile, EndboardScenarioId, ScenarioCatalog, ScenarioResult } from '../types';

const CACHE_KEY_PREFIX = 'ygo_endboard_scenarios_v1_';

/**
 * A stable, order-independent hash of the AI-compiled deck profile's content (roles + search
 * targets per card), used to detect when cached scenario results are stale because the profile
 * was regenerated (e.g. a smarter model re-analyzed the deck) even if the deck itself didn't
 * change. Not cryptographic — just needs to be deterministic and cheap, mirroring hashDeck's
 * style in deckProfileCache.ts.
 */
export function hashDeckProfileContent(profile: DeckProfile): string {
  let hash = 0;
  const ids = Object.keys(profile.cards).sort();
  for (const id of ids) {
    const card = profile.cards[id];
    const roles = [...(card.roles ?? [])].sort().join(',');
    const searches = [...(card.searches ?? [])].sort().join(',');
    const entry = `${id}:${roles}:${searches}`;
    for (let i = 0; i < entry.length; i++) {
      hash = (hash * 31 + entry.charCodeAt(i)) | 0;
    }
    hash = (hash * 31 + 44) | 0; // separator
  }
  return (hash >>> 0).toString(36);
}

/**
 * Reads the cached scenario catalog for a deck. Returns null (treated as "no cache") if the
 * catalog doesn't exist, or if its deckHash/deckProfileVersion don't match — the caller starts
 * a fresh catalog on next put in that case.
 */
export function getCachedScenarioCatalog(deckHash: string, deckProfileVersion: string): ScenarioCatalog | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(CACHE_KEY_PREFIX + deckHash);
    if (!stored) return null;
    const catalog: ScenarioCatalog = JSON.parse(stored);
    if (catalog.deckHash !== deckHash || catalog.deckProfileVersion !== deckProfileVersion) return null;
    return catalog;
  } catch (e) {
    console.error('Failed to read cached scenario catalog:', e);
    return null;
  }
}

/**
 * Stores one scenario result into the deck's catalog, keyed internally by scenarioId. If the
 * existing catalog is stale (deckHash/deckProfileVersion mismatch), it's discarded and a fresh
 * catalog is started containing only this result.
 */
export function putCachedScenarioResult(deckHash: string, deckProfileVersion: string, result: ScenarioResult): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getCachedScenarioCatalog(deckHash, deckProfileVersion);
    const results: Partial<Record<EndboardScenarioId, ScenarioResult>> = existing ? { ...existing.results } : {};
    results[result.scenarioId] = result;

    const catalog: ScenarioCatalog = {
      version: '1.0',
      deckHash,
      deckProfileVersion,
      results
    };
    localStorage.setItem(CACHE_KEY_PREFIX + deckHash, JSON.stringify(catalog));
  } catch (e) {
    console.error('Failed to cache scenario result:', e);
  }
}
