import { describe, expect, it } from 'vitest';
import {
  combatEffectsForActor,
  combatInitiative,
  combatParticipants,
  normalizeCombatControl,
  normalizeCombatEffects,
  normalizeCombatInitiative,
} from '../../src/features/campaign/combat';

describe('combat runtime normalization', () => {
  it('accepts bounded integer initiatives and ignores invalid values', () => {
    expect(normalizeCombatInitiative({ a: 17.9, b: '12', c: 'nope', d: 9000 })).toEqual({
      a: 17,
      b: 12,
      d: 1000,
    });
  });

  it('normalizes effects without exposing malformed runtime data', () => {
    expect(normalizeCombatEffects([
      { id: 'one', actorId: 'hero', name: '  Оглушён  ', kind: 'condition', remainingRounds: 2 },
      { id: 'two', actorId: 'hero', name: 'Благословение', kind: 'effect', remainingRounds: null },
      { id: '', actorId: 'hero', name: 'broken', remainingRounds: 1 },
    ])).toEqual([
      { id: 'one', actorId: 'hero', name: 'Оглушён', kind: 'condition', remainingRounds: 2 },
      { id: 'two', actorId: 'hero', name: 'Благословение', kind: 'effect', remainingRounds: null },
    ]);
  });

  it('keeps the stored order and filters deleted actors', () => {
    const actors = [{ id: 'b', name: 'B' }, { id: 'a', name: 'A' }];
    expect(combatParticipants({ combat_order: ['a', 'missing', 'b'] }, actors).map((actor) => actor.id)).toEqual(['a', 'b']);
  });

  it('provides safe selectors for control, initiative and effects', () => {
    const runtime = {
      combat_initiative: { hero: 18 },
      combat_effects: [{ id: 'x', actorId: 'hero', name: 'Горение', kind: 'effect' as const, remainingRounds: 1 }],
    };
    expect(normalizeCombatControl('manual')).toBe('manual');
    expect(normalizeCombatControl('unexpected')).toBe('automatic');
    expect(combatInitiative(runtime, 'hero')).toBe(18);
    expect(combatInitiative(runtime, 'other')).toBe(0);
    expect(combatEffectsForActor(runtime, 'hero')).toHaveLength(1);
  });
});
