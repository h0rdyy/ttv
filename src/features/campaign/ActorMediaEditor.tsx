'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { SheetActor } from './OnlineActorSheet';
import { actorMedia, actorMediaUrl } from './actorMedia';
import { mediaDebugError } from './mediaDebugError';
import { TabletopIcon } from './TabletopIcon';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

type Props = {
  actor: SheetActor;
  canEdit: boolean;
  onChanged: () => void;
  onMessage: (message: string) => void;
};

export function ActorMediaEditor({ actor, canEdit, onChanged, onMessage }: Props) {
  const media = actorMedia(actor.system_data);
  const [avatarPath, setAvatarPath] = useState(media.avatarPath);
  const [tokenPath, setTokenPath] = useState(media.tokenPath);
  const [tokenScale, setTokenScale] = useState(media.tokenScale);
  const [tokenOffsetX, setTokenOffsetX] = useState(media.tokenOffsetX);
  const [tokenOffsetY, setTokenOffsetY] = useState(media.tokenOffsetY);
  const [busy, setBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const tokenInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const next = actorMedia(actor.system_data);
    setAvatarPath(next.avatarPath);
    setTokenPath(next.tokenPath);
    setTokenScale(next.tokenScale);
    setTokenOffsetX(next.tokenOffsetX);
    setTokenOffsetY(next.tokenOffsetY);
  }, [actor.id, actor.system_data]);

  const avatarUrl = actorMediaUrl(actor.campaign_id, actor.id, 'avatar', avatarPath);
  const tokenUrl = actorMediaUrl(actor.campaign_id, actor.id, 'token', tokenPath);

  const upload = async (kind: 'avatar' | 'token', file: File) => {
    if (!canEdit || busy) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      onMessage(`Неподдерживаемый формат · type=${file.type || '(empty)'} · name=${file.name}`);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      onMessage(`Изображение слишком большое. Максимум 4 МБ · size=${file.size} bytes · name=${file.name}`);
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${actor.campaign_id}/${actor.id}/${kind}/${crypto.randomUUID()}.${extension}`;
    const previousPath = kind === 'avatar' ? avatarPath : tokenPath;

    const { error: uploadError } = await supabase.storage
      .from('campaign-actor-media')
      .upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[ActorMediaEditor] storage upload failed', {
        kind,
        path,
        file: { name: file.name, type: file.type, size: file.size },
        error: uploadError,
      });
      onMessage(mediaDebugError(uploadError, 'Не удалось загрузить изображение.'));
      setBusy(false);
      return;
    }

    const { error: saveError } = await supabase.rpc('set_actor_media_path', {
      target_actor: actor.id,
      media_kind: kind,
      media_path: path,
    });

    if (saveError) {
      console.error('[ActorMediaEditor] media path save failed', { kind, path, error: saveError });
      await supabase.storage.from('campaign-actor-media').remove([path]);
      onMessage(mediaDebugError(saveError, 'Не удалось сохранить изображение персонажа.'));
      setBusy(false);
      return;
    }

    if (kind === 'avatar') setAvatarPath(path);
    else setTokenPath(path);

    if (previousPath && previousPath !== path) {
      const { error: cleanupError } = await supabase.storage.from('campaign-actor-media').remove([previousPath]);
      if (cleanupError) console.error('[ActorMediaEditor] previous media cleanup failed', { previousPath, error: cleanupError });
    }

    onMessage(kind === 'avatar' ? 'Аватар листа обновлён.' : 'Фишка персонажа обновлена.');
    onChanged();
    setBusy(false);
  };

  const remove = async (kind: 'avatar' | 'token') => {
    if (!canEdit || busy) return;
    const currentPath = kind === 'avatar' ? avatarPath : tokenPath;
    if (!currentPath) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('set_actor_media_path', {
      target_actor: actor.id,
      media_kind: kind,
      media_path: null,
    });

    if (error) {
      console.error('[ActorMediaEditor] media unlink failed', { kind, currentPath, error });
      onMessage(mediaDebugError(error, 'Не удалось убрать изображение.'));
      setBusy(false);
      return;
    }

    const { error: storageError } = await supabase.storage.from('campaign-actor-media').remove([currentPath]);
    if (kind === 'avatar') setAvatarPath(null);
    else setTokenPath(null);
    if (storageError) {
      console.error('[ActorMediaEditor] storage delete failed', { kind, currentPath, error: storageError });
      onMessage(mediaDebugError(storageError, 'Изображение отвязано, но старый файл не удалось удалить.'));
    } else {
      onMessage('Изображение убрано.');
    }
    onChanged();
    setBusy(false);
  };

  const saveTokenPresentation = async () => {
    if (!canEdit || busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('set_actor_token_presentation', {
      target_actor: actor.id,
      token_scale: tokenScale,
      token_offset_x: tokenOffsetX,
      token_offset_y: tokenOffsetY,
    });
    if (error) {
      console.error('[ActorMediaEditor] token presentation save failed', { actorId: actor.id, error });
      onMessage(mediaDebugError(error, 'Не удалось сохранить положение фишки.'));
    } else {
      onMessage('Внешний вид фишки сохранён.');
      onChanged();
    }
    setBusy(false);
  };

  return (
    <aside className="actor-media-editor" data-wheel-isolation="true" aria-label="Внешний вид персонажа">
      <header>
        <div>
          <small>ВНЕШНИЙ ВИД</small>
          <strong>Портрет и фишка</strong>
        </div>
        <TabletopIcon name="characters" />
      </header>

      <section className="actor-media-block">
        <div className="actor-media-heading">
          <div><strong>Аватар листа</strong><small>Отображается в листе персонажа.</small></div>
        </div>
        <div className="actor-avatar-preview">
          {avatarUrl ? <img src={avatarUrl} alt={`Аватар ${actor.name}`} /> : <span>{actor.avatar || '🧙'}</span>}
        </div>
        {canEdit && (
          <div className="actor-media-actions">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload('avatar', file);
                event.currentTarget.value = '';
              }}
            />
            <button type="button" className="button" disabled={busy} onClick={() => avatarInputRef.current?.click()}>{avatarPath ? 'Заменить' : 'Загрузить'}</button>
            {avatarPath && <button type="button" className="button danger" disabled={busy} onClick={() => void remove('avatar')}>Убрать</button>}
          </div>
        )}
      </section>

      <section className="actor-media-block token-media-block">
        <div className="actor-media-heading">
          <div><strong>Фишка на карте</strong><small>Лучше PNG/WebP с прозрачным фоном.</small></div>
        </div>
        <div className="actor-token-preview">
          <div className="actor-token-preview-grid" />
          {tokenUrl ? (
            <img
              src={tokenUrl}
              alt={`Фишка ${actor.name}`}
              style={{
                transform: `translate(calc(-50% + ${tokenOffsetX}%), calc(-100% + ${tokenOffsetY}%)) scale(${tokenScale})`,
              }}
            />
          ) : (
            <span className="actor-token-preview-fallback">{actor.avatar || '🧙'}</span>
          )}
          <i className="actor-token-preview-anchor" />
        </div>
        {canEdit && (
          <>
            <div className="actor-media-actions">
              <input
                ref={tokenInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload('token', file);
                  event.currentTarget.value = '';
                }}
              />
              <button type="button" className="button" disabled={busy} onClick={() => tokenInputRef.current?.click()}>{tokenPath ? 'Заменить' : 'Загрузить'}</button>
              {tokenPath && <button type="button" className="button danger" disabled={busy} onClick={() => void remove('token')}>Убрать</button>}
            </div>

            <div className="actor-token-controls">
              <label>
                <span>Масштаб <b>{Math.round(tokenScale * 100)}%</b></span>
                <input type="range" min="0.5" max="2.5" step="0.05" value={tokenScale} onChange={(event) => setTokenScale(Number(event.target.value))} />
              </label>
              <label>
                <span>Смещение X <b>{tokenOffsetX}%</b></span>
                <input type="range" min="-50" max="50" step="1" value={tokenOffsetX} onChange={(event) => setTokenOffsetX(Number(event.target.value))} />
              </label>
              <label>
                <span>Смещение Y <b>{tokenOffsetY}%</b></span>
                <input type="range" min="-50" max="50" step="1" value={tokenOffsetY} onChange={(event) => setTokenOffsetY(Number(event.target.value))} />
              </label>
              <button type="button" className="button primary full" disabled={busy} onClick={() => void saveTokenPresentation()}>
                {busy ? 'Сохраняем…' : 'Сохранить положение'}
              </button>
            </div>
          </>
        )}
      </section>

      <footer>PNG, JPG или WebP · до 4 МБ</footer>
    </aside>
  );
}
