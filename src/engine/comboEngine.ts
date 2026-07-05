import { ComboRoute, ComboStep, DeckList } from '../types';

/**
 * Checks if a given deck contains all required cards for a combo route.
 * Matches across both Main and Extra deck.
 */
export function findMatchingRoutes(deck: DeckList, allRoutes: ComboRoute[]): ComboRoute[] {
  const allCardsInDeck = new Set<string>([...deck.main, ...deck.extra, ...deck.side]);
  
  return allRoutes.filter(route => {
    return route.requiredCards.every(cardId => allCardsInDeck.has(cardId));
  });
}

export interface ComboHistoryItem {
  step: ComboStep;
  outcome: 'success' | 'negated';
}

/**
 * Creates a stateful combo state machine for navigating steps.
 * Provides O(1) step lookup via a local Map.
 */
export function createEngine(route: ComboRoute) {
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

  const canAdvance = (outcome: 'success' | 'negated'): boolean => {
    if (currentStepId === null) return false;
    const step = stepMap.get(currentStepId);
    if (!step) return false;
    
    if (outcome === 'success') {
      return step.next_success !== null;
    } else {
      return step.next_negated !== null;
    }
  };

  const advance = (outcome: 'success' | 'negated'): ComboStep | null => {
    if (currentStepId === null) return null;
    const currentStep = getCurrentStep();
    
    // Log current step and the chosen outcome in history
    history.push({ step: currentStep, outcome });
    
    const nextId = outcome === 'success' ? currentStep.next_success : currentStep.next_negated;
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
    return currentStep ? (currentStep.next_success === null && currentStep.next_negated === null) : true;
  };

  const getProgress = (): { current: number; total: number } => {
    const total = route.steps.length;
    // Find the current index or length if complete
    const currentIdx = route.steps.findIndex(s => s.id === currentStepId);
    const current = currentIdx !== -1 ? currentIdx + 1 : total;
    return { current, total };
  };

  return {
    getCurrentStep,
    advance,
    canAdvance,
    reset,
    getHistory,
    isComplete,
    getProgress
  };
}
export type ComboEngine = ReturnType<typeof createEngine>;
