export type CombatControl = 'automatic' | 'manual';
export type CombatEffectKind = 'effect' | 'condition';

export type CombatEffect = {
  id: string;
  actorId: string;
  name: string;
  kind: CombatEffectKind;
  remainingRounds: number | null;
};

export type CombatRuntime = {
  campaign_id: string;
  combat_active: boolean;
  combat_round: number;
  combat_turn: number;
  combat_order: string[];
  combat_initiative: Record<string, number>;
  combat_effects: CombatEffect[];
  combat_control: CombatControl;
  updated_at: string;
};

export type CombatActor = { id: string; name: string };

export function normalizeCombatControl(value: unknown): CombatControl {
  return value === 'manual' ? 'manual' : 'automatic';
}

export function normalizeCombatInitiative(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([actorId, raw]) => [actorId, Number(raw)] as const)
      .filter(([, initiative]) => Number.isFinite(initiative))
      .map(([actorId, initiative]) => [actorId, Math.max(-1000, Math.min(1000, Math.trunc(initiative)))])
  );
}

export function normalizeCombatEffects(value: unknown): CombatEffect[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const candidate = raw as Record<string, unknown>;
    const id = typeof candidate.id === 'string' ? candidate.id : '';
    const actorId = typeof candidate.actorId === 'string' ? candidate.actorId : '';
    const name = typeof candidate.name === 'string' ? candidate.name.trim().slice(0, 80) : '';
    const kind: CombatEffectKind = candidate.kind === 'condition' ? 'condition' : 'effect';
    const rawDuration = candidate.remainingRounds;
    const duration = rawDuration == null || rawDuration === '' ? null : Number(rawDuration);
    if (!id || !actorId || !name || (duration !== null && (!Number.isInteger(duration) || duration < 1))) return [];
    return [{ id, actorId, name, kind, remainingRounds: duration === null ? null : Math.min(duration, 999) }];
  });
}

export function combatInitiative(runtime: Pick<CombatRuntime, 'combat_initiative'>, actorId: string) {
  const value = runtime.combat_initiative[actorId];
  return Number.isFinite(value) ? value : 0;
}

export function combatEffectsForActor(runtime: Pick<CombatRuntime, 'combat_effects'>, actorId: string) {
  return runtime.combat_effects.filter((effect) => effect.actorId === actorId);
}

export function combatParticipants<T extends CombatActor>(runtime: Pick<CombatRuntime, 'combat_order'>, actors: T[]) {
  const actorById = new Map(actors.map((actor) => [actor.id, actor]));
  return runtime.combat_order.flatMap((actorId) => {
    const actor = actorById.get(actorId);
    return actor ? [actor] : [];
  });
}

/**
 * Returns the actor whose turn is current, or null when combat is inactive,
 * the order is empty, or the turn index is out of bounds.
 */
export function combatCurrentActor<T extends CombatActor>(
  runtime: Pick<CombatRuntime, 'combat_active' | 'combat_order' | 'combat_turn'>,
  actors: T[],
): T | null {
  if (!runtime.combat_active) return null;
  if (runtime.combat_turn < 0 || runtime.combat_turn >= runtime.combat_order.length) return null;
  const id = runtime.combat_order[runtime.combat_turn];
  if (!id) return null;
  return actors.find((actor) => actor.id === id) ?? null;
}

/**
 * Advances the turn pointer. When it wraps past the last actor, the round
 * counter increments and effect durations decrement. Permanent effects
 * (remainingRounds === null) are preserved. Returns the updated runtime.
 */
export function advanceCombatTurn(runtime: CombatRuntime): CombatRuntime {
  if (!runtime.combat_active || runtime.combat_order.length === 0) return runtime;
  const safeTurn = Math.max(0, Math.min(runtime.combat_turn, runtime.combat_order.length - 1));
  const isLast = safeTurn >= runtime.combat_order.length - 1;
  if (!isLast) {
    return { ...runtime, combat_turn: safeTurn + 1, updated_at: new Date().toISOString() };
  }
  // Round wrap: bump round, reset turn, decrement effect durations.
  const nextRound = runtime.combat_round + 1;
  const nextEffects = runtime.combat_effects
    .map((effect) => effect.remainingRounds === null
      ? effect
      : { ...effect, remainingRounds: effect.remainingRounds - 1 })
    .filter((effect) => effect.remainingRounds === null || effect.remainingRounds > 0);
  return {
    ...runtime,
    combat_round: nextRound,
    combat_turn: 0,
    combat_effects: nextEffects,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Returns the combat order sorted by initiative (descending), with ties broken
 * by the existing stored position. This is the canonical ordering the UI
 * should display — `combat_order` itself remains the source of truth for turns.
 */
export function sortByInitiative<T extends CombatActor>(
  runtime: Pick<CombatRuntime, 'combat_initiative' | 'combat_order'>,
  actors: T[],
): T[] {
  const actorById = new Map(actors.map((actor) => [actor.id, actor]));
  const storedIndex = new Map(runtime.combat_order.map((id, index) => [id, index]));
  return runtime.combat_order
    .map((id) => actorById.get(id))
    .filter((actor): actor is T => Boolean(actor))
    .map((actor) => ({ actor, init: combatInitiative(runtime, actor.id), order: storedIndex.get(actor.id) ?? 0 }))
    .sort((a, b) => b.init - a.init || a.order - b.order)
    .map((entry) => entry.actor);
}
