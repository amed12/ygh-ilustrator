import { DeckList } from '../types';

/**
 * Builds a strict, structured prompt template for LLMs to generate Yu-Gi-Oh combos.
 * Ensures the response matches our types.ts schema exactly and avoids card hallucinations.
 */
export function buildComboPrompt(
  deckList: DeckList,
  cardNames: Record<string, string>
): string {
  // Format deck list for prompt
  const mainCards = deckList.main.map(id => `- ID: ${id} (${cardNames[id] || 'Unknown Card'})`).join('\n');
  const extraCards = deckList.extra.map(id => `- ID: ${id} (${cardNames[id] || 'Unknown Card'})`).join('\n');
  
  const deckListJSON = JSON.stringify({
    mainCount: deckList.main.length,
    extraCount: deckList.extra.length,
    mainDeckIds: deckList.main,
    extraDeckIds: deckList.extra
  }, null, 2);

  return `You are an expert competitive Yu-Gi-Oh! TCG / Master Duel deck analyst and professional combo designer.

Analyze the provided deck list below and generate a single optimal combo route (called a ComboRoute) that the player can execute.

STRICT DESIGN RULES (CRITICAL):
1. NO CARD HALLUCINATION: You may ONLY use cards that exist in the provided mainDeckIds and extraDeckIds.
2. Every step in the combo MUST reference a cardId that is physically present in the deck list. Never reference cards outside this deck.
3. Incorporate branching logic! If there is a key bottleneck/search/summon effect (like Force Strix search, or a Wise Strix summon), define a "Negated" path.
4. The success path should flow sequentially from step 1 to N (using next_success).
5. Negated paths should branch to fallback steps (step IDs 10+), which eventually terminate with next_success = null and next_negated = null (e.g., pivot to a defensive Abyss Dweller, Bagooska, set backrow, or Zeus line).
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
  "requiredCards": ["string", "string"], // The core card IDs from the deck list that are required to initiate this combo
  "steps": [
    {
      "id": 1, // unique integer
      "action": "string (human-readable step action instruction, max 70 chars, e.g. 'Normal Summon Tribute Lanius')",
      "cardId": "string (the card passcode/id from the deck list involved in this step)",
      "next_success": 2, // next step ID if successful, or null if combo complete
      "next_negated": 10 // step ID to pivot to if this step gets negated/handtrapped, or null if pass turn
    }
  ],
  "tags": ["going-first" | "going-second" | "otk" | "grind" | "defensive"] // 1-3 tags
}`;
}
