'use client';

import { useEffect } from 'react';

const TABLETOP_SURFACE_EVENT = 'ttv:tabletop-surface-open';

type TabletopSurfaceDetail = { id: string };

export function useExclusiveTabletopSurface(id: string, open: boolean, onClose: () => void) {
  useEffect(() => {
    const closeForOtherSurface = (event: Event) => {
      const customEvent = event as CustomEvent<TabletopSurfaceDetail>;
      if (!customEvent.detail?.id || customEvent.detail.id === id) return;
      onClose();
    };
    window.addEventListener(TABLETOP_SURFACE_EVENT, closeForOtherSurface);
    return () => window.removeEventListener(TABLETOP_SURFACE_EVENT, closeForOtherSurface);
  }, [id, onClose]);

  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent<TabletopSurfaceDetail>(TABLETOP_SURFACE_EVENT, {
      detail: { id },
    }));
  }, [id, open]);
}
