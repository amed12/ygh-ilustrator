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
2. You may reference Extra Deck cards for Synchro/XYZ/Link/Fusion summons during the combo (they are available face-down in the Extra Deck).
3. You may reference Main Deck cards that are searched/milled/drawn during the combo steps (e.g. via search effects like "Raidraptor - Nest"), but the STARTING plays must come from hand cards.
4. The "requiredCards" field must ONLY contain card IDs from the opening hand that are essential starters for this combo.
5. The hand may contain more than 5 cards (due to effects like Maxx "C", Pot of Desires, etc.). Use ALL relevant hand cards if they contribute to the combo.

STRICT DESIGN RULES (CRITICAL):
1. NO CARD HALLUCINATION: You may ONLY use cards that exist in the provided mainDeckIds and extraDeckIds.
2. Every step in the combo MUST reference a cardId that is physically present in the deck list. Never reference cards outside this deck.
3. Incorporate branching logic! If there is a key bottleneck/search/summon effect (like Force Strix search, or a Wise Strix summon), define a "Negated" path.
4. The success path should flow sequentially from step 1 to N (using next_success).
5. Negated paths should branch to fallback steps using high step IDs (step IDs 100+, such as 100, 101, 102, to prevent any duplicate ID collisions with the main success line), which eventually terminate with next_success = null and next_negated = null (e.g., pivot to a defensive Abyss Dweller, Bagooska, set backrow, or Zeus line).
6. next_success = null indicates the combo is complete.
7. next_negated = null indicates that if the negate occurs, there is no recovery line (e.g. pass turn).
8. Ensure all step IDs are unique 1-indexed integers.
9. Every next_success and next_negated value MUST point to another step id that exists in the same steps list, or be null. No broken pointers.

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
You must respond with ONLY a valid, raw JSON object matching the schema below. No markdown wrappers, no backticks (e.g. do not wrap in \`\`\`json), and no explanatory text. Just the raw JSON object.

JSON SCHEMA:
{
  "id": "string (unique string id, e.g. 'combo-wise-strix-opening')",
  "name": "string (descriptive name of the combo, max 45 chars)",
  "archetype": "string (primary archetype, e.g., 'Raidraptor')",
  "description": "string (1-2 sentence description explaining the end board or goal)",
  "requiredCards": ["string", "string"], // ONLY card IDs from the opening hand that are essential starters
  "steps": [
    {
      "id": 1, // unique integer
      "action": "string (human-readable step action instruction, max 70 chars, e.g. 'Normal Summon Tribute Lanius')",
      "cardId": "string (the card passcode/id from the deck list involved in this step)",
      "next_success": 2, // next step ID if successful, or null if combo complete
      "next_negated": 100 // step ID to pivot to if this step gets negated/handtrapped (use 100+ for fallbacks), or null if pass turn
    }
  ],
  "tags": ["${turnPosition}" | "otk" | "grind" | "defensive"] // 1-3 tags, MUST include "${turnPosition}"
}`;
}
