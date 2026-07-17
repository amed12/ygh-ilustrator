import { ComboRoute, ComboStep, DeckList, ComboResponse, EndBoard, TacticalRole, DeckProfile, CardProfile, CardRole } from '../types';

const VALID_TACTICAL_ROLES = new Set<TacticalRole>([
  'negate-monster',
  'negate-spell-trap',
  'omni-negate',
  'board-wipe',
  'targeted-removal',
  'protection',
  'floodgate',
  'attacker',
  'recovery',
  'towers',
  'follow-up',
  'burn'
]);

const VALID_CARD_ROLES = new Set<CardRole>([
  'starter',
  'extender',
  'searcher',
  'hand-trap',
  'board-breaker',
  'floodgate',
  'removal',
  'recovery',
  'boss',
  'garnet',
  'utility',
  'brick'
]);

export interface DeckProfileValidationResult {
  valid: boolean;
  data?: DeckProfile;
  errors: string[];
}

/**
 * Validates a raw AI-generated deck profile against the imported deck's main deck cards.
 * Anti-hallucination: drops any card entry not actually in the main deck, and any search
 * target not in the main deck. Never hard-fails on a single bad entry — just drops it,
 * since a profile with fewer entries degrades gracefully (those cards just don't get
 * search-graph edges) rather than blocking the whole feature.
 */
export function validateDeckProfile(raw: unknown, deckList: DeckList, deckHash: string): DeckProfileValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Response is not a valid JSON object.'] };
  }

  const data = raw as Record<string, unknown>;
  if (!data.cards || typeof data.cards !== 'object') {
    return { valid: false, errors: ['Missing "cards" object.'] };
  }

  const mainDeckSet = new Set(deckList.main);
  const rawCards = data.cards as Record<string, unknown>;
  const cards: Record<string, CardProfile> = {};

  for (const [cardId, rawProfile] of Object.entries(rawCards)) {
    if (!mainDeckSet.has(cardId) || !rawProfile || typeof rawProfile !== 'object') continue;
    const p = rawProfile as Record<string, unknown>;

    const roles = Array.isArray(p.roles)
      ? p.roles.map(r => String(r).toLowerCase()).filter((r): r is CardRole => VALID_CARD_ROLES.has(r as CardRole))
      : [];
    if (roles.length === 0) continue;

    const searches = Array.isArray(p.searches)
      ? p.searches.map(String).filter(id => mainDeckSet.has(id) && id !== cardId)
      : [];

    cards[cardId] = { cardId, roles, ...(searches.length ? { searches } : {}) };
  }

  if (Object.keys(cards).length === 0) {
    return { valid: false, errors: ['No valid card entries survived validation.'] };
  }

  return {
    valid: true,
    data: {
      version: '1.0',
      deckHash,
      source: 'ai',
      generatedAt: new Date().toISOString(),
      cards
    },
    errors: []
  };
}

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

  // EndBoard Validation — required and must be non-trivially specified
  let verifiedEndBoard: EndBoard | undefined;
  if (!data.endBoard || typeof data.endBoard !== 'object') {
    errors.push('endBoard is required. The AI must specify the full final board state.');
  } else {
    const eb = data.endBoard as Record<string, unknown>;
    if (!Array.isArray(eb.monsters)) {
      errors.push('endBoard.monsters must be an array.');
    }
    if (!Array.isArray(eb.spellsTraps)) {
      errors.push('endBoard.spellsTraps must be an array.');
    }
    if (!Array.isArray(eb.interruptions)) {
      errors.push('endBoard.interruptions must be an array.');
    } else {
      const interruptions = eb.interruptions as unknown[];
      if (interruptions.length === 0) {
        errors.push('endBoard.interruptions must not be empty — list at least 1 specific disruption effect.');
      }
      // Warn if interruptions are too vague (less than 15 chars suggests generic placeholders)
      interruptions.forEach((intr, i) => {
        if (typeof intr === 'string' && intr.length < 15) {
          errors.push(`endBoard.interruptions[${i}] is too vague: "${intr}". Must describe the specific card name and what it negates/prevents.`);
        }
      });
    }

    // cardRoles is optional — normalize and drop invalid entries rather than failing validation
    const onBoardCardIds = new Set<string>([
      ...(Array.isArray(eb.monsters) ? (eb.monsters as unknown[]).map(String) : []),
      ...(Array.isArray(eb.spellsTraps) ? (eb.spellsTraps as unknown[]).map(String) : [])
    ]);
    let cardRoles: Record<string, TacticalRole[]> | undefined;
    if (eb.cardRoles && typeof eb.cardRoles === 'object') {
      const rawRoles = eb.cardRoles as Record<string, unknown>;
      const normalized: Record<string, TacticalRole[]> = {};
      for (const [cardId, roles] of Object.entries(rawRoles)) {
        if (!onBoardCardIds.has(cardId) || !Array.isArray(roles)) continue;
        const validRoles = roles
          .map(r => String(r).toLowerCase())
          .filter((r): r is TacticalRole => VALID_TACTICAL_ROLES.has(r as TacticalRole));
        if (validRoles.length) normalized[cardId] = validRoles;
      }
      if (Object.keys(normalized).length) cardRoles = normalized;
    }

    verifiedEndBoard = {
      monsters: Array.isArray(eb.monsters) ? (eb.monsters as unknown[]).map(String) : [],
      spellsTraps: Array.isArray(eb.spellsTraps) ? (eb.spellsTraps as unknown[]).map(String) : [],
      interruptions: Array.isArray(eb.interruptions) ? (eb.interruptions as unknown[]).map(String) : [],
      ...(cardRoles ? { cardRoles } : {})
    };
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

    // Parse state mutations with typed fallback (no `any`)
    type ZoneMutation = { add: string[]; remove: string[] };
    type StateMutationMap = { hand: ZoneMutation; field: ZoneMutation; gy: ZoneMutation; banished: ZoneMutation };
    const emptyMutation = (): ZoneMutation => ({ add: [], remove: [] });
    const rawMut = rawStep.stateMutations;
    const verifiedMutations: StateMutationMap = {
      hand: { add: [], remove: [] },
      field: { add: [], remove: [] },
      gy: { add: [], remove: [] },
      banished: { add: [], remove: [] }
    };
    if (rawMut && typeof rawMut === 'object') {
      const m = rawMut as Record<string, unknown>;
      const parseZone = (z: unknown): ZoneMutation => {
        if (!z || typeof z !== 'object') return emptyMutation();
        const zone = z as Record<string, unknown>;
        return {
          add: Array.isArray(zone.add) ? zone.add.map(String) : [],
          remove: Array.isArray(zone.remove) ? zone.remove.map(String) : []
        };
      };
      verifiedMutations.hand = parseZone(m.hand);
      verifiedMutations.field = parseZone(m.field);
      verifiedMutations.gy = parseZone(m.gy);
      verifiedMutations.banished = parseZone(m.banished);
    }
    
    verifiedSteps.push({
      id: rawStep.id,
      action: String(rawStep.action || ''),
      cardId: String(rawStep.cardId || ''),
      responses: verifiedResponses,
      stateMutations: verifiedMutations
    });
  }

  // Step 2: Auto-repair broken pointers — nullify next_step if it references a non-existent ID.
  // This prevents hard-fail when AI generates placeholder IDs (e.g., 20, 30, 40) that don't exist.
  // We degrade gracefully: the branch simply ends at null rather than crashing the whole combo.
  for (const step of verifiedSteps) {
    if (step.responses) {
      for (const res of step.responses) {
        if (res.next_step !== null && !stepIds.has(res.next_step)) {
          // Auto-repair: treat as end-of-branch (null) instead of erroring
          res.next_step = null;
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

  const rawEfficiency = String(data.efficiency ?? '').toLowerCase();
  const efficiency = (['optimal', 'sub-optimal', 'brick'] as const).includes(
    rawEfficiency as 'optimal' | 'sub-optimal' | 'brick'
  )
    ? (rawEfficiency as 'optimal' | 'sub-optimal' | 'brick')
    : undefined;

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
      endBoard: verifiedEndBoard,
      efficiency
    },
    errors: []
  };
}
