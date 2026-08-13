'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';
import { MapCropDialog } from './MapCropDialog';

type Scene = {
  id: string;
  name: string;
  background_path: string | null;
  grid_enabled: boolean;
  fog_enabled: boolean;
  grid_size: number;
  grid_offset_x: number;
  grid_offset_y: number;
  grid_snap: boolean;
  fog_reveals: FogReveal[];
};

type Actor = { id: string; type: string; name: string; avatar: string };
type Token = { id: string; actor_id: string; hidden: boolean; size: number };
export type FogReveal = { id: string; x: number; y: number; width: number; height: number };

type Props = {
  campaignId: string;
  scene: Scene;
  actors: Actor[];
  tokens: Token[];
  fogDrawMode: boolean;
  onFogDrawMode: (value: boolean) => void;
  onClose: () => void;
  onChanged: () => void;
  onMessage: (message: string) => void;
};

const MAP_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_MAP_BYTES = 6 * 1024 * 1024;

export function OnlineSceneTools({
  campaignId,
  scene,
  actors,
  tokens,
  fogDrawMode,
  onFogDrawMode,
  onClose,
  onChanged,
  onMessage,
}: Props) {
  const [name, setName] = useState(scene.name);
  const [gridEnabled, setGridEnabled] = useState(scene.grid_enabled);
  const [fogEnabled, setFogEnabled] = useState(scene.fog_enabled);
  const [gridSize, setGridSize] = useState(scene.grid_size);
  const [offsetX, setOffsetX] = useState(scene.grid_offset_x);
  const [offsetY, setOffsetY] = useState(scene.grid_offset_y);
  const [snap, setSnap] = useState(scene.grid_snap);
  const [actorToPlace, setActorToPlace] = useState('');
  const [busy, setBusy] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setName(scene.name);
    setGridEnabled(scene.grid_enabled);
    setFogEnabled(scene.fog_enabled);
    setGridSize(scene.grid_size);
    setOffsetX(scene.grid_offset_x);
    setOffsetY(scene.grid_offset_y);
    setSnap(scene.grid_snap);
    setActorToPlace('');
  }, [scene]);

  const placedActorIds = useMemo(() => new Set(tokens.map((token) => token.actor_id)), [tokens]);
  const availableActors = actors.filter((actor) => !placedActorIds.has(actor.id));

  const saveScene = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('update_campaign_scene', {
      target_campaign: campaignId,
      target_scene: scene.id,
      scene_name: name.trim(),
      scene_grid_enabled: gridEnabled,
      scene_fog_enabled: fogEnabled,
      scene_grid_size: Math.max(16, Math.min(256, Math.round(gridSize || 64))),
      scene_grid_offset_x: Number(offsetX) || 0,
      scene_grid_offset_y: Number(offsetY) || 0,
      scene_grid_snap: snap,
    });
    if (error) onMessage(friendlyError(error, 'Не удалось сохранить сцену.'));
    else {
      onMessage('Сцена сохранена.');
      onChanged();
    }
    setBusy(false);
  };

  const uploadMap = async (file: File) => {
    if (!MAP_TYPES.includes(file.type)) {
      onMessage('Поддерживаются PNG, JPG и WebP.');
      return;
    }
    if (file.size > MAX_MAP_BYTES) {
      onMessage('Карта слишком большая. Максимум 6 МБ.');
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${campaignId}/${scene.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('campaign-maps').upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      onMessage(friendlyError(uploadError, 'Не удалось загрузить карту.'));
      setBusy(false);
      return;
    }

    const { error: saveError } = await supabase.rpc('set_scene_map_path', {
      target_campaign: campaignId,
      target_scene: scene.id,
      map_path: path,
    });

    if (saveError) {
      await supabase.storage.from('campaign-maps').remove([path]);
      onMessage(friendlyError(saveError, 'Не удалось привязать карту к сцене.'));
      setBusy(false);
      return;
    }

    if (scene.background_path && scene.background_path !== path) {
      await supabase.storage.from('campaign-maps').remove([scene.background_path]);
    }

    onMessage('Карта загружена.');
    onChanged();
    setBusy(false);
  };

  const selectMap = (file: File) => {
    if (!MAP_TYPES.includes(file.type)) {
      onMessage('Поддерживаются PNG, JPG и WebP.');
      return;
    }
    if (file.size > MAX_MAP_BYTES) {
      onMessage('Карта слишком большая. Максимум 6 МБ.');
      return;
    }
    setCropFile(file);
  };

  const removeMap = async () => {
    if (!scene.background_path) return;
    setBusy(true);
    const supabase = createClient();
    const mapPath = scene.background_path;
    const { error } = await supabase.rpc('set_scene_map_path', {
      target_campaign: campaignId,
      target_scene: scene.id,
      map_path: null,
    });
    if (error) {
      onMessage(friendlyError(error, 'Не удалось убрать карту со сцены.'));
      setBusy(false);
      return;
    }

    const { error: removeError } = await supabase.storage.from('campaign-maps').remove([mapPath]);
    if (removeError) onMessage('Карта убрана со сцены, но старый файл не удалось очистить.');
    else onMessage('Карта удалена со сцены.');
    onChanged();
    setBusy(false);
  };

  const placeActor = async () => {
    if (!actorToPlace) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('place_actor_on_scene', {
      target_campaign: campaignId,
      target_actor: actorToPlace,
      target_scene: scene.id,
    });
    if (error) onMessage(friendlyError(error, 'Не удалось поставить фишку на сцену.'));
    else {
      setActorToPlace('');
      onChanged();
    }
    setBusy(false);
  };

  const updateToken = async (token: Token, patch: { hidden?: boolean; size?: number }) => {
    const supabase = createClient();
    const { error } = await supabase.rpc('update_scene_token', {
      target_campaign: campaignId,
      target_token: token.id,
      token_hidden: patch.hidden ?? null,
      token_size: patch.size ?? null,
    });
    if (error) onMessage(friendlyError(error, 'Не удалось изменить фишку.'));
    else onChanged();
  };

  const removeToken = async (token: Token) => {
    const actor = actors.find((value) => value.id === token.actor_id);
    if (!window.confirm(`Убрать ${actor?.name ?? 'фишку'} со сцены? Персонаж останется в кампании.`)) return;
    const supabase = createClient();
    const { error } = await supabase.rpc('remove_scene_token', {
      target_campaign: campaignId,
      target_token: token.id,
    });
    if (error) onMessage(friendlyError(error, 'Не удалось убрать фишку.'));
    else onChanged();
  };

  const clearFogReveals = async () => {
    const supabase = createClient();
    const { error } = await supabase.rpc('set_scene_fog_reveals', {
      target_campaign: campaignId,
      target_scene: scene.id,
      reveals: [],
    });
    if (error) onMessage(friendlyError(error, 'Не удалось закрыть карту туманом.'));
    else {
      onMessage('Карта снова скрыта туманом.');
      onChanged();
    }
  };

  const deleteScene = async () => {
    if (!window.confirm(`Удалить сцену «${scene.name}»? Фишки этой сцены тоже будут убраны.`)) return;
    setBusy(true);
    const supabase = createClient();
    const mapPath = scene.background_path;
    const { error } = await supabase.rpc('delete_campaign_scene', {
      target_campaign: campaignId,
      target_scene: scene.id,
    });
    if (error) {
      onMessage(friendlyError(error, 'Не удалось удалить сцену.'));
      setBusy(false);
      return;
    }

    if (mapPath) {
      const { error: storageError } = await supabase.storage.from('campaign-maps').remove([mapPath]);
      if (storageError) onMessage('Сцена удалена. Старый файл карты не удалось очистить автоматически.');
    }
    onClose();
    onChanged();
    setBusy(false);
  };

  return (
    <>
      <section className="scene-tools-panel" data-wheel-isolation="true">
      <header className="scene-tools-head">
        <div><span className="eyebrow">СЦЕНА</span><h2>{scene.name}</h2></div>
        <button className="close-button" onClick={onClose}>×</button>
      </header>

      <div className="scene-tools-scroll">
        <section className="scene-tools-section">
          <h3>ОСНОВНОЕ</h3>
          <label><span>Название</span><input className="control full" value={name} onChange={(event) => setName(event.target.value)} /></label>
          <div className="scene-toggle-row">
            <label><input type="checkbox" checked={gridEnabled} onChange={(event) => setGridEnabled(event.target.checked)} /> Сетка</label>
            <label><input type="checkbox" checked={fogEnabled} onChange={(event) => setFogEnabled(event.target.checked)} /> Туман</label>
          </div>
          <button className="button primary full" disabled={busy} onClick={() => void saveScene()}>Сохранить сцену</button>
        </section>

        <section className="scene-tools-section">
          <h3>КАРТА</h3>
          <p className="muted">PNG, JPG или WebP · до 6 МБ.</p>
          <input
            ref={fileRef}
            className="scene-file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) selectMap(file);
              event.currentTarget.value = '';
            }}
          />
          <button className="button primary full" disabled={busy} onClick={() => fileRef.current?.click()}>{scene.background_path ? 'Заменить карту' : 'Загрузить карту'}</button>
          {scene.background_path && <button className="button danger full" disabled={busy} onClick={() => void removeMap()}>Убрать карту</button>}
        </section>

        <section className="scene-tools-section">
          <h3>СЕТКА</h3>
          <div className="scene-grid-fields">
            <label><span>Клетка, px</span><input className="control" type="number" min={16} max={256} value={gridSize} onChange={(event) => setGridSize(Number(event.target.value))} /></label>
            <label><span>Смещение X</span><input className="control" type="number" value={offsetX} onChange={(event) => setOffsetX(Number(event.target.value))} /></label>
            <label><span>Смещение Y</span><input className="control" type="number" value={offsetY} onChange={(event) => setOffsetY(Number(event.target.value))} /></label>
          </div>
          <label className="scene-check"><input type="checkbox" checked={snap} onChange={(event) => setSnap(event.target.checked)} /> Притягивать фишки к сетке</label>
        </section>

        <section className="scene-tools-section">
          <h3>ТУМАН</h3>
          <p className="muted">Включите туман и рисуйте мышью прямоугольники, которые должны быть видны игрокам.</p>
          <button className={`button full ${fogDrawMode ? 'active' : ''}`} disabled={!fogEnabled} onClick={() => onFogDrawMode(!fogDrawMode)}>{fogDrawMode ? '✓ Режим открытия включён' : 'Открывать область мышью'}</button>
          <button className="button full" disabled={!fogEnabled || scene.fog_reveals.length === 0} onClick={() => void clearFogReveals()}>Закрыть всю карту</button>
        </section>

        <section className="scene-tools-section">
          <h3>ФИШКИ</h3>
          <div className="scene-place-row">
            <select className="control" value={actorToPlace} onChange={(event) => setActorToPlace(event.target.value)}>
              <option value="">Добавить персонажа…</option>
              {availableActors.map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}
            </select>
            <button className="button" disabled={!actorToPlace || busy} onClick={() => void placeActor()}>＋</button>
          </div>
          <div className="scene-token-list">
            {tokens.map((token) => {
              const actor = actors.find((value) => value.id === token.actor_id);
              if (!actor) return null;
              return (
                <div className="scene-token-row" key={token.id}>
                  <span className="scene-token-avatar">{actor.avatar || (actor.type === 'player' ? '🧙' : '👤')}</span>
                  <span><strong>{actor.name}</strong><small>{token.hidden ? 'Скрыт от игроков' : 'Виден игрокам'}</small></span>
                  <button className={`button icon-button ${token.hidden ? 'active' : ''}`} title={token.hidden ? 'Показать' : 'Скрыть'} onClick={() => void updateToken(token, { hidden: !token.hidden })}>{token.hidden ? '◉' : '◌'}</button>
                  <div className="token-size-stepper" title="Размер фишки">
                    <button type="button" disabled={token.size <= 0.25} onClick={() => void updateToken(token, { size: Math.max(0.25, token.size - 0.25) })}>−</button>
                    <span>{Math.round(token.size * 100)}%</span>
                    <button type="button" disabled={token.size >= 4} onClick={() => void updateToken(token, { size: Math.min(4, token.size + 0.25) })}>+</button>
                  </div>
                  <button className="button danger icon-button" title="Убрать со сцены" onClick={() => void removeToken(token)}>×</button>
                </div>
              );
            })}
            {!tokens.length && <div className="online-small-empty">На сцене пока нет фишек.</div>}
          </div>
        </section>

        <section className="scene-tools-section danger-zone">
          <h3>ОПАСНАЯ ЗОНА</h3>
          <button className="button danger full" disabled={busy} onClick={() => void deleteScene()}>Удалить сцену</button>
        </section>
      </div>
      </section>
      {cropFile && <MapCropDialog file={cropFile} maxBytes={MAX_MAP_BYTES} onCancel={() => setCropFile(null)} onError={onMessage} onConfirm={(file) => { setCropFile(null); void uploadMap(file); }} />}
    </>
  );
}
