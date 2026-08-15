export type MovementSystemData = Record<string, unknown>;

export const DEFAULT_CELL_DISTANCE = 5;
export const DEFAULT_DISTANCE_UNIT = 'ft';
export const DEFAULT_MOVEMENT_SPEED = 30;

export function gridMovementDistance(
  deltaXpx: number,
  deltaYpx: number,
  cellPixels: number,
  distancePerCell = DEFAULT_CELL_DISTANCE,
) {
  if (!Number.isFinite(cellPixels) || cellPixels <= 0) return 0;
  const displacement = Math.max(Math.abs(deltaXpx), Math.abs(deltaYpx));
  // A true click is free, but any intentional drag counts as at least one cell.
  // This prevents repeated 1-2 px drags from advancing a snapped token for 0 ft.
  if (!Number.isFinite(displacement) || displacement < 0.75) return 0;
  // Experimental Foundry-like square-grid rule: diagonal movement costs one cell
  // per crossed square. This can later become a per-system diagonal policy.
  const cells = Math.max(1, Math.round(displacement / cellPixels));
  return cells * Math.max(0, distancePerCell);
}

export function shouldBlockCombatGridMove(distance: number, spent: number, speed: number, gridEnabled: boolean) {
  if (!gridEnabled) return false;
  if (!Number.isFinite(distance) || distance < 0) return true;
  // Zero means the pointer has not actually moved. Full-budget blocking happens
  // on pointerdown so a simple click never breaks token selection.
  if (distance === 0) return false;
  return spent + distance > speed;
}

export function actorMovementSpeed(systemData: MovementSystemData | null | undefined, fallback = DEFAULT_MOVEMENT_SPEED) {
  const movement = systemData?.movement;
  const movementObject = movement && typeof movement === 'object' ? movement as Record<string, unknown> : null;
  const candidates = [
    movementObject?.walk,
    movementObject?.speed,
    systemData?.speed,
    systemData?.walk_speed,
  ];

  for (const candidate of candidates) {
    const value = typeof candidate === 'number' ? candidate : Number(candidate);
    if (Number.isFinite(value) && value > 0) return value;
  }

  return fallback;
}

export function remainingMovement(speed: number, spent: number, preview = 0) {
  return Math.max(0, speed - spent - preview);
}
