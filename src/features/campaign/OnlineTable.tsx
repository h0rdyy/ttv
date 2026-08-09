'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';
import { useCampaignRealtime } from './useCampaignRealtime';
import { OnlineGmWorkshop } from './OnlineGmWorkshop';
import { OnlineGmSidebar, type GmSidebarTab } from './OnlineGmSidebar';

type Role = 'owner' | 'gm' | 'assistant-gm' | 'player' | 'spectator';
type Campaign = { id: string; name: string; description: string | null; owner_id: string; active_scene_id: string | null };
type Scene = { id: string; campaign_id: string; name: string; background_url: string | null; grid_enabled: boolean; fog_enabled: boolean; created_at: string };
type Actor = { id: string; campaign_id: string; owner_user_id: string | null; type: string; name: string; subtitle: string; avatar: string; system_data: Record<string, any> };
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
  initialActors: Actor[];
  initialTokens: Token[];
  initialInventories: Inventory[];
  initialContainers: Container[];
  initialItemInstances: ItemInstance[];
  initialItemDefinitions: ItemDefinition[];
  initialNotes: Note[];
  initialRollTables: RollTable[];
  initialRuntime: Runtime;
};

export function OnlineTable(props: Props) {
  const { role, mode, currentUserId, displayName } = props;
  const router = useRouter();
  const [campaign, setCampaign] = useState(props.campaign);
  const [actors, setActors] = useState(props.initialActors);
  const [tokens, setTokens] = useState(props.initialTokens);
  const [scenes, setScenes] = useState(props.initialScenes);
  const [inventories, setInventories] = useState(props.initialInventories);
  const [containers, setContainers] = useState(props.initialContainers);
  const [itemInstances, setItemInstances] = useState(props.initialItemInstances);
  const [itemDefinitions, setItemDefinitions] = useState(props.initialItemDefinitions);
  const [notes, setNotes] = useState(props.initialNotes);
  const [rollTables, setRollTables] = useState(props.initialRollTables);
  const [runtime, setRuntime] = useState(props.initialRuntime);
  const [selectedActorId, setSelectedActorId] = useState(() => {
    if (mode === 'player') return props.initialActors.find((actor) => actor.owner_user_id === currentUserId)?.id ?? '';
    return props.initialActors.find((actor) => actor.type === 'player')?.id ?? props.initialActors[0]?.id ?? '';
  });
  const [sidebarTab, setSidebarTab] = useState<GmSidebarTab>('party');
  const [workshopOpen, setWorkshopOpen] = useState(false);
  const [draggingTokenId, setDraggingTokenId] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const refreshTimerRef = useRef<number | null>(null);
  const lastBroadcastRef = useRef(0);

  useEffect(() => setCampaign(props.campaign), [props.campaign]);
  useEffect(() => setActors(props.initialActors), [props.initialActors]);
  useEffect(() => { setTokens(props.initialTokens); setPositions({}); }, [props.initialTokens]);
  useEffect(() => setScenes(props.initialScenes), [props.initialScenes]);
  useEffect(() => setInventories(props.initialInventories), [props.initialInventories]);
  useEffect(() => setContainers(props.initialContainers), [props.initialContainers]);
  useEffect(() => setItemInstances(props.initialItemInstances), [props.initialItemInstances]);
  useEffect(() => setItemDefinitions(props.initialItemDefinitions), [props.initialItemDefinitions]);
  useEffect(() => setNotes(props.initialNotes), [props.initialNotes]);
  useEffect(() => setRollTables(props.initialRollTables), [props.initialRollTables]);
  useEffect(() => setRuntime(props.initialRuntime), [props.initialRuntime]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      router.refresh();
    }, 90);
  }, [router]);

  useEffect(() => () => {
    if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
  }, []);

  useEffect(() => {
    if (mode !== 'gm') return;
    const onKey = (event: KeyboardEvent) => {
      const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? '');
      if (event.key === '/' && !editing) {
        event.preventDefault();
        setWorkshopOpen(true);
        requestAnimationFrame(() => document.querySelector<HTMLInputElement>('[data-item-search]')?.focus());
      }
      if (event.key === 'Escape') setWorkshopOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  const onRemoteTokenMove = useCallback((move: { tokenId: string; x: number; y: number }) => {
    setPositions((current) => ({
      ...current,
      [move.tokenId]: {
        x: Math.max(0, Math.min(100, move.x)),
        y: Math.max(0, Math.min(100, move.y)),
      },
    }));
  }, []);

  const onStateChanged = useCallback(() => scheduleRefresh(), [scheduleRefresh]);
  const { status: liveStatus, onlineUsers, broadcastTokenMove } = useCampaignRealtime({
    campaignId: campaign.id,
    currentUserId,
    displayName,
    mode,
    onStateChanged,
    onRemoteTokenMove,
  });

  const activeScene = scenes.find((scene) => scene.id === campaign.active_scene_id) ?? scenes[0] ?? null;
  const selectedActor = actors.find((actor) => actor.id === selectedActorId) ?? null;
  const ownActor = actors.find((actor) => actor.owner_user_id === currentUserId) ?? null;
  const sidebarActor = mode === 'player' ? ownActor : selectedActor;
  const gmAllowed = ['owner', 'gm', 'assistant-gm'].includes(role);

  useEffect(() => {
    if (mode === 'player' && ownActor && selectedActorId !== ownActor.id) setSelectedActorId(ownActor.id);
    if (mode === 'gm' && selectedActorId && !actors.some((actor) => actor.id === selectedActorId)) {
      setSelectedActorId(actors.find((actor) => actor.type === 'player')?.id ?? actors[0]?.id ?? '');
    }
  }, [actors, mode, ownActor, selectedActorId]);

  const inventoryForActor = (actorId?: string | null) => inventories.find((inventory) => inventory.owner_actor_id === actorId);
  const selectedInventory = inventoryForActor(sidebarActor?.id);
  const selectedContainers = selectedInventory ? containers.filter((container) => container.inventory_id === selectedInventory.id) : [];
  const itemById = useMemo(() => new Map(itemDefinitions.map((item) => [item.id, item])), [itemDefinitions]);
  const combatActors = useMemo(
    () => runtime.combat_order.map((id) => actors.find((actor) => actor.id === id)).filter((actor): actor is Actor => Boolean(actor)),
    [runtime.combat_order, actors],
  );

  const createScene = async () => {
    const name = window.prompt('Название новой сцены', 'Новая сцена')?.trim();
    if (!name) return;
    setBusy(true); setMessage('');
    const supabase = createClient();
    const { error } = await supabase.rpc('create_campaign_scene', { target_campaign: campaign.id, scene_name: name });
    if (error) setMessage(friendlyError(error, 'Не удалось создать сцену.'));
    else scheduleRefresh();
    setBusy(false);
  };

  const createPlayerActor = async () => {
    const name = window.prompt('Имя нового героя', 'Новый герой')?.trim();
    if (!name) return;
    setBusy(true); setMessage('');
    const supabase = createClient();
    const { data, error } = await supabase.rpc('create_campaign_actor', {
      target_campaign: campaign.id,
      actor_name: name,
      actor_kind: 'player',
      target_scene: activeScene?.id ?? null,
    });
    if (error) setMessage(friendlyError(error, 'Не удалось создать героя.'));
    else {
      if (typeof data === 'string') setSelectedActorId(data);
      setSidebarTab('party');
      scheduleRefresh();
    }
    setBusy(false);
  };

  const switchScene = async (sceneId: string) => {
    setBusy(true); setMessage('');
    const supabase = createClient();
    const { error } = await supabase.rpc('set_active_scene', { target_campaign: campaign.id, target_scene: sceneId });
    if (error) setMessage(friendlyError(error, 'Не удалось открыть сцену.'));
    else {
      setCampaign((current) => ({ ...current, active_scene_id: sceneId }));
      setTokens([]);
      setPositions({});
      scheduleRefresh();
    }
    setBusy(false);
  };

  const moveDraggingToken = (event: React.PointerEvent<HTMLElement>) => {
    if (!draggingTokenId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    setPositions((current) => ({ ...current, [draggingTokenId]: { x, y } }));

    const token = tokens.find((value) => value.id === draggingTokenId);
    const now = performance.now();
    if (token && !token.hidden && now - lastBroadcastRef.current >= 40) {
      lastBroadcastRef.current = now;
      broadcastTokenMove(draggingTokenId, x, y);
    }
  };

  const cancelTokenDrag = () => {
    if (!draggingTokenId) return;
    const tokenId = draggingTokenId;
    setDraggingTokenId(null);
    setPositions((current) => {
      const next = { ...current };
      delete next[tokenId];
      return next;
    });
  };

  const finishTokenDrag = async () => {
    if (!draggingTokenId) return;
    const tokenId = draggingTokenId;
    const position = positions[tokenId];
    setDraggingTokenId(null);
    if (!position) return;

    const supabase = createClient();
    const { error } = await supabase.rpc('move_scene_token', {
      target_token: tokenId,
      new_x: position.x,
      new_y: position.y,
    });
    if (error) {
      setMessage(friendlyError(error, 'Не удалось сохранить положение фишки.'));
      setPositions((current) => { const next = { ...current }; delete next[tokenId]; return next; });
      return;
    }
    setTokens((current) => current.map((token) => token.id === tokenId ? { ...token, ...position } : token));
    setPositions((current) => { const next = { ...current }; delete next[tokenId]; return next; });
  };

  const changeHp = async (actor: Actor, delta: number) => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('adjust_actor_hp', { target_actor: actor.id, hp_delta: delta });
    if (error) {
      setMessage(friendlyError(error, 'Не удалось изменить здоровье.'));
      return;
    }
    if (data && typeof data === 'object') {
      setActors((current) => current.map((value) => value.id === actor.id ? { ...value, system_data: data as Record<string, any> } : value));
    }
  };

  const combatAction = async (action: 'start' | 'next' | 'stop') => {
    setBusy(true); setMessage('');
    const supabase = createClient();
    const rpc = action === 'start' ? 'start_campaign_combat' : action === 'next' ? 'next_campaign_combat_turn' : 'stop_campaign_combat';
    const { error } = await supabase.rpc(rpc, { target_campaign: campaign.id });
    if (error) setMessage(friendlyError(error, action === 'start' ? 'Не удалось начать бой.' : 'Не удалось изменить ход боя.'));
    else scheduleRefresh();
    setBusy(false);
  };

  if (!activeScene && mode === 'player') {
    return <EmptyPlayerState campaignName={campaign.name} text="Мастер ещё не открыл игровую сцену." />;
  }

  const onlineTitle = onlineUsers.length
    ? onlineUsers.map((user) => `${user.name}${user.mode === 'gm' ? ' · мастер' : ''}`).join('\n')
    : 'Подключение к кампании';

  return (
    <div className={`online-table-shell ${mode === 'player' ? 'player-mode' : 'gm-mode'}`}>
      <header className="online-table-topbar">
        <div className="online-table-brand">{mode === 'gm' ? '✥ ПАНЕЛЬ МАСТЕРА' : '✦ TTV'}</div>
        <div className="online-table-campaign"><strong>{campaign.name}</strong><small>{mode === 'gm' ? 'Режим мастера' : 'Режим игрока'}</small></div>
        {mode === 'gm' && (
          <>
            <div className="online-scene-controls">
              {scenes.length > 0 && <select value={activeScene?.id ?? ''} onChange={(event) => void switchScene(event.target.value)} disabled={busy}>{scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</select>}
              <button className="button" onClick={createScene} disabled={busy}>＋ Сцена</button>
            </div>
            <div className="top-actions online-gm-actions">
              <button className="button" onClick={() => { setSidebarTab('party'); void createPlayerActor(); }}>＋ Герой</button>
              <button className="button" onClick={() => setSidebarTab('party')}>♟ Игроки</button>
              <button className="button" onClick={() => setSidebarTab('npc')}>☠ NPC</button>
              <button className="button" onClick={() => setSidebarTab('notes')}>▤ Заметки</button>
              <button className={`button ${workshopOpen ? 'active' : ''}`} onClick={() => setWorkshopOpen((value) => !value)}>⚒ Мастерская</button>
            </div>
          </>
        )}
        <div className="online-table-spacer" />
        <div className={`online-presence ${liveStatus}`} title={onlineTitle}><i />{liveStatus === 'online' ? `${Math.max(onlineUsers.length, 1)} в сети` : liveStatus === 'connecting' ? 'Подключение…' : 'Нет связи'}</div>
        {gmAllowed && <Link className="button" href={`/campaign/${campaign.id}/${mode === 'gm' ? 'player' : 'play'}`}>{mode === 'gm' ? '👁 Игрок' : 'Мастер'}</Link>}
        {mode === 'gm' && <Link className="button" href={`/campaign/${campaign.id}/manage`}>⚙ Кампания</Link>}
        <Link className="button" href="/campaigns/online">Выйти</Link>
      </header>

      <main className="online-table-workspace">
        <section
          className={`map-stage online-map-stage ${activeScene?.grid_enabled === false ? 'grid-off' : ''} ${draggingTokenId ? 'token-dragging' : ''}`}
          style={activeScene?.background_url ? { backgroundImage: `url(${activeScene.background_url})` } : undefined}
          onPointerMove={moveDraggingToken}
          onPointerUp={() => void finishTokenDrag()}
          onPointerCancel={cancelTokenDrag}
        >
          {!activeScene && mode === 'gm' ? (
            <div className="online-empty-map"><span>🗺</span><h2>Создайте первую сцену</h2><p>С неё начнётся игровой стол этой кампании.</p><button className="button primary" onClick={createScene}>＋ Создать сцену</button></div>
          ) : (
            <>
              {!activeScene?.background_url && <><div className="map-river"/><div className="map-ruin"/><div className="map-location location-a">Неизведанные земли</div><div className="map-location location-b">Путь группы</div></>}
              {activeScene?.fog_enabled && mode === 'player' && <div className="player-fog-hint" />}
              {tokens.map((token) => {
                const actor = actors.find((value) => value.id === token.actor_id);
                if (!actor) return null;
                const hp = actor.system_data?.hp;
                const hpPct = hp?.max ? Math.max(0, Math.min(100, (hp.current / hp.max) * 100)) : 100;
                const position = positions[token.id] ?? { x: token.x, y: token.y };
                const canMove = mode === 'gm' || actor.owner_user_id === currentUserId;
                return (
                  <button
                    key={token.id}
                    className={`token ${token.enemy ? 'enemy' : ''} ${selectedActorId === actor.id ? 'selected' : ''} ${token.hidden ? 'online-hidden-token' : ''}`}
                    style={{ left: `${position.x}%`, top: `${position.y}%` }}
                    onPointerDown={(event) => {
                      setSelectedActorId(actor.id);
                      if (!canMove) return;
                      event.preventDefault();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      lastBroadcastRef.current = 0;
                      setDraggingTokenId(token.id);
                    }}
                    onClick={() => setSelectedActorId(actor.id)}
                    title={canMove ? `${actor.name} — можно перемещать` : actor.name}
                  >
                    <span className="token-avatar">{actor.avatar || (actor.type === 'player' ? '🧙' : '👤')}</span>
                    <span className="token-name">{actor.name}</span>
                    <span className="token-hp"><i style={{ width: `${hpPct}%` }}/></span>
                    {token.hidden && mode === 'gm' && <em className="hidden-token-mark">скрыт</em>}
                  </button>
                );
              })}
              {activeScene && <div className="scene-chip">СЦЕНА · {activeScene.name}</div>}
            </>
          )}

          {mode === 'gm' && workshopOpen && (
            <OnlineGmWorkshop
              campaignId={campaign.id}
              activeSceneId={activeScene?.id ?? null}
              actors={actors}
              items={itemDefinitions}
              tables={rollTables}
              selectedActorId={selectedActorId}
              onSelectActor={setSelectedActorId}
              onClose={() => setWorkshopOpen(false)}
              onChanged={scheduleRefresh}
              onMessage={setMessage}
            />
          )}
        </section>

        {mode === 'gm' ? (
          <OnlineGmSidebar
            campaignId={campaign.id}
            tab={sidebarTab}
            onTab={setSidebarTab}
            actors={actors}
            selectedActorId={selectedActorId}
            onSelectActor={setSelectedActorId}
            inventories={inventories}
            containers={containers}
            instances={itemInstances}
            items={itemDefinitions}
            runtime={runtime}
            notes={notes}
            busy={busy}
            onHp={(actor, delta) => void changeHp(actor, delta)}
            onCombat={(action) => void combatAction(action)}
            onOpenWorkshop={() => setWorkshopOpen(true)}
            onChanged={scheduleRefresh}
            onMessage={setMessage}
          />
        ) : (
          <aside className="online-table-sidebar">
            {sidebarActor ? (
              <>
                <ActorCard actor={sidebarActor} />
                <InventoryCard actor={sidebarActor} containers={selectedContainers} instances={itemInstances} itemById={itemById} />
              </>
            ) : (
              <div className="online-player-unassigned"><span>🧙</span><h2>Персонаж ещё не назначен</h2><p>Мастер выберет вашего героя в настройках кампании.</p></div>
            )}
            <CombatCard runtime={runtime} actors={combatActors} />
          </aside>
        )}
      </main>

      {message && <div className="auth-status online-table-message online-global-message" onClick={() => setMessage('')}>{message}</div>}
    </div>
  );
}

function ActorCard({ actor }: { actor: Actor }) {
  const hp = actor.system_data?.hp;
  const primitiveStats = Object.entries(actor.system_data ?? {}).filter(([key, value]) => !['hp'].includes(key) && ['string', 'number', 'boolean'].includes(typeof value));
  return (
    <section className="online-actor-card">
      <div className="online-actor-title"><span>{actor.avatar || '👤'}</span><div><h2>{actor.name}</h2><p>{actor.subtitle}</p></div></div>
      <div className="online-hp-box"><span>Здоровье</span><b>{hp?.current ?? '—'} / {hp?.max ?? '—'}</b></div>
      <div className="online-stat-grid">{primitiveStats.map(([key,value]) => <div key={key}><span>{statLabel(key)}</span><b>{String(value)}</b></div>)}</div>
    </section>
  );
}

function InventoryCard({ actor, containers, instances, itemById }: { actor: Actor | null; containers: Container[]; instances: ItemInstance[]; itemById: Map<string, ItemDefinition> }) {
  if (!actor) return null;
  return (
    <section className="online-inventory-card">
      <div className="online-section-title"><strong>Инвентарь</strong></div>
      {containers.length === 0 ? <div className="online-small-empty">Инвентарь пока пуст.</div> : containers.map((container) => {
        const rows = instances.filter((instance) => instance.container_id === container.id);
        return <div className="online-container" key={container.id}><header><b>{container.name}</b><span>{rows.length}</span></header>{rows.length === 0 ? <small>Пусто</small> : rows.map((instance) => { const item=itemById.get(instance.definition_id); return item ? <div className="online-item" key={instance.id}><span>{item.icon}</span><span><b>{instance.custom_name || item.name}</b><small>{item.category}</small></span><em>×{instance.quantity}</em></div> : null; })}</div>;
      })}
    </section>
  );
}

function CombatCard({ runtime, actors }: { runtime: Runtime; actors: Actor[] }) {
  const current = runtime.combat_active ? actors[runtime.combat_turn] ?? null : null;
  return (
    <section className="online-combat-card">
      <div className="online-section-title"><strong>Бой</strong>{runtime.combat_active && <span>Раунд {runtime.combat_round}</span>}</div>
      {!runtime.combat_active ? <div className="online-small-empty">Сейчас боя нет.</div> : <><div className="online-combat-current"><span>Сейчас ход</span><b>{current?.name ?? '—'}</b></div><div className="online-combat-order">{actors.map((actor, index) => <div key={actor.id} className={index === runtime.combat_turn ? 'current' : ''}><span>{index + 1}</span><b>{actor.name}</b><em>{actor.system_data?.hp?.current ?? '—'} HP</em></div>)}</div></>}
    </section>
  );
}

function EmptyPlayerState({ campaignName, text }: { campaignName: string; text: string }) {
  return <main className="auth-page"><section className="auth-card"><div className="brand">✦ TTV</div><span className="eyebrow">{campaignName}</span><h1>Стол ещё готовится</h1><p>{text}</p><Link className="button" href="/campaigns/online">К кампаниям</Link></section></main>;
}

function statLabel(key: string) {
  const labels: Record<string,string> = { armor:'Защита', level:'Уровень', strength:'Сила', agility:'Ловкость', mana:'Мана' };
  return labels[key] ?? key;
}
