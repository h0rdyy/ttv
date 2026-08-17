export const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;
export const DICE_HISTORY_LIMIT = 12;

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
      if (!Number.isInteger(count) || count < 1 || count > 20 || !allowedSides.has(dieSides)) return null;
      if (sides.length + count > 20) return null;
      for (let index = 0; index < count; index += 1) sides.push(dieSides);
      continue;
    }

    if (!/^\d+$/.test(term)) return null;
    modifier += sign * Number(term);
    if (!Number.isInteger(modifier) || modifier < -100 || modifier > 100) return null;
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
  if (sides.length < 1 || sides.length > 20 || sides.length !== values.length) return null;
  if (!sides.every((side) => Number.isInteger(side) && allowedSides.has(side as number))) return null;
  if (!values.every((die, index) => Number.isInteger(die) && Number(die) >= 1 && Number(die) <= Number(sides[index]))) return null;
  if (!Number.isInteger(modifier) || Number(modifier) < -100 || Number(modifier) > 100) return null;
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
