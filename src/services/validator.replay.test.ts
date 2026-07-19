import { describe, it, expect } from 'vitest';
import { replayComboRoute } from './validator';
import { ComboRoute, DeckList } from '../types';

const deck: DeckList = {
  main: ['A', 'B'],
  extra: [],
  side: []
};

function makeRoute(steps: ComboRoute['steps']): ComboRoute {
  return {
    id: 'r1',
    name: 'Test Route',
    archetype: 'Test',
    description: '',
    requiredCards: ['A', 'B'],
    tags: [],
    steps
  };
}

describe('replayComboRoute normal-summon detection', () => {
  it('flags a second normal_summon when actionType is explicit', () => {
    const route = makeRoute([
      { id: 1, action: 'Play A', cardId: 'A', actionType: 'normal_summon', responses: [{ trigger: 'success', next_step: 2 }] },
      { id: 2, action: 'Play B', cardId: 'B', actionType: 'normal_summon', responses: [{ trigger: 'success', next_step: null }] }
    ]);
    const result = replayComboRoute(route, deck, ['A', 'B']);
    expect(result.errors.some(e => /second Normal Summon/.test(e))).toBe(true);
  });

  it('behaves as before for legacy text-only routes (regex fallback)', () => {
    const route = makeRoute([
      { id: 1, action: 'Normal Summon "A"', cardId: 'A', responses: [{ trigger: 'success', next_step: 2 }] },
      { id: 2, action: 'Normal Summon "B"', cardId: 'B', responses: [{ trigger: 'success', next_step: null }] }
    ]);
    const result = replayComboRoute(route, deck, ['A', 'B']);
    expect(result.errors.some(e => /second Normal Summon/.test(e))).toBe(true);
  });

  it('does not flag a single normal_summon step', () => {
    const route = makeRoute([
      { id: 1, action: 'Play A', cardId: 'A', actionType: 'normal_summon', responses: [{ trigger: 'success', next_step: null }] }
    ]);
    const result = replayComboRoute(route, deck, ['A']);
    expect(result.errors.some(e => /second Normal Summon/.test(e))).toBe(false);
  });

  it('does not count phase_marker steps toward the normal-summon budget even if the action text mentions "normal summon"', () => {
    const route = makeRoute([
      { id: 1, action: 'Play A', cardId: 'A', actionType: 'normal_summon', responses: [{ trigger: 'success', next_step: 2 }] },
      { id: 2, action: 'End Phase (reminder: already used your Normal Summon)', cardId: 'NONE', actionType: 'phase_marker', responses: [{ trigger: 'success', next_step: null }] }
    ]);
    const result = replayComboRoute(route, deck, ['A']);
    expect(result.errors.some(e => /second Normal Summon/.test(e))).toBe(false);
  });
});
