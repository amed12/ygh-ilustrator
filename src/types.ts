export interface Card {
  id: string;
  name: string;
  imageUrl: string;
}

export interface StateMutations {
  hand: { add: string[]; remove: string[] };
  field: { add: string[]; remove: string[] };
  gy: { add: string[]; remove: string[] };
  banished: { add: string[]; remove: string[] };
}

export interface ComboResponse {
  trigger: 'success' | 'ash_blossom' | 'imperm_veiler' | 'nibiru' | 'maxx_c' | 'generic_negate' | string;
  next_step: number | null;
}

export interface ComboStep {
  id: number;
  action: string;
  cardId: string;
  next_success?: number | null; // Deprecated
  next_negated?: number | null; // Deprecated
  responses?: ComboResponse[];
  stateMutations?: StateMutations;
  actionType?: ActionType;
}

/** Taxonomy of what mechanical action a combo step performs. See src/data/actionTypes.ts for icon/label metadata and inference. */
export type ActionType =
  | 'normal_summon'
  | 'special_summon'
  | 'xyz'
  | 'synchro'
  | 'link'
  | 'fusion'
  | 'ritual'
  | 'activate'
  | 'search'
  | 'send_gy'
  | 'discard'
  | 'banish'
  | 'set'
  | 'tribute'
  | 'return_hand'
  | 'phase_marker'
  | 'other';

/** Taxonomy of the tactical job a surviving end-board card does. */
export type TacticalRole =
  | 'negate-monster'
  | 'negate-spell-trap'
  | 'omni-negate'
  | 'board-wipe'
  | 'targeted-removal'
  | 'protection'
  | 'floodgate'
  | 'attacker'
  | 'recovery'
  | 'towers'
  | 'follow-up'
  | 'burn';

export interface EndBoard {
  monsters: string[];
  spellsTraps: string[];
  interruptions: string[];
  /** cardId -> tactical role(s), for cockpit-style badges on the end board. */
  cardRoles?: Record<string, TacticalRole[]>;
}

export interface ComboRoute {
  id: string;
  name: string;
  archetype: string;
  description: string;
  requiredCards: string[];
  steps: ComboStep[];
  tags: string[];
  endBoard?: EndBoard;
  /** AI's self-assessment of how good this line is from the given hand. */
  efficiency?: 'optimal' | 'sub-optimal' | 'brick';
}

export interface DeckList {
  main: string[];
  extra: string[];
  side: string[];
}

export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'deepseek';

export interface AISettings {
  provider: AIProvider;
  model: string;
  customApiKey: string;
  useDemo: boolean;
}

export interface ComboHandContext {
  handCardIds: string[];
  turnPosition: 'going-first' | 'going-second';
  generatedAt: string;
  /** Set when this hand context came from an on-demand Endboard Potential scenario, not a real drawn hand. */
  scenarioId?: EndboardScenarioId;
}

export type EndboardScenarioId = 'going-first-ceiling' | 'going-second-ceiling' | 'going-first-floor';

export interface EndboardScenarioDef {
  id: EndboardScenarioId;
  label: string;
  turnPosition: 'going-first' | 'going-second';
  handSize: 5 | 6;
  handQuality: 'best' | 'worst';
}

export interface ScenarioResult {
  version: '1.0';
  scenarioId: EndboardScenarioId;
  deckHash: string;
  deckProfileVersion: string;
  generatedAt: string;
  hypotheticalHand: string[];
  handRationale: string;
  route: ComboRoute;
}

export interface ScenarioCatalog {
  version: '1.0';
  deckHash: string;
  deckProfileVersion: string;
  results: Partial<Record<EndboardScenarioId, ScenarioResult>>;
}

export interface ComboExportFile {
  version: '1.0';
  exportedAt: string;
  route: ComboRoute;
  handContext?: ComboHandContext;
}

export interface PlaybookExportFile {
  version: '1.0';
  exportedAt: string;
  routes: ComboRoute[];
  handContexts?: Record<string, ComboHandContext>;
  deckProfile?: DeckProfile;
}

/** Functional role(s) a card plays for adaptive-matcher search-graph purposes. */
export type CardRole =
  | 'starter'
  | 'extender'
  | 'searcher'
  | 'hand-trap'
  | 'board-breaker'
  | 'floodgate'
  | 'removal'
  | 'recovery'
  | 'boss'
  | 'garnet'
  | 'utility'
  | 'brick';

export interface CardProfile {
  cardId: string;
  roles: CardRole[];
  /** Card IDs this card can add from the Deck to the hand. */
  searches?: string[];
}

/**
 * A one-shot, AI-compiled map of what each main-deck card in a given deck actually does
 * (roles + search targets). Generated once per deck and cached — the adaptive matcher then
 * runs purely offline/deterministically using this data, no AI needed at runtime.
 */
export interface DeckProfile {
  version: '1.0';
  deckHash: string;
  source: 'ai';
  generatedAt: string;
  cards: Record<string, CardProfile>;
}

export interface YGOPROCardDetails {
  id: string;
  name: string;
  type: string;
  desc: string;
  atk?: number;
  def?: number;
  level?: number;
  race: string;
  attribute?: string;
  archetype?: string;
}
