import { NextRequest, NextResponse } from 'next/server';
import { buildComboPrompt, buildMultiComboPrompt, TurnPosition } from '../../../services/prompts';

// ── Rate limiting (in-memory, per-instance) ──────────────────────────────────
// The demo mode shares a single server-side GEMINI_API_KEY across all visitors.
// This is a best-effort guard against runaway cost/abuse: it resets whenever
// the serverless instance recycles, so it is not a substitute for a proper
// distributed limiter, but it stops a single client from hammering the key.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX_REQUESTS = 10;
const requestLog = new Map<string, number[]>();

function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  const limited = timestamps.length >= RATE_LIMIT_MAX_REQUESTS;
  if (!limited) {
    timestamps.push(now);
  }
  requestLog.set(ip, timestamps);
  return limited;
}

// ── Input size caps ──────────────────────────────────────────────────────────
// Bounds prompt size (and therefore token cost) regardless of what the client sends.
const MAX_HAND_CARDS = 12;
const MAX_MAIN_DECK = 60;
const MAX_EXTRA_DECK = 15;
const MAX_SIDE_DECK = 15;
const MAX_CARD_NAMES = 200;

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        { error: `Demo AI generation is rate-limited to ${RATE_LIMIT_MAX_REQUESTS} requests per ${RATE_LIMIT_WINDOW_MS / 60000} minutes per user. Please wait a bit, or add your own API key in Settings for unlimited generation.` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { deckList, cardNames, handCards, turnPosition, mode } = body;

    if (!deckList || !cardNames) {
      return NextResponse.json(
        { error: 'Missing required parameters: deckList or cardNames' },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(deckList.main) || deckList.main.length > MAX_MAIN_DECK ||
      !Array.isArray(deckList.extra) || deckList.extra.length > MAX_EXTRA_DECK ||
      !Array.isArray(deckList.side) || deckList.side.length > MAX_SIDE_DECK ||
      typeof cardNames !== 'object' || Object.keys(cardNames).length > MAX_CARD_NAMES ||
      (handCards !== undefined && (!Array.isArray(handCards) || handCards.length > MAX_HAND_CARDS))
    ) {
      return NextResponse.json(
        { error: 'Deck or hand data exceeds allowed size limits.' },
        { status: 400 }
      );
    }

    // Validate hand cards and turn position with safe defaults
    const resolvedHand: string[] = Array.isArray(handCards) ? handCards : [];
    const resolvedTurn: TurnPosition = turnPosition === 'going-second' ? 'going-second' : 'going-first';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Demo API key is not configured on the server. Please enter a custom API key in the settings instead.' },
        { status: 503 }
      );
    }

    // Build the correct system prompt (single or multi)
    const prompt = mode === 'multi'
      ? buildMultiComboPrompt(deckList, cardNames, resolvedHand, resolvedTurn)
      : buildComboPrompt(deckList, cardNames, resolvedHand, resolvedTurn);

    // Call Gemini API using process.env.GEMINI_API_KEY
    // Default to a fast/cheap model for the public demo to prevent excessive costs
    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: 16000
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Gemini API Error: ${errText}` },
        { status: 502 }
      );
    }

    const resJson = await response.json();
    const rawResponse = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return NextResponse.json({ rawResponse });
  } catch (e: unknown) {
    console.error('Error inside API route /api/generate:', e);
    const message = e instanceof Error ? e.message : 'Internal Server Error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
