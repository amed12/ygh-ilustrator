import { DeckList, DeckProfile, YGOPROCardDetails } from '../types';

export type TurnPosition = 'going-first' | 'going-second';

/**
 * Formats a single card's full data into a concise block for the AI prompt.
 * Sends type, stats, and full effect text so the AI can reason about card interactions.
 */
function formatCardBlock(id: string, details: YGOPROCardDetails | undefined, isCritical: boolean): string {
  if (!details) return `  - ID: ${id} | [Unknown Card — no data]`;

  const stats: string[] = [];
  if (details.level) stats.push(`Lv${details.level}`);
  if (details.atk !== undefined) stats.push(`ATK ${details.atk}`);
  if (details.def !== undefined) stats.push(`DEF ${details.def}`);
  if (details.attribute) stats.push(details.attribute);
  if (details.race) stats.push(details.race);

  const statLine = stats.length > 0 ? ` | ${stats.join(' / ')}` : '';
  const typeLine = details.type ? ` | ${details.type}` : '';

  // For critical cards (hand + Extra Deck), send full effect.
  // For main deck non-hand cards, send first sentence only to save tokens.
  let effectLine = '';
  if (details.desc) {
    if (isCritical) {
      effectLine = `\n    EFFECT: "${details.desc}"`;
    } else {
      const firstSentence = details.desc.split(/\.\s/)[0].slice(0, 200);
      effectLine = `\n    EFFECT (summary): "${firstSentence}..."`;
    }
  }

  return `  - ID: ${id} | ${details.name}${typeLine}${statLine}${effectLine}`;
}

/**
 * Real Yu-Gi-Oh turn-structure and rules constraints. LLMs reliably hallucinate illegal lines
 * (double Normal Summons, reused hard-OPT effects, treating Xyz material as "in the GY") when
 * only given card effect text — these rules are not derivable from a card's text alone.
 */
const RULES_ENFORCEMENT = `═══════════════════════════════════════════════════════
RULES ENFORCEMENT (a route that violates any of these is INVALID, not just suboptimal):
═══════════════════════════════════════════════════════
1. ONE NORMAL SUMMON/SET PER TURN. Unless a card effect explicitly grants an additional Normal Summon, only one Normal Summon or Set may occur in the entire route.
2. RESPECT ONCE-PER-TURN (OPT) RESTRICTIONS EXACTLY AS PRINTED. A "hard" OPT (worded "once per turn" and tied to the card itself, e.g. "You can only use this effect of "X" once per turn") cannot be used twice by two copies of the same card in one turn. A "soft" OPT (tied to the player, e.g. "once per turn, you can...") still limits that specific effect to one activation per turn even across different named cards sharing the restriction text. Do not activate the same OPT effect twice in a line.
3. XYZ/LINK MATERIALS ARE NOT IN THE GRAVEYARD. A monster used as Xyz material is attached to that Xyz Monster, not sent to the GY — it cannot be targeted as "in the GY" until it is actually detached (and detaching is itself an action a step must perform). Do not reference a card as being in the GY unless a specific effect sent/discarded it there.
4. COSTS MUST BE PAYABLE WHEN PAID. Do not use a card/resource as a cost (tribute, discard, banish, LP payment) if it was already spent, summoned as a different card, or otherwise unavailable at that point in the line.
5. NIBIRU TIMING. Nibiru, the Primal Being can only be activated once 5 or more monsters have been Summoned (Normal or Special, either player) this turn — do not place a "nibiru" branch before the 5th Summon in the line.
6. DO NOT FABRICATE INTERRUPTIONS. Every entry in endBoard.interruptions must correspond to an effect actually printed on a card that ends up on the field per the route — do not invent negates the deck doesn't have access to.`;

/** Fixed taxonomy for endBoard.cardRoles — every surviving end-board card gets a tactical label. */
const TACTICAL_ROLE_TAXONOMY = `negate-monster, negate-spell-trap, omni-negate, board-wipe, targeted-removal, protection, floodgate, attacker, recovery, towers, follow-up, burn`;

/** One-line definitions so the AI applies each tactical role consistently. */
const TACTICAL_ROLE_DEFINITIONS = `TACTICAL ROLE DEFINITIONS (assign per end-board card):
  - negate-monster: negates monster effects (e.g. targeted monster negate)
  - negate-spell-trap: negates Spell/Trap activations
  - omni-negate: can negate ANY card type (monster + spell + trap)
  - board-wipe: destroys/removes multiple opponent cards at once
  - targeted-removal: destroys/banishes/bounces a single targeted card
  - protection: protects OTHER cards you control (destruction/targeting protection)
  - towers: the card ITSELF is unaffected by (most) opponent card effects
  - floodgate: continuous restriction on the opponent's actions (e.g. can't Special Summon, locks a card type)
  - attacker: high-ATK beater / battle pressure
  - recovery: recycles/recurs resources from GY or banishment
  - follow-up: guarantees next-turn plays (searched combo piece, on-field starter for turn 3)
  - burn: inflicts direct effect damage to the opponent`;

interface PromptSections {
  handSection: string;
  extraSection: string;
  mainSection: string;
  mainDeckOthers: string[];
  sideSection: string;
  turnContext: string;
  sideDeckStrategy: string;
}

/**
 * Builds the shared card-data sections (hand/extra/main/side + turn/side strategy context)
 * used by both the single-combo and multi-combo prompt builders.
 */
/** Roles that make a main-deck card combo-relevant enough to warrant its full effect text. */
const COMBO_RELEVANT_ROLES = new Set(['starter', 'extender', 'searcher', 'recovery', 'boss']);

/**
 * Decides which non-hand main-deck cards get FULL effect text in the prompt.
 * Deep combos route through cards searched/summoned FROM THE DECK — with only a
 * one-sentence summary the AI cannot chain them, which is why end boards come out thin.
 * With a deck profile: full text for starters/extenders/searchers/recovery/boss + every
 * known search target. Without one: full text for everything (input tokens are cheap
 * relative to a broken combo line).
 */
function buildFullDetailSet(deckList: DeckList, deckProfile?: DeckProfile): Set<string> {
  if (!deckProfile) return new Set(deckList.main);
  const full = new Set<string>();
  for (const id of deckList.main) {
    const profile = deckProfile.cards[id];
    if (!profile) continue;
    if (profile.roles.some(r => COMBO_RELEVANT_ROLES.has(r))) full.add(id);
    for (const target of profile.searches ?? []) full.add(target);
  }
  return full;
}

/**
 * Renders the precompiled deck profile as a compact role map the combo AI can use as
 * strategic guidance (which bosses/negates to build toward, which search chains reach them)
 * instead of re-deriving everything from raw card text on every call.
 */
function buildDeckRoleMapSection(
  deckList: DeckList,
  cardDetails: Record<string, YGOPROCardDetails>,
  deckProfile?: DeckProfile
): string {
  if (!deckProfile) return '';

  const nameOf = (id: string) => cardDetails[id]?.name ?? id;
  const lineFor = (id: string): string | null => {
    const p = deckProfile.cards[id];
    if (!p) return null;
    const searches = p.searches?.length ? ` → searches: ${p.searches.map(nameOf).join(', ')}` : '';
    return `  - ${nameOf(id)} (${id}): ${p.roles.join(', ')}${searches}`;
  };
  const sectionFor = (ids: string[]) =>
    ids.filter((id, i) => ids.indexOf(id) === i).map(lineFor).filter(Boolean).join('\n');

  const main = sectionFor(deckList.main);
  const extra = sectionFor(deckList.extra);
  const side = sectionFor(deckList.side);
  if (!main && !extra && !side) return '';

  return `
════════════════════════════
DECK ROLE MAP (precompiled analysis — use as strategic guidance):
════════════════════════════
Use this map to pick the strongest reachable end board (bosses/negates) and the search chains
that get there. It is guidance, not gospel — still verify every play against the printed
effect text above.
MAIN DECK:
${main || '  (none profiled)'}
EXTRA DECK:
${extra || '  (none profiled)'}
SIDE DECK:
${side || '  (none profiled)'}
`;
}

function buildPromptSections(
  deckList: DeckList,
  handCards: string[],
  turnPosition: TurnPosition,
  cardDetails: Record<string, YGOPROCardDetails>,
  deckProfile?: DeckProfile
): PromptSections {
  const handSet = new Set(handCards);
  const fullDetailSet = buildFullDetailSet(deckList, deckProfile);

  // ── OPENING HAND (FULL EFFECT — most critical) ────────────────────────────
  const handSection = handCards.map(id =>
    formatCardBlock(id, cardDetails[id], true)
  ).join('\n');

  // ── EXTRA DECK (FULL EFFECT — needed to plan end board) ────────────────────
  const extraSection = deckList.extra.map(id =>
    formatCardBlock(id, cardDetails[id], true)
  ).join('\n');

  // ── MAIN DECK (full effect for combo-relevant cards — combos chain THROUGH the deck) ──
  const mainDeckOthers = deckList.main.filter(id => !handSet.has(id));
  const mainSection = mainDeckOthers.map(id =>
    formatCardBlock(id, cardDetails[id], fullDetailSet.has(id))
  ).join('\n');

  // ── SIDE DECK (FULL EFFECT — game 2/3 strategy) ───────────────────────────
  const sideSection = deckList.side.length > 0
    ? deckList.side.map(id => formatCardBlock(id, cardDetails[id], true)).join('\n')
    : '  (No side deck cards)';

  // ── TURN POSITION CONTEXT ─────────────────────────────────────────────────
  const turnContext = turnPosition === 'going-first'
    ? `GOING FIRST — No Battle Phase this turn.
STRATEGIC OBJECTIVE: Build the strongest end board this specific hand can honestly generate.
  - Identify which Extra Deck monsters provide Omni-Negates, targeted negates, floodgates, or protection.
  - Use as many hand cards as the line legitimately supports, but do NOT force a card into the combo if doing so requires an illegal play, a cost that can't be paid, or reusing an OPT effect. Holding a card back (e.g. keeping a hand trap, or a card with no useful line) is a valid, honest outcome — say so in the description if you do.
  - Only claim negates/disruption the deck can actually produce from this hand — do not inflate the end board with fabricated interruptions.
  - End board MUST specify each monster/trap on field and EXACTLY what it negates or prevents.`
    : `GOING SECOND — Opponent has an established board.
STRATEGIC OBJECTIVE: Break the opponent's board, establish advantage, and push for OTK if ATK values allow.
  - Identify board-breaking tools in the hand (e.g. spells that destroy/banish, monsters with on-summon removal).
  - Calculate total ATK on field after board break to determine if OTK is achievable.
  - If OTK is not possible, prioritize establishing a defensive end board for the following turn.
  - Use hand cards as the line legitimately supports — do not force in a card that has no legal, useful play this turn.`;

  // ── SIDE DECK STRATEGY CONTEXT ────────────────────────────────────────────
  const sideDeckStrategy = deckList.side.length > 0
    ? `SIDE DECK STRATEGY (Game 2 / Game 3):
After game 1, you may side in cards from the Side Deck to counter the opponent's strategy.
Analyze the side deck cards above and in the \"tags\" field include \"side-in\" tags if this combo benefits from:
  - Anti-meta floodgates (e.g., Dimensional Barrier, There Can Be Only One)
  - Board wipe hand traps (e.g., Droll & Lock Bird vs combo decks)
  - Searchable power cards that improve specific matchups
Include in the combo description a note on which side deck cards could replace/augment specific steps in game 2/3.`
    : `SIDE DECK STRATEGY: No side deck provided. Skip side strategy analysis.`;

  return { handSection, extraSection, mainSection, mainDeckOthers, sideSection, turnContext, sideDeckStrategy };
}

/**
 * Builds a high-intelligence prompt for LLMs to generate Yu-Gi-Oh combos.
 * Sends full card effects for hand cards + Extra Deck, summary effects for main deck.
 * Includes strategic analysis, side deck strategy, and strict end board crafting requirements.
 *
 * @param deckList       - The full imported deck list (main/extra/side).
 * @param cardNames      - Resolved card name map (passcode → name). Used as fallback.
 * @param handCards      - Card IDs the player currently has in hand.
 * @param turnPosition   - Whether the player is going first or second.
 * @param cardDetails    - Full card data from YGOPRODECK API (includes effect text, types, stats).
 */
export function buildComboPrompt(
  deckList: DeckList,
  cardNames: Record<string, string>,
  handCards: string[],
  turnPosition: TurnPosition,
  cardDetails: Record<string, YGOPROCardDetails> = {},
  deckProfile?: DeckProfile
): string {
  const { handSection, extraSection, mainSection, mainDeckOthers, sideSection, turnContext, sideDeckStrategy } =
    buildPromptSections(deckList, handCards, turnPosition, cardDetails, deckProfile);
  const roleMapSection = buildDeckRoleMapSection(deckList, cardDetails, deckProfile);

  return `You are an elite-level competitive Yu-Gi-Oh! TCG / Master Duel deck analyst and professional combo architect.
Your job is to generate a complete, deeply-analyzed combo route with a fully-crafted end board.

═══════════════════════════════════════════════════════
MISSION CRITICAL REQUIREMENTS (READ BEFORE ALL ELSE):
═══════════════════════════════════════════════════════
1. READ EVERY CARD EFFECT below before generating anything. Do not rely on general knowledge — base all reasoning on the exact effect text provided.
2. USE HAND CARDS HONESTLY. Use every card whose inclusion is legal and useful — but do not force in a card via an illegal or nonsensical play just to avoid "wasting" it. It is correct to hold a card back if the line has no legal use for it.
3. END BOARD MUST BE FULLY CRAFTED. Specify every monster and spell/trap on the field at the end, and EXACTLY what interruption each one provides (negate type, destruction, banish, etc).
4. INTERRUPTIONS MUST BE SPECIFIC AND REAL. Not "1 negate" — write "Raidraptor - Ultimate Falcon (unaffected by opponent's card effects, reduces all opponent monster ATK to 0 during opponent's turn)". Never invent a negate the resulting board doesn't actually have.
5. BRANCHING FOR HAND TRAPS. Provide fallback branches for Ash Blossom, Maxx "C", Nibiru, and Impermanence on every key Special Summon.
6. CHAIN THROUGH THE DECK. Deep combos route through cards searched or Special Summoned FROM THE DECK, not just the opening hand — after each search/summon, immediately consider what that new card enables, and keep extending the line until the board can no longer legally grow.

${RULES_ENFORCEMENT}

════════════════════════════════════════
TURN POSITION & STRATEGIC OBJECTIVE:
════════════════════════════════════════
${turnContext}

════════════════════════════════════════
${sideDeckStrategy}
════════════════════════════════════════

════════════════════════════
OPENING HAND (${handCards.length} cards) — FULL CARD EFFECTS:
════════════════════════════
${handSection}

════════════════════════════
EXTRA DECK (${deckList.extra.length} cards) — FULL CARD EFFECTS (plan your end board from these):
════════════════════════════
${extraSection}

════════════════════════════
MAIN DECK (${mainDeckOthers.length} remaining cards — not in hand):
════════════════════════════
${mainSection}
${roleMapSection}
════════════════════════════
SIDE DECK (${deckList.side.length} cards) — for game 2/3 analysis:
════════════════════════════
${sideSection}

═══════════════════════════════════
STRICT DESIGN RULES:
═══════════════════════════════════
1. NO HALLUCINATION: Only use card IDs that appear in the deck lists above.
2. NON-DECK CARDS: For tokens, set cardId to "TOKEN". For opponent's cards (e.g. Nibiru), use "OPPONENT". For generic actions, use "NONE".
3. BRANCHING: Every step that involves a Special Summon MUST have response branches: "success", "ash_blossom" (or "imperm_veiler"), "nibiru" (after 5th summon), "maxx_c", and "generic_negate" where applicable.
4. MAXX "C" EMERGENCY LINE: If going first, provide a fallback path triggered by "maxx_c" on the first Special Summon that establishes at least 1 disruption while minimizing further special summons.
5. STATE MUTATIONS: For every step, track hand/field/GY/banished changes in stateMutations. Accuracy is required.
6. STEP IDs: Must be unique 1-indexed integers. No broken pointers. Last step in each branch must have next_step: null.
7. ALL REQUIRED CARDS: The "requiredCards" array must list ONLY the card IDs from the opening hand that are essential starters.
8. EFFICIENCY RATING: Set "efficiency" to "optimal" if the end board is the strongest this hand can honestly produce with multiple real interruptions, "sub-optimal" if the line works but the board is below the deck's potential (e.g. compromised by a Maxx "C" branch, or only a secondary starter), or "brick" if the hand produces no meaningful board (set and pass).
9. TACTICAL ROLES: For every card ID listed in endBoard.monsters or endBoard.spellsTraps, assign it 1+ tactical role(s) in endBoard.cardRoles using ONLY this exact taxonomy: ${TACTICAL_ROLE_TAXONOMY}.

${TACTICAL_ROLE_DEFINITIONS}

═══════════════════════════════════
OUTPUT FORMAT:
═══════════════════════════════════
Respond with ONLY a valid raw JSON object. No markdown, no backticks, no explanation.

CRITICAL STEP ID RULES — VIOLATING THESE MAKES THE OUTPUT INVALID:
- All step IDs MUST be sequential integers: 1, 2, 3, 4 ... up to N.
- EVERY "next_step" value MUST reference an ID that actually exists in your steps array.
- Fallback branches (ash_blossom, maxx_c, nibiru) MUST point to a real step ID you define.
  * If a fallback ends the combo immediately: use "next_step": null.
  * If a fallback diverges into a shorter line: define those steps with their own IDs and include them in the steps array.
- NEVER reference a step ID in "next_step" unless that ID appears as "id" somewhere in the steps array.
- The main success path uses IDs 1, 2, 3 ... N. Fallback paths start from N+1 and continue sequentially.

EXAMPLE of correct branching (main path = steps 1-3, Maxx C fallback = steps 4-5):
  Step 1 responses: [{"trigger":"success","next_step":2},{"trigger":"maxx_c","next_step":4}]
  Step 2 responses: [{"trigger":"success","next_step":3}]
  Step 3 responses: [{"trigger":"success","next_step":null}]   <- end of main path
  Step 4 responses: [{"trigger":"success","next_step":5}]
  Step 5 responses: [{"trigger":"success","next_step":null}]   <- end of Maxx C fallback
All five step IDs (1,2,3,4,5) MUST be present in the steps array.

JSON SCHEMA:
{
  "id": "string (unique id, e.g. 'combo-rr-ultimate-falcon-line')",
  "name": "string (descriptive name, max 50 chars)",
  "archetype": "string (primary archetype of this deck)",
  "description": "string (2-3 sentences: what the combo achieves, what cards are used, what the end board does)",
  "requiredCards": ["string (card IDs from opening hand that are essential starters)"],
  "endBoard": {
    "monsters": ["string (card ID of each monster on field at end)"],
    "spellsTraps": ["string (card ID of each set/active spell or trap at end)"],
    "interruptions": [
      "string (specific disruption — card name + exactly what it does, e.g. 'Raidraptor - Ultimate Falcon: unaffected by card effects, reduces all opponent monster ATK to 0 in opponent turn')"
    ],
    "cardRoles": {
      "<card ID from monsters/spellsTraps>": ["negate-monster" | "negate-spell-trap" | "omni-negate" | "board-wipe" | "targeted-removal" | "protection" | "floodgate" | "attacker" | "recovery" | "towers" | "follow-up" | "burn"]
    }
  },
  "steps": [
    {
      "id": 1,
      "action": "string (clear human-readable instruction for this step)",
      "cardId": "string (passcode of the card acting)",
      "responses": [
        { "trigger": "success", "next_step": 2 },
        { "trigger": "maxx_c", "next_step": 4 }
      ],
      "stateMutations": {
        "hand": { "add": [], "remove": ["card_id_used"] },
        "field": { "add": ["card_id_summoned"], "remove": [] },
        "gy": { "add": [], "remove": [] },
        "banished": { "add": [], "remove": [] }
      }
    }
  ],
  "tags": ["going-first" | "going-second" | "otk" | "grind" | "defensive" | "side-in"],
  "efficiency": "optimal" | "sub-optimal" | "brick"
}`;
}

/**
 * Builds a one-shot prompt asking the AI to compile a "deck profile": for every card in the
 * deck (Main, Extra, and Side), its functional role(s) and what it can search from the Deck
 * to the hand. This runs once per deck (result is cached), so the adaptive matcher can work
 * purely offline afterward — the AI is a compiler here, not a runtime dependency.
 */
export function buildDeckProfilePrompt(
  deckList: DeckList,
  cardDetails: Record<string, YGOPROCardDetails> = {}
): string {
  const uniqueSection = (ids: string[]) => ids
    .filter((id, i) => ids.indexOf(id) === i) // unique
    .map(id => formatCardBlock(id, cardDetails[id], true))
    .join('\n');

  const mainSection = uniqueSection(deckList.main);
  const extraSection = deckList.extra.length > 0 ? uniqueSection(deckList.extra) : '  (No extra deck cards)';
  const sideSection = deckList.side.length > 0 ? uniqueSection(deckList.side) : '  (No side deck cards)';

  return `You are a Yu-Gi-Oh! TCG / Master Duel deck analyst. Analyze ALL cards below (Main,
Extra, and Side Deck) and classify each one's functional role(s) for combo-line matching purposes.

═══════════════════════════════════
MAIN DECK (${deckList.main.length} cards) — FULL CARD EFFECTS:
═══════════════════════════════════
${mainSection}

═══════════════════════════════════
EXTRA DECK (${deckList.extra.length} cards) — FULL CARD EFFECTS:
═══════════════════════════════════
${extraSection}

═══════════════════════════════════
SIDE DECK (${deckList.side.length} cards) — FULL CARD EFFECTS:
═══════════════════════════════════
${sideSection}

═══════════════════════════════════
TASK:
═══════════════════════════════════
For EVERY card ID listed above (all three sections), output an entry with:
1. "roles": one or more of this exact taxonomy:
   - "starter": can independently begin a combo from an empty board
   - "extender": continues/extends an existing line but can't start one alone (incl. cards that Special Summon themselves)
   - "searcher": adds a card from the Deck to the hand
   - "hand-trap": opponent's-turn interruption used from hand (e.g. Ash Blossom, Maxx "C", Nibiru)
   - "board-breaker": removes/negates the OPPONENT's established cards (going-second tool, e.g. Lightning Storm, Evenly Matched)
   - "floodgate": continuous restriction on the opponent's actions (e.g. Dimensional Barrier, There Can Be Only One)
   - "removal": spot/mass removal used on your own turn that isn't a dedicated board-breaker
   - "recovery": recycles/recurs resources from GY or banishment, or generates follow-up for later turns
   - "boss": win condition / endgame monster the deck builds toward
   - "garnet": required in the Deck as material/target for another card's effect, but dead when drawn (never intended to be in hand)
   - "utility": useful tech/support that fits none of the above
   - "brick": dead card with no useful effect in a vacuum (and not a garnet — i.e. nothing in the deck wants it in the Deck either)
   A card may have several roles (e.g. a searcher that is also a starter).
   EXTRA DECK cards are never "starter" or "hand-trap" — they are typically "boss", "extender",
   "removal", "floodgate", "recovery", or "utility" depending on what they do once summoned.
2. "searches": ONLY if the card's effect adds another card from the Deck to the hand — list
   the card ID(s) of what it can concretely search. If the effect is conditional/generic (e.g.
   "any Level 4 monster"), list every ID from the Main Deck above that plausibly qualifies. If
   a card cannot search anything, omit "searches" entirely or use an empty array.
   Search targets must be MAIN DECK card IDs (search = Deck → hand).

RULES:
- Only use card IDs that appear in the lists above.
- Base every judgment strictly on the effect text given — do not use general knowledge of the
  card beyond what's printed here.
- Do not invent search targets that aren't actually reachable by the printed effect.

OUTPUT FORMAT:
Respond with ONLY a valid raw JSON object. No markdown, no backticks, no explanation.
{
  "cards": {
    "<card ID>": { "roles": ["starter" | "extender" | "searcher" | "hand-trap" | "board-breaker" | "floodgate" | "removal" | "recovery" | "boss" | "garnet" | "utility" | "brick"], "searches": ["<card ID>", "..."] }
  }
}`;
}

/**
 * Builds a prompt for LLMs to generate MULTIPLE distinct combo routes from a single opening hand
 * in one call — one route per viable starter/line (e.g. "if you open card A", "if you open card B").
 * Each route follows the exact same per-route JSON schema as buildComboPrompt, returned as a JSON array.
 *
 * @param deckList       - The full imported deck list (main/extra/side).
 * @param cardNames      - Resolved card name map (passcode → name). Used as fallback.
 * @param handCards      - Card IDs the player currently has in hand.
 * @param turnPosition   - Whether the player is going first or second.
 * @param cardDetails    - Full card data from YGOPRODECK API (includes effect text, types, stats).
 */
export function buildMultiComboPrompt(
  deckList: DeckList,
  cardNames: Record<string, string>,
  handCards: string[],
  turnPosition: TurnPosition,
  cardDetails: Record<string, YGOPROCardDetails> = {},
  deckProfile?: DeckProfile
): string {
  const { handSection, extraSection, mainSection, mainDeckOthers, sideSection, turnContext, sideDeckStrategy } =
    buildPromptSections(deckList, handCards, turnPosition, cardDetails, deckProfile);
  const roleMapSection = buildDeckRoleMapSection(deckList, cardDetails, deckProfile);

  return `You are an elite-level competitive Yu-Gi-Oh! TCG / Master Duel deck analyst and professional combo architect.
Your job is to analyze this single opening hand and generate EVERY distinct, viable combo route it supports —
not just one line. Different routes should use different starters, different Extra Deck payoffs, or fundamentally
different sequencing — not trivial rewordings of the same line.

═══════════════════════════════════════════════════════
MISSION CRITICAL REQUIREMENTS (READ BEFORE ALL ELSE):
═══════════════════════════════════════════════════════
1. READ EVERY CARD EFFECT below before generating anything. Do not rely on general knowledge — base all reasoning on the exact effect text provided.
2. IDENTIFY EVERY VIABLE STARTER in the hand. For each one, produce a separate, complete combo route that uses it as the entry point.
3. AT LEAST 1 ROUTE, UP TO 4. If the hand only supports one real line, return an array with exactly 1 route — do not pad with redundant near-duplicates.
4. WITHIN EACH ROUTE, USE HAND CARDS HONESTLY. Use every card whose inclusion is legal and useful — but do not force in a card via an illegal or nonsensical play just to avoid "wasting" it. It is correct for a route to hold a card back if it has no legal use for it.
5. END BOARD MUST BE FULLY CRAFTED for each route. Specify every monster and spell/trap on the field at the end, and EXACTLY what interruption each one provides (negate type, destruction, banish, etc).
6. INTERRUPTIONS MUST BE SPECIFIC AND REAL. Not "1 negate" — write "Raidraptor - Ultimate Falcon (unaffected by opponent's card effects, reduces all opponent monster ATK to 0 during opponent's turn)". Never invent a negate the resulting board doesn't actually have.
7. BRANCHING FOR HAND TRAPS. Within each route, provide fallback branches for Ash Blossom, Maxx "C", Nibiru, and Impermanence on every key Special Summon.
8. CHAIN THROUGH THE DECK. Deep combos route through cards searched or Special Summoned FROM THE DECK, not just the opening hand — after each search/summon, immediately consider what that new card enables, and keep extending each line until its board can no longer legally grow.

${RULES_ENFORCEMENT}
(Rules enforcement applies independently to EVERY route in the array — a route that's illegal on its own is invalid even if other routes in the array are fine.)

════════════════════════════════════════
TURN POSITION & STRATEGIC OBJECTIVE:
════════════════════════════════════════
${turnContext}

════════════════════════════════════════
${sideDeckStrategy}
════════════════════════════════════════

════════════════════════════
OPENING HAND (${handCards.length} cards) — FULL CARD EFFECTS:
════════════════════════════
${handSection}

════════════════════════════
EXTRA DECK (${deckList.extra.length} cards) — FULL CARD EFFECTS (plan your end board from these):
════════════════════════════
${extraSection}

════════════════════════════
MAIN DECK (${mainDeckOthers.length} remaining cards — not in hand):
════════════════════════════
${mainSection}
${roleMapSection}
════════════════════════════
SIDE DECK (${deckList.side.length} cards) — for game 2/3 analysis:
════════════════════════════
${sideSection}

═══════════════════════════════════
STRICT DESIGN RULES (apply to EVERY route in the array):
═══════════════════════════════════
1. NO HALLUCINATION: Only use card IDs that appear in the deck lists above.
2. NON-DECK CARDS: For tokens, set cardId to "TOKEN". For opponent's cards (e.g. Nibiru), use "OPPONENT". For generic actions, use "NONE".
3. BRANCHING: Every step that involves a Special Summon MUST have response branches: "success", "ash_blossom" (or "imperm_veiler"), "nibiru" (after 5th summon), "maxx_c", and "generic_negate" where applicable.
4. MAXX "C" EMERGENCY LINE: If going first, provide a fallback path triggered by "maxx_c" on the first Special Summon that establishes at least 1 disruption while minimizing further special summons.
5. STATE MUTATIONS: For every step, track hand/field/GY/banished changes in stateMutations. Accuracy is required.
6. STEP IDs: Within EACH route, step IDs must be unique 1-indexed integers local to that route (every route restarts numbering at 1). No broken pointers. Last step in each branch must have next_step: null.
7. ALL REQUIRED CARDS: Each route's "requiredCards" array must list ONLY the card IDs from the opening hand that are essential starters for THAT route.
8. DISTINCT IDs ACROSS ROUTES: Each route's top-level "id" string must be unique across the array (e.g. "combo-a-starter-line", "combo-b-starter-line").
9. EFFICIENCY RATING: Set each route's "efficiency" to "optimal" if its end board is the strongest that starter can honestly produce with multiple real interruptions, "sub-optimal" if the line works but the board is below the deck's potential, or "brick" if it produces no meaningful board.
10. TACTICAL ROLES: For every card ID listed in a route's endBoard.monsters or endBoard.spellsTraps, assign it 1+ tactical role(s) in endBoard.cardRoles using ONLY this exact taxonomy: ${TACTICAL_ROLE_TAXONOMY}.

${TACTICAL_ROLE_DEFINITIONS}

═══════════════════════════════════
OUTPUT FORMAT:
═══════════════════════════════════
Respond with ONLY a valid raw JSON ARRAY of route objects. No markdown, no backticks, no explanation.
Each element of the array MUST follow the exact schema below (identical to a single combo route).

CRITICAL STEP ID RULES — VIOLATING THESE MAKES THE OUTPUT INVALID:
- Within each route, all step IDs MUST be sequential integers: 1, 2, 3, 4 ... up to N.
- EVERY "next_step" value MUST reference an ID that actually exists in that route's steps array.
- Fallback branches (ash_blossom, maxx_c, nibiru) MUST point to a real step ID you define.
  * If a fallback ends the combo immediately: use "next_step": null.
  * If a fallback diverges into a shorter line: define those steps with their own IDs and include them in the steps array.
- NEVER reference a step ID in "next_step" unless that ID appears as "id" somewhere in that route's steps array.
- The main success path uses IDs 1, 2, 3 ... N. Fallback paths start from N+1 and continue sequentially.

JSON SCHEMA (array of these):
[
  {
    "id": "string (unique id across the array, e.g. 'combo-rr-ultimate-falcon-line')",
    "name": "string (descriptive name, max 50 chars)",
    "archetype": "string (primary archetype of this deck)",
    "description": "string (2-3 sentences: what the combo achieves, what cards are used, what the end board does)",
    "requiredCards": ["string (card IDs from opening hand that are essential starters for this route)"],
    "endBoard": {
      "monsters": ["string (card ID of each monster on field at end)"],
      "spellsTraps": ["string (card ID of each set/active spell or trap at end)"],
      "interruptions": [
        "string (specific disruption — card name + exactly what it does, e.g. 'Raidraptor - Ultimate Falcon: unaffected by card effects, reduces all opponent monster ATK to 0 in opponent turn')"
      ],
      "cardRoles": {
        "<card ID from monsters/spellsTraps>": ["negate-monster" | "negate-spell-trap" | "omni-negate" | "board-wipe" | "targeted-removal" | "protection" | "floodgate" | "attacker" | "recovery" | "towers" | "follow-up" | "burn"]
      }
    },
    "steps": [
      {
        "id": 1,
        "action": "string (clear human-readable instruction for this step)",
        "cardId": "string (passcode of the card acting)",
        "responses": [
          { "trigger": "success", "next_step": 2 },
          { "trigger": "maxx_c", "next_step": 4 }
        ],
        "stateMutations": {
          "hand": { "add": [], "remove": ["card_id_used"] },
          "field": { "add": ["card_id_summoned"], "remove": [] },
          "gy": { "add": [], "remove": [] },
          "banished": { "add": [], "remove": [] }
        }
      }
    ],
    "tags": ["going-first" | "going-second" | "otk" | "grind" | "defensive" | "side-in"],
    "efficiency": "optimal" | "sub-optimal" | "brick"
  }
]`;
}

