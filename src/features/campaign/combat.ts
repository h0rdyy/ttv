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
