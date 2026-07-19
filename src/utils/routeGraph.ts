import { ComboRoute, ComboStep } from '../types';

/**
 * Cycle-safe walk of a route's main success line, starting from the first step
 * and following each step's "success" response's next_step pointer until it
 * runs out, points to a missing step, or would revisit an already-visited step.
 */
export function mainSuccessLine(route: ComboRoute): ComboStep[] {
  const steps: ComboStep[] = [];
  if (route.steps.length === 0) return steps;

  const stepMap = new Map(route.steps.map(s => [s.id, s]));
  const visited = new Set<number>();
  let current: ComboStep | undefined = route.steps[0];

  while (current) {
    steps.push(current);
    visited.add(current.id);

    const successRes = current.responses?.find(r => r.trigger === 'success');
    if (successRes && successRes.next_step !== null && stepMap.has(successRes.next_step) && !visited.has(successRes.next_step)) {
      current = stepMap.get(successRes.next_step);
    } else {
      break;
    }
  }

  return steps;
}
