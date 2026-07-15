import { describe, it, expect } from 'vitest';
import { rankRoutes, buildSearchGraph } from './adaptiveMatcher';
import { ComboRoute, DeckList } from '../types';

const deck: DeckList = {
  main: ['A', 'B', 'C', 'D'],
  extra: ['X'],
  side: []
};

function makeRoute(overrides: Partial<ComboRoute> = {}): ComboRoute {
  return {
    id: 'r1',
    name: 'Test Route',
    archetype: 'Test',
    description: '',
    requiredCards: ['A', 'B'],
    tags: [],
    steps: [
      { id: 1, action: 'do A', cardId: 'A', responses: [{ trigger: 'success', next_step: 2 }] },
      {
        id: 2,
        action: 'search C with B',
        cardId: 'B',
        responses: [{ trigger: 'success', next_step: null }],
        stateMutations: {
          hand: { add: ['C'], remove: [] },
          field: { add: [], remove: [] },
          gy: { add: [], remove: [] },
          banished: { add: [], remove: [] }
        }
      }
    ],
    ...overrides
  };
}

describe('rankRoutes', () => {
  it('classifies a hand with all required cards as direct', () => {
    const route = makeRoute();
    const [match] = rankRoutes(['A', 'B'], [route], deck);
    expect(match.playability).toBe('direct');
    expect(match.score).toBe(1);
    expect(match.missing).toEqual([]);
  });

  it('classifies a hand missing a required card, but holding its searcher, as searchable (1-hop)', () => {
    const route = makeRoute({ requiredCards: ['A', 'C'] });
    // B searches C via stateMutations.hand.add on step 2
    const [match] = rankRoutes(['A', 'B'], [route], deck);
    expect(match.playability).toBe('searchable');
    expect(match.reachable).toEqual([{ missingCardId: 'C', viaHandCardId: 'B' }]);
  });

  it('classifies a hand with a 2-hop search chain as searchable', () => {
    const routeWithChain = makeRoute({
      requiredCards: ['A', 'D'],
      steps: [
        { id: 1, action: 'do A', cardId: 'A', responses: [{ trigger: 'success', next_step: 2 }] },
        {
          id: 2,
          action: 'A searches B',
          cardId: 'A',
          responses: [{ trigger: 'success', next_step: 3 }],
          stateMutations: {
            hand: { add: ['B'], remove: [] },
            field: { add: [], remove: [] },
            gy: { add: [], remove: [] },
            banished: { add: [], remove: [] }
          }
        },
        {
          id: 3,
          action: 'B searches D',
          cardId: 'B',
          responses: [{ trigger: 'success', next_step: null }],
          stateMutations: {
            hand: { add: ['D'], remove: [] },
            field: { add: [], remove: [] },
            gy: { add: [], remove: [] },
            banished: { add: [], remove: [] }
          }
        }
      ]
    });
    const [match] = rankRoutes(['A'], [routeWithChain], deck);
    expect(match.playability).toBe('searchable');
    expect(match.reachable).toEqual([{ missingCardId: 'D', viaHandCardId: 'A' }]);
  });

  it('respects copy counts when checking hand satisfaction', () => {
    const route = makeRoute({ requiredCards: ['A', 'A'] });
    const oneCopy = rankRoutes(['A', 'B'], [route], deck);
    expect(oneCopy[0].playability).not.toBe('direct');
    const twoCopies = rankRoutes(['A', 'A'], [route], deck);
    expect(twoCopies[0].playability).toBe('direct');
  });

  it('classifies a hand satisfying only part of the requirement as partial', () => {
    const route = makeRoute({ requiredCards: ['A', 'D'] });
    const [match] = rankRoutes(['A'], [route], deck);
    expect(match.playability).toBe('partial');
    expect(match.missing).toEqual(['D']);
  });

  it('drops routes with no satisfied and no reachable pieces', () => {
    const route = makeRoute({ requiredCards: ['D'] });
    const matches = rankRoutes(['A'], [route], deck);
    expect(matches).toEqual([]);
  });

  it('builds a search graph edge only when the target is in the main deck', () => {
    const route = makeRoute({
      steps: [
        {
          id: 1,
          action: 'search extra deck card (should not create an edge)',
          cardId: 'A',
          responses: [{ trigger: 'success', next_step: null }],
          stateMutations: {
            hand: { add: ['X'], remove: [] },
            field: { add: [], remove: [] },
            gy: { add: [], remove: [] },
            banished: { add: [], remove: [] }
          }
        }
      ]
    });
    const graph = buildSearchGraph([route], deck);
    expect(graph.get('A')).toBeUndefined();
  });
});
