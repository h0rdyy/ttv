'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnlineTable } from './OnlineTable';
import { OnlineActorSheet, type SheetActor } from './OnlineActorSheet';
import { OnlineSheetWorkshop } from './OnlineSheetWorkshop';
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
  const [selectedActorId, setSelectedActorId] = useState(() => props.mode === 'player' ? ownActor?.id ?? '' : '');
  const [sheetActorId, setSheetActorId] = useState<string | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (props.mode === 'player') {
      setSelectedActorId(ownActor?.id ?? '');
      if (sheetActorId && sheetActorId !== ownActor?.id) setSheetActorId(null);
      return;
    }
    if (!selectedActorId || props.initialActors.some((actor) => actor.id === selectedActorId)) return;
    setSelectedActorId('');
  }, [props.initialActors, props.mode, ownActor?.id, selectedActorId, sheetActorId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // OnlineActorSheet owns its own Escape handling so dirty values cannot be
      // discarded by this outer layer before the sheet asks for confirmation.
      setManagerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const selectedActor = props.initialActors.find((actor) => actor.id === selectedActorId) ?? null;
  const sheetActor = props.initialActors.find((actor) => actor.id === sheetActorId) ?? null;
  const template = sheetActor ? initialSheetTemplates.find((value) => value.id === sheetActor.sheet_template_id) ?? null : null;

  const refresh = () => router.refresh();
  const openSelectedSheet = () => {
    const actor = props.mode === 'player' ? ownActor : selectedActor;
    if (actor) setSheetActorId(actor.id);
  };

  return (
    <div className="v05-table-layer">
      <OnlineTable
        {...tableProps}
        selectedActorId={selectedActorId}
        onSelectActor={setSelectedActorId}
      />

      <div className={`sheet-dock ${props.mode === 'player' ? 'player' : 'gm'}`}>
        {props.mode === 'gm' && (
          <select value={selectedActor?.id ?? ''} onChange={(event) => setSelectedActorId(event.target.value)} aria-label="Персонаж для листа">
            <option value="">Выберите персонажа…</option>
            {props.initialActors.map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}
          </select>
        )}
        <button className="button" disabled={!(props.mode === 'player' ? ownActor : selectedActor)} onClick={openSelectedSheet}>◇ {props.mode === 'player' ? 'Мой лист' : 'Лист'}</button>
        {gmAllowed && props.mode === 'gm' && <button className={`button ${managerOpen ? 'active' : ''}`} onClick={() => { setManagerOpen((value) => !value); setSheetActorId(null); }}>⚒ Листы</button>}
      </div>

      {managerOpen && props.mode === 'gm' && (
        <section className="workshop-panel online-workshop-panel v05-sheet-workshop-overlay" data-wheel-isolation="true">
          <header className="workshop-header">
            <div className="workshop-title">ЛИСТЫ ПЕРСОНАЖЕЙ</div>
            <div className="workshop-shortcuts">Классический лист · поля мастера</div>
            <button className="close-button" onClick={() => setManagerOpen(false)}>×</button>
          </header>
          <div className="workshop-module-body">
            <OnlineSheetWorkshop
              campaignId={props.campaign.id}
              templates={initialSheetTemplates}
              onChanged={refresh}
              onMessage={setMessage}
            />
          </div>
        </section>
      )}

      {sheetActor && (
        <OnlineActorSheet
          actor={sheetActor}
          template={template}
          canEdit={gmAllowed || sheetActor.owner_user_id === props.currentUserId}
          onClose={() => setSheetActorId(null)}
          onChanged={refresh}
          onMessage={setMessage}
        />
      )}

      {message && <div className="auth-status online-table-message v05-sheet-message" onClick={() => setMessage('')}>{message}</div>}
    </div>
  );
}
