import { describe, expect, it } from 'vitest';
import {
  actorMovementSpeed,
  calibrationUnitsPerMapWidth,
  formatMovementDistance,
  gridUnitsPerMapWidth,
  mapMovementDistance,
  movementStorageKey,
  remainingMovement,
  roundMovementDistance,
  shouldBlockCombatGridMove,
} from '../../src/features/campaign/movement';

describe('movement formulas', () => {
  it('rounds deterministic map distances to hundredths', () => {
    expect(roundMovementDistance(0.1 + 0.2)).toBe(0.3);
    expect(formatMovementDistance(2.5)).toBe('2.50');
    expect(mapMovementDistance(64, 0, 1280, 100)).toBe(5);
    expect(mapMovementDistance(64, 64, 1280, 100)).toBe(5);
    expect(mapMovementDistance(128, 64, 1280, 100)).toBe(10);
  });

  it('keeps calibrated map movement independent from visual grid size', () => {
    const calibratedScale = gridUnitsPerMapWidth(64, 1280, 5);
    expect(calibratedScale).toBe(100);
    expect(mapMovementDistance(256, 0, 1280, calibratedScale)).toBe(20);
    expect(gridUnitsPerMapWidth(96, 1280, 5)).not.toBe(calibratedScale);
    expect(calibrationUnitsPerMapWidth(384, 0, 1280, 30)).toBe(100);
  });

  it('blocks only movement beyond the exact combat budget', () => {
    expect(shouldBlockCombatGridMove(0, 0, 30, true)).toBe(false);
    expect(shouldBlockCombatGridMove(2.37, 27.63, 30, true)).toBe(false);
    expect(shouldBlockCombatGridMove(2.38, 27.63, 30, true)).toBe(true);
    expect(shouldBlockCombatGridMove(0.01, 30, 30, true)).toBe(true);
    expect(shouldBlockCombatGridMove(10, 30, 30, false)).toBe(false);
  });

  it('uses the sheet speed before legacy movement values', () => {
    expect(actorMovementSpeed({ speed: 25 })).toBe(25);
    expect(actorMovementSpeed({ speed: '17.5' })).toBe(17.5);
    expect(actorMovementSpeed({ speed: 20, movement: { walk: 30 } })).toBe(20);
    expect(actorMovementSpeed({ movement: { walk: 22.75 } })).toBe(22.75);
    expect(actorMovementSpeed({ walk_speed: '40' })).toBe(40);
    expect(actorMovementSpeed({})).toBe(30);
    expect(remainingMovement(25, 24.75, 0.25)).toBe(0);
  });

  it('scopes persisted movement budget to the active scene', () => {
    const turn = '4:1:actor-1';
    const firstScene = movementStorageKey('campaign-1', 'actor-1', 'scene-a', turn);
    const secondScene = movementStorageKey('campaign-1', 'actor-1', 'scene-b', turn);

    expect(firstScene).toBe('ttv:movement:campaign-1:actor-1:scene-a:4:1:actor-1');
    expect(secondScene).not.toBe(firstScene);
    expect(movementStorageKey('campaign-1', 'actor-1', '', turn)).toBe('');
  });

  it('fails closed for invalid calibrated inputs', () => {
    expect(mapMovementDistance(10, 10, 0, 100)).toBe(0);
    expect(mapMovementDistance(10, 10, 1000, 0)).toBe(0);
    expect(calibrationUnitsPerMapWidth(0, 0, 1000, 5)).toBe(0);
    expect(gridUnitsPerMapWidth(0, 1000, 5)).toBe(0);
  });
});
