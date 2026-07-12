import { DeckList, ComboRoute } from '../types';

/**
 * Computes "n choose r" (binomial coefficient) using the iterative multiplicative
 * form so intermediate values stay small — safe for the deck/hand sizes this app uses.
 */
export function nCr(n: number, r: number): number {
  if (r < 0 || r > n) return 0;
  const k = Math.min(r, n - r);
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
}

/**
 * Hypergeometric probability of drawing exactly `k` successes when drawing `n` cards
 * (without replacement) from a deck of `N` cards containing `K` copies of the target card.
 */
export function hypergeometricPMF(N: number, K: number, n: number, k: number): number {
  const denominator = nCr(N, n);
  if (denominator === 0) return 0;
  return (nCr(K, k) * nCr(N - K, n - k)) / denominator;
}

/**
 * Probability of drawing AT LEAST one copy of a card with `K` copies in an `N`-card deck,
 * given an `n`-card hand.
 */
export function probabilityAtLeastOne(N: number, K: number, n: number): number {
  if (K <= 0 || N <= 0 || n <= 0) return 0;
  const total = nCr(N, n);
  if (total === 0) return 0;
  return 1 - nCr(N - K, n) / total;
}

/**
 * Probability that an `n`-card hand contains at least one copy of EVERY distinct card
 * in `groupSizes` (each entry = how many copies of that distinct card exist in the deck),
 * computed via inclusion-exclusion over "this group is entirely absent" events.
 */
export function probabilityToOpenAllGroups(N: number, groupSizes: number[], n: number): number {
  const total = nCr(N, n);
  if (total === 0 || groupSizes.length === 0) return 0;

  const m = groupSizes.length;
  let sum = 0;
  // Iterate every subset of groups; subset = "these groups are all missing from the hand".
  for (let mask = 0; mask < (1 << m); mask++) {
    let excludedCopies = 0;
    let bitsSet = 0;
    for (let i = 0; i < m; i++) {
      if (mask & (1 << i)) {
        excludedCopies += groupSizes[i];
        bitsSet++;
      }
    }
    const sign = bitsSet % 2 === 0 ? 1 : -1;
    sum += sign * (nCr(N - excludedCopies, n) / total);
  }
  return Math.max(0, Math.min(1, sum));
}

/** Counts how many copies of `cardId` exist in the deck's main deck. */
function copiesInMain(deck: DeckList, cardId: string): number {
  return deck.main.filter(id => id === cardId).length;
}

/**
 * Probability of opening a specific combo route in an `n`-card hand: the hand must contain
 * at least one copy of every distinct main-deck starter the route requires. Extra/Side Deck
 * IDs in requiredCards are excluded — they can never be drawn into a hand.
 */
export function probabilityToOpenCombo(deck: DeckList, route: ComboRoute, handSize: number): number {
  const mainDeckSet = new Set(deck.main);
  const distinctStarters = Array.from(new Set(route.requiredCards.filter(id => mainDeckSet.has(id))));
  if (distinctStarters.length === 0) return 0;

  const groupSizes = distinctStarters.map(id => copiesInMain(deck, id));
  return probabilityToOpenAllGroups(deck.main.length, groupSizes, handSize);
}

/**
 * Probability of "bricking": drawing a hand with NONE of the starters across ANY of the
 * given routes (i.e. not even one card that could begin any known combo line).
 */
export function probabilityToBrick(deck: DeckList, routes: ComboRoute[], handSize: number): number {
  const mainDeckSet = new Set(deck.main);
  const unionStarters = new Set<string>();
  routes.forEach(route => {
    route.requiredCards.forEach(id => {
      if (mainDeckSet.has(id)) unionStarters.add(id);
    });
  });

  const N = deck.main.length;
  if (unionStarters.size === 0 || N === 0) return 1;

  const totalCopies = Array.from(unionStarters).reduce((sum, id) => sum + copiesInMain(deck, id), 0);
  const total = nCr(N, handSize);
  if (total === 0) return 1;

  return nCr(N - totalCopies, handSize) / total;
}
