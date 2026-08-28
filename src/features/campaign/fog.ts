export type FogReveal = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Returns the effective dimensions of a reveal rectangle. Guards against
 * zero or negative sizes so a "click with no drag" never opens fog.
 */
export function normalizeReveal(reveal: FogReveal): FogReveal {
  const width = Math.max(0, reveal.width);
  const height = Math.max(0, reveal.height);
  return { ...reveal, x: reveal.x, y: reveal.y, width, height };
}

/**
 * Whether a point is inside any of the reveal rectangles.
 *
 * A reveal with width or height equal to zero is treated as a single point at
 * (x, y) and only matches a point landing exactly on it — this avoids
 * accidentally marking a no-drag click as a "fog opened" event.
 */
export function isPointRevealed(position: { x: number; y: number }, reveals: FogReveal[]): boolean {
  return reveals.some((reveal) => {
    const width = reveal.width > 0 ? reveal.width : 0;
    const height = reveal.height > 0 ? reveal.height : 0;
    if (width === 0 && height === 0) {
      return position.x === reveal.x && position.y === reveal.y;
    }
    if (width === 0) {
      return position.x === reveal.x && position.y >= reveal.y && position.y <= reveal.y + height;
    }
    if (height === 0) {
      return position.x >= reveal.x && position.x <= reveal.x + width && position.y === reveal.y;
    }
    return position.x >= reveal.x
      && position.x <= reveal.x + width
      && position.y >= reveal.y
      && position.y <= reveal.y + height;
  });
}

/**
 * Whether a reveal rectangle is large enough to be considered a deliberate
 * drag, not a stray click. Mirrors the threshold used by OnlineTable.
 */
export function isMeaningfulReveal(reveal: Pick<FogReveal, 'width' | 'height'>): boolean {
  return reveal.width >= 0.5 && reveal.height >= 0.5;
}
