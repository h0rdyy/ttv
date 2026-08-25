'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';
import { ActorMediaEditor } from './ActorMediaEditor';
import { MapInteractionTools } from './MapInteractionTools';
import { OnlineTable } from './OnlineTable';
import type { SheetActor } from './OnlineActorSheet';
import { PlayerCharacterWindow } from './PlayerCharacterWindow';
import { PlayerImmersionHud } from './PlayerImmersionHud';
import { SceneMeasurementCalibrator } from './SceneMeasurementCalibrator';
import { TabletopIcon } from './TabletopIcon';
import { TabletopSceneSwitcher } from './TabletopSceneSwitcher';
import { TabletopShellV2 } from './TabletopShellV2';
import { actorMedia, actorMediaUrl } from './actorMedia';
import type { ActorSheetTemplate } from './actorSheets';
import type { FogReveal } from './OnlineSceneTools';
import type { CombatRuntime } from './combat';

type Role = 'owner' | 'gm' | 'assistant-gm' | 'player' | 'spectator';
type Campaign = { id: string; name: string; description: string | null; owner_id: string; active_scene_id: string | null };
type Scene = {
  id: string;
  campaign_id: string;
  name: string;
  background_url: string | null;
  background_path: string | null;
  grid_enabled: boolean;
  fog_enabled: boolean;
  grid_size: number;
  grid_offset_x: number;
  grid_offset_y: number;
  grid_snap: boolean;
  fog_reveals: FogReveal[];
  measurement_unit: string | null;
  measurement_units_per_map_width: number | null;
  created_at: string;
};
type Token = { id: string; scene_id: string; actor_id: string; x: number; y: number; size: number; rotation: number; enemy: boolean; hidden: boolean };
type Inventory = { id: string; campaign_id: string; owner_actor_id: string };
type Container = { id: string; inventory_id: string; name: string; type: string; capacity: number | null; sort_order: number };
type ItemInstance = { id: string; definition_id: string; container_id: string; quantity: number; custom_name: string | null; equipped: boolean; state: Record<string, any> };
type ItemDefinition = {
  id: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  icon: string;
  weight: number | null;
  price: number | null;
  currency: string | null;
  source: string | null;
  properties: Record<string, any>;
  effects: any[];
};
type Note = { id: string; title: string | null; body: string; pinned: boolean; created_at: string; updated_at: string };
type RollTable = { id: string; name: string; die: string; rows: any };
type ActorContextMenu = { actorId: string; x: number; y: number };

type Props = {
  campaign: Campaign;
  role: Role;
  mode: 'gm' | 'player';
  currentUserId: string;
  displayName: string;
  initialScenes: Scene[];
  initialActors: SheetActor[];
  initialTokens: Token[];
  initialInventories: Inventory[];
  initialContainers: Container[];
  initialItemInstances: ItemInstance[];
  initialItemDefinitions: ItemDefinition[];
  initialSheetTemplates: ActorSheetTemplate[];
  initialNotes: Note[];
  initialRollTables: RollTable[];
  initialRuntime: CombatRuntime;
};

export function OnlineTableV05(props: Props) {
  const router = useRouter();
  const { initialSheetTemplates, ...tableProps } = props;
  const actors = props.initialActors.map(withCompatibleHealth);
  const gmAllowed = ['owner', 'gm', 'assistant-gm'].includes(props.role);
  const ownActor = actors.find((actor) => actor.owner_user_id === props.currentUserId) ?? null;
  const activeScene = props.initialScenes.find((scene) => scene.id === props.campaign.active_scene_id) ?? props.initialScenes[0] ?? null;
  const [selectedActorId, setSelectedActorId] = useState(() => props.mode === 'player' ? ownActor?.id ?? '' : '');
  const [characterActorId, setCharacterActorId] = useState<string | null>(null);
  const [actorMenu, setActorMenu] = useState<ActorContextMenu | null>(null);
  const [deleteConfirmActorId, setDeleteConfirmActorId] = useState<string | null>(null);
  const [deletingActorId, setDeletingActorId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const pendingOpenActorIdRef = useRef<string | null>(null);
  const selectedActorIdRef = useRef(selectedActorId);
  selectedActorIdRef.current = selectedActorId;

  useEffect(() => {
    if (props.mode !== 'gm' || !selectedActorId) return;
    const exists = actors.some((actor) => actor.id === selectedActorId);
    if (!exists) pendingOpenActorIdRef.current = selectedActorId;
    else if (pendingOpenActorIdRef.current && pendingOpenActorIdRef.current !== selectedActorId) pendingOpenActorIdRef.current = null;
  }, [props.initialActors, props.mode, selectedActorId]);

  useEffect(() => {
    const actorIds = new Set(actors.map((actor) => actor.id));

    if (props.mode === 'player') {
      setSelectedActorId(ownActor?.id ?? '');
      if (characterActorId && characterActorId !== ownActor?.id) setCharacterActorId(null);
      return;
    }

    const pendingActorId = pendingOpenActorIdRef.current;
    if (pendingActorId && actorIds.has(pendingActorId)) {
      pendingOpenActorIdRef.current = null;
      setSelectedActorId(pendingActorId);
      setCharacterActorId(pendingActorId);
      return;
    }

    if (characterActorId && !actorIds.has(characterActorId)) setCharacterActorId(null);
    if (selectedActorId && !actorIds.has(selectedActorId) && !pendingOpenActorIdRef.current) setSelectedActorId('');
    if (deleteConfirmActorId && !actorIds.has(deleteConfirmActorId)) setDeleteConfirmActorId(null);
  }, [props.initialActors, props.mode, ownActor?.id, selectedActorId, characterActorId, deleteConfirmActorId]);

  useEffect(() => {
    if (props.mode !== 'gm' || !gmAllowed) return;

    const blockRightDrag = (event: PointerEvent) => {
      if (event.button !== 2) return;
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('.online-table-shell.gm-mode .token')) return;
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const openContextMenu = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const actorTarget = target.closest<HTMLButtonElement>('.online-table-shell.gm-mode .token, .online-table-shell.gm-mode .gm-library-actor');
      if (!actorTarget) return;

      event.preventDefault();
      event.stopPropagation();
      actorTarget.click();
      const x = Math.max(8, Math.min(event.clientX, window.innerWidth - 238));
      const y = Math.max(8, Math.min(event.clientY, window.innerHeight - 126));
      window.setTimeout(() => {
        const actorId = selectedActorIdRef.current;
        if (actorId && actors.some((actor) => actor.id === actorId)) setActorMenu({ actorId, x, y });
      }, 0);
    };

    document.addEventListener('pointerdown', blockRightDrag, true);
    document.addEventListener('contextmenu', openContextMenu);
    return () => {
      document.removeEventListener('pointerdown', blockRightDrag, true);
      document.removeEventListener('contextmenu', openContextMenu);
    };
  }, [gmAllowed, props.initialActors, props.mode]);

  useEffect(() => {
    if (!actorMenu) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('[data-gm-actor-context-menu="true"]')) setActorMenu(null);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActorMenu(null);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [actorMenu]);

  const selectedActor = actors.find((actor) => actor.id === selectedActorId) ?? null;
  const characterActor = actors.find((actor) => actor.id === characterActorId) ?? null;
  const template = characterActor ? initialSheetTemplates.find((value) => value.id === characterActor.sheet_template_id) ?? null : null;
  const characterInventory = characterActor
    ? props.initialInventories.find((inventory) => inventory.owner_actor_id === characterActor.id) ?? null
    : null;
  const contextActor = actorMenu ? actors.find((actor) => actor.id === actorMenu.actorId) ?? null : null;
  const deleteActor = deleteConfirmActorId ? actors.find((actor) => actor.id === deleteConfirmActorId) ?? null : null;
  const characterMedia = characterActor ? actorMedia(characterActor.system_data) : null;
  const characterAvatarUrl = characterActor && characterMedia
    ? actorMediaUrl(props.campaign.id, characterActor.id, 'avatar', characterMedia.avatarPath)
    : null;
  const canEditCharacter = Boolean(characterActor && (gmAllowed || characterActor.owner_user_id === props.currentUserId));

  const refresh = () => router.refresh();
  const openSelectedCharacter = () => {
    const actor = props.mode === 'player' ? ownActor : selectedActor;
    if (actor) setCharacterActorId(actor.id);
  };
  const editContextActor = () => {
    if (!actorMenu) return;
    setSelectedActorId(actorMenu.actorId);
    setCharacterActorId(actorMenu.actorId);
    setActorMenu(null);
  };
  const requestDeleteContextActor = () => {
    if (!contextActor) return;
    setDeleteConfirmActorId(contextActor.id);
    setActorMenu(null);
  };
  const deleteConfirmedActor = async () => {
    if (!deleteActor || deletingActorId) return;
    setDeletingActorId(deleteActor.id);
    const supabase = createClient();
    const { error } = await supabase.rpc('delete_campaign_actor', {
      target_campaign: props.campaign.id,
      target_actor: deleteActor.id,
    });
    if (error) setMessage(friendlyError(error, 'Не удалось удалить персонажа.'));
    else {
      if (selectedActorIdRef.current === deleteActor.id) setSelectedActorId('');
      if (characterActorId === deleteActor.id) setCharacterActorId(null);
      pendingOpenActorIdRef.current = null;
      setMessage(`Персонаж «${deleteActor.name}» удалён.`);
      setDeleteConfirmActorId(null);
      refresh();
    }
    setDeletingActorId(null);
  };

  const immersionClasses = props.mode === 'player' ? ' player-immersion' : '';

  return (
    <div className={`v05-table-layer tabletop-shell-v2${immersionClasses}`}>
      <OnlineTable
        {...tableProps}
        initialActors={actors}
        selectedActorId={selectedActorId}
        onSelectActor={setSelectedActorId}
      />

      <TabletopShellV2
        mode={props.mode}
        campaignName={props.campaign.name}
        activeSceneName={activeScene?.name ?? null}
        combatActive={props.initialRuntime.combat_active}
        combatRound={props.initialRuntime.combat_round}
        focusActive={Boolean(characterActor)}
      />

      {props.mode === 'gm' && gmAllowed && (
        <TabletopSceneSwitcher
          campaignId={props.campaign.id}
          activeSceneId={activeScene?.id ?? null}
          scenes={props.initialScenes}
          onChanged={refresh}
          onMessage={setMessage}
        />
      )}

      <MapInteractionTools
        campaignId={props.campaign.id}
        mode={props.mode}
        currentUserId={props.currentUserId}
        displayName={props.displayName}
        scene={activeScene}
      />

      {props.mode === 'gm' && gmAllowed && (
        <SceneMeasurementCalibrator
          campaignId={props.campaign.id}
          scene={activeScene}
          onChanged={refresh}
          onMessage={setMessage}
        />
      )}

      {props.mode === 'gm' && gmAllowed && selectedActor && !characterActor && (
        <button type="button" className="gm-inspector-sheet-button" onClick={openSelectedCharacter}>
          <TabletopIcon name="sheet" />
          <span><strong>Открыть лист</strong><small>{selectedActor.name}</small></span>
        </button>
      )}

      {props.mode === 'player' && (
        <PlayerImmersionHud
          campaignId={props.campaign.id}
          actor={ownActor}
          actors={actors}
          scene={activeScene}
          runtime={props.initialRuntime}
          onOpenCharacter={openSelectedCharacter}
        />
      )}

      {characterActor && (
        <div
          className={`actor-sheet-media-shell ${characterAvatarUrl ? 'has-custom-avatar' : ''}`}
          style={characterAvatarUrl ? { '--actor-sheet-avatar': `url("${characterAvatarUrl}")` } as CSSProperties : undefined}
        >
          <PlayerCharacterWindow
            actor={characterActor}
            template={template}
            inventory={characterInventory}
            containers={props.initialContainers}
            instances={props.initialItemInstances}
            items={props.initialItemDefinitions}
            canEdit={canEditCharacter}
            onClose={() => setCharacterActorId(null)}
            onChanged={refresh}
            onMessage={setMessage}
          />
          <ActorMediaEditor
            actor={characterActor}
            canEdit={canEditCharacter}
            onChanged={refresh}
            onMessage={setMessage}
          />
        </div>
      )}

      {actorMenu && contextActor && (
        <div
          className="online-menu-popover"
          data-gm-actor-context-menu="true"
          role="menu"
          aria-label={`Действия с персонажем ${contextActor.name}`}
          style={{ position: 'fixed', left: actorMenu.x, top: actorMenu.y, width: 230, zIndex: 112 }}
        >
          <button type="button" role="menuitem" onClick={editContextActor}>
            <span>Открыть лист</span><small>Редактировать персонажа</small>
          </button>
          <button type="button" role="menuitem" onClick={requestDeleteContextActor} style={{ color: 'var(--danger, #d96868)' }}>
            <span>Удалить</span><small>Удалить персонажа</small>
          </button>
        </div>
      )}

      {deleteActor && (
        <div className="foundry-confirm-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget && !deletingActorId) setDeleteConfirmActorId(null); }}>
          <section className="foundry-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="actor-delete-title" aria-describedby="actor-delete-description">
            <div className="foundry-confirm-icon danger"><TabletopIcon name="trash" /></div>
            <div>
              <small>УДАЛЕНИЕ ПЕРСОНАЖА</small>
              <h3 id="actor-delete-title">Удалить «{deleteActor.name}»?</h3>
              <p id="actor-delete-description">Вместе с персонажем будут удалены его фишки и инвентарь. Это действие нельзя отменить.</p>
            </div>
            <footer>
              <button type="button" className="button" disabled={Boolean(deletingActorId)} onClick={() => setDeleteConfirmActorId(null)}>Отмена</button>
              <button type="button" className="button danger" disabled={Boolean(deletingActorId)} onClick={() => void deleteConfirmedActor()}>{deletingActorId ? 'Удаляем…' : 'Удалить персонажа'}</button>
            </footer>
          </section>
        </div>
      )}

      {message && <div className="auth-status online-table-message v05-sheet-message" onClick={() => setMessage('')}>{message}</div>}
    </div>
  );
}

function withCompatibleHealth(actor: SheetActor): SheetActor {
  const data = actor.system_data ?? {};
  const sheetHealth = objectResource(data.hit_points);
  const legacyHealth = objectResource(data.hp);
  const health = sheetHealth ?? legacyHealth;
  if (!health || data.hp === health) return actor;
  return { ...actor, system_data: { ...data, hp: health } };
}

function objectResource(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
