'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';
import { useCampaignRealtime } from './useCampaignRealtime';

type Role = 'owner' | 'gm' | 'assistant-gm' | 'player' | 'spectator';
type Campaign = { id: string; name: string; description: string | null; owner_id: string; active_scene_id: string | null };
type Scene = { id: string; campaign_id: string; name: string; background_url: string | null; grid_enabled: boolean; fog_enabled: boolean; created_at: string };
type Actor = { id: string; campaign_id: string; owner_user_id: string | null; type: string; name: string; subtitle: string; avatar: string; system_data: Record<string, any> };
type Token = { id: string; scene_id: string; actor_id: string; x: number; y: number; size: number; rotation: number; enemy: boolean; hidden: boolean };
type Inventory = { id: string; campaign_id: string; owner_actor_id: string };
type Container = { id: string; inventory_id: string; name: string; type: string; capacity: number | null; sort_order: number };
type ItemInstance = { id: string; definition_id: string; container_id: string; quantity: number; custom_name: string | null; equipped: boolean; state: Record<string, any> };
type ItemDefinition = { id: string; name: string; description: string; category: string; rarity: string; icon: string; weight: number | null };
type Runtime = { campaign_id: string; combat_active: boolean; combat_round: number; combat_turn: number; combat_order: string[]; updated_at: string };

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
  const [runtime, setRuntime] = useState(props.initialRuntime);
  const [selectedActorId, setSelectedActorId] = useState(() => {
    if (mode === 'player') return props.initialActors.find((actor) => actor.owner_user_id === currentUserId)?.id ?? '';
    return props.initialActors.find((actor) => actor.type === 'player')?.id ?? props.initialActors[0]?.id ?? '';
  });
  const [draggingTokenId, setDraggingTokenId] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [actorName, setActorName] = useState('');
  const [actorKind, setActorKind] = useState<'player' | 'npc'>('player');
  const [quickItemName, setQuickItemName] = useState('');
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
      setSelectedActorId(actors[0]?.id ?? '');
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

  const switchScene = async (sceneId: string) => {
    setBusy(true); setMessage('');
    const supabase = createClient();
    const { error } = await supabase.rpc('set_active_scene', { target_campaign: campaign.id, target_scene: sceneId });
    if (error) setMessage(friendlyError(error, 'Не удалось открыть сцену.'));
    else {
      setCampaign((current) => ({ ...current, active_scene_id: sceneId }));
      scheduleRefresh();
    }
    setBusy(false);
  };

  const createActor = async (event: FormEvent) => {
    event.preventDefault();
    if (!actorName.trim()) return;
    setBusy(true); setMessage('');
    const supabase = createClient();
    const { error } = await supabase.rpc('create_campaign_actor', {
      target_campaign: campaign.id,
      actor_name: actorName.trim(),
      actor_kind: actorKind,
      target_scene: activeScene?.id ?? null,
    });
    if (error) setMessage(friendlyError(error, 'Не удалось создать персонажа.'));
    else { setActorName(''); scheduleRefresh(); }
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

  const giveItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedActor || !quickItemName.trim()) return;
    setBusy(true); setMessage('');
    const supabase = createClient();
    const { error } = await supabase.rpc('give_simple_item', {
      target_campaign: campaign.id,
      target_actor: selectedActor.id,
      item_name: quickItemName.trim(),
    });
    if (error) setMessage(friendlyError(error, 'Не удалось выдать предмет.'));
    else {
      setQuickItemName('');
      setMessage(`Предмет выдан: ${selectedActor.name}`);
      scheduleRefresh();
    }
    setBusy(false);
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
    <div className={`online-table-shell ${mode === 'player' ? 'player-mode' : ''}`}>
      <header className="online-table-topbar">
        <div className="online-table-brand">{mode === 'gm' ? '✥ ПАНЕЛЬ МАСТЕРА' : '✦ TTV'}</div>
        <div className="online-table-campaign"><strong>{campaign.name}</strong><small>{mode === 'gm' ? 'Режим мастера' : 'Режим игрока'}</small></div>
        {mode === 'gm' && (
          <div className="online-scene-controls">
            {scenes.length > 0 && <select value={activeScene?.id ?? ''} onChange={(event) => switchScene(event.target.value)} disabled={busy}>{scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</select>}
            <button className="button" onClick={createScene} disabled={busy}>＋ Сцена</button>
          </div>
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
          onPointerCancel={() => setDraggingTokenId(null)}
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
        </section>

        <aside className="online-table-sidebar">
          {mode === 'gm' ? (
            <>
              <div className="online-sidebar-head"><span className="eyebrow">ГРУППА И МИР</span><strong>{actors.length} персонажей</strong></div>
              <div className="online-actor-list">
                {actors.map((actor) => <button key={actor.id} className={selectedActorId === actor.id ? 'selected' : ''} onClick={() => setSelectedActorId(actor.id)}><span>{actor.avatar || '👤'}</span><span><b>{actor.name}</b><small>{actor.subtitle || (actor.type === 'player' ? 'Игрок' : 'NPC')}</small></span><em>{actor.system_data?.hp?.current ?? '—'}</em></button>)}
                {actors.length === 0 && <div className="online-small-empty">Добавьте первого персонажа.</div>}
              </div>

              <form className="online-actor-create" onSubmit={createActor}>
                <strong>Добавить на сцену</strong>
                <input value={actorName} onChange={(event) => setActorName(event.target.value)} placeholder="Имя персонажа" />
                <div><select value={actorKind} onChange={(event) => setActorKind(event.target.value as 'player' | 'npc')}><option value="player">Персонаж игрока</option><option value="npc">NPC</option></select><button className="button primary" disabled={busy || !activeScene}>＋</button></div>
              </form>

              {selectedActor && <ActorCard actor={selectedActor} editable onHp={changeHp} />}
              <InventoryCard actor={selectedActor} containers={selectedContainers} instances={itemInstances} itemById={itemById} />
              {selectedActor && <QuickGive actorName={selectedActor.name} itemName={quickItemName} busy={busy} onItemName={setQuickItemName} onSubmit={giveItem} />}
            </>
          ) : sidebarActor ? (
            <>
              <ActorCard actor={sidebarActor} />
              <InventoryCard actor={sidebarActor} containers={selectedContainers} instances={itemInstances} itemById={itemById} />
            </>
          ) : (
            <div className="online-player-unassigned"><span>🧙</span><h2>Персонаж ещё не назначен</h2><p>Мастер выберет вашего героя в настройках кампании.</p></div>
          )}

          <CombatCard
            runtime={runtime}
            actors={combatActors}
            editable={mode === 'gm'}
            busy={busy}
            onStart={() => void combatAction('start')}
            onNext={() => void combatAction('next')}
            onStop={() => void combatAction('stop')}
          />

          {message && <div className="auth-status online-table-message">{message}</div>}
        </aside>
      </main>
    </div>
  );
}

function ActorCard({ actor, editable = false, onHp }: { actor: Actor; editable?: boolean; onHp?: (actor: Actor, delta: number) => void }) {
  const hp = actor.system_data?.hp;
  const primitiveStats = Object.entries(actor.system_data ?? {}).filter(([key, value]) => !['hp'].includes(key) && ['string', 'number', 'boolean'].includes(typeof value));
  return (
    <section className="online-actor-card">
      <div className="online-actor-title"><span>{actor.avatar || '👤'}</span><div><h2>{actor.name}</h2><p>{actor.subtitle}</p></div></div>
      <div className="online-hp-box"><span>Здоровье</span><b>{hp?.current ?? '—'} / {hp?.max ?? '—'}</b>{editable && hp && <div><button onClick={() => onHp?.(actor,-1)}>−</button><button onClick={() => onHp?.(actor,1)}>＋</button></div>}</div>
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

function QuickGive({ actorName, itemName, busy, onItemName, onSubmit }: { actorName: string; itemName: string; busy: boolean; onItemName: (value: string) => void; onSubmit: (event: FormEvent) => void }) {
  return (
    <form className="online-quick-give" onSubmit={onSubmit}>
      <strong>Выдать предмет</strong>
      <small>{actorName}</small>
      <div><input value={itemName} onChange={(event) => onItemName(event.target.value)} placeholder="Например: Ключ от башни" /><button className="button" disabled={busy || !itemName.trim()}>Выдать</button></div>
    </form>
  );
}

function CombatCard({ runtime, actors, editable, busy, onStart, onNext, onStop }: { runtime: Runtime; actors: Actor[]; editable: boolean; busy: boolean; onStart: () => void; onNext: () => void; onStop: () => void }) {
  const current = runtime.combat_active ? actors[runtime.combat_turn] ?? null : null;
  return (
    <section className="online-combat-card">
      <div className="online-section-title"><strong>Бой</strong>{runtime.combat_active && <span>Раунд {runtime.combat_round}</span>}</div>
      {!runtime.combat_active ? (
        <>{editable ? <button className="button primary full" disabled={busy} onClick={onStart}>⚔ Начать бой</button> : <div className="online-small-empty">Сейчас боя нет.</div>}</>
      ) : (
        <>
          <div className="online-combat-current"><span>Сейчас ход</span><b>{current?.name ?? '—'}</b></div>
          <div className="online-combat-order">{actors.map((actor, index) => <div key={actor.id} className={index === runtime.combat_turn ? 'current' : ''}><span>{index + 1}</span><b>{actor.name}</b><em>{actor.system_data?.hp?.current ?? '—'} HP</em></div>)}</div>
          {editable && <div className="online-combat-actions"><button className="button primary" disabled={busy} onClick={onNext}>Следующий ход →</button><button className="button" disabled={busy} onClick={onStop}>Закончить</button></div>}
        </>
      )}
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
