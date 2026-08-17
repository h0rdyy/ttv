import { describe, expect, it } from 'vitest';
import {
  buildDiceFormula,
  mergeDiceRollHistory,
  parseDiceFormula,
  parseDiceRoll,
  removeDieFromRoll,
} from '../../src/features/campaign/dice';

const FIXED_ROLL = {
  id: '7fd97df9-c7ab-48ab-9d05-92b6ee9fd354',
  senderUserId: '4feaf7d5-d7ef-4b1f-a25c-d60e74038450',
  displayName: 'Игрок',
  sides: [20, 6],
  values: [17, 4],
  modifier: 2,
  total: 23,
  visibility: 'public',
  createdAt: '2026-08-13T10:00:00.000Z',
} as const;

describe('dice contracts', () => {
  it('builds stable formulas', () => {
    expect(buildDiceFormula([], 0)).toBe('Выберите кубы');
    expect(buildDiceFormula([20, 6, 20], 3)).toBe('2d20 + 1d6 + 3');
    expect(buildDiceFormula([8], -2)).toBe('1d8 − 2');
  });

  it('parses compact formulas with explicit safety bounds', () => {
    expect(parseDiceFormula('d20')).toEqual({ sides: [20], modifier: 0 });
    expect(parseDiceFormula('2d6 + d8 + 3')).toEqual({ sides: [6, 6, 8], modifier: 3 });
    expect(parseDiceFormula('2d10−4')).toEqual({ sides: [10, 10], modifier: -4 });
    expect(parseDiceFormula('21d6')).toBeNull();
    expect(parseDiceFormula('2d7+3')).toBeNull();
    expect(parseDiceFormula('d20-d6')).toBeNull();
    expect(parseDiceFormula('101+d20')).toBeNull();
    expect(parseDiceFormula('hello')).toBeNull();
  });

  it('accepts a canonical server payload and rejects tampering', () => {
    const parsed = parseDiceRoll(FIXED_ROLL);
    expect(parsed).not.toBeNull();
    expect(parsed?.formula).toBe('1d20 + 1d6 + 2');
    expect(parseDiceRoll({ ...FIXED_ROLL, total: 24 })).toBeNull();
    expect(parseDiceRoll({ ...FIXED_ROLL, sides: [20, 7] })).toBeNull();
    expect(parseDiceRoll({ ...FIXED_ROLL, values: [17] })).toBeNull();
    expect(parseDiceRoll({ ...FIXED_ROLL, displayName: '' })).toBeNull();
  });

  it('deduplicates realtime echoes and bounds history', () => {
    const first = parseDiceRoll(FIXED_ROLL);
    const newer = parseDiceRoll({
      ...FIXED_ROLL,
      id: 'e4408800-72ca-4d10-82e2-4b40b44de4f8',
      createdAt: '2026-08-13T10:01:00.000Z',
    });
    expect(first).not.toBeNull();
    expect(newer).not.toBeNull();
    if (!first || !newer) throw new Error('fixed dice fixtures must parse');

    expect(mergeDiceRollHistory([first], first)).toEqual([first]);
    expect(mergeDiceRollHistory([first], newer, 1)).toEqual([newer]);
  });

  it('removes a settled die and recalculates the total', () => {
    const parsed = parseDiceRoll(FIXED_ROLL);
    expect(parsed).not.toBeNull();
    if (!parsed) throw new Error('fixed dice fixture must parse');

    const oneDie = removeDieFromRoll(parsed, 0);
    expect(oneDie).not.toBeNull();
    expect(oneDie?.sides).toEqual([6]);
    expect(oneDie?.values).toEqual([4]);
    expect(oneDie?.formula).toBe('1d6 + 2');
    expect(oneDie?.total).toBe(6);
    expect(oneDie ? removeDieFromRoll(oneDie, 0) : undefined).toBeNull();
  });
});
