import { ComboRoute, ComboHandContext, ComboExportFile } from '../types';

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
      steps: (routeObj.steps as Record<string, unknown>[]).map(step => ({
        id: Number(step.id),
        action: String(step.action || ''),
        cardId: String(step.cardId || ''),
        next_success: step.next_success === null ? null : Number(step.next_success),
        next_negated: step.next_negated === null ? null : Number(step.next_negated)
      })),
      tags: Array.isArray(routeObj.tags) ? routeObj.tags.map(String) : []
    },
    handContext: resolvedHandContext
  };
}
