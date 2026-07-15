import { ComboRoute, ComboHandContext, ComboExportFile, PlaybookExportFile, ComboStep, ComboResponse, StateMutations, EndBoard } from '../types';

/**
 * Serializes and triggers a browser download for a single combo route.
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
 * Serializes and triggers a browser download for ALL given combo routes as a single
 * Playbook file, so a user's accumulated custom/AI-generated combos can be backed up
 * and re-imported together in one file instead of one at a time.
 */
export function exportPlaybookToFile(routes: ComboRoute[], handContexts: Record<string, ComboHandContext>): void {
  const filteredContexts: Record<string, ComboHandContext> = {};
  routes.forEach(r => {
    if (handContexts[r.id]) {
      filteredContexts[r.id] = handContexts[r.id];
    }
  });

  const exportData: PlaybookExportFile = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    routes,
    handContexts: filteredContexts
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.download = `playbook-ygo-combos-${dateStr}.json`;

  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Reads a File uploaded by the user and parses it. Accepts either a single-combo
 * ComboExportFile or a multi-combo PlaybookExportFile — always resolves to an array
 * (length 1 for a single-combo file) so callers don't need to care which format was used.
 */
export function importComboFromFile(file: File): Promise<{ route: ComboRoute; handContext?: ComboHandContext }[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          throw new Error('File content is empty.');
        }

        const data = JSON.parse(text);
        const resolved = parseImportedFile(data);
        if (!resolved || resolved.length === 0) {
          throw new Error('Invalid combo file format. The file is corrupted or not a valid YGO Combo Engine export.');
        }

        resolve(resolved);
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
 * Safe runtime validation/parsing for a raw ComboRoute-shaped object. Shared by file import
 * (validateExportFile below) and share-link decoding (services/shareLink.ts) so both entry
 * points enforce identical structural guarantees.
 */
export function parseComboRouteRaw(raw: unknown): ComboRoute | null {
  if (!raw || typeof raw !== 'object') return null;
  const routeObj = raw as Record<string, unknown>;

  if (
    typeof routeObj.id !== 'string' ||
    typeof routeObj.name !== 'string' ||
    typeof routeObj.archetype !== 'string' ||
    !Array.isArray(routeObj.steps) ||
    !Array.isArray(routeObj.requiredCards)
  ) {
    return null;
  }

  return {
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
    endBoard: parseEndBoard(routeObj.endBoard),
    efficiency: (['optimal', 'sub-optimal', 'brick'] as const).includes(
      routeObj.efficiency as 'optimal' | 'sub-optimal' | 'brick'
    )
      ? (routeObj.efficiency as 'optimal' | 'sub-optimal' | 'brick')
      : undefined
  };
}

/**
 * Safe runtime validation/parsing for a raw ComboHandContext-shaped object.
 */
export function parseHandContextRaw(raw: unknown): ComboHandContext | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const hc = raw as Record<string, unknown>;
  if (
    !Array.isArray(hc.handCardIds) ||
    (hc.turnPosition !== 'going-first' && hc.turnPosition !== 'going-second')
  ) {
    return undefined;
  }
  return {
    handCardIds: hc.handCardIds.map(String),
    turnPosition: hc.turnPosition,
    generatedAt: typeof hc.generatedAt === 'string' ? hc.generatedAt : new Date().toISOString()
  };
}

/**
 * Safe runtime validation/parsing for an imported file. Accepts either shape:
 *   - PlaybookExportFile: { version, routes: [...], handContexts?: { [routeId]: ... } }
 *   - ComboExportFile:    { version, route: {...}, handContext?: {...} }
 * Both are normalized to the same { route, handContext }[] shape, reusing
 * parseComboRouteRaw/parseHandContextRaw so file import and share-link decoding
 * (services/shareLink.ts) enforce identical structural guarantees.
 */
function parseImportedFile(raw: unknown): { route: ComboRoute; handContext?: ComboHandContext }[] | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (data.version !== '1.0') return null;

  // Playbook format: multiple routes in one file.
  if (Array.isArray(data.routes)) {
    const handCtxsObj = (data.handContexts && typeof data.handContexts === 'object'
      ? data.handContexts
      : {}) as Record<string, unknown>;

    const results: { route: ComboRoute; handContext?: ComboHandContext }[] = [];
    for (const rawRoute of data.routes) {
      const route = parseComboRouteRaw(rawRoute);
      if (!route) continue;
      results.push({
        route,
        handContext: parseHandContextRaw(handCtxsObj[route.id])
      });
    }
    return results;
  }

  // Single-combo format.
  if (data.route && typeof data.route === 'object') {
    const route = parseComboRouteRaw(data.route);
    if (!route) return null;
    return [{
      route,
      handContext: parseHandContextRaw(data.handContext)
    }];
  }

  return null;
}
