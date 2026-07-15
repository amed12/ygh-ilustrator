import { ComboRoute, DeckList, YGOPROCardDetails } from '../types';

/** Passcodes of common meta hand traps — treated as their own "reachable" pieces since they
 * don't need to be searched, just held; kept here so the matcher can recognize them without
 * relying on oracle-text heuristics that might misfire on niche cards. */
const KNOWN_HAND_TRAPS = new Set<string>([
  '14558127', // Ash Blossom & Joyous Spring
  '97268402', // Effect Veiler
  '27174286', // Maxx "C"
  '27260347', // Nibiru, the Primal Being
  '94145021', // Ghost Ogre & Snow Rabbit
  '52038741', // PSY-Framegear Gamma
  '4536758',  // Droll & Lock Bird
  '65681983', // Infinite Impermanence
]);

const SEARCH_PHRASE = /add\s+1\s+.*?\s+from\s+your\s+deck\s+to\s+your\s+hand/i;

export type RoutePlayability = 'direct' | 'searchable' | 'partial';

export interface SearchPath {
  missingCardId: string;
  viaHandCardId: string;
}

export interface RouteMatch {
  route: ComboRoute;
  playability: RoutePlayability;
  score: number;
  satisfied: string[];
  reachable: SearchPath[];
  missing: string[];
}

/**
 * Builds a directed search graph (searcher cardId -> cards it can add from Deck to hand).
 * Two sources, unioned: (1) authored combo steps whose stateMutations.hand.add reflects a
 * search effect, (2) oracle-text heuristic on cached card details for cards not covered by (1).
 */
export function buildSearchGraph(
  allRoutes: ComboRoute[],
  deck: DeckList,
  cardDetails: Record<string, YGOPROCardDetails> = {}
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  const mainDeckSet = new Set(deck.main);

  const addEdge = (from: string, to: string) => {
    if (!mainDeckSet.has(to)) return;
    if (!graph.has(from)) graph.set(from, new Set());
    graph.get(from)!.add(to);
  };

  allRoutes.forEach(route => {
    route.steps.forEach(step => {
      const added = step.stateMutations?.hand?.add ?? [];
      added.forEach(targetId => addEdge(step.cardId, targetId));
    });
  });

  Object.values(cardDetails).forEach(card => {
    if (!mainDeckSet.has(card.id)) return;
    if (card.desc && SEARCH_PHRASE.test(card.desc)) {
      // Heuristic can't know the exact target(s) from text alone; connect it to every other
      // main-deck card sharing the same archetype as a best-effort approximation.
      if (card.archetype) {
        deck.main.forEach(otherId => {
          if (otherId === card.id) return;
          if (cardDetails[otherId]?.archetype === card.archetype) {
            addEdge(card.id, otherId);
          }
        });
      }
    }
  });

  return graph;
}

function isHandTrap(cardId: string): boolean {
  return KNOWN_HAND_TRAPS.has(cardId);
}

/**
 * Ranks combo routes by how reachable they are from the given hand, using exact matches first
 * and falling back to search-graph reachability (<=2 hops) and hand traps for partial credit.
 * This is a superset of findPlayableRoutes — routes that match exactly still come out on top.
 */
export function rankRoutes(
  handCards: string[],
  allRoutes: ComboRoute[],
  deck: DeckList,
  cardDetails: Record<string, YGOPROCardDetails> = {}
): RouteMatch[] {
  const mainDeckSet = new Set(deck.main);
  const graph = buildSearchGraph(allRoutes, deck, cardDetails);

  const handCounts = new Map<string, number>();
  handCards.forEach(id => handCounts.set(id, (handCounts.get(id) || 0) + 1));

  const matches: RouteMatch[] = [];

  allRoutes.forEach(route => {
    const requiredInMain = route.requiredCards.filter(id => mainDeckSet.has(id));
    if (requiredInMain.length === 0) return;

    const reqCounts = new Map<string, number>();
    requiredInMain.forEach(id => reqCounts.set(id, (reqCounts.get(id) || 0) + 1));

    const satisfied: string[] = [];
    const stillMissing: string[] = [];
    const remainingHandCounts = new Map(handCounts);

    reqCounts.forEach((count, cardId) => {
      const have = remainingHandCounts.get(cardId) || 0;
      const satisfiedCount = Math.min(have, count);
      for (let i = 0; i < satisfiedCount; i++) satisfied.push(cardId);
      remainingHandCounts.set(cardId, have - satisfiedCount);
      for (let i = 0; i < count - satisfiedCount; i++) stillMissing.push(cardId);
    });

    if (stillMissing.length === 0) {
      matches.push({
        route,
        playability: 'direct',
        score: 1,
        satisfied,
        reachable: [],
        missing: []
      });
      return;
    }

    // Any hand card can act as a searcher reaching a missing piece via <=2 hops through the
    // search graph — including cards that also satisfy a requiredCards slot, since playing a
    // card as a starter and it triggering its own search effect is the same physical action.
    const availableHandCards = Array.from(new Set(handCards));

    const reachable: SearchPath[] = [];
    const trueMissing: string[] = [];
    const claimedSearchers = new Set<string>();

    stillMissing.forEach(missingCardId => {
      const via = availableHandCards.find(handCardId => {
        if (claimedSearchers.has(handCardId)) return false;
        if (isHandTrap(handCardId)) return false; // hand traps don't search starters
        const oneHop = graph.get(handCardId)?.has(missingCardId);
        if (oneHop) return true;
        // 2-hop: handCard -> intermediate -> missingCardId
        const firstHop = graph.get(handCardId);
        if (!firstHop) return false;
        for (const intermediate of firstHop) {
          if (graph.get(intermediate)?.has(missingCardId)) return true;
        }
        return false;
      });

      if (via) {
        claimedSearchers.add(via);
        reachable.push({ missingCardId, viaHandCardId: via });
      } else {
        trueMissing.push(missingCardId);
      }
    });

    if (satisfied.length === 0 && reachable.length === 0) return; // nothing to offer

    const totalPieces = satisfied.length + reachable.length + trueMissing.length;
    const score = (satisfied.length + reachable.length * 0.9) / totalPieces;

    matches.push({
      route,
      playability: trueMissing.length === 0 ? 'searchable' : 'partial',
      score,
      satisfied,
      reachable,
      missing: trueMissing
    });
  });

  const playabilityRank: Record<RoutePlayability, number> = { direct: 0, searchable: 1, partial: 2 };
  const efficiencyRank: Record<string, number> = { optimal: 0, 'sub-optimal': 1, brick: 2 };

  return matches.sort((a, b) => {
    if (playabilityRank[a.playability] !== playabilityRank[b.playability]) {
      return playabilityRank[a.playability] - playabilityRank[b.playability];
    }
    if (b.score !== a.score) return b.score - a.score;
    const aEff = efficiencyRank[a.route.efficiency ?? ''] ?? 1;
    const bEff = efficiencyRank[b.route.efficiency ?? ''] ?? 1;
    if (aEff !== bEff) return aEff - bEff;
    return a.route.steps.length - b.route.steps.length;
  });
}
