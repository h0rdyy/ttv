export type MovementSystemData = Record<string, unknown>;

export const DEFAULT_CELL_DISTANCE = 5;
export const DEFAULT_DISTANCE_UNIT = 'ft';
export const DEFAULT_MOVEMENT_SPEED = 30;
export const MOVEMENT_PRECISION = 100;

export function roundMovementDistance(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * MOVEMENT_PRECISION) / MOVEMENT_PRECISION;
}

export function formatMovementDistance(value: number) {
  return roundMovementDistance(value).toFixed(2);
}

export function gridMovementDistance(
  deltaXpx: number,
  deltaYpx: number,
  cellPixels: number,
  distancePerCell = DEFAULT_CELL_DISTANCE,
) {
  if (!Number.isFinite(cellPixels) || cellPixels <= 0) return 0;
  const displacement = Math.max(Math.abs(deltaXpx), Math.abs(deltaYpx));
  // Keep a tiny dead-zone so a normal click remains free. After that, distance is
  // continuous inside the square instead of jumping in whole 5-ft cells.
  if (!Number.isFinite(displacement) || displacement < 0.75) return 0;
  const cells = displacement / cellPixels;
  return roundMovementDistance(cells * Math.max(0, distancePerCell));
}

export function shouldBlockCombatGridMove(distance: number, spent: number, speed: number, distanceScaleAvailable: boolean) {
  if (!distanceScaleAvailable) return false;
  if (!Number.isFinite(distance) || distance < 0) return true;
  if (distance === 0) return false;
  return roundMovementDistance(spent + distance) > roundMovementDistance(speed);
}

export function actorMovementSpeed(systemData: MovementSystemData | null | undefined, fallback = DEFAULT_MOVEMENT_SPEED) {
  const movement = systemData?.movement;
  const movementObject = movement && typeof movement === 'object' ? movement as Record<string, unknown> : null;
  // `speed` is the editable field in the current Actor Sheet and therefore wins
  // over legacy movement keys that may still exist on older characters.
  const candidates = [
    systemData?.speed,
    movementObject?.walk,
    movementObject?.speed,
    systemData?.walk_speed,
  ];

  for (const candidate of candidates) {
    const value = typeof candidate === 'number' ? candidate : Number(candidate);
    if (Number.isFinite(value) && value > 0) return roundMovementDistance(value);
  }

  return roundMovementDistance(fallback);
}

export function remainingMovement(speed: number, spent: number, preview = 0) {
  return roundMovementDistance(Math.max(0, speed - spent - preview));
}
