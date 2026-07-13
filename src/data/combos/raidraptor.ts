import { ComboRoute } from '../../types';

export const RAIDRAPTOR_COMBOS: ComboRoute[] = [
  {
    id: 'rr-force-strix-turbo',
    name: 'Force Strix Turbo → Rising Rebellion',
    archetype: 'Raidraptor',
    description: 'A board-breaking line for when your opponent already has a field (going second, or as a follow-up once they commit to the board): Force Strix into Brave Strix into Rising Rebellion Falcon, whose on-summon effect wipes everything your opponent controls.',
    // Only cards that must actually START in hand — Tribute Lanius and Soul Shave Force are
    // fetched mid-combo (Force Strix's search, Brave Strix's search) and don't belong here.
    // Force Strix/Brave Strix/Rising Rebellion Falcon are Extra Deck monsters and can never be
    // drawn into a hand at all.
    requiredCards: [
      '53251824', // Vanishing Lanius
      '31314549', // Singing Lanius
      '96345188'  // Mimicry Lanius (discarded in step 5 to activate Tribute Lanius's effect)
    ],
    tags: ['going-second', 'otk', 'boss-monster'],
    endBoard: {
      monsters: ['59822133'], // Rising Rebellion Falcon
      spellsTraps: [],
      interruptions: ['Rising Rebellion Falcon: on-Summon effect destroys every card your opponent controls (whiffs if they control nothing — only run this line once they have a board)']
    },
    steps: [
      {
        id: 1,
        action: 'Normal Summon "Raidraptor - Vanishing Lanius"',
        cardId: '53251824',
        responses: [
          { trigger: 'success', next_step: 2 }
        ],
        stateMutations: {
          hand: { add: [], remove: ['53251824'] },
          field: { add: ['53251824'], remove: [] },
          gy: { add: [], remove: [] },
          banished: { add: [], remove: [] }
        }
      },
      {
        id: 2,
        action: 'Special Summon "Raidraptor - Singing Lanius" from your hand',
        cardId: '31314549',
        responses: [
          { trigger: 'success', next_step: 3 },
          { trigger: 'maxx_c', next_step: 10 },
          { trigger: 'generic_negate', next_step: 10 }
        ],
        stateMutations: {
          hand: { add: [], remove: ['31314549'] },
          field: { add: ['31314549'], remove: [] },
          gy: { add: [], remove: [] },
          banished: { add: [], remove: [] }
        }
      },
      {
        id: 3,
        action: 'Overlay "Raidraptor - Vanishing Lanius" + "Raidraptor - Singing Lanius" to Xyz Summon "Raidraptor - Force Strix"',
        cardId: '73347079',
        responses: [
          { trigger: 'success', next_step: 4 },
          { trigger: 'imperm_veiler', next_step: 10 }
        ],
        stateMutations: {
          hand: { add: [], remove: [] },
          field: { add: ['73347079'], remove: ['53251824', '31314549'] },
          gy: { add: [], remove: [] },
          banished: { add: [], remove: [] }
        }
      },
      {
        id: 4,
        action: 'Activate Force Strix effect: detach 1 Xyz Material to add "Raidraptor - Tribute Lanius" to your hand',
        cardId: '73347079',
        responses: [
          { trigger: 'success', next_step: 5 },
          { trigger: 'ash_blossom', next_step: 11 },
          { trigger: 'imperm_veiler', next_step: 11 }
        ],
        stateMutations: {
          hand: { add: ['83236601'], remove: [] },
          field: { add: [], remove: [] },
          gy: { add: [], remove: [] },
          banished: { add: [], remove: [] }
        }
      },
      {
        id: 5,
        action: 'Special Summon "Raidraptor - Tribute Lanius" from your hand via its own effect, then send "Raidraptor - Mimicry Lanius" from your hand to the GY to activate its effect',
        cardId: '83236601',
        responses: [
          { trigger: 'success', next_step: 6 },
          { trigger: 'ash_blossom', next_step: 11 }
        ],
        stateMutations: {
          hand: { add: [], remove: ['83236601', '96345188'] },
          field: { add: ['83236601'], remove: [] },
          gy: { add: ['96345188'], remove: [] },
          banished: { add: [], remove: [] }
        }
      },
      {
        id: 6,
        action: 'Special Summon "Raidraptor - Brave Strix" using "Raidraptor - Force Strix" you control as material (its own summoning condition — no Rank-Up-Magic needed)',
        cardId: '08617563',
        responses: [
          { trigger: 'success', next_step: 7 },
          { trigger: 'nibiru', next_step: 12 }
        ],
        stateMutations: {
          hand: { add: [], remove: [] },
          field: { add: ['08617563'], remove: ['73347079'] },
          gy: { add: [], remove: [] },
          banished: { add: [], remove: [] }
        }
      },
      {
        id: 7,
        action: 'Activate Brave Strix effect: add "Rank-Up-Magic Soul Shave Force" from your Deck to your hand',
        cardId: '08617563',
        responses: [
          { trigger: 'success', next_step: 8 },
          { trigger: 'ash_blossom', next_step: 12 },
          { trigger: 'imperm_veiler', next_step: 12 }
        ],
        stateMutations: {
          hand: { add: ['23581825'], remove: [] },
          field: { add: [], remove: [] },
          gy: { add: [], remove: [] },
          banished: { add: [], remove: [] }
        }
      },
      {
        id: 8,
        action: 'Activate "Rank-Up-Magic Soul Shave Force" targeting "Raidraptor - Brave Strix" you control: banish it, then Xyz Summon "Raidraptor - Rising Rebellion Falcon" from the Extra Deck using it as material',
        cardId: '59822133',
        responses: [
          { trigger: 'success', next_step: 9 }
        ],
        stateMutations: {
          hand: { add: [], remove: ['23581825'] },
          field: { add: ['59822133'], remove: ['08617563'] },
          gy: { add: ['23581825'], remove: [] },
          banished: { add: ['08617563'], remove: [] }
        }
      },
      {
        id: 9,
        action: 'Activate Rising Rebellion Falcon\'s on-Summon effect to destroy every card your opponent controls. COMBO COMPLETE!',
        cardId: '59822133',
        responses: [
          { trigger: 'success', next_step: null }
        ],
        stateMutations: {
          hand: { add: [], remove: [] },
          field: { add: [], remove: [] },
          gy: { add: [], remove: [] },
          banished: { add: [], remove: [] }
        }
      },
      // Fallback Lines
      {
        id: 10,
        action: 'Fallback Play: Overlay your remaining Rank 4 Raidraptor Xyz Monster into "Abyss Dweller" for graveyard disruption, set backrow and pass.',
        cardId: '21044178',
        responses: [
          { trigger: 'success', next_step: null }
        ],
        stateMutations: {
          hand: { add: [], remove: [] },
          field: { add: ['21044178'], remove: [] },
          gy: { add: [], remove: [] },
          banished: { add: [], remove: [] }
        }
      },
      {
        id: 11,
        action: 'Defensive Play: Set remaining spells/traps, pass turn and prepare to grind next turn.',
        cardId: '08559793',
        responses: [
          { trigger: 'success', next_step: null }
        ],
        stateMutations: {
          hand: { add: [], remove: ['08559793'] },
          field: { add: ['08559793'], remove: [] },
          gy: { add: [], remove: [] },
          banished: { add: [], remove: [] }
        }
      },
      {
        id: 12,
        action: 'Zeus Line: In Main Phase 1 (no Battle Phase needed), overlay "Raidraptor - Brave Strix" to Xyz Summon "Divine Arsenal AA-ZEUS - Sky Thunder" as your end board.',
        cardId: '90448279',
        responses: [
          { trigger: 'success', next_step: null }
        ],
        stateMutations: {
          hand: { add: [], remove: [] },
          field: { add: ['90448279'], remove: ['08617563'] },
          gy: { add: [], remove: [] },
          banished: { add: [], remove: [] }
        }
      }
    ]
  },
  {
    id: 'rr-wise-strix-grind',
    name: 'Wise Strix → Arsenal Falcon Grind',
    archetype: 'Raidraptor',
    description: 'A grindy alternative line focusing on Link-2 Wise Strix to set Rank-Up Spells directly from the deck.',
    requiredCards: [
      '53251824', // Vanishing Lanius
      '87321742', // Strangle Lanius
      '36429703', // Wise Strix
      '96157835', // Arsenal Falcon
      '43047672', // Final Fortress Falcon
      '26973555'  // Utopic Draco Future
    ],
    tags: ['grind', 'going-first'],
    endBoard: {
      monsters: ['43047672'], // Final Fortress Falcon
      spellsTraps: [],
      interruptions: ['Unaffected Boss Monster']
    },
    steps: [
      {
        id: 1,
        action: 'Normal Summon "Raidraptor - Vanishing Lanius", Special Summon "Raidraptor - Strangle Lanius"',
        cardId: '53251824',
        responses: [
          { trigger: 'success', next_step: 2 }
        ],
        stateMutations: {
          hand: { add: [], remove: ['53251824', '87321742'] },
          field: { add: ['53251824', '87321742'], remove: [] },
          gy: { add: [], remove: [] },
          banished: { add: [], remove: [] }
        }
      },
      {
        id: 2,
        action: 'Link Summon "Raidraptor - Wise Strix" using Vanishing and Strangle as materials',
        cardId: '36429703',
        responses: [
          { trigger: 'success', next_step: 3 },
          { trigger: 'nibiru', next_step: 7 }
        ],
        stateMutations: {
          hand: { add: [], remove: [] },
          field: { add: ['36429703'], remove: ['53251824', '87321742'] },
          gy: { add: [], remove: [] },
          banished: { add: [], remove: [] }
        }
      },
      {
        id: 3,
        action: 'Activate Wise Strix effect: Special Summon a Level 4 "Raidraptor" monster from your Deck',
        cardId: '36429703',
        responses: [
          { trigger: 'success', next_step: 4 },
          { trigger: 'ash_blossom', next_step: 8 }
        ]
      },
      {
        id: 4,
        action: 'Xyz Summon "Raidraptor - Arsenal Falcon" using that monster (+ another Level 4 on field) as material, then detach 1 material to Special Summon a Raidraptor from your Deck',
        cardId: '96157835',
        responses: [
          { trigger: 'success', next_step: 5 },
          { trigger: 'ash_blossom', next_step: 8 }
        ],
        stateMutations: {
          hand: { add: [], remove: [] },
          field: { add: ['96157835'], remove: [] },
          gy: { add: [], remove: [] },
          banished: { add: [], remove: [] }
        }
      },
      {
        id: 5,
        action: 'Activate Wise Strix\'s 2nd effect: Set "Rank-Up-Magic Soul Shave Force" directly from your Deck',
        cardId: '36429703',
        responses: [
          { trigger: 'success', next_step: 6 }
        ],
        stateMutations: {
          hand: { add: [], remove: [] },
          field: { add: ['23581825'], remove: [] },
          gy: { add: [], remove: [] },
          banished: { add: [], remove: [] }
        }
      },
      {
        id: 6,
        action: 'Activate "Rank-Up-Magic Soul Shave Force" targeting "Raidraptor - Arsenal Falcon": banish it, then Xyz Summon "Raidraptor - Final Fortress Falcon" using it as material. COMBO COMPLETE!',
        cardId: '43047672',
        responses: [
          { trigger: 'success', next_step: null }
        ],
        stateMutations: {
          hand: { add: [], remove: [] },
          field: { add: ['43047672'], remove: ['96157835', '23581825'] },
          gy: { add: ['23581825'], remove: [] },
          banished: { add: ['96157835'], remove: [] }
        }
      },
      {
        id: 7,
        action: 'Fallback: Use your remaining material/monster to Special Summon "Number F0: Utopic Draco Future" for monster negates.',
        cardId: '26973555',
        responses: [
          { trigger: 'success', next_step: null }
        ],
        stateMutations: {
          hand: { add: [], remove: [] },
          field: { add: ['26973555'], remove: [] },
          gy: { add: [], remove: [] },
          banished: { add: [], remove: [] }
        }
      },
      {
        id: 8,
        action: 'Defensive Play: Set "Raidraptor - Nest", pass turn and conserve resources for next turn.',
        cardId: '08559793',
        responses: [
          { trigger: 'success', next_step: null }
        ],
        stateMutations: {
          hand: { add: [], remove: ['08559793'] },
          field: { add: ['08559793'], remove: [] },
          gy: { add: [], remove: [] },
          banished: { add: [], remove: [] }
        }
      }
    ]
  }
];
