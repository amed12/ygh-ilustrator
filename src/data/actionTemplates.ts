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
}

export interface ActionTemplateGroup {
  group: string;
  templates: ActionTemplate[];
}

export const ACTION_TEMPLATES: ActionTemplateGroup[] = [
  {
    group: 'Summon',
    templates: [
      { label: 'Normal Summon', phrase: 'Normal Summon {card}' },
      { label: 'Special Summon', phrase: 'Special Summon {card}' },
      { label: 'SS from Deck', phrase: 'Special Summon {card} from the Deck' },
      { label: 'SS from GY', phrase: 'Special Summon {card} from the GY' },
      { label: 'SS from hand', phrase: 'Special Summon {card} from your hand' },
      { label: 'Xyz Summon', phrase: 'Xyz Summon {card}' },
      { label: 'Link Summon', phrase: 'Link Summon {card}' },
      { label: 'Synchro Summon', phrase: 'Synchro Summon {card}' },
      { label: 'Fusion Summon', phrase: 'Fusion Summon {card}' }
    ]
  },
  {
    group: 'Effect',
    templates: [
      { label: 'Activate effect', phrase: 'activate {card} effect' },
      { label: 'Activate in GY', phrase: 'activate the effect of {card} in the GY' },
      { label: 'Activate Spell/Trap', phrase: 'activate {card}' },
      { label: 'Chain', phrase: 'chain {card}' },
      { label: 'Negate', phrase: 'negate with {card}' }
    ]
  },
  {
    group: 'Cost / Material',
    templates: [
      { label: 'Tribute it', phrase: 'tribute it' },
      { label: 'Tribute', phrase: 'tribute {card}' },
      { label: 'Discard', phrase: 'discard {card}' },
      { label: 'Detach 1 material', phrase: 'detach 1 material' },
      { label: 'Use as material', phrase: 'using {card} as material' },
      { label: 'Send to GY', phrase: 'send {card} to the GY' },
      { label: 'Banish', phrase: 'banish {card}' }
    ]
  },
  {
    group: 'Search / Draw',
    templates: [
      { label: 'Search', phrase: 'search {card}' },
      { label: 'Add from Deck', phrase: 'add {card} from the Deck to your hand' },
      { label: 'Add from GY', phrase: 'add {card} from the GY to your hand' },
      { label: 'Draw 1', phrase: 'draw 1 card' },
      { label: 'Excavate/Reveal', phrase: 'reveal {card}' },
      { label: 'Mill', phrase: 'send the top card(s) of your Deck to the GY' }
    ]
  },
  {
    group: 'Field',
    templates: [
      { label: 'Set', phrase: 'Set {card}' },
      { label: 'Destroy', phrase: 'destroy {card}' },
      { label: 'Target', phrase: 'target {card}' },
      { label: 'Return to hand', phrase: 'return {card} to the hand' },
      { label: 'Attach as material', phrase: 'attach {card} as material' },
      { label: 'Change position', phrase: 'change it to Defense Position' }
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
