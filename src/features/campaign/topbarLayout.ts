import { useCallback, useEffect, useState } from 'react';

export type TopbarSlot =
  | 'brand'
  | 'campaign'
  | 'scene-select'
  | 'zoom'
  | 'menu'
  | 'presence'
  | 'scene-menu'
  | 'workshop';

export type TopbarRow = 'primary' | 'secondary';

export type TopbarItem = {
  slot: TopbarSlot;
  row: TopbarRow;
};

export const DEFAULT_TOPBAR: TopbarItem[] = [
  { slot: 'brand', row: 'primary' },
  { slot: 'campaign', row: 'primary' },
  { slot: 'scene-select', row: 'primary' },
  { slot: 'zoom', row: 'primary' },
  { slot: 'menu', row: 'primary' },
  { slot: 'presence', row: 'primary' },
  { slot: 'scene-menu', row: 'secondary' },
  { slot: 'workshop', row: 'secondary' },
];

const STORAGE_KEY = 'ttv:topbar:layout:v1';
const EDIT_KEY = 'ttv:topbar:edit-mode';

/**
 * Pure reorder: place `slot` at `toIndex` within `toRow`.
 *
 * `toIndex` is a position in the *target row* (0..row.length), not an
 * absolute array index. This matters for cross-row moves (primary ↔ secondary)
 * where the absolute index of a sameRow position is different from the
 * sameRow index itself. Centralising the row-relative → absolute translation
 * here keeps the drag handler in OnlineTable simple and bug-free.
 */
export function reorderTopbar(
  layout: TopbarItem[],
  slot: TopbarSlot,
  toIndex: number,
  toRow: TopbarRow,
): TopbarItem[] {
  const fromIndex = layout.findIndex((item) => item.slot === slot);
  if (fromIndex === -1) return layout;
  const next = layout.filter((item) => item.slot !== slot);
  const rowItems = next.filter((item) => item.row === toRow);
  let insertAt: number;
  if (rowItems.length === 0) {
    insertAt = next.length;
  } else if (toIndex >= rowItems.length) {
    const last = rowItems[rowItems.length - 1];
    insertAt = next.indexOf(last) + 1;
  } else {
    insertAt = next.indexOf(rowItems[toIndex]);
  }
  next.splice(insertAt, 0, { slot, row: toRow });
  return next;
}

/**
 * Render the layout as a copy-pasteable TypeScript array literal matching
 * the shape of `DEFAULT_TOPBAR`. Used by the editor "Copy for prod" action:
 * the dev pastes the snippet into the source file and commits it so the new
 * default ships to all users on the next deploy.
 */
export function topbarLayoutToSource(layout: TopbarItem[]): string {
  const body = layout
    .map((item) => `  { slot: ${JSON.stringify(item.slot)}, row: ${JSON.stringify(item.row)} },`)
    .join('\n');
  return `[\n${body}\n]`;
}

function loadLayoutFromStorage(): TopbarItem[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const validSlots: TopbarSlot[] = ['brand', 'campaign', 'scene-select', 'zoom', 'menu', 'presence', 'scene-menu', 'workshop'];
    const seen = new Set<TopbarSlot>();
    const cleaned: TopbarItem[] = [];
    for (const item of parsed) {
      if (item && typeof item === 'object' && validSlots.includes(item.slot) && !seen.has(item.slot)) {
        seen.add(item.slot);
        cleaned.push({ slot: item.slot, row: item.row === 'secondary' ? 'secondary' : 'primary' });
      }
    }
    // Make sure every default slot is present
    for (const def of DEFAULT_TOPBAR) {
      if (!seen.has(def.slot)) cleaned.push(def);
    }
    return cleaned;
  } catch {
    return null;
  }
}

function saveLayout(layout: TopbarItem[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // ignore quota errors
  }
}

export function useTopbarLayout() {
  // Always start with the default so SSR and the first client render agree
  // (avoids hydration mismatch). The real saved layout is loaded in an effect
  // after mount.
  const [layout, setLayout] = useState<TopbarItem[]>(DEFAULT_TOPBAR);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    const stored = loadLayoutFromStorage();
    if (stored) setLayout(stored);
    try {
      if (window.localStorage.getItem(EDIT_KEY) === '1') {
        setEditMode(true);
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveLayout(layout);
  }, [layout, hydrated]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hydrated) return;
    try {
      window.localStorage.setItem(EDIT_KEY, editMode ? '1' : '0');
    } catch {
      // ignore
    }
  }, [editMode, hydrated]);

  const moveSlot = useCallback((slot: TopbarSlot, toIndex: number, toRow: TopbarRow) => {
    setLayout((current) => reorderTopbar(current, slot, toIndex, toRow));
  }, []);

  const reset = useCallback(() => {
    setLayout(DEFAULT_TOPBAR);
  }, []);

  const toggleEdit = useCallback(() => {
    setEditMode((value) => !value);
  }, []);

  return { layout, moveSlot, reset, editMode, toggleEdit, hydrated };
}

export function topbarIndex(layout: TopbarItem[], row: TopbarRow): number[] {
  return layout
    .map((item, index) => ({ item, index }))
    .filter((entry) => entry.item.row === row)
    .map((entry) => entry.index);
}
