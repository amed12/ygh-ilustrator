import { NextRequest, NextResponse } from 'next/server';
import {
  buildComboPrompt,
  buildMultiComboPrompt,
  buildDeckProfilePrompt,
  buildComboSketchPrompt,
  buildScenarioSketchPrompt,
  buildExtendComboPrompt,
  buildRepairComboPrompt,
  ComboLineSketch,
  ReplayFinalState,
  TurnPosition
} from '../../../services/prompts';
import { ComboRoute, DeckProfile, YGOPROCardDetails } from '../../../types';

// ── Rate limiting (in-memory, per-instance) ──────────────────────────────────
// The demo mode shares a single server-side GEMINI_API_KEY across all visitors.
// This is a best-effort guard against runaway cost/abuse: it resets whenever
// the serverless instance recycles, so it is not a substitute for a proper
// distributed limiter, but it stops a single client from hammering the key.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
// One deep-line solver run now fans out into multiple calls (1 sketch + up to 4 routes,
// each with optional repair/extend follow-ups ≈ up to ~13 calls), so the per-IP budget
// covers roughly 3 solver runs per window instead of 10 single-shot generations.
const RATE_LIMIT_MAX_REQUESTS = 40;
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
    const { deckList, cardNames, handCards, turnPosition, mode, cardDetails } = body;
    // Deep-line pipeline payload (all optional; validated per-mode below)
    const { deckProfile, lineFocus, route, finalState, replayErrors, handSize, handQuality } = body;

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
    const resolvedCardDetails: Record<string, YGOPROCardDetails> =
      cardDetails && typeof cardDetails === 'object' && Object.keys(cardDetails).length <= MAX_CARD_NAMES
        ? cardDetails
        : {};

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Demo API key is not configured on the server. Please enter a custom API key in the settings instead.' },
        { status: 503 }
      );
    }

    // Optional deep-line payload — trusted only as prompt-building context, never executed.
    const resolvedProfile: DeckProfile | undefined =
      deckProfile && typeof deckProfile === 'object' && deckProfile.cards ? deckProfile as DeckProfile : undefined;
    const capIds = (v: unknown, max: number) => (Array.isArray(v) ? v.map(String).slice(0, max) : []);
    const resolvedLineFocus: ComboLineSketch | undefined =
      lineFocus && typeof lineFocus === 'object' && typeof lineFocus.name === 'string' && Array.isArray(lineFocus.starterCardIds)
        ? {
            name: String(lineFocus.name).slice(0, 100),
            starterCardIds: capIds(lineFocus.starterCardIds, MAX_HAND_CARDS),
            goal: String(lineFocus.goal ?? '').slice(0, 500),
            targetEndBoardIds: capIds(lineFocus.targetEndBoardIds, MAX_EXTRA_DECK),
            keyCardIds: capIds(lineFocus.keyCardIds, MAX_HAND_CARDS)
          }
        : undefined;
    const resolvedRoute: ComboRoute | undefined =
      route && typeof route === 'object' && Array.isArray(route.steps) ? route as ComboRoute : undefined;
    const resolvedFinalState: ReplayFinalState | undefined =
      finalState && typeof finalState === 'object' && Array.isArray(finalState.field)
        ? finalState as ReplayFinalState
        : undefined;
    const resolvedReplayErrors: string[] =
      Array.isArray(replayErrors) ? replayErrors.map(String).slice(0, 50) : [];

    // Build the correct prompt for the requested pipeline phase.
    let prompt: string;
    if (mode === 'profile') {
      prompt = buildDeckProfilePrompt(deckList, resolvedCardDetails);
    } else if (mode === 'multi') {
      prompt = buildMultiComboPrompt(deckList, cardNames, resolvedHand, resolvedTurn, resolvedCardDetails, resolvedProfile);
    } else if (mode === 'sketch') {
      prompt = buildComboSketchPrompt(deckList, cardNames, resolvedHand, resolvedTurn, resolvedCardDetails, resolvedProfile);
    } else if (mode === 'scenario-sketch') {
      const resolvedHandSize = handSize === 6 ? 6 : 5;
      const resolvedHandQuality = handQuality === 'worst' ? 'worst' : 'best';
      prompt = buildScenarioSketchPrompt(deckList, cardNames, resolvedTurn, resolvedHandSize, resolvedHandQuality, resolvedCardDetails, resolvedProfile);
    } else if (mode === 'extend') {
      if (!resolvedRoute || !resolvedFinalState) {
        return NextResponse.json({ error: 'Mode "extend" requires route and finalState.' }, { status: 400 });
      }
      prompt = buildExtendComboPrompt(deckList, cardNames, resolvedHand, resolvedTurn, resolvedCardDetails, resolvedProfile, resolvedRoute, resolvedFinalState, resolvedLineFocus?.targetEndBoardIds);
    } else if (mode === 'repair') {
      if (!resolvedRoute || resolvedReplayErrors.length === 0) {
        return NextResponse.json({ error: 'Mode "repair" requires route and replayErrors.' }, { status: 400 });
      }
      prompt = buildRepairComboPrompt(deckList, cardNames, resolvedHand, resolvedTurn, resolvedCardDetails, resolvedProfile, resolvedRoute, resolvedReplayErrors);
    } else {
      // 'single' and 'route' — one full route; 'route' additionally focuses on a sketched line.
      prompt = buildComboPrompt(deckList, cardNames, resolvedHand, resolvedTurn, resolvedCardDetails, resolvedProfile, resolvedLineFocus);
    }

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
