'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';
import { MapInteractionTools } from './MapInteractionTools';
import { OnlineTable } from './OnlineTable';
import type { SheetActor } from './OnlineActorSheet';
import { PlayerCharacterWindow } from './PlayerCharacterWindow';
import { PlayerImmersionHud } from './PlayerImmersionHud';
import { SceneMeasurementCalibrator } from './SceneMeasurementCalibrator';
import { TabletopShellV2 } from './TabletopShellV2';
import { TabletopUiPreferencesPanel, useTabletopUiPreferences } from './TabletopUiPreferences';
import type { ActorSheetTemplate } from './actorSheets';
import type { FogReveal } from './OnlineSceneTools';

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
type Runtime = { campaign_id: string; combat_active: boolean; combat_round: number; combat_turn: number; combat_order: string[]; updated_at: string };
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
  initialRuntime: Runtime;
};

export function OnlineTableV05(props: Props) {
  const router = useRouter();
  const { initialSheetTemplates, ...tableProps } = props;
  // Classic pre-v0.5 actors stored health in `hp`; the flexible sheet stores the
  // resource in `hit_points`. Keep `hit_points` canonical, but expose an in-memory
  // `hp` alias so legacy table/sidebar code renders the same value without writing
  // duplicate health data back to Supabase.
  const actors = props.initialActors.map(withCompatibleHealth);
  const gmAllowed = ['owner', 'gm', 'assistant-gm'].includes(props.role);
  const ownActor = actors.find((actor) => actor.owner_user_id === props.currentUserId) ?? null;
  const activeScene = props.initialScenes.find((scene) => scene.id === props.campaign.active_scene_id) ?? props.initialScenes[0] ?? null;
  const [selectedActorId, setSelectedActorId] = useState(() => props.mode === 'player' ? ownActor?.id ?? '' : '');
  const [characterActorId, setCharacterActorId] = useState<string | null>(null);
  const [actorMenu, setActorMenu] = useState<ActorContextMenu | null>(null);
  const [deletingActorId, setDeletingActorId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const { preferences, updatePreferences, resetPreferences } = useTabletopUiPreferences(props.currentUserId);
  const pendingOpenActorIdRef = useRef<string | null>(null);
  const selectedActorIdRef = useRef(selectedActorId);
  selectedActorIdRef.current = selectedActorId;

  // Creation happens inside OnlineTable/GM sidebar. Their RPC returns the new id
  // before router.refresh() brings the Actor into this wrapper. Remember that
  // temporary unknown selection so an inner reconciliation cannot lose the
  // request to open the freshly created character.
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
  }, [props.initialActors, props.mode, ownActor?.id, selectedActorId, characterActorId]);

  useEffect(() => {
    if (props.mode !== 'gm' || !gmAllowed) return;

    // Token dragging currently begins on any pointer button. Intercept RMB before
    // the map sees it so a context click never starts a token drag.
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
      // Both token and library row already know how to select their Actor. Reuse
      // that source of truth, then open the menu after React flushes selection.
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
  const deleteContextActor = async () => {
    if (!contextActor || !window.confirm(`Удалить персонажа «${contextActor.name}»? Вместе с ним будут удалены его фишки и инвентарь.`)) return;
    setDeletingActorId(contextActor.id);
    const supabase = createClient();
    const { error } = await supabase.rpc('delete_campaign_actor', {
      target_campaign: props.campaign.id,
      target_actor: contextActor.id,
    });
    if (error) setMessage(friendlyError(error, 'Не удалось удалить персонажа.'));
    else {
      if (selectedActorIdRef.current === contextActor.id) setSelectedActorId('');
      if (characterActorId === contextActor.id) setCharacterActorId(null);
      pendingOpenActorIdRef.current = null;
      setActorMenu(null);
      setMessage(`Персонаж «${contextActor.name}» удалён.`);
      refresh();
    }
    setDeletingActorId(null);
  };

  const immersionClasses = props.mode === 'player' ? ' player-immersion' : '';
  const uiClasses = [
    preferences.dice ? '' : ' ui-hide-dice',
    preferences.movement ? '' : ' ui-hide-movement',
    preferences.sceneInfo ? '' : ' ui-hide-scene-info',
    preferences.presence ? '' : ' ui-hide-presence',
    preferences.density === 'compact' ? ' ui-density-compact' : '',
  ].join('');

  return (
    <div className={`v05-table-layer tabletop-shell-v2${immersionClasses}${uiClasses}`}>
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

      <TabletopUiPreferencesPanel
        preferences={preferences}
        onChange={updatePreferences}
        onReset={resetPreferences}
      />

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
        <PlayerCharacterWindow
          actor={characterActor}
          template={template}
          inventory={characterInventory}
          containers={props.initialContainers}
          instances={props.initialItemInstances}
          items={props.initialItemDefinitions}
          canEdit={gmAllowed || characterActor.owner_user_id === props.currentUserId}
          onClose={() => setCharacterActorId(null)}
          onChanged={refresh}
          onMessage={setMessage}
        />
      )}

      {actorMenu && contextActor && (
        <div
          className="online-menu-popover"
          data-gm-actor-context-menu="true"
          role="menu"
          aria-label={`Действия с персонажем ${contextActor.name}`}
          style={{ position: 'fixed', left: actorMenu.x, top: actorMenu.y, width: 230, zIndex: 12000 }}
        >
          <button type="button" role="menuitem" onClick={editContextActor}>
            <span>✎ Редактировать</span><small>Открыть персонажа</small>
          </button>
          <button type="button" role="menuitem" disabled={deletingActorId === contextActor.id} onClick={() => void deleteContextActor()} style={{ color: 'var(--danger, #d96868)' }}>
            <span>× Удалить</span><small>{deletingActorId === contextActor.id ? 'Удаление…' : 'Удалить персонажа'}</small>
          </button>
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
