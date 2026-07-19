import { describe, it, expect } from 'vitest';
import { inferActionType, resolveActionType } from './actionTypes';

describe('inferActionType', () => {
  it('prefers xyz over special_summon when both phrases appear', () => {
    expect(inferActionType('Overlay two monsters to Xyz Summon "Boss"')).toBe('xyz');
  });

  it('prefers synchro/link/fusion/ritual mechanics over generic special summon', () => {
    expect(inferActionType('Synchro Summon "Boss" using Tuner')).toBe('synchro');
    expect(inferActionType('Link Summon "Boss" using two monsters')).toBe('link');
    expect(inferActionType('Fusion Summon "Boss" from your Extra Deck')).toBe('fusion');
    expect(inferActionType('Ritual Summon "Boss" by tributing monsters')).toBe('ritual');
  });

  it('detects normal summon, excluding additional/cannot phrasing', () => {
    expect(inferActionType('Normal Summon "Starter"')).toBe('normal_summon');
    expect(inferActionType('Use effect to gain an additional Normal Summon')).not.toBe('normal_summon');
    expect(inferActionType('This turn you cannot Normal Summon')).not.toBe('normal_summon');
  });

  it('falls back to special_summon for plain special summon text', () => {
    expect(inferActionType('Special Summon "Extender" from your hand')).toBe('special_summon');
  });

  it('detects search/discard/banish/tribute/return/set/activate', () => {
    expect(inferActionType('Add "Card" from your Deck to your hand')).toBe('search');
    expect(inferActionType('Discard "Card" to activate its effect')).toBe('discard');
    expect(inferActionType('Banish "Card" from the GY')).toBe('banish');
    expect(inferActionType('Tribute a monster to summon')).toBe('tribute');
    expect(inferActionType('Return "Card" to the hand')).toBe('return_hand');
    expect(inferActionType('Set a spell card')).toBe('set');
    expect(inferActionType('Activate the effect of "Card"')).toBe('activate');
  });

  it('returns undefined for unrecognized text', () => {
    expect(inferActionType('Do something inscrutable')).toBeUndefined();
  });
});

describe('resolveActionType', () => {
  it('prefers the explicit actionType field over inference', () => {
    expect(resolveActionType({ actionType: 'link', action: 'Normal Summon "Card"' })).toBe('link');
  });

  it('falls back to inference when actionType is absent', () => {
    expect(resolveActionType({ action: 'Normal Summon "Card"' })).toBe('normal_summon');
  });
});
