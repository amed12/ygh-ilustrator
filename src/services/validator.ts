import { ComboRoute, ComboStep, DeckList } from '../types';

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
    } else if (!allDeckCards.has(rawStep.cardId)) {
      // BANNED: Card hallucination check
      errors.push(`Step ${stepNum} (ID: ${rawStep.id}): Card ID "${rawStep.cardId}" (${rawStep.action}) is not in the imported deck.`);
    }

    const nextSuccess = rawStep.next_success === null ? null : Number(rawStep.next_success);
    const nextNegated = rawStep.next_negated === null ? null : Number(rawStep.next_negated);
    
    verifiedSteps.push({
      id: rawStep.id,
      action: String(rawStep.action || ''),
      cardId: String(rawStep.cardId || ''),
      next_success: isNaN(nextSuccess as number) ? null : nextSuccess,
      next_negated: isNaN(nextNegated as number) ? null : nextNegated
    });
  }

  // Step 2: Validate pointers
  for (const step of verifiedSteps) {
    if (step.next_success !== null && !stepIds.has(step.next_success)) {
      errors.push(`Step ID ${step.id}: "next_success" points to non-existent step ID ${step.next_success}.`);
    }
    if (step.next_negated !== null && !stepIds.has(step.next_negated)) {
      errors.push(`Step ID ${step.id}: "next_negated" points to non-existent step ID ${step.next_negated}.`);
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
    if (step) {
      if (step.next_success !== null && hasCycle(step.next_success)) return true;
      if (step.next_negated !== null && hasCycle(step.next_negated)) return true;
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
      tags: (data.tags as string[] || []).map(String)
    },
    errors: []
  };
}
