import { YGOPROCardDetails } from '../types';

const CACHE_KEY = 'ygo_card_cache_v1';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_ENTRIES = 1500;

interface CacheEntry {
  d: YGOPROCardDetails;
  t: number;
}

type CacheShape = Record<string, CacheEntry>;

function readCache(): CacheShape {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) return {};
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to read card cache:', e);
    return {};
  }
}

function writeCache(cache: CacheShape) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('Failed to write card cache, evicting oldest half and retrying:', e);
    const entries = Object.entries(cache).sort((a, b) => a[1].t - b[1].t);
    const half = entries.slice(Math.floor(entries.length / 2));
    const shrunk = Object.fromEntries(half);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(shrunk));
    } catch (e2) {
      console.error('Failed to write card cache even after eviction:', e2);
    }
  }
}

export function getCachedCards(ids: string[]): { hits: Record<string, YGOPROCardDetails>; misses: string[] } {
  const cache = readCache();
  const now = Date.now();
  const hits: Record<string, YGOPROCardDetails> = {};
  const misses: string[] = [];

  ids.forEach(id => {
    const entry = cache[id];
    if (entry && now - entry.t < TTL_MS) {
      hits[id] = entry.d;
    } else {
      misses.push(id);
    }
  });

  return { hits, misses };
}

export function putCachedCards(cards: Record<string, YGOPROCardDetails>) {
  if (typeof window === 'undefined') return;
  const cache = readCache();
  const now = Date.now();

  Object.entries(cards).forEach(([id, d]) => {
    cache[id] = { d, t: now };
  });

  const entries = Object.entries(cache);
  if (entries.length > MAX_ENTRIES) {
    entries.sort((a, b) => b[1].t - a[1].t);
    writeCache(Object.fromEntries(entries.slice(0, MAX_ENTRIES)));
  } else {
    writeCache(cache);
  }
}
