import { EndboardScenarioDef, EndboardScenarioId } from '../types';

/** Extra display copy per scenario — kept separate from the core def so the def stays a clean data shape. */
export const ENDBOARD_SCENARIO_DESCRIPTIONS: Record<EndboardScenarioId, string> = {
  'going-first-ceiling': 'The strongest realistic opening this deck can produce.',
  'going-second-ceiling': 'Breaking a board with a 6-card hand.',
  'going-first-floor': 'A weak but non-brick draw.'
};

/**
 * Fixed set of "what's the best/worst this deck can do" scenarios shown in Endboard Potential.
 * Each one is generated on-demand (never eagerly) and cached per-deck in scenarioCache.ts.
 */
export const ENDBOARD_SCENARIOS: EndboardScenarioDef[] = [
  {
    id: 'going-first-ceiling',
    label: 'Going First — Ceiling',
    turnPosition: 'going-first',
    handSize: 5,
    handQuality: 'best'
  },
  {
    id: 'going-second-ceiling',
    label: 'Going Second — Ceiling',
    turnPosition: 'going-second',
    handSize: 6,
    handQuality: 'best'
  },
  {
    id: 'going-first-floor',
    label: 'Going First — Floor',
    turnPosition: 'going-first',
    handSize: 5,
    handQuality: 'worst'
  }
];
