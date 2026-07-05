import { ComboRoute } from '../../types';

export const RAIDRAPTOR_COMBOS: ComboRoute[] = [
  {
    id: 'rr-force-strix-turbo',
    name: 'Force Strix Turbo → Rising Rebellion',
    archetype: 'Raidraptor',
    description: 'The main offensive line using Force Strix and Brave Strix to summon the Rank 13 Rising Rebellion Falcon.',
    requiredCards: [
      '53251824', // Vanishing Lanius
      '31314549', // Singing Lanius
      '83236601', // Tribute Lanius
      '96345188', // Mimicry Lanius
      '23581825', // Soul Shave Force
      '73347079', // Force Strix
      '08617563', // Brave Strix
      '59822133'  // Rising Rebellion Falcon
    ],
    tags: ['going-first', 'boss-monster'],
    steps: [
      {
        id: 1,
        action: 'Normal Summon "Raidraptor - Vanishing Lanius"',
        cardId: '53251824',
        next_success: 2,
        next_negated: null // No recovery if normal summon fails immediately (pass turn)
      },
      {
        id: 2,
        action: 'Special Summon "Raidraptor - Singing Lanius" from your hand',
        cardId: '31314549',
        next_success: 3,
        next_negated: 10 // Negated? Pivot to Abyss Dweller fallback
      },
      {
        id: 3,
        action: 'Overlay Vanishing + Singing to Xyz Summon "Raidraptor - Force Strix"',
        cardId: '73347079',
        next_success: 4,
        next_negated: 10 // Negated? Overlay into Abyss Dweller line
      },
      {
        id: 4,
        action: 'Activate Force Strix effect: Detach material to search "Raidraptor - Tribute Lanius"',
        cardId: '73347079',
        next_success: 5,
        next_negated: 11 // Handtrapped/Negated? Set backrow & Pass
      },
      {
        id: 5,
        action: 'Normal/Special Summon "Raidraptor - Tribute Lanius", activate effect to send "Raidraptor - Mimicry Lanius" to GY',
        cardId: '83236601',
        next_success: 6,
        next_negated: 11 // Negated? Set & Pass
      },
      {
        id: 6,
        action: 'Xyz Rank-Up: Overlay "Raidraptor - Force Strix" to Summon "Raidraptor - Brave Strix"',
        cardId: '08617563',
        next_success: 7,
        next_negated: 12 // Negated? Try to pivot into Zeus line
      },
      {
        id: 7,
        action: 'Activate Brave Strix effect: Search "Rank-Up-Magic Soul Shave Force"',
        cardId: '08617563',
        next_success: 8,
        next_negated: 12 // Negated? Pivot to Zeus line
      },
      {
        id: 8,
        action: 'Activate "Rank-Up-Magic Soul Shave Force" targeting Force Strix in GY to Xyz Summon "Raidraptor - Rising Rebellion Falcon"',
        cardId: '59822133',
        next_success: 9,
        next_negated: null // Negation here leaves you open, pass turn
      },
      {
        id: 9,
        action: 'Activate Rising Rebellion Falcon on summon effect to destroy all cards your opponent controls. COMBO COMPLETE!',
        cardId: '59822133',
        next_success: null,
        next_negated: null
      },
      // Fallback Lines
      {
        id: 10,
        action: 'Fallback Play: Overlay your Rank 4s into "Abyss Dweller" for graveyard disruption, set backrow and pass.',
        cardId: '21044178',
        next_success: null,
        next_negated: null
      },
      {
        id: 11,
        action: 'Defensive Play: Set remaining spells/traps, pass turn and prepare to grind next turn.',
        cardId: '08559793',
        next_success: null,
        next_negated: null
      },
      {
        id: 12,
        action: 'Zeus Line: Battle Phase, attack with Brave Strix. In Main Phase 2, overlay into "Divine Arsenal AA-ZEUS - Sky Thunder".',
        cardId: '90448279',
        next_success: null,
        next_negated: null
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
    steps: [
      {
        id: 1,
        action: 'Normal Summon "Raidraptor - Vanishing Lanius", Special Summon "Raidraptor - Strangle Lanius"',
        cardId: '53251824',
        next_success: 2,
        next_negated: null
      },
      {
        id: 2,
        action: 'Link Summon "Raidraptor - Wise Strix" using Vanishing and Strangle as materials',
        cardId: '36429703',
        next_success: 3,
        next_negated: 7 // Negated Link Summon? Pivot to Draco Future defensive line if possible
      },
      {
        id: 3,
        action: 'Activate Wise Strix effect: Special Summon level 4 Raidraptor from deck',
        cardId: '36429703',
        next_success: 4,
        next_negated: 8 // Negated? Set & Pass
      },
      {
        id: 4,
        action: 'Xyz Summon "Raidraptor - Arsenal Falcon", detach material to special summon from deck',
        cardId: '96157835',
        next_success: 5,
        next_negated: 8
      },
      {
        id: 5,
        action: 'Activate Wise Strix 2nd effect: Set Rank-Up-Magic spell directly from deck',
        cardId: '36429703',
        next_success: 6,
        next_negated: null
      },
      {
        id: 6,
        action: 'Rank Up Arsenal Falcon into "Raidraptor - Final Fortress Falcon". COMBO COMPLETE!',
        cardId: '43047672',
        next_success: null,
        next_negated: null
      },
      {
        id: 7,
        action: 'Fallback: Use remaining material to summon "Number F0: Utopic Draco Future" for monster negates.',
        cardId: '26973555',
        next_success: null,
        next_negated: null
      },
      {
        id: 8,
        action: 'Defensive Play: Pass turn and conserve resources for next turn.',
        cardId: '08559793',
        next_success: null,
        next_negated: null
      }
    ]
  }
];
