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
}

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
  | 'recovery';

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
