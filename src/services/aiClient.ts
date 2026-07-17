import { AISettings, ComboRoute, DeckList, DeckProfile, YGOPROCardDetails } from '../types';
import { buildComboPrompt, buildMultiComboPrompt, buildDeckProfilePrompt, TurnPosition } from './prompts';
import { validateComboRoute, validateDeckProfile } from './validator';

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

/**
 * Generates ALL possible combo lines from the opening hand in a single AI call.
 * Returns an array of validated ComboRoute objects.
 * Partial failures are skipped and logged — at least 1 valid combo must be returned.
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

/**
 * Internal helper: sends prompt to the selected provider and returns raw text.
 * Support local proxy API call in settings.useDemo mode.
 */
async function callProvider(
  settings: AISettings,
  prompt: string,
  mode: 'single' | 'multi' | 'profile',
  deckList: DeckList,
  cardNames: Record<string, string>,
  handCards: string[],
  turnPosition: TurnPosition,
  cardDetails?: Record<string, YGOPROCardDetails>
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
        cardDetails
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

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 16000 }
      })
    });
    if (!r.ok) throw new Error(`Gemini API Error (${r.status}): ${await r.text()}`);
    const j = await r.json();
    responseText = j.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else if (provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model, max_tokens: 16000, messages: [{ role: 'user', content: prompt }] })
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
      body: JSON.stringify({ model, max_tokens: 16000, messages: [{ role: 'user', content: prompt }] })
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
    let r = await callOpenRouter(16000);
    if (r.status === 402) {
      // Low-credit accounts can't afford the full budget; retry with what
      // OpenRouter says the account can pay for ("can only afford N tokens").
      const errText = await r.text();
      const affordable = Math.min(...[...errText.matchAll(/can only afford (\d+)/g)].map(m => Number(m[1])));
      // Below ~4000 output tokens the combo JSON is guaranteed to truncate — fail loudly
      // instead of returning a silently shallow/broken route.
      if (Number.isFinite(affordable) && affordable >= 4000) {
        console.warn(`OpenRouter credits are low: retrying with max_tokens=${Math.floor(affordable * 0.9)} (wanted 16000). Combo depth may suffer — top up at https://openrouter.ai/settings/credits or pick a cheaper/free model.`);
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
        model, max_tokens: 16000, messages: [{ role: 'user', content: prompt }],
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
