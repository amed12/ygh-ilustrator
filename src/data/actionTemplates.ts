import type { ActionType } from './actionTypes';

/**
 * Click-to-compose phrase templates for the combo step Action Composer.
 * `{card}` marks a slot filled by picking a card from the deck; the composed
 * result is always a plain string written into ComboStep.action, so no schema
 * changes are needed and hand-typed/AI-generated actions coexist freely.
 */
export interface ActionTemplate {
  /** Short chip label shown in the composer. */
  label: string;
  /** Phrase inserted into the action string; `{card}` is replaced by the picked card's name. */
  phrase: string;
  /** The ActionType this template classifies as, when it represents the step's primary action (costs/connectors have none). */
  actionType?: ActionType;
}

export interface ActionTemplateGroup {
  group: string;
  templates: ActionTemplate[];
}

export const ACTION_TEMPLATES: ActionTemplateGroup[] = [
  {
    group: 'Summon',
    templates: [
      { label: 'Normal Summon', phrase: 'Normal Summon {card}', actionType: 'normal_summon' },
      { label: 'Special Summon', phrase: 'Special Summon {card}', actionType: 'special_summon' },
      { label: 'SS from Deck', phrase: 'Special Summon {card} from the Deck', actionType: 'special_summon' },
      { label: 'SS from GY', phrase: 'Special Summon {card} from the GY', actionType: 'special_summon' },
      { label: 'SS from hand', phrase: 'Special Summon {card} from your hand', actionType: 'special_summon' },
      { label: 'Xyz Summon', phrase: 'Xyz Summon {card}', actionType: 'xyz' },
      { label: 'Link Summon', phrase: 'Link Summon {card}', actionType: 'link' },
      { label: 'Synchro Summon', phrase: 'Synchro Summon {card}', actionType: 'synchro' },
      { label: 'Fusion Summon', phrase: 'Fusion Summon {card}', actionType: 'fusion' }
    ]
  },
  {
    group: 'Effect',
    templates: [
      { label: 'Activate effect', phrase: 'activate {card} effect', actionType: 'activate' },
      { label: 'Activate in GY', phrase: 'activate the effect of {card} in the GY', actionType: 'activate' },
      { label: 'Activate Spell/Trap', phrase: 'activate {card}', actionType: 'activate' },
      { label: 'Chain', phrase: 'chain {card}', actionType: 'activate' },
      { label: 'Negate', phrase: 'negate with {card}', actionType: 'activate' }
    ]
  },
  {
    group: 'Cost / Material',
    templates: [
      { label: 'Tribute it', phrase: 'tribute it', actionType: 'tribute' },
      { label: 'Tribute', phrase: 'tribute {card}', actionType: 'tribute' },
      { label: 'Discard', phrase: 'discard {card}', actionType: 'discard' },
      { label: 'Detach 1 material', phrase: 'detach 1 material' },
      { label: 'Use as material', phrase: 'using {card} as material' },
      { label: 'Send to GY', phrase: 'send {card} to the GY', actionType: 'send_gy' },
      { label: 'Banish', phrase: 'banish {card}', actionType: 'banish' }
    ]
  },
  {
    group: 'Search / Draw',
    templates: [
      { label: 'Search', phrase: 'search {card}', actionType: 'search' },
      { label: 'Add from Deck', phrase: 'add {card} from the Deck to your hand', actionType: 'search' },
      { label: 'Add from GY', phrase: 'add {card} from the GY to your hand', actionType: 'search' },
      { label: 'Draw 1', phrase: 'draw 1 card', actionType: 'search' },
      { label: 'Excavate/Reveal', phrase: 'reveal {card}' },
      { label: 'Mill', phrase: 'send the top card(s) of your Deck to the GY', actionType: 'send_gy' }
    ]
  },
  {
    group: 'Field',
    templates: [
      { label: 'Set', phrase: 'Set {card}', actionType: 'set' },
      { label: 'Destroy', phrase: 'destroy {card}' },
      { label: 'Target', phrase: 'target {card}' },
      { label: 'Return to hand', phrase: 'return {card} to the hand', actionType: 'return_hand' },
      { label: 'Attach as material', phrase: 'attach {card} as material' },
      { label: 'Change position', phrase: 'change it to Defense Position' }
    ]
  },
  {
    group: 'Phase',
    templates: [
      { label: 'End Phase', phrase: 'End Phase', actionType: 'phase_marker' },
      { label: 'Battle Phase', phrase: 'Battle Phase', actionType: 'phase_marker' }
    ]
  },
  {
    group: 'Connector',
    templates: [
      { label: ', then', phrase: ', then' },
      { label: '&', phrase: '&' },
      { label: ';', phrase: ';' },
      { label: 'to', phrase: 'to' },
      { label: 'and if you do', phrase: 'and if you do,' }
    ]
  }
];
