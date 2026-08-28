import { describe, expect, it } from 'vitest';
import {
  advanceCombatTurn,
  combatCurrentActor,
  combatEffectsForActor,
  combatInitiative,
  combatParticipants,
  normalizeCombatControl,
  normalizeCombatEffects,
  normalizeCombatInitiative,
  sortByInitiative,
  type CombatRuntime,
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

describe('combat turn + round advancement', () => {
  const baseRuntime = (overrides: Partial<CombatRuntime> = {}): CombatRuntime => ({
    campaign_id: 'c',
    combat_active: true,
    combat_round: 1,
    combat_turn: 0,
    combat_order: ['a', 'b', 'c'],
    combat_initiative: { a: 15, b: 12, c: 18 },
    combat_effects: [],
    combat_control: 'automatic',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  });

  it('combatCurrentActor returns null when combat is inactive', () => {
    const runtime = baseRuntime({ combat_active: false });
    expect(combatCurrentActor(runtime, [{ id: 'a', name: 'A' }])).toBeNull();
  });

  it('combatCurrentActor returns null when order is empty', () => {
    const runtime = baseRuntime({ combat_order: [] });
    expect(combatCurrentActor(runtime, [{ id: 'a', name: 'A' }])).toBeNull();
  });

  it('combatCurrentActor returns null when turn is out of bounds', () => {
    const runtime = baseRuntime({ combat_turn: 99 });
    expect(combatCurrentActor(runtime, [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }])).toBeNull();
  });

  it('combatCurrentActor returns null when actor was deleted from campaign', () => {
    const runtime = baseRuntime({ combat_turn: 0 });
    expect(combatCurrentActor(runtime, [])).toBeNull();
  });

  it('combatCurrentActor returns the right actor at given turn', () => {
    const runtime = baseRuntime({ combat_turn: 2 });
    const current = combatCurrentActor(runtime, [
      { id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }, { id: 'c', name: 'Carol' },
    ]);
    expect(current?.id).toBe('c');
  });

  it('advances to the next actor without wrapping', () => {
    const runtime = baseRuntime({ combat_turn: 0 });
    const next = advanceCombatTurn(runtime);
    expect(next.combat_turn).toBe(1);
    expect(next.combat_round).toBe(1);
    expect(next.combat_effects).toEqual([]);
    expect(next.updated_at).not.toBe(runtime.updated_at);
  });

  it('wraps the round and resets to turn 0 on the last actor', () => {
    const runtime = baseRuntime({ combat_turn: 2 });
    const next = advanceCombatTurn(runtime);
    expect(next.combat_turn).toBe(0);
    expect(next.combat_round).toBe(2);
  });

  it('decrements effect durations and drops expired ones on round wrap', () => {
    const runtime = baseRuntime({
      combat_turn: 2,
      combat_effects: [
        { id: 'e1', actorId: 'a', name: 'Горение', kind: 'effect', remainingRounds: 2 },
        { id: 'e2', actorId: 'b', name: 'Оглушён', kind: 'condition', remainingRounds: 1 },
        { id: 'e3', actorId: 'c', name: 'Благословение', kind: 'effect', remainingRounds: null },
      ],
    });
    const next = advanceCombatTurn(runtime);
    expect(next.combat_effects.map((e) => `${e.name}:${e.remainingRounds}`)).toEqual([
      'Горение:1',
      'Благословение:null',
    ]);
  });

  it('clamps an out-of-range turn back into bounds before advancing', () => {
    const runtime = baseRuntime({ combat_turn: 99 });
    const next = advanceCombatTurn(runtime);
    // 99 is clamped to length-1 (2), so we wrap and bump round.
    expect(next.combat_turn).toBe(0);
    expect(next.combat_round).toBe(2);
  });

  it('is a no-op when combat is inactive', () => {
    const runtime = baseRuntime({ combat_active: false, combat_turn: 0 });
    const next = advanceCombatTurn(runtime);
    expect(next).toBe(runtime);
  });

  it('is a no-op when order is empty', () => {
    const runtime = baseRuntime({ combat_order: [] });
    const next = advanceCombatTurn(runtime);
    expect(next).toBe(runtime);
  });
});

describe('sortByInitiative', () => {
  it('orders by initiative desc with stored order as tiebreaker', () => {
    const runtime = {
      combat_initiative: { a: 10, b: 18, c: 18, d: 5 },
      combat_order: ['a', 'b', 'c', 'd'],
    };
    const actors = [
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
      { id: 'c', name: 'Carol' },
      { id: 'd', name: 'Dave' },
    ];
    expect(sortByInitiative(runtime, actors).map((a) => a.id)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('treats missing initiative as 0', () => {
    const runtime = {
      combat_initiative: { a: 10 },
      combat_order: ['x', 'a', 'y'],
    };
    const actors = [
      { id: 'a', name: 'A' },
      { id: 'x', name: 'X' },
    ];
    expect(sortByInitiative(runtime, actors).map((a) => a.id)).toEqual(['a', 'x']);
  });

  it('skips actors that no longer exist in the campaign', () => {
    const runtime = {
      combat_initiative: { a: 10, b: 20 },
      combat_order: ['a', 'b', 'gone'],
    };
    const actors = [{ id: 'a', name: 'A' }];
    expect(sortByInitiative(runtime, actors).map((a) => a.id)).toEqual(['a']);
  });
});
