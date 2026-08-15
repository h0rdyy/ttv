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

export function mapMovementDistance(
  deltaXpx: number,
  deltaYpx: number,
  mapWidthPx: number,
  unitsPerMapWidth: number,
) {
  if (!Number.isFinite(mapWidthPx) || mapWidthPx <= 0) return 0;
  if (!Number.isFinite(unitsPerMapWidth) || unitsPerMapWidth <= 0) return 0;
  const displacement = Math.max(Math.abs(deltaXpx), Math.abs(deltaYpx));
  // A normal click stays free. Past the dead-zone, use a continuous square-grid
  // metric in map space. The map width is the stable reference, so visual grid
  // size, browser size and camera zoom cannot change the physical distance.
  if (!Number.isFinite(displacement) || displacement < 0.75) return 0;
  return roundMovementDistance((displacement / mapWidthPx) * unitsPerMapWidth);
}

export function calibrationUnitsPerMapWidth(
  deltaXpx: number,
  deltaYpx: number,
  mapWidthPx: number,
  knownDistance: number,
) {
  if (!Number.isFinite(mapWidthPx) || mapWidthPx <= 0) return 0;
  if (!Number.isFinite(knownDistance) || knownDistance <= 0) return 0;
  const linePixels = Math.hypot(deltaXpx, deltaYpx);
  if (!Number.isFinite(linePixels) || linePixels < 1) return 0;
  const mapFraction = linePixels / mapWidthPx;
  if (!Number.isFinite(mapFraction) || mapFraction <= 0) return 0;
  return roundMovementDistance(knownDistance / mapFraction);
}

export function gridUnitsPerMapWidth(
  gridSizePx: number,
  mapWidthPx: number,
  distancePerCell = DEFAULT_CELL_DISTANCE,
) {
  if (!Number.isFinite(gridSizePx) || gridSizePx <= 0) return 0;
  if (!Number.isFinite(mapWidthPx) || mapWidthPx <= 0) return 0;
  if (!Number.isFinite(distancePerCell) || distancePerCell <= 0) return 0;
  return roundMovementDistance((mapWidthPx / gridSizePx) * distancePerCell);
}

// Kept for compatibility with older tests/components. New movement code should
// use mapMovementDistance() with a persisted scene calibration.
export function gridMovementDistance(
  deltaXpx: number,
  deltaYpx: number,
  cellPixels: number,
  distancePerCell = DEFAULT_CELL_DISTANCE,
) {
  if (!Number.isFinite(cellPixels) || cellPixels <= 0) return 0;
  const displacement = Math.max(Math.abs(deltaXpx), Math.abs(deltaYpx));
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
