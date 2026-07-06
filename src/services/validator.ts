import { ComboRoute, ComboStep, DeckList, ComboResponse } from '../types';

export interface ValidationResult {
  valid: boolean;
  data?: ComboRoute;
  errors: string[];
}

/**
 * Validates the raw JSON returned from the LLM against the ComboRoute TypeScript schema.
 * Ensures the AI didn't hallucinate card IDs or create circular/broken paths.
 */
export function validateComboRoute(raw: unknown, deckList: DeckList): ValidationResult {
  const errors: string[] = [];
  
  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Response is not a valid JSON object.'] };
  }

  const data = raw as Record<string, unknown>;

  // Check top-level properties
  if (typeof data.id !== 'string' || !data.id.trim()) {
    errors.push('Missing or invalid "id" property (must be non-empty string).');
  }
  if (typeof data.name !== 'string' || !data.name.trim()) {
    errors.push('Missing or invalid "name" property (must be non-empty string).');
  }
  if (typeof data.archetype !== 'string' || !data.archetype.trim()) {
    errors.push('Missing or invalid "archetype" property.');
  }
  if (typeof data.description !== 'string') {
    errors.push('Missing "description" property.');
  }
  
  if (!Array.isArray(data.requiredCards)) {
    errors.push('requiredCards must be an array.');
  }
  if (!Array.isArray(data.steps)) {
    errors.push('steps must be an array.');
    return { valid: false, errors };
  }
  if (!Array.isArray(data.tags)) {
    errors.push('tags must be an array.');
  }

  // EndBoard Validation
  if (data.endBoard && typeof data.endBoard === 'object') {
    const eb = data.endBoard as Record<string, unknown>;
    if (!Array.isArray(eb.monsters)) errors.push('endBoard.monsters must be an array.');
    if (!Array.isArray(eb.spellsTraps)) errors.push('endBoard.spellsTraps must be an array.');
    if (!Array.isArray(eb.interruptions)) errors.push('endBoard.interruptions must be an array.');
  }

  const stepsList = data.steps as Record<string, unknown>[];
  const verifiedSteps: ComboStep[] = [];
  const stepIds = new Set<number>();
  
  const allDeckCards = new Set<string>([...deckList.main, ...deckList.extra, ...deckList.side]);

  // Step 1: Validate individual step structures & card IDs
  for (let idx = 0; idx < stepsList.length; idx++) {
    const rawStep = stepsList[idx];
    const stepNum = idx + 1;
    
    if (typeof rawStep.id !== 'number') {
      errors.push(`Step ${stepNum}: missing numeric "id".`);
      continue;
    }
    
    if (stepIds.has(rawStep.id)) {
      errors.push(`Step ${stepNum}: duplicate step ID "${rawStep.id}".`);
    } else {
      stepIds.add(rawStep.id);
    }
    
    if (typeof rawStep.action !== 'string' || !rawStep.action.trim()) {
      errors.push(`Step ${stepNum} (ID: ${rawStep.id}): missing or empty "action".`);
    }
    
    if (typeof rawStep.cardId !== 'string') {
      errors.push(`Step ${stepNum} (ID: ${rawStep.id}): missing string "cardId".`);
    } else {
      const uCardId = rawStep.cardId.toUpperCase();
      if (!allDeckCards.has(rawStep.cardId) && !['TOKEN', 'OPPONENT', 'NONE'].includes(uCardId)) {
        errors.push(`Step ${stepNum} (ID: ${rawStep.id}): Card ID "${rawStep.cardId}" (${rawStep.action}) is not in the imported deck.`);
      }
    }

    // Process responses
    const verifiedResponses: ComboResponse[] = [];
    if (Array.isArray(rawStep.responses)) {
      for (const res of rawStep.responses) {
        if (typeof res.trigger !== 'string') {
          errors.push(`Step ID ${rawStep.id}: response missing string 'trigger'.`);
        }
        const nextStep = res.next_step === null ? null : Number(res.next_step);
        if (nextStep !== null && isNaN(nextStep)) {
          errors.push(`Step ID ${rawStep.id}: response next_step must be number or null.`);
        }
        verifiedResponses.push({
          trigger: String(res.trigger || ''),
          next_step: isNaN(nextStep as number) ? null : nextStep
        });
      }
    } else {
      // Backwards compatibility or error
      const nSuccess = rawStep.next_success === null ? null : Number(rawStep.next_success);
      const nNegated = rawStep.next_negated === null ? null : Number(rawStep.next_negated);
      if (!isNaN(nSuccess as number) || nSuccess === null) {
        verifiedResponses.push({ trigger: 'success', next_step: nSuccess as (number|null) });
      }
      if (nNegated !== null && !isNaN(nNegated as number)) {
        verifiedResponses.push({ trigger: 'generic_negate', next_step: nNegated as number });
      }
    }

    // Simple parsing of state mutations without strict schema block
    const verifiedMutations = rawStep.stateMutations as any || {
      hand: { add: [], remove: [] },
      field: { add: [], remove: [] },
      gy: { add: [], remove: [] },
      banished: { add: [], remove: [] }
    };
    
    verifiedSteps.push({
      id: rawStep.id,
      action: String(rawStep.action || ''),
      cardId: String(rawStep.cardId || ''),
      responses: verifiedResponses,
      stateMutations: verifiedMutations
    });
  }

  // Step 2: Validate pointers
  for (const step of verifiedSteps) {
    if (step.responses) {
      for (const res of step.responses) {
        if (res.next_step !== null && !stepIds.has(res.next_step)) {
          errors.push(`Step ID ${step.id}: response points to non-existent step ID ${res.next_step}.`);
        }
      }
    }
  }

  // Step 3: Check for infinite loops (cycle detection)
  const visited = new Set<number>();
  const recStack = new Set<number>();
  
  function hasCycle(stepId: number): boolean {
    if (recStack.has(stepId)) return true;
    if (visited.has(stepId)) return false;
    
    visited.add(stepId);
    recStack.add(stepId);
    
    const step = verifiedSteps.find(s => s.id === stepId);
    if (step && step.responses) {
      for (const res of step.responses) {
        if (res.next_step !== null && hasCycle(res.next_step)) return true;
      }
    }
    
    recStack.delete(stepId);
    return false;
  }

  if (verifiedSteps.length > 0) {
    const rootId = verifiedSteps[0].id;
    if (hasCycle(rootId)) {
      errors.push('Combo route contains an infinite loop cycle.');
    }
  } else {
    errors.push('Combo route must have at least one step.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      id: String(data.id || ''),
      name: String(data.name || ''),
      archetype: String(data.archetype || ''),
      description: String(data.description || ''),
      requiredCards: (data.requiredCards as string[]).map(String),
      steps: verifiedSteps,
      tags: (data.tags as string[] || []).map(String),
      endBoard: data.endBoard as any
    },
    errors: []
  };
}
