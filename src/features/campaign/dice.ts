export const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;
export const DICE_HISTORY_LIMIT = 12;
export const MAX_DICE_COUNT = 20;
export const MIN_DICE_MODIFIER = -100;
export const MAX_DICE_MODIFIER = 100;

export type DiceSide = (typeof DICE_SIDES)[number];
export type DicePool = Partial<Record<DiceSide, number>>;

export type DiceVisibility = 'public' | 'gm';

export type DiceRoll = {
  id: string;
  senderUserId: string;
  displayName: string;
  sides: number[];
  values: number[];
  modifier: number;
  total: number;
  visibility: DiceVisibility;
  createdAt: string;
  formula: string;
};

export type ParsedDiceFormula = {
  sides: number[];
  modifier: number;
};

const allowedSides = new Set<number>(DICE_SIDES);

export function diceSidesToPool(sidesList: number[]): DicePool {
  const pool: DicePool = {};
  sidesList.slice(0, MAX_DICE_COUNT).forEach((sides) => {
    if (!allowedSides.has(sides)) return;
    const die = sides as DiceSide;
    pool[die] = (pool[die] ?? 0) + 1;
  });
  return pool;
}

export function dicePoolToSides(pool: DicePool): number[] {
  const sidesList: number[] = [];
  for (const sides of DICE_SIDES) {
    const count = Math.max(0, Math.floor(pool[sides] ?? 0));
    for (let index = 0; index < count && sidesList.length < MAX_DICE_COUNT; index += 1) {
      sidesList.push(sides);
    }
  }
  return sidesList;
}

export function changeDicePool(pool: DicePool, sides: DiceSide, delta: number): DicePool {
  if (!Number.isFinite(delta) || delta === 0) return { ...pool };
  const current = Math.max(0, Math.floor(pool[sides] ?? 0));
  const total = dicePoolToSides(pool).length;
  const requested = Math.max(0, current + Math.trunc(delta));
  const nextCount = Math.min(requested, current + Math.max(0, MAX_DICE_COUNT - total));
  const next = { ...pool };
  if (nextCount === 0) delete next[sides];
  else next[sides] = nextCount;
  return next;
}

export function clampDiceModifier(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(MIN_DICE_MODIFIER, Math.min(MAX_DICE_MODIFIER, Math.trunc(value)));
}

export function buildDiceFormula(sidesList: number[], modifier: number) {
  if (!sidesList.length) return 'Выберите кубы';
  const counts = new Map<number, number>();
  sidesList.forEach((sides) => counts.set(sides, (counts.get(sides) ?? 0) + 1));
  const dice = [...counts.entries()].map(([sides, count]) => `${count}d${sides}`).join(' + ');
  if (!modifier) return dice;
  return `${dice} ${modifier > 0 ? '+' : '−'} ${Math.abs(modifier)}`;
}

/**
 * Parses the compact player-facing syntax used by the dice tray, e.g.
 * `d20`, `2d6+3`, or `2d8 + d4 - 1`.
 *
 * The server RPC remains authoritative for the actual random result; this
 * parser only converts an explicitly bounded formula to the RPC arguments.
 */
export function parseDiceFormula(value: string): ParsedDiceFormula | null {
  const compact = value.trim().toLocaleLowerCase('en').replace(/[−–—]/g, '-').replace(/\s+/g, '');
  if (!compact) return null;

  const expression = /^[+-]/.test(compact) ? compact : `+${compact}`;
  const matches = [...expression.matchAll(/([+-])([^+-]+)/g)];
  if (!matches.length || matches.map((match) => match[0]).join('') !== expression) return null;

  const sides: number[] = [];
  let modifier = 0;

  for (const match of matches) {
    const sign = match[1] === '-' ? -1 : 1;
    const term = match[2];
    const diceMatch = /^(\d*)d(\d+)$/.exec(term);

    if (diceMatch) {
      if (sign < 0) return null;
      const count = diceMatch[1] ? Number(diceMatch[1]) : 1;
      const dieSides = Number(diceMatch[2]);
      if (!Number.isInteger(count) || count < 1 || count > MAX_DICE_COUNT || !allowedSides.has(dieSides)) return null;
      if (sides.length + count > MAX_DICE_COUNT) return null;
      for (let index = 0; index < count; index += 1) sides.push(dieSides);
      continue;
    }

    if (!/^\d+$/.test(term)) return null;
    modifier += sign * Number(term);
    if (!Number.isInteger(modifier) || modifier < MIN_DICE_MODIFIER || modifier > MAX_DICE_MODIFIER) return null;
  }

  if (!sides.length) return null;
  return { sides, modifier };
}

export function parseDiceRoll(value: unknown): DiceRoll | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === 'string' ? raw.id : '';
  const senderUserId = typeof raw.senderUserId === 'string' ? raw.senderUserId : '';
  const displayName = typeof raw.displayName === 'string' ? raw.displayName.trim() : '';
  const sides = Array.isArray(raw.sides) ? raw.sides : [];
  const values = Array.isArray(raw.values) ? raw.values : [];
  const modifier = raw.modifier;
  const total = raw.total;
  const visibility = raw.visibility;
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : '';

  if (!isUuid(id) || !isUuid(senderUserId) || !displayName || displayName.length > 80) return null;
  if (sides.length < 1 || sides.length > MAX_DICE_COUNT || sides.length !== values.length) return null;
  if (!sides.every((side) => Number.isInteger(side) && allowedSides.has(side as number))) return null;
  if (!values.every((die, index) => Number.isInteger(die) && Number(die) >= 1 && Number(die) <= Number(sides[index]))) return null;
  if (!Number.isInteger(modifier) || Number(modifier) < MIN_DICE_MODIFIER || Number(modifier) > MAX_DICE_MODIFIER) return null;
  if (!Number.isInteger(total)) return null;
  if (visibility !== 'public' && visibility !== 'gm') return null;
  if (!createdAt || Number.isNaN(Date.parse(createdAt))) return null;

  const numericSides = sides.map(Number);
  const numericValues = values.map(Number);
  const numericModifier = Number(modifier);
  const expectedTotal = numericValues.reduce((sum, die) => sum + die, 0) + numericModifier;
  if (Number(total) !== expectedTotal) return null;

  return {
    id,
    senderUserId,
    displayName,
    sides: numericSides,
    values: numericValues,
    modifier: numericModifier,
    total: Number(total),
    visibility,
    createdAt,
    formula: buildDiceFormula(numericSides, numericModifier),
  };
}

export function mergeDiceRollHistory(history: DiceRoll[], roll: DiceRoll, limit = DICE_HISTORY_LIMIT) {
  const safeLimit = Math.max(1, Math.floor(limit));
  return [roll, ...history.filter((item) => item.id !== roll.id)]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, safeLimit);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
