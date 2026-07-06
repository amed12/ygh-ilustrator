import { DeckList } from '../types';

export type TurnPosition = 'going-first' | 'going-second';

/**
 * Builds a strict, structured prompt template for LLMs to generate Yu-Gi-Oh combos.
 * Ensures the response matches our types.ts schema exactly and avoids card hallucinations.
 *
 * @param deckList     - The full imported deck list (main/extra/side).
 * @param cardNames    - Resolved card name map (passcode → name).
 * @param handCards    - Card IDs the player currently has in hand (no upper limit).
 * @param turnPosition - Whether the player is going first or second.
 */
export function buildComboPrompt(
  deckList: DeckList,
  cardNames: Record<string, string>,
  handCards: string[],
  turnPosition: TurnPosition
): string {
  // Format deck list for prompt
  const mainCards = deckList.main.map(id => `- ID: ${id} (${cardNames[id] || 'Unknown Card'})`).join('\n');
  const extraCards = deckList.extra.map(id => `- ID: ${id} (${cardNames[id] || 'Unknown Card'})`).join('\n');

  // Format hand cards
  const handCardsList = handCards
    .map(id => `- ID: ${id} (${cardNames[id] || 'Unknown Card'})`)
    .join('\n');

  const deckListJSON = JSON.stringify({
    mainCount: deckList.main.length,
    extraCount: deckList.extra.length,
    mainDeckIds: deckList.main,
    extraDeckIds: deckList.extra
  }, null, 2);

  const turnContext = turnPosition === 'going-first'
    ? `The player is GOING FIRST. There is no Battle Phase this turn. The goal is to build the strongest possible end board with negates, floodgates, and/or interruptions before passing turn. Do NOT include attacks or battle damage steps.`
    : `The player is GOING SECOND. The opponent already has an established board. The goal is to break the opponent's board and push for an OTK (One Turn Kill) if possible, or at minimum clear threats and establish advantage. Include Battle Phase attacks if the combo leads to lethal damage.`;

  return `You are an expert competitive Yu-Gi-Oh! TCG / Master Duel deck analyst and professional combo designer.

The player has drawn their opening hand and needs an optimal combo route. Analyze the hand cards and the full deck context to generate the best possible play sequence.

TURN POSITION:
${turnContext}

OPENING HAND (${handCards.length} cards):
${handCardsList}

CRITICAL HAND RULES:
1. The combo MUST begin from the cards in the OPENING HAND above. Step 1 must use a hand card.
2. You may reference Extra Deck cards for Synchro/XYZ/Link/Fusion summons during the combo.
3. The "requiredCards" field must ONLY contain card IDs from the opening hand that are essential starters for this combo.
4. The hand may contain more than 5 cards (e.g. from Maxx "C"). Use ALL relevant hand cards.

STRICT DESIGN RULES (CRITICAL):
1. NO CARD HALLUCINATION: You may ONLY use cards that exist in the provided mainDeckIds and extraDeckIds.
2. NON-DECK CARDS: If a step involves a Token, an opponent's card (e.g., Nibiru), or a generic action, set cardId to "TOKEN", "OPPONENT", or "NONE".
3. BRANCHING & FALLBACKS: Yu-Gi-Oh is highly interactive. Do NOT just provide a single linear success path. You MUST provide alternative branches using the "responses" array for EACH step if applicable.
   - Triggers can be: "success", "ash_blossom", "imperm_veiler", "nibiru", "maxx_c", "generic_negate".
   - "next_step: null" indicates the combo ends there.
4. THE MAXX "C" CHALLENGE: If going first, you MUST provide an explicit early fallback path if 'Maxx C' is activated in response to the first Special Summon. This route should minimize opponent draws while establishing a minimal interruption (e.g., Rank 4 Bagooska or a set trap). Use trigger "maxx_c".
5. STATE MUTATIONS: For each step, track virtual state changes. If you discard a card from hand, list it in stateMutations.hand.remove and gy.add.
6. END BOARD: Summarize the final board state in the "endBoard" object.
7. IDs: Ensure all step IDs are unique 1-indexed integers. No broken pointers.

DECK LIST:
---
MAIN DECK CARDS:
${mainCards}

EXTRA DECK CARDS:
${extraCards}

RAW DATA:
${deckListJSON}
---

OUTPUT FORMAT:
You must respond with ONLY a valid, raw JSON object matching the schema below. No markdown wrappers, no backticks, no explanatory text.

JSON SCHEMA:
{
  "id": "string (unique string id, e.g. 'combo-wise-strix-opening')",
  "name": "string (descriptive name of the combo, max 45 chars)",
  "archetype": "string (primary archetype)",
  "description": "string (1-2 sentence description explaining the end board or goal)",
  "requiredCards": ["string"], // ONLY card IDs from the opening hand that are essential starters
  "endBoard": {
    "monsters": ["string (card IDs)"],
    "spellsTraps": ["string (card IDs)"],
    "interruptions": ["string (human-readable, e.g. '1 Omni-Negate', '1 GY Banish')"]
  },
  "steps": [
    {
      "id": 1,
      "action": "string (human-readable step action instruction)",
      "cardId": "string (the card passcode/id involved)",
      "responses": [
        { "trigger": "success", "next_step": 2 },
        { "trigger": "ash_blossom", "next_step": 10 },
        { "trigger": "maxx_c", "next_step": 11 }
      ],
      "stateMutations": {
        "hand": { "add": ["id"], "remove": ["id"] },
        "field": { "add": ["id"], "remove": ["id"] },
        "gy": { "add": ["id"], "remove": ["id"] },
        "banished": { "add": ["id"], "remove": ["id"] }
      }
    }
  ],
  "tags": ["${turnPosition}" | "otk" | "grind" | "defensive"]
}`;
}
