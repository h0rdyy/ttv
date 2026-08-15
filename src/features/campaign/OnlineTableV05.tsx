'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnlineTable } from './OnlineTable';
import type { SheetActor } from './OnlineActorSheet';
import { PlayerCharacterWindow } from './PlayerCharacterWindow';
import { PlayerImmersionHud } from './PlayerImmersionHud';
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
  const gmAllowed = ['owner', 'gm', 'assistant-gm'].includes(props.role);
  const ownActor = props.initialActors.find((actor) => actor.owner_user_id === props.currentUserId) ?? null;
  const activeScene = props.initialScenes.find((scene) => scene.id === props.campaign.active_scene_id) ?? props.initialScenes[0] ?? null;
  const [selectedActorId, setSelectedActorId] = useState(() => props.mode === 'player' ? ownActor?.id ?? '' : '');
  const [characterActorId, setCharacterActorId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const knownActorIdsRef = useRef(new Set(props.initialActors.map((actor) => actor.id)));

  useEffect(() => {
    const nextIds = new Set(props.initialActors.map((actor) => actor.id));
    const addedIds = new Set(props.initialActors.filter((actor) => !knownActorIdsRef.current.has(actor.id)).map((actor) => actor.id));
    knownActorIdsRef.current = nextIds;

    if (props.mode === 'player') {
      setSelectedActorId(ownActor?.id ?? '');
      if (characterActorId && characterActorId !== ownActor?.id) setCharacterActorId(null);
      return;
    }

    if (selectedActorId && addedIds.has(selectedActorId)) {
      // Both +Hero and +NPC select the newly created actor before refresh.
      // As soon as the refreshed actor arrives, open the unified character window.
      setCharacterActorId(selectedActorId);
    }

    if (characterActorId && !nextIds.has(characterActorId)) setCharacterActorId(null);
    if (!selectedActorId || nextIds.has(selectedActorId)) return;
    setSelectedActorId('');
  }, [props.initialActors, props.mode, ownActor?.id, selectedActorId, characterActorId]);

  const selectedActor = props.initialActors.find((actor) => actor.id === selectedActorId) ?? null;
  const characterActor = props.initialActors.find((actor) => actor.id === characterActorId) ?? null;
  const template = characterActor ? initialSheetTemplates.find((value) => value.id === characterActor.sheet_template_id) ?? null : null;
  const characterInventory = characterActor
    ? props.initialInventories.find((inventory) => inventory.owner_actor_id === characterActor.id) ?? null
    : null;

  const refresh = () => router.refresh();
  const openSelectedCharacter = () => {
    const actor = props.mode === 'player' ? ownActor : selectedActor;
    if (actor) setCharacterActorId(actor.id);
  };

  const immersionClasses = props.mode === 'player' ? ' player-immersion' : '';

  return (
    <div className={`v05-table-layer${immersionClasses}`}>
      <OnlineTable
        {...tableProps}
        selectedActorId={selectedActorId}
        onSelectActor={setSelectedActorId}
      />

      {props.mode === 'player' && (
        <PlayerImmersionHud
          campaignId={props.campaign.id}
          actor={ownActor}
          actors={props.initialActors}
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

      {message && <div className="auth-status online-table-message v05-sheet-message" onClick={() => setMessage('')}>{message}</div>}
    </div>
  );
}
