export interface Card {
  id: string;
  name: string;
  imageUrl: string;
}

export interface ComboStep {
  id: number;
  action: string;
  cardId: string;
  next_success: number | null;
  next_negated: number | null;
}

export interface ComboRoute {
  id: string;
  name: string;
  archetype: string;
  description: string;
  requiredCards: string[];
  steps: ComboStep[];
  tags: string[];
}

export interface DeckList {
  main: string[];
  extra: string[];
  side: string[];
}

export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'openrouter';

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
