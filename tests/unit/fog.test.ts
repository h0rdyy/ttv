import { describe, expect, it } from 'vitest';
import { isMeaningfulReveal, isPointRevealed, normalizeReveal, type FogReveal } from '../../src/features/campaign/fog';

describe('fog reveals', () => {
  const reveal = (overrides: Partial<FogReveal> = {}): FogReveal => ({
    id: 'r1', x: 10, y: 20, width: 30, height: 40, ...overrides,
  });

  it('isPointRevealed returns true for a point clearly inside a rectangle', () => {
    expect(isPointRevealed({ x: 20, y: 30 }, [reveal()])).toBe(true);
  });

  it('isPointRevealed returns false for a point clearly outside', () => {
    expect(isPointRevealed({ x: 5, y: 5 }, [reveal()])).toBe(false);
  });

  it('isPointRevealed includes the boundary points', () => {
    expect(isPointRevealed({ x: 10, y: 20 }, [reveal()])).toBe(true);
    expect(isPointRevealed({ x: 40, y: 60 }, [reveal()])).toBe(true);
  });

  it('isPointRevealed treats a zero-size reveal as a single point', () => {
    const point = reveal({ x: 50, y: 50, width: 0, height: 0 });
    expect(isPointRevealed({ x: 50, y: 50 }, [point])).toBe(true);
    expect(isPointRevealed({ x: 50.01, y: 50 }, [point])).toBe(false);
  });

  it('isPointRevealed treats a zero-width reveal as a vertical line', () => {
    const line = reveal({ x: 30, y: 10, width: 0, height: 20 });
    expect(isPointRevealed({ x: 30, y: 15 }, [line])).toBe(true);
    expect(isPointRevealed({ x: 31, y: 15 }, [line])).toBe(false);
  });

  it('isPointRevealed treats a zero-height reveal as a horizontal line', () => {
    const line = reveal({ x: 10, y: 30, width: 20, height: 0 });
    expect(isPointRevealed({ x: 15, y: 30 }, [line])).toBe(true);
    expect(isPointRevealed({ x: 15, y: 31 }, [line])).toBe(false);
  });

  it('isPointRevealed returns true if any reveal covers the point', () => {
    const reveals = [reveal({ x: 0, y: 0, width: 10, height: 10 }), reveal({ x: 50, y: 50, width: 20, height: 20 })];
    expect(isPointRevealed({ x: 5, y: 5 }, reveals)).toBe(true);
    expect(isPointRevealed({ x: 60, y: 60 }, reveals)).toBe(true);
    expect(isPointRevealed({ x: 30, y: 30 }, reveals)).toBe(false);
  });

  it('isPointRevealed handles negative dimensions as zero', () => {
    const broken = reveal({ x: 10, y: 10, width: -5, height: -5 });
    expect(isPointRevealed({ x: 10, y: 10 }, [broken])).toBe(true);
    expect(isPointRevealed({ x: 11, y: 11 }, [broken])).toBe(false);
  });

  it('normalizeReveal clamps negative width and height to zero', () => {
    const out = normalizeReveal({ id: 'r', x: 1, y: 2, width: -3, height: -4 });
    expect(out.width).toBe(0);
    expect(out.height).toBe(0);
  });

  it('normalizeReveal preserves positive values', () => {
    const out = normalizeReveal({ id: 'r', x: 1, y: 2, width: 3, height: 4 });
    expect(out).toEqual({ id: 'r', x: 1, y: 2, width: 3, height: 4 });
  });

  it('isMeaningfulReveal accepts rectangles above the threshold', () => {
    expect(isMeaningfulReveal({ width: 0.5, height: 0.5 })).toBe(true);
    expect(isMeaningfulReveal({ width: 10, height: 10 })).toBe(true);
  });

  it('isMeaningfulReveal rejects small or zero rectangles', () => {
    expect(isMeaningfulReveal({ width: 0, height: 0 })).toBe(false);
    expect(isMeaningfulReveal({ width: 0.4, height: 10 })).toBe(false);
    expect(isMeaningfulReveal({ width: 10, height: 0.4 })).toBe(false);
  });
});
