import { describe, it, expect } from 'vitest';
import { deriveStepCardFlow } from './stepCards';
import { ComboStep } from '../types';

function makeStep(overrides: Partial<ComboStep>): ComboStep {
  return { id: 1, action: '', cardId: 'A', ...overrides };
}

describe('deriveStepCardFlow', () => {
  it('returns no results for a legacy step without stateMutations', () => {
    const flow = deriveStepCardFlow(makeStep({ cardId: 'A' }));
    expect(flow.sourceCardId).toBe('A');
    expect(flow.resultCardIds).toEqual([]);
  });

  it('filters out pseudo-IDs (TOKEN/OPPONENT/NONE)', () => {
    const flow = deriveStepCardFlow(makeStep({
      cardId: 'A',
      stateMutations: {
        hand: { add: [], remove: [] },
        field: { add: ['TOKEN', 'B'], remove: [] },
        gy: { add: [], remove: [] },
        banished: { add: [], remove: [] }
      }
    }));
    expect(flow.resultCardIds).toEqual(['B']);
  });

  it('excludes the source card when it merely moved zones', () => {
    const flow = deriveStepCardFlow(makeStep({
      cardId: 'A',
      stateMutations: {
        hand: { add: [], remove: [] },
        field: { add: ['A', 'B'], remove: ['A'] },
        gy: { add: [], remove: [] },
        banished: { add: [], remove: [] }
      }
    }));
    expect(flow.resultCardIds).toEqual(['B']);
  });

  it('prefers field additions before hand additions and dedupes', () => {
    const flow = deriveStepCardFlow(makeStep({
      cardId: 'A',
      stateMutations: {
        hand: { add: ['C', 'B'], remove: [] },
        field: { add: ['B'], remove: [] },
        gy: { add: [], remove: [] },
        banished: { add: [], remove: [] }
      }
    }));
    expect(flow.resultCardIds).toEqual(['B', 'C']);
  });

  it('caps at 4 result cards', () => {
    const flow = deriveStepCardFlow(makeStep({
      cardId: 'A',
      stateMutations: {
        hand: { add: [], remove: [] },
        field: { add: ['B', 'C', 'D', 'E', 'F'], remove: [] },
        gy: { add: [], remove: [] },
        banished: { add: [], remove: [] }
      }
    }));
    expect(flow.resultCardIds).toHaveLength(4);
  });
});
