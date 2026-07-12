import { ComboRoute, ComboStep, DeckList, ComboResponse } from '../types';

/**
 * Checks if a given deck contains all required cards for a combo route.
 * Matches across both Main and Extra deck.
 */
export function findMatchingRoutes(deck: DeckList, allRoutes: ComboRoute[]): ComboRoute[] {
  const allCardsInDeck = new Set<string>([...deck.main, ...deck.extra, ...deck.side]);
  
  return allRoutes.filter(route => {
    // 1. Must contain all required starters in the deck
    const hasRequired = route.requiredCards.every(cardId => allCardsInDeck.has(cardId));
    if (!hasRequired) return false;

    // 2. Must contain all cards referenced in the steps (excluding reserved keyword actions)
    return route.steps.every(step => {
      const uCardId = step.cardId.toUpperCase();
      if (['NONE', 'TOKEN', 'OPPONENT'].includes(uCardId)) return true;
      return allCardsInDeck.has(step.cardId);
    });
  });
}

/**
 * Finds all combo routes that are PLAYABLE given the current opening hand.
 * A route is playable if all its requiredCards are present in the hand (with correct copy count).
 * This is stricter than findMatchingRoutes which only checks deck membership.
 *
 * requiredCards may include Extra Deck / Side Deck pieces the route also depends on — those can
 * never be drawn into an opening hand, so they're excluded from the hand-count check via
 * `deck.main`. Only main-deck cards are checked against the hand.
 */
export function findPlayableRoutes(handCards: string[], allRoutes: ComboRoute[], deck: DeckList): ComboRoute[] {
  const mainDeckSet = new Set(deck.main);
  const handCounts = new Map<string, number>();
  handCards.forEach(id => handCounts.set(id, (handCounts.get(id) || 0) + 1));

  return allRoutes.filter(route => {
    const handStarters = route.requiredCards.filter(id => mainDeckSet.has(id));
    if (handStarters.length === 0) return false;

    const reqCounts = new Map<string, number>();
    handStarters.forEach(id => reqCounts.set(id, (reqCounts.get(id) || 0) + 1));

    for (const [id, count] of reqCounts.entries()) {
      if ((handCounts.get(id) || 0) < count) return false;
    }
    return true;
  });
}

export interface ComboHistoryItem {
  step: ComboStep;
  trigger: string;
}

export interface VirtualState {
  hand: string[];
  field: string[];
  gy: string[];
  banished: string[];
}

/**
 * Creates a stateful combo state machine for navigating steps.
 * Provides O(1) step lookup via a local Map.
 */
export function createEngine(route: ComboRoute, initialHand: string[] = []) {
  // O(1) map lookup
  const stepMap = new Map<number, ComboStep>();
  route.steps.forEach(step => {
    stepMap.set(step.id, step);
  });

  // Find the first step in the combo (usually step 1)
  let currentStepId = route.steps.length > 0 ? route.steps[0].id : null;
  const history: ComboHistoryItem[] = [];

  const getCurrentStep = (): ComboStep => {
    if (currentStepId === null) {
      throw new Error('Combo engine is empty or has not been initialized.');
    }
    const step = stepMap.get(currentStepId);
    if (!step) {
      throw new Error(`Step ID ${currentStepId} not found in route map.`);
    }
    return step;
  };

  const getAvailableResponses = (): ComboResponse[] => {
    if (currentStepId === null) return [];
    const step = stepMap.get(currentStepId);
    if (!step || !step.responses) return [];
    return step.responses;
  };

  const advance = (trigger: string): ComboStep | null => {
    if (currentStepId === null) return null;
    const currentStep = getCurrentStep();
    
    const response = currentStep.responses?.find(r => r.trigger === trigger);
    if (!response) {
      return null;
    }

    // Log current step and the chosen trigger in history
    history.push({ step: currentStep, trigger });
    
    const nextId = response.next_step;
    currentStepId = nextId;
    
    return nextId !== null ? stepMap.get(nextId) || null : null;
  };

  const reset = (): void => {
    currentStepId = route.steps.length > 0 ? route.steps[0].id : null;
    history.length = 0; // Clear array in-place
  };

  const getHistory = (): ComboHistoryItem[] => {
    return [...history];
  };

  const isComplete = (): boolean => {
    if (currentStepId === null) return true; // Reached end of path
    const currentStep = stepMap.get(currentStepId);
    if (!currentStep) return true;
    
    if (currentStep.responses && currentStep.responses.length > 0) {
      return false; // has at least one possible continuation
    }
    return true;
  };

  const getProgress = (): { current: number; total: number } => {
    const total = route.steps.length;
    // Find the current index or length if complete
    const currentIdx = route.steps.findIndex(s => s.id === currentStepId);
    const current = currentIdx !== -1 ? currentIdx + 1 : total;
    return { current, total };
  };

  const getVirtualState = (): VirtualState => {
    const state: VirtualState = {
      hand: [...initialHand],
      field: [],
      gy: [],
      banished: []
    };

    // Replay mutations up to current point in history
    for (const h of history) {
      const muts = h.step.stateMutations;
      if (!muts) continue;

      if (muts.hand) {
        muts.hand.remove.forEach(id => {
          const idx = state.hand.indexOf(id);
          if (idx !== -1) state.hand.splice(idx, 1);
        });
        state.hand.push(...muts.hand.add);
      }
      if (muts.field) {
        muts.field.remove.forEach(id => {
          const idx = state.field.indexOf(id);
          if (idx !== -1) state.field.splice(idx, 1);
        });
        state.field.push(...muts.field.add);
      }
      if (muts.gy) {
        muts.gy.remove.forEach(id => {
          const idx = state.gy.indexOf(id);
          if (idx !== -1) state.gy.splice(idx, 1);
        });
        state.gy.push(...muts.gy.add);
      }
      if (muts.banished) {
        muts.banished.remove.forEach(id => {
          const idx = state.banished.indexOf(id);
          if (idx !== -1) state.banished.splice(idx, 1);
        });
        state.banished.push(...muts.banished.add);
      }
    }
    return state;
  };

  return {
    getCurrentStep,
    getAvailableResponses,
    advance,
    reset,
    getHistory,
    isComplete,
    getProgress,
    getVirtualState
  };
}

export type ComboEngine = ReturnType<typeof createEngine>;
