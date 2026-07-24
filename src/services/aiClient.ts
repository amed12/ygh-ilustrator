import { AISettings, ComboRoute, DeckList, DeckProfile, EndboardScenarioDef, ScenarioResult, YGOPROCardDetails } from '../types';
import {
  buildComboPrompt,
  buildMultiComboPrompt,
  buildDeckProfilePrompt,
  buildComboSketchPrompt,
  buildScenarioSketchPrompt,
  buildExtendComboPrompt,
  buildRepairComboPrompt,
  ComboLineSketch,
  TurnPosition
} from './prompts';
import { validateComboRoute, validateDeckProfile, replayComboRoute } from './validator';
import { ENDBOARD_SCENARIOS } from '../data/endboardScenarios';

/**
 * Cleans the LLM response to remove markdown backticks (e.g. ```json ... ```)
 * and extract the raw JSON string.
 */
function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();

  // Remove starting ```json or ```
  if (cleaned.startsWith('```')) {
    const lines = cleaned.split('\n');
    if (lines[0].startsWith('```')) {
      lines.shift();
    }
    if (lines[lines.length - 1].startsWith('```')) {
      lines.pop();
    }
    cleaned = lines.join('\n').trim();
  }

  // Some models prepend free-text reasoning before the JSON payload despite
  // being told not to ("We are to build a combo line for..."). If the
  // response doesn't already start with a JSON opener, drop everything
  // before the first '{' or '[' so parsing/repair has a real chance.
  if (cleaned.length > 0 && cleaned[0] !== '{' && cleaned[0] !== '[') {
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    const candidates = [firstBrace, firstBracket].filter((i) => i !== -1);
    if (candidates.length > 0) {
      cleaned = cleaned.slice(Math.min(...candidates)).trim();
    }
  }

  return cleaned;
}

/**
 * Attempts to repair truncated JSON by closing any open brackets/braces.
 * This handles cases where max_tokens cuts the response mid-stream.
 * Returns the repaired string, or the original if it already parses.
 */
function tryRepairJson(raw: string): string {
  // If already valid, nothing to do
  try { JSON.parse(raw); return raw; } catch { /* continue */ }

  let repaired = raw.trimEnd();

  // Remove trailing comma before any closing attempt
  repaired = repaired.replace(/,\s*$/, '');

  // Count open brackets/braces to determine what's missing
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escape = false;

  for (const ch of repaired) {
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') openBraces++;
    else if (ch === '}') openBraces--;
    else if (ch === '[') openBrackets++;
    else if (ch === ']') openBrackets--;
  }

  // Close any open string
  if (inString) repaired += '"';

  // Close open arrays then objects
  for (let i = 0; i < openBrackets; i++) repaired += ']';
  for (let i = 0; i < openBraces; i++) repaired += '}';

  return repaired;
}

/**
 * Cleans and parses an LLM JSON response, repairing token-truncated output as a fallback.
 * Throws with a snippet of the raw text when the payload is unrecoverable.
 */
function parseJsonPayload(rawText: string, context: string): unknown {
  const cleaned = cleanJsonResponse(rawText);
  try {
    return JSON.parse(cleaned);
  } catch {
    const repaired = tryRepairJson(cleaned);
    try {
      return JSON.parse(repaired);
    } catch {
      throw new Error(`AI returned invalid JSON (${context}): ${cleaned.substring(0, 200)}...`);
    }
  }
}

/**
 * Interface representing the model information.
 */
export interface AIModelOption {
  id: string;
  name: string;
}

export const PROVIDER_MODELS: Record<string, AIModelOption[]> = {
  gemini: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Default)' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Recommended)' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro (Latest)' }
  ],
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast)' },
    { id: 'gpt-4o', name: 'GPT-4o (High Intelligence)' }
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku' }
  ],
  openrouter: [
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3 (OpenRouter)' },
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash (OpenRouter)' }
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek V3 (Direct)' },
    { id: 'deepseek-reasoner', name: 'DeepSeek R1 (Reasoner)' }
  ]
};

/**
 * Sends the deck list to the selected AI provider to generate a combo.
 * Validates the output at runtime to prevent hallucinations.
 */
export async function generateAICombo(
  deckList: DeckList,
  cardNames: Record<string, string>,
  settings: AISettings,
  handCards: string[],
  turnPosition: TurnPosition,
  cardDetails: Record<string, YGOPROCardDetails> = {},
  deckProfile?: DeckProfile
): Promise<ComboRoute> {
  const prompt = buildComboPrompt(deckList, cardNames, handCards, turnPosition, cardDetails, deckProfile);
  const responseText = await callProvider(settings, prompt, 'single', deckList, cardNames, handCards, turnPosition);

  if (!responseText) {
    throw new Error('AI returned an empty response.');
  }

  // Parse and validate the response — with repair fallback for token-truncated responses
  const cleaned = cleanJsonResponse(responseText);
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch {
    // JSON parse failed — try to repair truncated JSON before giving up
    const repaired = tryRepairJson(cleaned);
    try {
      parsedJson = JSON.parse(repaired);
    } catch {
      throw new Error(`AI returned invalid JSON (could not repair): ${cleaned.substring(0, 200)}...`);
    }
  }

  const validation = validateComboRoute(parsedJson, deckList);
  if (!validation.valid) {
    throw new Error(`AI Combo Validation Failed:\n${validation.errors.join('\n')}`);
  }

  return validation.data!;
}

/** Max distinct lines expanded per solver run — mirrors the sketch prompt's "at most 4". */
const MAX_SKETCH_LINES = 4;
/** Max "can this board still grow?" follow-up calls per route. */
const MAX_EXTENSION_PASSES = 2;

/**
 * Generates ALL viable combo lines from the opening hand.
 *
 * Deep-line pipeline (one shallow one-shot call was the root cause of thin AI combos):
 *  1. SKETCH — one cheap call enumerates the distinct viable lines (name/starter/goal only).
 *  2. EXPAND — one dedicated call per line, so the full output-token budget buys depth for
 *     a single route instead of being split across four.
 *  3. REPLAY + REPAIR — each route is mechanically replayed against its own stateMutations;
 *     violations go back to the model once for correction instead of being silently accepted.
 *  4. EXTEND — the model is shown its own final board state and asked to keep extending the
 *     main line until no legal play remains (up to MAX_EXTENSION_PASSES).
 *
 * Falls back to the legacy single-call multi-route path if the sketch phase fails.
 */
export async function generateMultipleAICombos(
  settings: AISettings,
  deckList: DeckList,
  cardNames: Record<string, string>,
  handCards: string[],
  turnPosition: TurnPosition,
  cardDetails: Record<string, YGOPROCardDetails> = {},
  deckProfile?: DeckProfile
): Promise<ComboRoute[]> {
  let sketches: ComboLineSketch[] = [];
  try {
    const raw = await callProvider(
      settings,
      buildComboSketchPrompt(deckList, cardNames, handCards, turnPosition, cardDetails, deckProfile),
      'sketch', deckList, cardNames, handCards, turnPosition, cardDetails, { deckProfile }
    );
    sketches = sanitizeSketches(parseJsonPayload(raw, 'sketch'), handCards, deckList);
  } catch (e) {
    console.warn('Sketch phase failed — falling back to legacy single-call generation.', e);
  }

  if (sketches.length > 0) {
    const results = await Promise.all(
      sketches.slice(0, MAX_SKETCH_LINES).map(sketch =>
        generateDeepRoute(settings, deckList, cardNames, handCards, turnPosition, cardDetails, deckProfile, sketch)
          .catch((e: unknown) => {
            console.warn(`Line "${sketch.name}" failed to generate — skipping.`, e);
            return null;
          })
      )
    );
    const routes = dedupeRouteIds(results.filter((r): r is ComboRoute => r !== null));
    if (routes.length > 0) return routes;
    console.warn('All sketched lines failed — falling back to legacy single-call generation.');
  }

  return generateMultipleAICombosLegacy(settings, deckList, cardNames, handCards, turnPosition, cardDetails, deckProfile);
}

/**
 * Keeps only well-formed sketches whose starters actually come from the sampled hand.
 * Target/key card IDs are soft-validated against the deck (hallucinated IDs are dropped,
 * the line itself survives) — they steer prompts, they are not legality data.
 */
function sanitizeSketches(parsed: unknown, handCards: string[], deckList: DeckList): ComboLineSketch[] {
  const handSet = new Set(handCards);
  const deckSet = new Set([...deckList.main, ...deckList.extra, ...deckList.side]);
  const lines = (parsed as { lines?: unknown })?.lines;
  if (!Array.isArray(lines)) return [];
  const sketches: ComboLineSketch[] = [];
  for (const line of lines) {
    if (!line || typeof line !== 'object') continue;
    const l = line as Record<string, unknown>;
    const starterCardIds = Array.isArray(l.starterCardIds)
      ? l.starterCardIds.map(String).filter(id => handSet.has(id))
      : [];
    if (typeof l.name !== 'string' || !l.name.trim() || starterCardIds.length === 0) continue;
    const inDeck = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(id => deckSet.has(id)) : []);
    sketches.push({
      name: l.name.trim(),
      starterCardIds,
      goal: String(l.goal ?? ''),
      targetEndBoardIds: inDeck(l.targetEndBoardIds),
      keyCardIds: inDeck(l.keyCardIds)
    });
  }
  return sketches;
}

/**
 * Validates the AI-chosen hypothetical hand against real per-card copy counts in the Main Deck
 * (same counting approach as validator.ts's replayComboRoute) and returns the surviving,
 * exact-size hand along with its sanitized sketch lines. Hallucinated IDs (not in the deck, or
 * copies beyond what the deck runs) are dropped; if fewer than handSize legal cards survive,
 * throws so the caller can fall back the same way the sketch-phase-failed path does.
 */
function sanitizeScenarioSketch(
  parsed: unknown,
  deckList: DeckList,
  handSize: number
): { handCardIds: string[]; handRationale: string; sketches: ComboLineSketch[] } {
  const p = parsed as Record<string, unknown> | null;
  if (!p || typeof p !== 'object') {
    throw new Error('Scenario sketch response was not a JSON object.');
  }

  // Real copy counts across the Main Deck only — the chosen hand must come from there.
  const mainCopyCounts = new Map<string, number>();
  for (const id of deckList.main) {
    mainCopyCounts.set(id, (mainCopyCounts.get(id) ?? 0) + 1);
  }

  const rawHand = Array.isArray(p.handCardIds) ? p.handCardIds.map(String) : [];
  const used = new Map<string, number>();
  const handCardIds: string[] = [];
  for (const id of rawHand) {
    const cap = mainCopyCounts.get(id) ?? 0;
    const usedSoFar = used.get(id) ?? 0;
    if (cap > 0 && usedSoFar < cap) {
      handCardIds.push(id);
      used.set(id, usedSoFar + 1);
    }
  }

  if (handCardIds.length !== handSize) {
    throw new Error(
      `Scenario sketch produced an invalid hand: expected ${handSize} legal cards, got ${handCardIds.length} after copy-count validation.`
    );
  }

  const sketches = sanitizeSketches(p, handCardIds, deckList);
  if (sketches.length === 0) {
    throw new Error('Scenario sketch produced a hand but no viable combo lines from it.');
  }

  return {
    handCardIds,
    handRationale: typeof p.handRationale === 'string' ? p.handRationale : '',
    sketches
  };
}

/**
 * Generates one on-demand "Endboard Potential" scenario: the model picks its own opening hand
 * (best or worst honest draw per the scenario definition), sketches viable lines from it, and
 * only the single top-ranked line is expanded into a full route through the existing deep-line
 * pipeline (sketch → route → repair → extend) — cheaper than expanding every sketched line
 * since this is a "what's the ceiling/floor" question, not a full solver run.
 */
export async function generateEndboardScenario(
  settings: AISettings,
  deckList: DeckList,
  cardNames: Record<string, string>,
  cardDetails: Record<string, YGOPROCardDetails>,
  deckProfile: DeckProfile,
  scenario: EndboardScenarioDef
): Promise<ScenarioResult> {
  const raw = await callProvider(
    settings,
    buildScenarioSketchPrompt(deckList, cardNames, scenario.turnPosition, scenario.handSize, scenario.handQuality, cardDetails, deckProfile),
    'scenario-sketch', deckList, cardNames, [], scenario.turnPosition, cardDetails,
    { deckProfile, handSize: scenario.handSize, handQuality: scenario.handQuality }
  );
  const { handCardIds, handRationale, sketches } = sanitizeScenarioSketch(
    parseJsonPayload(raw, `scenario sketch "${scenario.id}"`), deckList, scenario.handSize
  );

  const topSketch = sketches[0];
  const route = await generateDeepRoute(
    settings, deckList, cardNames, handCardIds, scenario.turnPosition, cardDetails, deckProfile, topSketch
  );

  return {
    version: '1.0',
    scenarioId: scenario.id,
    deckHash: deckProfile.deckHash,
    deckProfileVersion: deckProfile.version,
    generatedAt: new Date().toISOString(),
    hypotheticalHand: handCardIds,
    handRationale,
    route
  };
}

/**
 * Generates all ENDBOARD_SCENARIOS in parallel and returns the settled results. Not called
 * eagerly by the v1 UI (each scenario is a 30-90s multi-call pipeline) — kept for potential
 * future bulk use (e.g. a background pre-warm).
 */
export async function generateEndboardScenarios(
  settings: AISettings,
  deckList: DeckList,
  cardNames: Record<string, string>,
  cardDetails: Record<string, YGOPROCardDetails>,
  deckProfile: DeckProfile
): Promise<PromiseSettledResult<ScenarioResult>[]> {
  return Promise.allSettled(
    ENDBOARD_SCENARIOS.map(scenario =>
      generateEndboardScenario(settings, deckList, cardNames, cardDetails, deckProfile, scenario)
    )
  );
}

/** Route ids are model-chosen and generated in parallel — suffix collisions instead of dropping routes. */
function dedupeRouteIds(routes: ComboRoute[]): ComboRoute[] {
  const seen = new Set<string>();
  return routes.map(route => {
    let id = route.id;
    for (let n = 2; seen.has(id); n++) id = `${route.id}-${n}`;
    seen.add(id);
    return id === route.id ? route : { ...route, id };
  });
}

/**
 * Expands one sketched line into a full route, then runs the replay/repair and extend loops.
 */
async function generateDeepRoute(
  settings: AISettings,
  deckList: DeckList,
  cardNames: Record<string, string>,
  handCards: string[],
  turnPosition: TurnPosition,
  cardDetails: Record<string, YGOPROCardDetails>,
  deckProfile: DeckProfile | undefined,
  sketch: ComboLineSketch
): Promise<ComboRoute> {
  const prompt = buildComboPrompt(deckList, cardNames, handCards, turnPosition, cardDetails, deckProfile, sketch);
  const raw = await callProvider(
    settings, prompt, 'route', deckList, cardNames, handCards, turnPosition, cardDetails,
    { deckProfile, lineFocus: sketch }
  );
  const validation = validateComboRoute(parseJsonPayload(raw, `route "${sketch.name}"`), deckList);
  if (!validation.valid || !validation.data) {
    throw new Error(`Route "${sketch.name}" failed validation:\n${validation.errors.join('\n')}`);
  }

  let route = await repairRouteIfNeeded(
    settings, deckList, cardNames, handCards, turnPosition, cardDetails, deckProfile, validation.data
  );
  route = await extendRoute(
    settings, deckList, cardNames, handCards, turnPosition, cardDetails, deckProfile, route, sketch
  );
  return route;
}

/**
 * Replays the route; on violations, gives the model ONE shot at fixing them. Keeps whichever
 * version replays with fewer violations, so a bad repair can't make things worse.
 */
async function repairRouteIfNeeded(
  settings: AISettings,
  deckList: DeckList,
  cardNames: Record<string, string>,
  handCards: string[],
  turnPosition: TurnPosition,
  cardDetails: Record<string, YGOPROCardDetails>,
  deckProfile: DeckProfile | undefined,
  route: ComboRoute
): Promise<ComboRoute> {
  const replay = replayComboRoute(route, deckList, handCards);
  if (replay.valid) return route;

  try {
    const raw = await callProvider(
      settings,
      buildRepairComboPrompt(deckList, cardNames, handCards, turnPosition, cardDetails, deckProfile, route, replay.errors),
      'repair', deckList, cardNames, handCards, turnPosition, cardDetails,
      { deckProfile, route, replayErrors: replay.errors }
    );
    const validation = validateComboRoute(parseJsonPayload(raw, `repair of "${route.name}"`), deckList);
    if (validation.valid && validation.data) {
      const repairedReplay = replayComboRoute(validation.data, deckList, handCards);
      if (repairedReplay.errors.length < replay.errors.length) return validation.data;
    }
  } catch (e) {
    console.warn(`Repair call for "${route.name}" failed — keeping the original route.`, e);
  }

  console.warn(`Route "${route.name}" still has replay violations after repair:\n${replay.errors.join('\n')}`);
  return route;
}

/**
 * Shows the model its own final board state and asks it to keep extending the main line —
 * repeats until it answers {"done": true}, the extension stops growing, or the pass cap hits.
 * An extension is only accepted if it doesn't introduce new replay violations.
 */
async function extendRoute(
  settings: AISettings,
  deckList: DeckList,
  cardNames: Record<string, string>,
  handCards: string[],
  turnPosition: TurnPosition,
  cardDetails: Record<string, YGOPROCardDetails>,
  deckProfile: DeckProfile | undefined,
  route: ComboRoute,
  sketch?: ComboLineSketch
): Promise<ComboRoute> {
  let current = route;
  for (let pass = 0; pass < MAX_EXTENSION_PASSES; pass++) {
    const replay = replayComboRoute(current, deckList, handCards);
    let parsed: unknown;
    try {
      const raw = await callProvider(
        settings,
        buildExtendComboPrompt(deckList, cardNames, handCards, turnPosition, cardDetails, deckProfile, current, replay.finalState, sketch?.targetEndBoardIds),
        'extend', deckList, cardNames, handCards, turnPosition, cardDetails,
        { deckProfile, route: current, finalState: replay.finalState, lineFocus: sketch }
      );
      parsed = parseJsonPayload(raw, `extension of "${current.name}"`);
    } catch (e) {
      console.warn(`Extension pass ${pass + 1} for "${current.name}" failed — keeping the route as is.`, e);
      break;
    }

    if ((parsed as { done?: boolean })?.done) break;

    const validation = validateComboRoute(parsed, deckList);
    if (!validation.valid || !validation.data || validation.data.steps.length <= current.steps.length) break;
    const extendedReplay = replayComboRoute(validation.data, deckList, handCards);
    if (extendedReplay.errors.length > replay.errors.length) break;
    current = validation.data;
  }
  return current;
}

/**
 * Legacy path: ALL combo lines from one AI call. Kept as the fallback when the deep-line
 * pipeline can't complete (e.g. sketch phase rejected by the provider).
 * Partial failures are skipped and logged — at least 1 valid combo must be returned.
 */
async function generateMultipleAICombosLegacy(
  settings: AISettings,
  deckList: DeckList,
  cardNames: Record<string, string>,
  handCards: string[],
  turnPosition: TurnPosition,
  cardDetails: Record<string, YGOPROCardDetails> = {},
  deckProfile?: DeckProfile
): Promise<ComboRoute[]> {
  const prompt = buildMultiComboPrompt(deckList, cardNames, handCards, turnPosition, cardDetails, deckProfile);
  const rawText = await callProvider(settings, prompt, 'multi', deckList, cardNames, handCards, turnPosition);

  if (!rawText) throw new Error('AI returned empty response.');

  const cleaned = cleanJsonResponse(rawText);
  let parsedArray: unknown;
  try {
    parsedArray = JSON.parse(cleaned);
  } catch {
    const repaired = tryRepairJson(cleaned);
    try {
      parsedArray = JSON.parse(repaired);
    } catch {
      throw new Error(`AI returned invalid JSON for multi-combo: ${cleaned.substring(0, 200)}...`);
    }
  }

  if (!Array.isArray(parsedArray)) {
    // Some models wrap arrays in an object — try to unwrap
    const asObj = parsedArray as Record<string, unknown>;
    const firstArray = Object.values(asObj).find(v => Array.isArray(v));
    if (firstArray) {
      parsedArray = firstArray;
    } else {
      throw new Error('AI did not return an array of combo routes.');
    }
  }

  const routes: ComboRoute[] = [];
  for (const item of parsedArray as unknown[]) {
    const validation = validateComboRoute(item, deckList);
    if (validation.valid && validation.data) {
      routes.push(validation.data);
    }
    // Skip invalid items — partial success is acceptable
  }

  if (routes.length === 0) {
    throw new Error('AI returned combo array but all routes failed validation.');
  }

  return routes;
}

/**
 * Compiles a one-shot "deck profile" (card roles + search targets for every main-deck card),
 * validates it, and returns it for the caller to cache. The AI runs once here; afterwards the
 * adaptive matcher consumes this data purely offline.
 */
export async function generateDeckProfile(
  deckList: DeckList,
  settings: AISettings,
  cardDetails: Record<string, YGOPROCardDetails>,
  deckHash: string
): Promise<DeckProfile> {
  const prompt = buildDeckProfilePrompt(deckList, cardDetails);
  const responseText = await callProvider(settings, prompt, 'profile', deckList, {}, [], 'going-first', cardDetails);

  if (!responseText) {
    throw new Error('AI returned an empty response.');
  }

  const cleaned = cleanJsonResponse(responseText);
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch {
    const repaired = tryRepairJson(cleaned);
    try {
      parsedJson = JSON.parse(repaired);
    } catch {
      throw new Error(`AI returned invalid JSON (could not repair): ${cleaned.substring(0, 200)}...`);
    }
  }

  const validation = validateDeckProfile(parsedJson, deckList, deckHash);
  if (!validation.valid) {
    throw new Error(`AI Deck Profile Validation Failed:\n${validation.errors.join('\n')}`);
  }

  return validation.data!;
}

type CallProviderMode = 'single' | 'multi' | 'profile' | 'sketch' | 'route' | 'extend' | 'repair' | 'scenario-sketch';

/**
 * 'sketch' and 'scenario-sketch' hand the model the deck's ENTIRE main deck effect text plus
 * the role map and ask it to reason backwards from the end board — much heavier analysis than
 * 'route'/'extend'/'repair', which work off a fixed short hand. Reasoning-heavy models can burn
 * the whole token budget narrating that analysis before ever emitting JSON, so these modes get
 * extra headroom.
 */
function maxTokensForMode(mode: CallProviderMode): number {
  return mode === 'sketch' || mode === 'scenario-sketch' ? 24000 : 16000;
}

/**
 * Internal helper: sends prompt to the selected provider and returns raw text.
 * Support local proxy API call in settings.useDemo mode.
 */
async function callProvider(
  settings: AISettings,
  prompt: string,
  mode: CallProviderMode,
  deckList: DeckList,
  cardNames: Record<string, string>,
  handCards: string[],
  turnPosition: TurnPosition,
  cardDetails?: Record<string, YGOPROCardDetails>,
  // Extra pipeline payload (deckProfile / lineFocus / route / finalState / replayErrors) —
  // demo mode rebuilds prompts server-side, so these must travel with the request.
  extras?: Record<string, unknown>
): Promise<string> {
  if (settings.useDemo) {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deckList,
        cardNames,
        handCards,
        turnPosition,
        mode,
        cardDetails,
        ...(extras ?? {})
      })
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Demo Mode is unavailable on this deployment (this host cannot run the AI server route). Switch to Custom Key Mode in Settings and add your own API key to generate combos.');
      }
      if (response.status === 429) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Demo Mode is rate-limited. Please wait a bit, or add your own API key in Settings.');
      }
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Serverless demo API returned status ${response.status}`);
    }

    const data = await response.json();
    return data.rawResponse || '';
  }

  const key = settings.customApiKey.trim();
  if (!key) throw new Error('API Key is required when not using Demo Mode.');

  const { provider, model } = settings;
  let responseText = '';

  const maxTokens = maxTokensForMode(mode);

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: maxTokens }
      })
    });
    if (!r.ok) throw new Error(`Gemini API Error (${r.status}): ${await r.text()}`);
    const j = await r.json();
    responseText = j.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else if (provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] })
    });
    if (!r.ok) throw new Error(`OpenAI API Error (${r.status}): ${await r.text()}`);
    const j = await r.json();
    responseText = j.choices?.[0]?.message?.content || '';
  } else if (provider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'x-api-key': key,
        'anthropic-version': '2023-06-01', 'dangerously-allow-browser': 'true'
      } as HeadersInit,
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] })
    }).catch(() => { throw new Error('Anthropic CORS block — use OpenRouter or Gemini.'); });
    if (!r.ok) throw new Error(`Anthropic API Error (${r.status}): ${await r.text()}`);
    const j = await r.json();
    responseText = j.content?.[0]?.text || '';
  } else if (provider === 'openrouter') {
    const callOpenRouter = (maxTokens: number) => fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`,
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
        'X-Title': 'Yu-Gi-Oh Combo Engine'
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] })
    });
    let r = await callOpenRouter(maxTokens);
    if (r.status === 402) {
      // Low-credit accounts can't afford the full budget; retry with what
      // OpenRouter says the account can pay for ("can only afford N tokens").
      const errText = await r.text();
      const affordable = Math.min(...[...errText.matchAll(/can only afford (\d+)/g)].map(m => Number(m[1])));
      // Below ~4000 output tokens the combo JSON is guaranteed to truncate — fail loudly
      // instead of returning a silently shallow/broken route.
      if (Number.isFinite(affordable) && affordable >= 4000) {
        console.warn(`OpenRouter credits are low: retrying with max_tokens=${Math.floor(affordable * 0.9)} (wanted ${maxTokens}). Combo depth may suffer — top up at https://openrouter.ai/settings/credits or pick a cheaper/free model.`);
        r = await callOpenRouter(Math.floor(affordable * 0.9));
      } else {
        throw new Error(`OpenRouter credits are too low to generate a complete combo (needs ≥4000 output tokens). Top up at https://openrouter.ai/settings/credits or switch to a 🆓 free model in Settings. Original error: ${errText}`);
      }
    }
    if (!r.ok) throw new Error(`OpenRouter API Error (${r.status}): ${await r.text()}`);
    const j = await r.json();
    responseText = j.choices?.[0]?.message?.content || '';
  } else if (provider === 'deepseek') {
    const r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }],
        ...(model === 'deepseek-chat' ? { response_format: { type: 'json_object' } } : {})
      })
    });
    if (!r.ok) throw new Error(`DeepSeek API Error (${r.status}): ${await r.text()}`);
    const j = await r.json();
    responseText = j.choices?.[0]?.message?.content || '';
  } else {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }

  return responseText;
}
