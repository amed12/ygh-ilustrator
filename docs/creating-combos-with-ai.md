# Creating Combos/Playbooks with an External AI Chat

This app has a built-in AI solver (Settings → AI Mode), but you can also ask **any external
AI chat** (ChatGPT, Claude.ai, Gemini, etc.) to write a combo for you, save its answer as a
`.json` file, and import it here. This is useful when you want to use a specific model, review
the line yourself before importing, or write/tweak the JSON by hand.

This guide covers:
1. [How import actually works](#how-import-works)
2. [The exact file format the app accepts](#file-format)
3. [A copy-paste prompt template for the external AI](#prompt-template)
4. [Full working examples](#working-examples) (already tested against this app's real parser)
5. [Field reference](#field-reference)
6. [Common mistakes / troubleshooting](#common-mistakes)

---

## How import works

In the app: open a deck → **Playbook Configuration** panel (right sidebar) → **Import** →
choose a `.json` file.

- You can select **one file that contains one combo**, or **one file that contains many
  combos at once** (a "Playbook") — both formats are described below, and both can be
  selected together (multi-select is supported).
- Importing does **not** replace your existing combos — new ones are added alongside what
  you already have (duplicate `id`s are deduplicated, keeping the newest).
- Once imported, a combo shows up in "Available Combos" like any other and can be practiced,
  exported again, or shared via link.

There are two independent checks the app runs, and they matter for what you send an AI:

| When | Check | What it verifies |
|---|---|---|
| **On file import** (what this guide is about) | Structural only | `id`/`name`/`archetype`/`steps`/`requiredCards` exist with the right types. It does **not** check that card IDs actually exist in your deck, doesn't require an `endBoard`, and doesn't detect infinite loops. |
| **On in-app AI generation** (Settings → AI Mode) | Strict | Same as above, **plus**: every `cardId` must exist in your imported deck, `endBoard` is required with a real interruption description (≥15 characters), and broken/circular step pointers are rejected or auto-repaired. |

**Practical implication:** because file import is lenient, the app will happily import a
combo with a typo'd card ID or a vague end board — it just won't error. Use the prompt
template below and the checklist at the end so what you import is actually *good*, not just
*accepted*.

---

## File format

There are two accepted shapes. Both are plain JSON, `version` must be exactly `"1.0"`.

### Single combo (`ComboExportFile`)

```jsonc
{
  "version": "1.0",
  "exportedAt": "2026-07-13T00:00:00.000Z",   // any ISO date string; informational only
  "route": {
    /* ... one combo route, see schema below ... */
  },
  "handContext": {                             // optional
    "handCardIds": ["53251824", "31314549"],
    "turnPosition": "going-first",             // "going-first" | "going-second"
    "generatedAt": "2026-07-13T00:00:00.000Z"
  }
}
```

### Playbook — many combos in one file (`PlaybookExportFile`)

```jsonc
{
  "version": "1.0",
  "exportedAt": "2026-07-13T00:00:00.000Z",
  "routes": [
    /* ... array of combo routes, same schema as above ... */
  ],
  "handContexts": {                            // optional
    "<route-id>": { "handCardIds": [...], "turnPosition": "going-first", "generatedAt": "..." }
  }
}
```

### The combo route schema (used inside `route` or each entry of `routes`)

```jsonc
{
  "id": "combo-my-example",          // unique string, no spaces needed but keep it URL-safe
  "name": "Short readable name",     // shown as the combo title in the UI
  "archetype": "Raidraptor",         // free text, shown as a subtitle
  "description": "1-3 sentences describing what this line does and why.",
  "requiredCards": ["53251824", "31314549"],
  // ^ ONLY the Main Deck card IDs that must already be in your OPENING HAND for this combo
  //   to start. Do NOT list cards that get searched/drawn mid-combo, and NEVER list Extra
  //   Deck or Side Deck cards here — they can never be in a hand, so the combo would never
  //   be suggested to you.
  "tags": ["going-first"],           // free-form labels shown as badges: e.g. "going-first",
                                      // "going-second", "otk", "grind", "defensive", "boss-monster"
  "endBoard": {                      // optional but strongly recommended
    "monsters": ["73347079"],        // card IDs left on your field/Extra Monster Zone at the end
    "spellsTraps": [],               // card IDs of set/active spells or traps at the end
    "interruptions": [
      "Card Name: exactly what it negates/prevents — be specific, not \"1 negate\""
    ]
  },
  "steps": [
    {
      "id": 1,                       // integer, unique WITHIN this route, start at 1
      "action": "Normal Summon \"Card Name\"",   // human-readable instruction shown to the player
      "cardId": "53251824",          // the card performing this action (see reserved values below)
      "responses": [
        { "trigger": "success", "next_step": 2 },
        { "trigger": "maxx_c", "next_step": 4 }
      ],
      "stateMutations": {            // optional but recommended — powers the "Hand -1/Field +1" badges
        "hand":     { "add": [], "remove": ["53251824"] },
        "field":    { "add": ["53251824"], "remove": [] },
        "gy":       { "add": [], "remove": [] },
        "banished": { "add": [], "remove": [] }
      }
    }
  ]
}
```

**`cardId` reserved values** (use these instead of a real passcode when a step isn't about a
specific card of yours):
- `"TOKEN"` — a Token is being made
- `"OPPONENT"` — the opponent's card is what's relevant to this step (e.g. a hand trap they used)
- `"NONE"` — a generic action with no specific card (e.g. "pass turn", "set backrow")

**`responses[].trigger` values** the UI specially recognizes (any other string still works,
it just renders in a generic style):
- `"success"` — the play resolved as planned
- `"ash_blossom"` — opponent used Ash Blossom & Joyous Spring
- `"maxx_c"` — opponent used Maxx "C"
- `"nibiru"` — opponent used Nibiru, the Primal Being
- `"imperm_veiler"` — opponent used Effect Veiler / Infinite Impermanence
- `"generic_negate"` — any other negation not covered above

**`next_step`**: either the `id` of another step in the **same** `steps` array, or `null` to
end that branch. Every step needs at least a `"success"` response unless it's a true
dead-end.

---

## Prompt template

Copy this, fill in the placeholders, and paste it into ChatGPT / Claude / Gemini / etc.

````text
You are a Yu-Gi-Oh! combo line writer. Output ONLY a raw JSON object matching the exact
schema below — no markdown, no code fences, no explanation before or after.

MY DECK:
Main Deck: {{PASTE MAIN DECK CARD NAMES + PASSCODES, ONE PER LINE}}
Extra Deck: {{PASTE EXTRA DECK CARD NAMES + PASSCODES}}
Side Deck: {{PASTE SIDE DECK CARD NAMES + PASSCODES, OR "none"}}

MY OPENING HAND (or "any hand that opens this deck" if you want a general line):
{{LIST THE CARDS IN HAND, OR DESCRIBE THE STARTER(S) YOU WANT THE LINE TO USE}}

TURN POSITION: {{going-first OR going-second}}

RULES YOU MUST FOLLOW:
1. Only reference card passcodes I actually listed above. Do not invent cards or passcodes.
2. Respect real Yu-Gi-Oh rules: only ONE Normal Summon per turn (unless a card explicitly
   grants another), respect each card's own once-per-turn restriction, Xyz/Link materials
   are NOT "in the GY" until actually detached/sent there, and (if going first) there is no
   Battle Phase.
3. requiredCards must list ONLY the Main Deck cards that must already be in the opening hand
   — never Extra/Side Deck cards, and never cards that get searched mid-combo.
4. Every step needing a "success" response must also have realistic fallback branches for
   ash_blossom / maxx_c / nibiru / imperm_veiler / generic_negate where a hand trap could
   plausibly interrupt that specific Special Summon.
5. endBoard.interruptions must describe REAL effects on the cards in your final endBoard —
   name the card and say exactly what it negates/prevents. Do not invent negates the board
   doesn't have.
6. Step "id" values must be unique integers starting at 1, sequential. Every "next_step"
   must point to a real step id in the same route, or null to end that branch.
7. Use double quotes for card names inside "action" strings (e.g. Normal Summon "Card Name").

OUTPUT SCHEMA (single combo):
{
  "version": "1.0",
  "exportedAt": "{{today's ISO date}}",
  "route": {
    "id": "string, unique",
    "name": "string, max ~50 chars",
    "archetype": "string",
    "description": "string, 2-3 sentences",
    "requiredCards": ["passcode", "..."],
    "tags": ["going-first" | "going-second" | "otk" | "grind" | "defensive" | "boss-monster"],
    "endBoard": {
      "monsters": ["passcode", "..."],
      "spellsTraps": ["passcode", "..."],
      "interruptions": ["Card Name: specific effect description, 15+ characters"]
    },
    "steps": [
      {
        "id": 1,
        "action": "string",
        "cardId": "passcode, or TOKEN/OPPONENT/NONE",
        "responses": [
          { "trigger": "success", "next_step": 2 },
          { "trigger": "maxx_c", "next_step": null }
        ],
        "stateMutations": {
          "hand": { "add": [], "remove": [] },
          "field": { "add": [], "remove": [] },
          "gy": { "add": [], "remove": [] },
          "banished": { "add": [], "remove": [] }
        }
      }
    ]
  }
}

If you can generate MORE THAN ONE viable line from this hand/deck, instead output a
"playbook" with the same route objects inside a top-level "routes" array instead of
"route" — ask me first if you're not sure whether I want one line or several.
````

If you want several distinct lines in one go, tell the AI: *"Output a playbook instead —
put multiple route objects in a top-level `routes` array."* (see the Playbook shape above).

---

## Working examples

These two files are verified to import successfully in this app (tested directly against
the app's parser, not just hand-written).

<details>
<summary><code>example-single-combo.json</code></summary>

```json
{
  "version": "1.0",
  "exportedAt": "2026-07-13T00:00:00.000Z",
  "route": {
    "id": "combo-external-ai-example",
    "name": "Vanishing Lanius Opening",
    "archetype": "Raidraptor",
    "description": "Basic Force Strix line starting from Vanishing Lanius and Singing Lanius, ending with Force Strix on board.",
    "requiredCards": ["53251824", "31314549"],
    "tags": ["going-first"],
    "endBoard": {
      "monsters": ["73347079"],
      "spellsTraps": [],
      "interruptions": ["Raidraptor - Force Strix: detach material to add a Raidraptor monster from your Deck to your hand, refilling resources for next turn"]
    },
    "steps": [
      {
        "id": 1,
        "action": "Normal Summon \"Raidraptor - Vanishing Lanius\"",
        "cardId": "53251824",
        "responses": [
          { "trigger": "success", "next_step": 2 }
        ],
        "stateMutations": {
          "hand": { "add": [], "remove": ["53251824"] },
          "field": { "add": ["53251824"], "remove": [] },
          "gy": { "add": [], "remove": [] },
          "banished": { "add": [], "remove": [] }
        }
      },
      {
        "id": 2,
        "action": "Special Summon \"Raidraptor - Singing Lanius\" from your hand",
        "cardId": "31314549",
        "responses": [
          { "trigger": "success", "next_step": 3 },
          { "trigger": "maxx_c", "next_step": 4 },
          { "trigger": "generic_negate", "next_step": 4 }
        ],
        "stateMutations": {
          "hand": { "add": [], "remove": ["31314549"] },
          "field": { "add": ["31314549"], "remove": [] },
          "gy": { "add": [], "remove": [] },
          "banished": { "add": [], "remove": [] }
        }
      },
      {
        "id": 3,
        "action": "Overlay \"Raidraptor - Vanishing Lanius\" + \"Raidraptor - Singing Lanius\" to Xyz Summon \"Raidraptor - Force Strix\". COMBO COMPLETE!",
        "cardId": "73347079",
        "responses": [
          { "trigger": "success", "next_step": null }
        ],
        "stateMutations": {
          "hand": { "add": [], "remove": [] },
          "field": { "add": ["73347079"], "remove": ["53251824", "31314549"] },
          "gy": { "add": [], "remove": [] },
          "banished": { "add": [], "remove": [] }
        }
      },
      {
        "id": 4,
        "action": "Fallback: Set remaining spells/traps and pass the turn with only Vanishing Lanius on board.",
        "cardId": "NONE",
        "responses": [
          { "trigger": "success", "next_step": null }
        ]
      }
    ]
  }
}
```
</details>

<details>
<summary><code>example-playbook.json</code> (two combos + one hand context, in a single file)</summary>

```json
{
  "version": "1.0",
  "exportedAt": "2026-07-13T00:00:00.000Z",
  "routes": [
    {
      "id": "combo-external-ai-example",
      "name": "Vanishing Lanius Opening",
      "archetype": "Raidraptor",
      "description": "Basic Force Strix line.",
      "requiredCards": ["53251824", "31314549"],
      "tags": ["going-first"],
      "endBoard": {
        "monsters": ["73347079"],
        "spellsTraps": [],
        "interruptions": ["Raidraptor - Force Strix: detach material to add a Raidraptor monster from your Deck to your hand"]
      },
      "steps": [
        { "id": 1, "action": "Normal Summon \"Raidraptor - Vanishing Lanius\"", "cardId": "53251824", "responses": [{ "trigger": "success", "next_step": 2 }] },
        { "id": 2, "action": "Overlay into \"Raidraptor - Force Strix\". COMBO COMPLETE!", "cardId": "73347079", "responses": [{ "trigger": "success", "next_step": null }] }
      ]
    },
    {
      "id": "combo-external-ai-example-2",
      "name": "Second Route Example",
      "archetype": "Raidraptor",
      "description": "A second, independent combo in the same playbook file.",
      "requiredCards": ["87321742"],
      "tags": ["grind"],
      "steps": [
        { "id": 1, "action": "Special Summon \"Raidraptor - Strangle Lanius\" from your hand", "cardId": "87321742", "responses": [{ "trigger": "success", "next_step": null }] }
      ]
    }
  ],
  "handContexts": {
    "combo-external-ai-example": {
      "handCardIds": ["53251824", "31314549"],
      "turnPosition": "going-first",
      "generatedAt": "2026-07-13T00:00:00.000Z"
    }
  }
}
```
</details>

---

## Field reference

| Field | Required | Type | Notes |
|---|---|---|---|
| `version` | ✅ | `"1.0"` | Must be exactly this string. |
| `route` (single) / `routes` (playbook) | ✅ | object / array | Pick one shape per file. |
| `route.id` | ✅ | string, non-empty | Must be unique among your combos — importing a duplicate `id` overwrites the older one. |
| `route.name` | ✅ | string, non-empty | Shown as the combo title. |
| `route.archetype` | ✅ | string, non-empty | Shown as a subtitle. |
| `route.description` | recommended | string | Shown under the title in the combo list. |
| `route.requiredCards` | ✅ | string[] | Main Deck passcodes only — this is what the app matches against a drawn hand. |
| `route.tags` | recommended | string[] | Free-form badges. |
| `route.endBoard` | recommended | object | Not required by file import, but the combo will look incomplete without it. |
| `route.steps` | ✅ | array, non-empty | See step schema above. |
| `step.id` | ✅ | integer | Unique per route, doesn't need to start at 1 but 1-indexed sequential is clearest. |
| `step.action` | ✅ | string, non-empty | Shown as the instruction text during practice. |
| `step.cardId` | ✅ | string | A real passcode, or `TOKEN`/`OPPONENT`/`NONE`. |
| `step.responses` | recommended | array | Omit only for a true dead-end step. |
| `step.stateMutations` | optional | object | Powers the Hand/Field/GY/Banished count badges — nice to have, not required. |

---

## Common mistakes

- **Extra/Side Deck cards in `requiredCards`.** These can never be in an opening hand, so
  the combo will never appear as playable for any hand you select. Only list Main Deck
  starters.
- **`next_step` pointing to a step ID that doesn't exist.** The app will silently treat that
  branch as ending there instead of erroring — check your IDs carefully instead of relying
  on this.
- **Wrapping the JSON in markdown code fences or adding commentary.** Some AI chats add
  ` ```json ` fences or a sentence before/after the JSON — strip those before saving the
  file; the file must be pure JSON.
- **Vague `endBoard.interruptions`** like `"1 negate"`. The app's file import won't reject
  this, but it's not useful to you — always name the card and the exact effect.
- **Reusing the same `route.id` across unrelated combos.** Re-importing a file with an `id`
  you already have replaces the older combo of that name.
