'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';
import { TabletopIcon } from './TabletopIcon';
import { useExclusiveTabletopSurface } from './useExclusiveTabletopSurface';

type Scene = { id: string; name: string };

type Props = {
  campaignId: string;
  activeSceneId: string | null;
  scenes: Scene[];
  onChanged: () => void;
  onMessage: (message: string) => void;
};

export function TabletopSceneSwitcher({ campaignId, activeSceneId, scenes, onChanged, onMessage }: Props) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState(activeSceneId ?? scenes[0]?.id ?? '');
  useExclusiveTabletopSurface('scene-switcher', open, () => setOpen(false));

  useEffect(() => {
    setHost(document.querySelector<HTMLElement>('.v05-table-layer .online-table-topbar'));
  }, []);

  useEffect(() => {
    setSelectedId(activeSceneId ?? scenes[0]?.id ?? '');
  }, [activeSceneId, scenes]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('[data-scene-switcher="true"]')) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [open]);

  if (!host || scenes.length === 0) return null;
  const selected = scenes.find((scene) => scene.id === selectedId) ?? scenes[0];

  const switchScene = async (sceneId: string) => {
    if (!sceneId || sceneId === selectedId || busy) {
      setOpen(false);
      return;
    }
    const previousId = selectedId;
    setSelectedId(sceneId);
    setOpen(false);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('set_active_scene', {
      target_campaign: campaignId,
      target_scene: sceneId,
    });
    if (error) {
      setSelectedId(previousId);
      onMessage(friendlyError(error, 'Не удалось открыть сцену.'));
    } else {
      onChanged();
    }
    setBusy(false);
  };

  return createPortal(
    <div className="tabletop-scene-switcher" data-scene-switcher="true" data-wheel-isolation="true">
      <button
        type="button"
        className={open ? 'active' : ''}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
      >
        <TabletopIcon name="scene" />
        <span>{busy ? 'Открываем…' : selected?.name ?? 'Сцена'}</span>
        <i aria-hidden="true">⌄</i>
      </button>
      {open && (
        <div className="tabletop-scene-list" role="listbox" aria-label="Сцены кампании">
          {scenes.map((scene) => (
            <button
              key={scene.id}
              type="button"
              role="option"
              aria-selected={scene.id === selectedId}
              onClick={() => void switchScene(scene.id)}
            >
              <TabletopIcon name="scene" />
              <span>{scene.name}</span>
              {scene.id === selectedId && <b>Текущая</b>}
            </button>
          ))}
        </div>
      )}
    </div>,
    host,
  );
}
