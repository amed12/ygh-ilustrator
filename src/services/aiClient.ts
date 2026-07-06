import { AISettings, ComboRoute, DeckList } from '../types';
import { buildComboPrompt, TurnPosition } from './prompts';
import { validateComboRoute } from './validator';

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
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3' },
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash (OpenRouter)' }
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
  turnPosition: TurnPosition
): Promise<ComboRoute> {
  const prompt = buildComboPrompt(deckList, cardNames, handCards, turnPosition);

  let responseText = '';

  if (settings.useDemo) {
    // Call our serverless proxy
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deckList, cardNames, settings })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Serverless demo API returned status ${response.status}`);
    }

    const data = await response.json();
    responseText = data.rawResponse;
  } else {
    // Direct client-side fetch using user's custom API key
    const key = settings.customApiKey.trim();
    if (!key) {
      throw new Error('API Key is required when not using Demo Mode.');
    }

    const provider = settings.provider;
    const model = settings.model;

    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API Error (${response.status}): ${errText}`);
      }

      const resJson = await response.json();
      responseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (provider === 'openai') {
      const url = 'https://api.openai.com/v1/chat/completions';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI API Error (${response.status}): ${errText}`);
      }

      const resJson = await response.json();
      responseText = resJson.choices?.[0]?.message?.content || '';
    } else if (provider === 'anthropic') {
      // NOTE: Anthropic has CORS restrictions on direct client-side fetch.
      // To bypass CORS for local client usage, we instruct the user, but we will attempt it directly.
      const url = 'https://api.anthropic.com/v1/messages';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'dangerously-allow-browser': 'true' // Client SDK allows this, headers might block direct.
        } as HeadersInit,
        body: JSON.stringify({
          model,
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }]
        })
      }).catch(() => {
        throw new Error('Anthropic API request failed (likely due to browser CORS policies). Please try OpenRouter or Gemini instead.');
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic API Error (${response.status}): ${errText}`);
      }

      const resJson = await response.json();
      responseText = resJson.content?.[0]?.text || '';
    } else if (provider === 'openrouter') {
      const url = 'https://openrouter.ai/api/v1/chat/completions';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
          'X-Title': 'Yu-Gi-Oh Combo Engine'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter API Error (${response.status}): ${errText}`);
      }

      const resJson = await response.json();
      responseText = resJson.choices?.[0]?.message?.content || '';
    } else {
      throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  if (!responseText) {
    throw new Error('AI returned an empty response.');
  }

  // Parse and validate the response
  const cleaned = cleanJsonResponse(responseText);
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned invalid JSON: ${cleaned.substring(0, 100)}...`);
  }

  const validation = validateComboRoute(parsedJson, deckList);
  if (!validation.valid) {
    throw new Error(`AI Combo Validation Failed:\n${validation.errors.join('\n')}`);
  }

  return validation.data!;
}
