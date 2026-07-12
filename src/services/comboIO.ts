import { ComboRoute, ComboHandContext, ComboExportFile, ComboStep, ComboResponse, StateMutations, EndBoard } from '../types';

/**
 * Serializes and triggers a browser download for a combo route.
 */
export function exportComboToFile(route: ComboRoute, handContext?: ComboHandContext): void {
  const exportData: ComboExportFile = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    route,
    handContext
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  // Sanitize filename
  const safeName = route.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  link.href = url;
  link.download = `ygo-combo-${safeName || route.id}.json`;
  
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Reads a File uploaded by the user and parses it as a ComboExportFile.
 */
export function importComboFromFile(file: File): Promise<ComboExportFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          throw new Error('File content is empty.');
        }

        const data = JSON.parse(text);
        const validated = validateExportFile(data);
        if (!validated) {
          throw new Error('Invalid combo file format. The file is corrupted or not a valid YGO Combo Engine export.');
        }

        resolve(validated);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'JSON parse failure.';
        reject(new Error(`Failed to import combo: ${msg}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file from disk.'));
    };

    reader.readAsText(file);
  });
}

/**
 * Parses a single step's response branches, falling back to the deprecated
 * next_success/next_negated fields for files exported before `responses` existed.
 */
function parseStepResponses(step: Record<string, unknown>): ComboResponse[] | undefined {
  if (Array.isArray(step.responses)) {
    return (step.responses as Record<string, unknown>[]).map(res => ({
      trigger: String(res.trigger || ''),
      next_step: res.next_step === null || res.next_step === undefined ? null : Number(res.next_step)
    }));
  }

  const responses: ComboResponse[] = [];
  if ('next_success' in step) {
    const nSuccess = step.next_success === null ? null : Number(step.next_success);
    responses.push({ trigger: 'success', next_step: Number.isNaN(nSuccess) ? null : nSuccess });
  }
  if ('next_negated' in step && step.next_negated !== null && step.next_negated !== undefined) {
    const nNegated = Number(step.next_negated);
    if (!Number.isNaN(nNegated)) {
      responses.push({ trigger: 'generic_negate', next_step: nNegated });
    }
  }
  return responses.length > 0 ? responses : undefined;
}

/**
 * Parses a step's stateMutations, defaulting each zone to an empty add/remove pair.
 */
function parseStateMutations(raw: unknown): StateMutations | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const m = raw as Record<string, unknown>;
  const parseZone = (z: unknown): { add: string[]; remove: string[] } => {
    if (!z || typeof z !== 'object') return { add: [], remove: [] };
    const zone = z as Record<string, unknown>;
    return {
      add: Array.isArray(zone.add) ? zone.add.map(String) : [],
      remove: Array.isArray(zone.remove) ? zone.remove.map(String) : []
    };
  };
  return {
    hand: parseZone(m.hand),
    field: parseZone(m.field),
    gy: parseZone(m.gy),
    banished: parseZone(m.banished)
  };
}

/**
 * Parses the route's endBoard, if present.
 */
function parseEndBoard(raw: unknown): EndBoard | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const eb = raw as Record<string, unknown>;
  return {
    monsters: Array.isArray(eb.monsters) ? eb.monsters.map(String) : [],
    spellsTraps: Array.isArray(eb.spellsTraps) ? eb.spellsTraps.map(String) : [],
    interruptions: Array.isArray(eb.interruptions) ? eb.interruptions.map(String) : []
  };
}

/**
 * Safe runtime validation typeguard for exported combo files.
 */
function validateExportFile(raw: unknown): ComboExportFile | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;

  // Check version and top-level fields
  if (data.version !== '1.0' || !data.route || typeof data.route !== 'object') {
    return null;
  }

  const routeObj = data.route as Record<string, unknown>;

  // Basic validation of ComboRoute structure
  if (
    typeof routeObj.id !== 'string' ||
    typeof routeObj.name !== 'string' ||
    typeof routeObj.archetype !== 'string' ||
    !Array.isArray(routeObj.steps) ||
    !Array.isArray(routeObj.requiredCards)
  ) {
    return null;
  }

  // Validate hand context if present
  let resolvedHandContext: ComboHandContext | undefined = undefined;
  if (data.handContext && typeof data.handContext === 'object') {
    const hc = data.handContext as Record<string, unknown>;
    if (
      Array.isArray(hc.handCardIds) &&
      (hc.turnPosition === 'going-first' || hc.turnPosition === 'going-second')
    ) {
      resolvedHandContext = {
        handCardIds: hc.handCardIds.map(String),
        turnPosition: hc.turnPosition,
        generatedAt: typeof hc.generatedAt === 'string' ? hc.generatedAt : new Date().toISOString()
      };
    }
  }

  // Map to a strictly-typed ComboExportFile
  return {
    version: '1.0',
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
    route: {
      id: String(routeObj.id),
      name: String(routeObj.name),
      archetype: String(routeObj.archetype),
      description: String(routeObj.description || ''),
      requiredCards: (routeObj.requiredCards as string[]).map(String),
      steps: (routeObj.steps as Record<string, unknown>[]).map((step): ComboStep => ({
        id: Number(step.id),
        action: String(step.action || ''),
        cardId: String(step.cardId || ''),
        responses: parseStepResponses(step),
        stateMutations: parseStateMutations(step.stateMutations)
      })),
      tags: Array.isArray(routeObj.tags) ? routeObj.tags.map(String) : [],
      endBoard: parseEndBoard(routeObj.endBoard)
    },
    handContext: resolvedHandContext
  };
}
