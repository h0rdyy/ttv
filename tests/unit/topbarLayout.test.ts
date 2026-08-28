import { describe, expect, it } from 'vitest';
import { DEFAULT_TOPBAR, reorderTopbar, topbarLayoutToSource, type TopbarItem } from '../../src/features/campaign/topbarLayout';

function layoutToString(layout: TopbarItem[]): string {
  return layout.map((item) => `${item.slot}(${item.row === 'primary' ? 'P' : 'S'})`).join(' -> ');
}

function primary(layout: TopbarItem[]): string[] {
  return layout.filter((item) => item.row === 'primary').map((item) => item.slot);
}

function secondary(layout: TopbarItem[]): string[] {
  return layout.filter((item) => item.row === 'secondary').map((item) => item.slot);
}

describe('reorderTopbar', () => {
  it('moves a slot within the primary row', () => {
    // scene-select right of zoom in primary → scene-select becomes index 3 in primary
    const next = reorderTopbar(DEFAULT_TOPBAR, 'scene-select', 3, 'primary');
    expect(primary(next)).toEqual(['brand', 'campaign', 'zoom', 'scene-select', 'menu', 'presence']);
    expect(secondary(next)).toEqual(['scene-menu', 'workshop']);
  });

  it('moves a slot to the left edge of the primary row', () => {
    const next = reorderTopbar(DEFAULT_TOPBAR, 'workshop', 0, 'primary');
    expect(primary(next)).toEqual(['workshop', 'brand', 'campaign', 'scene-select', 'zoom', 'menu', 'presence']);
    expect(secondary(next)).toEqual(['scene-menu']);
  });

  it('moves a slot to the right edge of the primary row', () => {
    const next = reorderTopbar(DEFAULT_TOPBAR, 'presence', 6, 'primary');
    expect(primary(next)).toEqual(['brand', 'campaign', 'scene-select', 'zoom', 'menu', 'presence']);
    expect(secondary(next)).toEqual(['scene-menu', 'workshop']);
  });

  it('moves a primary slot into the secondary row at the end', () => {
    // scene-select right of workshop in secondary → appended after workshop
    const next = reorderTopbar(DEFAULT_TOPBAR, 'scene-select', 2, 'secondary');
    expect(primary(next)).toEqual(['brand', 'campaign', 'zoom', 'menu', 'presence']);
    expect(secondary(next)).toEqual(['scene-menu', 'workshop', 'scene-select']);
    expect(layoutToString(next)).toBe(
      'brand(P) -> campaign(P) -> zoom(P) -> menu(P) -> presence(P) -> scene-menu(S) -> workshop(S) -> scene-select(S)',
    );
  });

  it('moves a primary slot into the middle of the secondary row', () => {
    // scene-select right of scene-menu in secondary → between scene-menu and workshop
    const next = reorderTopbar(DEFAULT_TOPBAR, 'scene-select', 1, 'secondary');
    expect(secondary(next)).toEqual(['scene-menu', 'scene-select', 'workshop']);
  });

  it('moves a secondary slot into the primary row at the right place', () => {
    // workshop right of zoom in primary → index 4 in primary (after zoom, before menu)
    const next = reorderTopbar(DEFAULT_TOPBAR, 'workshop', 4, 'primary');
    expect(primary(next)).toEqual(['brand', 'campaign', 'scene-select', 'zoom', 'workshop', 'menu', 'presence']);
    expect(secondary(next)).toEqual(['scene-menu']);
  });

  it('moves a secondary slot to the left of all primary items', () => {
    // workshop left of brand in primary → at position 0 in primary
    const next = reorderTopbar(DEFAULT_TOPBAR, 'workshop', 0, 'primary');
    expect(primary(next)).toEqual(['workshop', 'brand', 'campaign', 'scene-select', 'zoom', 'menu', 'presence']);
    expect(secondary(next)).toEqual(['scene-menu']);
  });

  it('reorders within the secondary row without leaking into primary', () => {
    // workshop left of scene-menu in secondary → between presence and scene-menu
    const next = reorderTopbar(DEFAULT_TOPBAR, 'workshop', 0, 'secondary');
    expect(primary(next)).toEqual(['brand', 'campaign', 'scene-select', 'zoom', 'menu', 'presence']);
    expect(secondary(next)).toEqual(['workshop', 'scene-menu']);
    expect(layoutToString(next)).toBe(
      'brand(P) -> campaign(P) -> scene-select(P) -> zoom(P) -> menu(P) -> presence(P) -> workshop(S) -> scene-menu(S)',
    );
  });

  it('appends to secondary when it is empty after the move', () => {
    const layout: TopbarItem[] = [
      { slot: 'brand', row: 'primary' },
      { slot: 'zoom', row: 'primary' },
    ];
    const next = reorderTopbar(layout, 'zoom', 0, 'secondary');
    expect(next).toEqual([
      { slot: 'brand', row: 'primary' },
      { slot: 'zoom', row: 'secondary' },
    ]);
  });

  it('is a no-op when the slot is unknown', () => {
    const next = reorderTopbar(DEFAULT_TOPBAR, 'unknown-slot' as never, 0, 'primary');
    expect(next).toBe(DEFAULT_TOPBAR);
  });

  it('does not mutate the source layout', () => {
    const before = DEFAULT_TOPBAR.map((item) => ({ ...item }));
    reorderTopbar(DEFAULT_TOPBAR, 'scene-select', 3, 'primary');
    expect(DEFAULT_TOPBAR).toEqual(before);
  });
});

describe('topbarLayoutToSource', () => {
  it('renders the default layout as a paste-ready array literal', () => {
    const source = topbarLayoutToSource(DEFAULT_TOPBAR);
    expect(source).toBe(
      '[\n' +
        '  { slot: "brand", row: "primary" },\n' +
        '  { slot: "campaign", row: "primary" },\n' +
        '  { slot: "scene-select", row: "primary" },\n' +
        '  { slot: "zoom", row: "primary" },\n' +
        '  { slot: "menu", row: "primary" },\n' +
        '  { slot: "presence", row: "primary" },\n' +
        '  { slot: "scene-menu", row: "secondary" },\n' +
        '  { slot: "workshop", row: "secondary" },\n' +
        ']',
    );
  });

  it('reflects the current ordering of an edited layout', () => {
    const edited = reorderTopbar(DEFAULT_TOPBAR, 'workshop', 0, 'secondary');
    const source = topbarLayoutToSource(edited);
    expect(source.split('\n')[0]).toBe('[');
    expect(source).toContain('{ slot: "workshop", row: "secondary" }');
    // primary block must come before the secondary block in the rendered source
    const primaryLine = source.indexOf('{ slot: "brand", row: "primary" }');
    const secondaryLine = source.indexOf('{ slot: "workshop", row: "secondary" }');
    expect(primaryLine).toBeGreaterThan(-1);
    expect(secondaryLine).toBeGreaterThan(primaryLine);
  });
});
