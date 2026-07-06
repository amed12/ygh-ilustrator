import { NextRequest, NextResponse } from 'next/server';
import { buildComboPrompt, TurnPosition } from '../../../services/prompts';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deckList, cardNames, handCards, turnPosition } = body;

    if (!deckList || !cardNames) {
      return NextResponse.json(
        { error: 'Missing required parameters: deckList or cardNames' },
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

    // Build the system prompt
    const prompt = buildComboPrompt(deckList, cardNames, resolvedHand, resolvedTurn);

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
          responseMimeType: 'application/json'
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
