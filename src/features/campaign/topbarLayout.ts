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
    setLayout((current) => {
      const fromIndex = current.findIndex((item) => item.slot === slot);
      if (fromIndex === -1) return current;
      const next = current.filter((item) => item.slot !== slot);
      const target = next.findIndex((item) => item.row === toRow);
      const insertAt = toRow === 'secondary' && (target === -1 || toIndex >= next.length) ? next.length : Math.max(0, Math.min(toIndex, next.length));
      next.splice(insertAt, 0, { slot, row: toRow });
      return next;
    });
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
