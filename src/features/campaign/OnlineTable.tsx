'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';
import { useCampaignRealtime } from './useCampaignRealtime';
import { OnlineGmWorkshop } from './OnlineGmWorkshop';
import { OnlineGmSidebar, type GmSidebarTab } from './OnlineGmSidebar';
import { OnlineSceneTools } from './OnlineSceneTools';
import { isMeaningfulReveal, isPointRevealed, type FogReveal } from './fog';
import { DiceTray } from './DiceTray';
import { type DiceRoll, mergeDiceRollHistory } from './dice';
import { actorMedia, actorMediaUrl } from './actorMedia';
import { combatEffectsForActor, combatInitiative, type CombatRuntime } from './combat';
import { nextTokenSelection } from './tokenSelection';
import { bulkSummary, partitionBulkResults, safeBulk } from './bulkOperations';

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
type Note = { id: string; title: string | null; body: string; pinned: boolean; created_at: string; updated_at: string };
type RollTable = { id: string; name: string; die: string; rows: any };
type Camera = { zoom: number; x: number; y: number };
type Size = { width: number; height: number };
type TopbarMenu = 'scene' | 'session' | null;

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
  initialRuntime: CombatRuntime;
  selectedActorId: string;
  onSelectActor: (id: string) => void;
  onMessage: (message: string) => void;
};

export function OnlineTable(props: Props) {
  const { role, mode, currentUserId, displayName, selectedActorId, onSelectActor: setSelectedActorId, onMessage: setMessage } = props;
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
  const [diceHistory, setDiceHistory] = useState<DiceRoll[]>([]);
  const [sidebarTab, setSidebarTab] = useState<GmSidebarTab>('party');
  const [workshopOpen, setWorkshopOpen] = useState(false);
  const [sceneToolsOpen, setSceneToolsOpen] = useState(false);
  const [topbarMenu, setTopbarMenu] = useState<TopbarMenu>(null);
  const [fogDrawMode, setFogDrawMode] = useState(false);
  const [fogDraft, setFogDraft] = useState<FogReveal | null>(null);
  const [draggingTokenId, setDraggingTokenId] = useState<string | null>(null);
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
  const [failedTokenMediaUrls, setFailedTokenMediaUrls] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [camera, setCamera] = useState<Camera>({ zoom: 1, x: 0, y: 0 });
  const [mapNaturalSize, setMapNaturalSize] = useState<Size | null>(null);
  const [mapStageSize, setMapStageSize] = useState<Size | null>(null);
  const [panning, setPanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const refreshTimerRef = useRef<number | null>(null);
  const lastBroadcastRef = useRef(0);
  const mapWorldRef = useRef<HTMLDivElement | null>(null);
  const mapStageRef = useRef<HTMLElement | null>(null);
  const panRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const spaceHeldRef = useRef(false);
  const fogStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => setCampaign(props.campaign), [props.campaign]);
  useEffect(() => setActors(props.initialActors), [props.initialActors]);
  useEffect(() => { setTokens(props.initialTokens); setPositions({}); setSelectedTokenIds([]); }, [props.initialTokens]);
  useEffect(() => setScenes(props.initialScenes), [props.initialScenes]);
  useEffect(() => setInventories(props.initialInventories), [props.initialInventories]);
  useEffect(() => setContainers(props.initialContainers), [props.initialContainers]);
  useEffect(() => setItemInstances(props.initialItemInstances), [props.initialItemInstances]);
  useEffect(() => setItemDefinitions(props.initialItemDefinitions), [props.initialItemDefinitions]);
  useEffect(() => setNotes(props.initialNotes), [props.initialNotes]);
  useEffect(() => setRollTables(props.initialRollTables), [props.initialRollTables]);
  useEffect(() => setRuntime(props.initialRuntime), [props.initialRuntime]);
  useEffect(() => setDiceHistory([]), [props.campaign.id]);
  useEffect(() => setFailedTokenMediaUrls(new Set()), [props.campaign.id]);

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
    if (!topbarMenu) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('[data-topbar-menu-root="true"]')) setTopbarMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTopbarMenu(null);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [topbarMenu]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceHeldRef.current = true;
      if (mode !== 'gm') return;
      const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? '');
      if (event.key === '/' && !editing) {
        event.preventDefault();
        setWorkshopOpen(true);
        requestAnimationFrame(() => document.querySelector<HTMLInputElement>('[data-item-search]')?.focus());
      }
      if (event.key === 'Escape') {
        setWorkshopOpen(false);
        setSceneToolsOpen(false);
        setFogDrawMode(false);
        setFogDraft(null);
        fogStartRef.current = null;
        setSelectedTokenIds([]);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceHeldRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
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
  const onDiceRoll = useCallback((roll: DiceRoll) => {
    setDiceHistory((current) => mergeDiceRollHistory(current, roll));
  }, []);
  const { status: liveStatus, onlineUsers, broadcastTokenMove } = useCampaignRealtime({
    campaignId: campaign.id,
    currentUserId,
    displayName,
    mode,
    onStateChanged,
    onRemoteTokenMove,
    onDiceRoll,
  });

  const activeScene = scenes.find((scene) => scene.id === campaign.active_scene_id) ?? scenes[0] ?? null;
  const selectedActor = actors.find((actor) => actor.id === selectedActorId) ?? null;
  const ownActor = actors.find((actor) => actor.owner_user_id === currentUserId) ?? null;
  const sidebarActor = mode === 'player' ? ownActor : selectedActor;
  const gmAllowed = ['owner', 'gm', 'assistant-gm'].includes(role);

  useEffect(() => {
    setCamera({ zoom: 1, x: 0, y: 0 });
    setFogDraft(null);
    fogStartRef.current = null;
    setFogDrawMode(false);
  }, [activeScene?.id]);

  useEffect(() => {
    const stage = mapStageRef.current;
    if (!stage) return;
    const updateSize = () => setMapStageSize({ width: stage.clientWidth, height: stage.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const url = activeScene?.background_url;
    if (!url) {
      setMapNaturalSize(null);
      return;
    }
    let disposed = false;
    const image = new Image();
    image.onload = () => {
      if (!disposed && image.naturalWidth > 0 && image.naturalHeight > 0) {
        setMapNaturalSize({ width: image.naturalWidth, height: image.naturalHeight });
      }
    };
    image.onerror = () => { if (!disposed) setMapNaturalSize(null); };
    image.src = url;
    return () => { disposed = true; };
  }, [activeScene?.background_url]);

  useEffect(() => {
    if (mode === 'player' && ownActor && selectedActorId !== ownActor.id) setSelectedActorId(ownActor.id);
    if (mode === 'gm' && selectedActorId && !actors.some((actor) => actor.id === selectedActorId)) {
      setSelectedActorId(actors.find((actor) => actor.type === 'player')?.id ?? actors[0]?.id ?? '');
    }
  }, [actors, mode, ownActor, selectedActorId, setSelectedActorId]);

  const inventoryForActor = (actorId?: string | null) => inventories.find((inventory) => inventory.owner_actor_id === actorId);
  const selectedInventory = inventoryForActor(sidebarActor?.id);
  const selectedContainers = selectedInventory ? containers.filter((container) => container.inventory_id === selectedInventory.id) : [];
  const itemById = useMemo(() => new Map(itemDefinitions.map((item) => [item.id, item])), [itemDefinitions]);

  const createScene = async () => {
    const name = window.prompt('Название новой сцены', 'Новая сцена')?.trim();
    if (!name) return;
    setBusy(true); setMessage('');
    const supabase = createClient();
    const { data, error } = await supabase.rpc('create_campaign_scene', { target_campaign: campaign.id, scene_name: name });
    if (error) setMessage(friendlyError(error, 'Не удалось создать сцену.'));
    else {
      if (!campaign.active_scene_id && typeof data === 'string') setCampaign((current) => ({ ...current, active_scene_id: data }));
      scheduleRefresh();
    }
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
      setSelectedTokenIds([]);
      scheduleRefresh();
    }
    setBusy(false);
  };

  const patchScene = async (patch: { grid?: boolean; fog?: boolean }) => {
    if (!activeScene || mode !== 'gm') return;
    const supabase = createClient();
    const { error } = await supabase.rpc('update_campaign_scene', {
      target_campaign: campaign.id,
      target_scene: activeScene.id,
      scene_name: null,
      scene_grid_enabled: patch.grid ?? null,
      scene_fog_enabled: patch.fog ?? null,
      scene_grid_size: null,
      scene_grid_offset_x: null,
      scene_grid_offset_y: null,
      scene_grid_snap: null,
    });
    if (error) {
      setMessage(friendlyError(error, 'Не удалось изменить сцену.'));
      return;
    }
    setScenes((current) => current.map((scene) => scene.id === activeScene.id ? {
      ...scene,
      grid_enabled: patch.grid ?? scene.grid_enabled,
      fog_enabled: patch.fog ?? scene.fog_enabled,
    } : scene));
    scheduleRefresh();
  };

  const pointInWorld = (event: React.PointerEvent<HTMLElement>) => {
    const rect = mapWorldRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
    };
  };

  const moveDraggingToken = (event: React.PointerEvent<HTMLElement>) => {
    if (!draggingTokenId) return;
    const point = pointInWorld(event);
    if (!point) return;
    setPositions((current) => ({ ...current, [draggingTokenId]: point }));

    const token = tokens.find((value) => value.id === draggingTokenId);
    const now = performance.now();
    const liveVisible = token && !token.hidden && (!activeScene?.fog_enabled || isPointRevealed(point, activeScene.fog_reveals ?? []));
    if (liveVisible && now - lastBroadcastRef.current >= 40) {
      lastBroadcastRef.current = now;
      broadcastTokenMove(draggingTokenId, point.x, point.y);
    }
  };

  const snapPosition = (position: { x: number; y: number }) => {
    if (!activeScene?.grid_enabled || !activeScene.grid_snap || !mapWorldRef.current) return position;
    const rect = mapWorldRef.current.getBoundingClientRect();
    const baseWidth = rect.width / camera.zoom;
    const baseHeight = rect.height / camera.zoom;
    if (!baseWidth || !baseHeight) return position;
    const xPx = (position.x / 100) * baseWidth;
    const yPx = (position.y / 100) * baseHeight;
    const size = activeScene.grid_size || 64;
    const snappedX = Math.round((xPx - activeScene.grid_offset_x) / size) * size + activeScene.grid_offset_x;
    const snappedY = Math.round((yPx - activeScene.grid_offset_y) / size) * size + activeScene.grid_offset_y;
    return {
      x: Math.max(0, Math.min(100, (snappedX / baseWidth) * 100)),
      y: Math.max(0, Math.min(100, (snappedY / baseHeight) * 100)),
    };
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
    const rawPosition = positions[tokenId];
    setDraggingTokenId(null);
    if (!rawPosition) return;
    const position = snapPosition(rawPosition);

    if (mode === 'player' && activeScene?.fog_enabled && !isPointRevealed(position, activeScene.fog_reveals ?? [])) {
      setMessage('Эта область пока скрыта туманом.');
      setPositions((current) => { const next = { ...current }; delete next[tokenId]; return next; });
      return;
    }

    const token = tokens.find((value) => value.id === tokenId);
    const liveVisible = token && !token.hidden && (!activeScene?.fog_enabled || isPointRevealed(position, activeScene.fog_reveals ?? []));
    if (liveVisible) broadcastTokenMove(tokenId, position.x, position.y);
    setPositions((current) => ({ ...current, [tokenId]: position }));

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
    setTokens((current) => current.map((value) => value.id === tokenId ? { ...value, ...position } : value));
    setPositions((current) => { const next = { ...current }; delete next[tokenId]; return next; });
  };

  const beginFogDraw = (event: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== 'gm' || !fogDrawMode || !activeScene?.fog_enabled || event.button !== 0) return;
    const point = pointInWorld(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    fogStartRef.current = point;
    setFogDraft({ id: 'draft', x: point.x, y: point.y, width: 0, height: 0 });
  };

  const moveFogDraw = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = fogStartRef.current;
    if (!start) return;
    const point = pointInWorld(event);
    if (!point) return;
    setFogDraft({
      id: 'draft',
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
    });
  };

  const finishFogDraw = async () => {
    const draft = fogDraft;
    fogStartRef.current = null;
    setFogDraft(null);
    if (!draft || !activeScene || !isMeaningfulReveal(draft)) return;
    const reveal = { ...draft, id: crypto.randomUUID() };
    const reveals = [...(activeScene.fog_reveals ?? []), reveal];
    setScenes((current) => current.map((scene) => scene.id === activeScene.id ? { ...scene, fog_reveals: reveals } : scene));
    const supabase = createClient();
    const { error } = await supabase.rpc('set_scene_fog_reveals', {
      target_campaign: campaign.id,
      target_scene: activeScene.id,
      reveals,
    });
    if (error) {
      setMessage(friendlyError(error, 'Не удалось открыть область карты.'));
      scheduleRefresh();
    }
  };

  const beginPan = (event: React.PointerEvent<HTMLElement>) => {
    if (fogDrawMode || draggingTokenId) return;
    if (event.button !== 1 && !(event.button === 0 && spaceHeldRef.current)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    setPanning(true);
  };

  const movePan = (event: React.PointerEvent<HTMLElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    const dx = event.clientX - pan.x;
    const dy = event.clientY - pan.y;
    panRef.current = { ...pan, x: event.clientX, y: event.clientY };
    setCamera((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
  };

  const endPan = (event: React.PointerEvent<HTMLElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    panRef.current = null;
    setPanning(false);
  };

  const changeZoom = (nextZoom: number) => {
    setCamera((current) => ({ ...current, zoom: Math.max(0.5, Math.min(3, nextZoom)) }));
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

  const selectToken = (tokenId: string, actorId: string, additive: boolean) => {
    const next = nextTokenSelection(selectedTokenIds, tokenId, mode === 'gm' && additive);
    const primaryActorId = next.includes(tokenId)
      ? actorId
      : tokens.find((token) => next.includes(token.id))?.actor_id ?? '';
    setSelectedTokenIds(next);
    setSelectedActorId(primaryActorId);
  };

  const markTokenMediaFailed = (url: string) => {
    setFailedTokenMediaUrls((current) => {
      if (current.has(url)) return current;
      const next = new Set(current);
      next.add(url);
      return next;
    });
  };

  const clearTokenSelection = () => {
    setSelectedTokenIds([]);
    if (mode === 'gm') setSelectedActorId('');
  };

  const bulkUpdateHidden = async (hidden: boolean) => {
    if (mode !== 'gm' || !selectedTokenIds.length || bulkBusy) return;
    setBulkBusy(true);
    setMessage('');
    const supabase = createClient();
    const ids = [...selectedTokenIds];
    const results = await Promise.all(ids.map((tokenId) => safeBulk(supabase.rpc('update_scene_token', {
      target_campaign: campaign.id,
      target_token: tokenId,
      token_hidden: hidden,
      token_size: null,
    }))));
    const { succeeded, failed } = partitionBulkResults(ids, results);
    const succeededIds = new Set(succeeded.map((entry) => entry.item));
    if (succeededIds.size) {
      setTokens((current) => current.map((token) => succeededIds.has(token.id) ? { ...token, hidden } : token));
    }
    const verb = hidden ? 'Скрыто фишек' : 'Показано фишек';
    if (failed.length) {
      const firstError = failed[0]?.error;
      const fallback = hidden ? 'Не удалось скрыть все фишки.' : 'Не удалось показать все фишки.';
      const base = firstError ? friendlyError(firstError, fallback) : fallback;
      setMessage(`${base} ${bulkSummary(verb, succeeded.length, failed.length)}`);
    } else {
      setMessage(bulkSummary(verb, succeeded.length, 0));
    }
    if (succeeded.length) scheduleRefresh();
    setBulkBusy(false);
  };

  const bulkRemoveFromScene = async () => {
    if (mode !== 'gm' || !selectedTokenIds.length || bulkBusy) return;
    if (!window.confirm(`Убрать выбранные фишки со сцены (${selectedTokenIds.length})? Персонажи останутся в кампании.`)) return;
    setBulkBusy(true);
    setMessage('');
    const supabase = createClient();
    const ids = [...selectedTokenIds];
    const results = await Promise.all(ids.map((tokenId) => safeBulk(supabase.rpc('remove_scene_token', {
      target_campaign: campaign.id,
      target_token: tokenId,
    }))));
    const { succeeded, failed } = partitionBulkResults(ids, results);
    const succeededIds = new Set(succeeded.map((entry) => entry.item));
    if (succeededIds.size) {
      setTokens((current) => current.filter((token) => !succeededIds.has(token.id)));
      setSelectedTokenIds((current) => current.filter((id) => !succeededIds.has(id)));
    }
    if (failed.length) {
      const firstError = failed[0]?.error;
      const base = firstError ? friendlyError(firstError, 'Не удалось убрать все фишки со сцены.') : 'Не удалось убрать все фишки со сцены.';
      setMessage(`${base} ${bulkSummary('Убрано со сцены', succeeded.length, failed.length)}`);
    } else {
      setMessage(bulkSummary('Убрано со сцены', succeeded.length, 0));
    }
    if (succeeded.length) scheduleRefresh();
    setBulkBusy(false);
  };

  const selectAllNpcTokens = () => {
    if (mode !== 'gm' || !activeScene) return;
    const npcTokenIds = tokens.filter((token) => {
      const actor = actors.find((value) => value.id === token.actor_id);
      return actor && actor.type !== 'player';
    }).map((token) => token.id);
    setSelectedTokenIds(npcTokenIds);
    const primary = tokens.find((token) => npcTokenIds.includes(token.id));
    setSelectedActorId(primary?.actor_id ?? '');
  };

  if (!activeScene && mode === 'player') {
    return <EmptyPlayerState campaignName={campaign.name} text="Мастер ещё не открыл игровую сцену." />;
  }

  const onlineTitle = onlineUsers.length
    ? onlineUsers.map((user) => `${user.name}${user.mode === 'gm' ? ' · мастер' : ''}`).join('\n')
    : 'Подключение к кампании';

  const reveals = activeScene?.fog_reveals ?? [];
  const zoomLabel = `${Math.round(camera.zoom * 100)}%`;
  const fittedMapSize = mapNaturalSize && mapStageSize
    ? (() => {
        const scale = Math.min(mapStageSize.width / mapNaturalSize.width, mapStageSize.height / mapNaturalSize.height);
        return { width: mapNaturalSize.width * scale, height: mapNaturalSize.height * scale };
      })()
    : null;

  return (
    <div className={`online-table-shell ${mode === 'player' ? 'player-mode' : 'gm-mode'}`}>
      <header className="online-table-topbar">
        <div className="online-table-brand">{mode === 'gm' ? '✥ ПАНЕЛЬ МАСТЕРА' : '✦ TTV'}</div>
        <div className="online-table-campaign"><strong>{campaign.name}</strong><small>{mode === 'gm' ? 'Режим мастера' : 'Режим игрока'}</small></div>

        {mode === 'gm' && scenes.length > 0 && (
          <div className="online-scene-controls">
            <select value={activeScene?.id ?? ''} onChange={(event) => void switchScene(event.target.value)} disabled={busy} aria-label="Текущая сцена">
              {scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.name}</option>)}
            </select>
          </div>
        )}

        <div className="map-zoom-controls">
          <button className="button icon-button" title="Уменьшить карту" aria-label="Уменьшить карту" onClick={() => changeZoom(camera.zoom - 0.1)}>−</button>
          <button className="button zoom-label" title="Сбросить вид" onClick={() => setCamera({ zoom: 1, x: 0, y: 0 })}>{zoomLabel}</button>
          <button className="button icon-button" title="Увеличить карту" aria-label="Увеличить карту" onClick={() => changeZoom(camera.zoom + 0.1)}>＋</button>
        </div>

        {mode === 'gm' && (
          <>
            <div className="online-topbar-menu" data-topbar-menu-root="true">
              <button
                className={`button online-menu-trigger ${topbarMenu === 'scene' || sceneToolsOpen ? 'active' : ''}`}
                type="button"
                aria-haspopup="menu"
                aria-expanded={topbarMenu === 'scene'}
                onClick={() => setTopbarMenu((current) => current === 'scene' ? null : 'scene')}
              >
                ▣ Сцена <span aria-hidden="true">⌄</span>
              </button>
              {topbarMenu === 'scene' && (
                <div className="online-menu-popover scene-menu" role="menu" aria-label="Действия сцены">
                  <button type="button" role="menuitem" disabled={busy} onClick={() => { setTopbarMenu(null); void createScene(); }}>
                    <span>＋ Новая сцена</span><small>Создать чистую игровую сцену</small>
                  </button>
                  <button type="button" role="menuitemcheckbox" aria-checked={Boolean(activeScene?.grid_enabled)} disabled={!activeScene} onClick={() => { setTopbarMenu(null); void patchScene({ grid: !activeScene?.grid_enabled }); }}>
                    <span>▦ Сетка</span><em>{activeScene?.grid_enabled ? 'Включена' : 'Выключена'}</em>
                  </button>
                  <button type="button" role="menuitemcheckbox" aria-checked={Boolean(activeScene?.fog_enabled)} disabled={!activeScene} onClick={() => { setTopbarMenu(null); void patchScene({ fog: !activeScene?.fog_enabled }); }}>
                    <span>♟ Туман войны</span><em>{activeScene?.fog_enabled ? 'Включён' : 'Выключен'}</em>
                  </button>
                  <button type="button" role="menuitem" disabled={!activeScene} onClick={() => { setTopbarMenu(null); setSceneToolsOpen((value) => !value); setWorkshopOpen(false); }}>
                    <span>⚙ Настройки сцены</span><small>Карта, фишки, сетка и туман</small>
                  </button>
                </div>
              )}
            </div>
            <button className={`button online-workshop-trigger ${workshopOpen ? 'active' : ''}`} onClick={() => { setTopbarMenu(null); setWorkshopOpen((value) => !value); setSceneToolsOpen(false); }}>⚒ Мастерская</button>
          </>
        )}
        <div className="online-table-spacer" />
        <div className={`online-presence ${liveStatus}`} title={onlineTitle}><i />{liveStatus === 'online' ? `${Math.max(onlineUsers.length, 1)} в сети` : liveStatus === 'connecting' ? 'Подключение…' : 'Нет связи'}</div>
        <div className="online-topbar-menu session-menu-root" data-topbar-menu-root="true">
          <button
            className={`button online-menu-trigger ${topbarMenu === 'session' ? 'active' : ''}`}
            type="button"
            aria-haspopup="menu"
            aria-expanded={topbarMenu === 'session'}
            onClick={() => setTopbarMenu((current) => current === 'session' ? null : 'session')}
          >
            ☰ <span>Меню</span>
          </button>
          {topbarMenu === 'session' && (
            <div className="online-menu-popover align-right" role="menu" aria-label="Меню игрового стола">
              {gmAllowed && <Link role="menuitem" href={`/campaign/${campaign.id}/${mode === 'gm' ? 'player' : 'play'}`}><span>{mode === 'gm' ? '👁 Режим игрока' : '✥ Режим мастера'}</span><small>Переключить представление стола</small></Link>}
              {mode === 'gm' && <Link role="menuitem" href={`/campaign/${campaign.id}/manage`}><span>⚙ Управление кампанией</span><small>Участники, герои и приглашение</small></Link>}
              <Link role="menuitem" href="/campaigns/online"><span>← К списку кампаний</span><small>Покинуть игровой стол</small></Link>
            </div>
          )}
        </div>
      </header>

      <main className="online-table-workspace">
        <section
          ref={mapStageRef}
          className={`map-stage online-map-stage ${draggingTokenId ? 'token-dragging' : ''} ${panning ? 'map-panning' : ''} ${fogDrawMode ? 'fog-drawing' : ''}`}
          onWheel={(event) => {
            const target = event.target;
            if (target instanceof Element && target.closest('[data-wheel-isolation="true"]')) return;
            event.preventDefault();
            changeZoom(camera.zoom * (event.deltaY < 0 ? 1.1 : 0.9));
          }}
          onPointerDown={beginPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
        >
          {!activeScene && mode === 'gm' ? (
            <div className="online-empty-map"><span>🗺</span><h2>Создайте первую сцену</h2><p>С неё начнётся игровой стол этой кампании.</p><button className="button primary" onClick={createScene}>＋ Создать сцену</button></div>
          ) : activeScene ? (
            <>
              <div
                ref={mapWorldRef}
                className="online-map-world"
                style={{
                  ...(fittedMapSize ? {
                    width: `${fittedMapSize.width}px`,
                    height: `${fittedMapSize.height}px`,
                    left: '50%',
                    top: '50%',
                  } : { inset: 0 }),
                  transform: `${fittedMapSize ? 'translate(-50%, -50%) ' : ''}translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`,
                  backgroundImage: activeScene.background_url ? `url(${activeScene.background_url})` : undefined,
                }}
                onPointerDown={(event) => {
                  if (mode === 'gm' && event.button === 0 && !fogDrawMode && event.target === event.currentTarget) {
                    clearTokenSelection();
                  }
                  beginFogDraw(event);
                }}
                onPointerMove={(event) => { moveDraggingToken(event); moveFogDraw(event); }}
                onPointerUp={() => { void finishTokenDrag(); void finishFogDraw(); }}
                onPointerCancel={() => { cancelTokenDrag(); fogStartRef.current = null; setFogDraft(null); }}
              >
                {!activeScene.background_url && <><div className="map-river"/><div className="map-ruin"/><div className="map-location location-a">Неизведанные земли</div><div className="map-location location-b">Путь группы</div></>}

                {activeScene.grid_enabled && (
                  <div
                    className="online-grid-layer"
                    style={{
                      backgroundSize: `${activeScene.grid_size}px ${activeScene.grid_size}px`,
                      backgroundPosition: `${activeScene.grid_offset_x}px ${activeScene.grid_offset_y}px`,
                    }}
                  />
                )}

                {tokens.map((token) => {
                  const actor = actors.find((value) => value.id === token.actor_id);
                  if (!actor) return null;
                  const hp = actor.system_data?.hp;
                  const hpPct = hp?.max ? Math.max(0, Math.min(100, (hp.current / hp.max) * 100)) : 100;
                  const position = positions[token.id] ?? { x: token.x, y: token.y };
                  const hiddenByFog = mode === 'player' && activeScene.fog_enabled && actor.owner_user_id !== currentUserId && !isPointRevealed(position, reveals);
                  if (hiddenByFog && draggingTokenId !== token.id) return null;
                  const canMove = !fogDrawMode && (mode === 'gm' || actor.owner_user_id === currentUserId);
                  const media = actorMedia(actor.system_data);
                  const rawTokenArtUrl = actorMediaUrl(campaign.id, actor.id, 'token', media.tokenPath);
                  const rawAvatarUrl = actorMediaUrl(campaign.id, actor.id, 'avatar', media.avatarPath);
                  const tokenArtUrl = rawTokenArtUrl && !failedTokenMediaUrls.has(rawTokenArtUrl) ? rawTokenArtUrl : null;
                  const avatarUrl = rawAvatarUrl && !failedTokenMediaUrls.has(rawAvatarUrl) ? rawAvatarUrl : null;
                  const tokenEffects = runtime.combat_active ? combatEffectsForActor(runtime, actor.id) : [];
                  const isSelected = selectedTokenIds.includes(token.id) || (selectedTokenIds.length === 0 && selectedActorId === actor.id);
                  return (
                    <button
                      key={token.id}
                      className={`token ${tokenArtUrl ? 'token-custom-art' : ''} ${token.enemy ? 'enemy' : ''} ${isSelected ? 'selected' : ''} ${selectedTokenIds.length > 1 && selectedTokenIds.includes(token.id) ? 'multi-selected' : ''} ${token.hidden ? 'online-hidden-token' : ''}`}
                      style={{
                        left: `${position.x}%`,
                        top: `${position.y}%`,
                        transform: 'translate(-50%,-50%)',
                        '--token-avatar-size': `${Math.max(12, Math.round(46 * (token.size || 1)))}px`,
                        '--token-avatar-font-size': `${Math.max(9, Math.round(20 * (token.size || 1)))}px`,
                        '--token-border-size': `${Math.max(1, Math.round(3 * Math.min(token.size || 1, 1)))}px`,
                        '--token-art-scale': String(media.tokenScale),
                        '--token-art-offset-x': `${media.tokenOffsetX}%`,
                        '--token-art-offset-y': `${media.tokenOffsetY}%`,
                      } as React.CSSProperties}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        const additive = mode === 'gm' && (event.shiftKey || event.metaKey || event.ctrlKey);
                        selectToken(token.id, actor.id, additive);
                        if (additive || !canMove) return;
                        event.preventDefault();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        lastBroadcastRef.current = 0;
                        setDraggingTokenId(token.id);
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (event.detail !== 0) return;
                        const additive = mode === 'gm' && (event.shiftKey || event.metaKey || event.ctrlKey);
                        selectToken(token.id, actor.id, additive);
                      }}
                      title={mode === 'gm'
                        ? `${actor.name}${tokenEffects.length ? ` · ${tokenEffects.map((effect) => effect.name).join(', ')}` : ''} · Shift+клик — несколько`
                        : canMove ? `${actor.name} — можно перемещать` : actor.name}
                    >
                      {tokenArtUrl ? (
                        <span className="token-character-art" aria-hidden="true"><img src={tokenArtUrl} alt="" draggable={false} onError={() => markTokenMediaFailed(tokenArtUrl)} /></span>
                      ) : avatarUrl ? (
                        <span className="token-avatar token-avatar-image"><img src={avatarUrl} alt="" draggable={false} onError={() => markTokenMediaFailed(avatarUrl)} /></span>
                      ) : (
                        <span className="token-avatar">{actor.avatar || (actor.type === 'player' ? '🧙' : '👤')}</span>
                      )}
                      <span className="token-name">{actor.name}</span>
                      <span className="token-hp"><i style={{ width: `${hpPct}%` }}/></span>
                      {tokenEffects.length > 0 && (
                        <span className="token-combat-effects" aria-label={`Эффекты: ${tokenEffects.map((effect) => effect.name).join(', ')}`}>
                          {tokenEffects.map((effect) => (
                            <span key={effect.id} className={`token-combat-effect ${effect.kind}`} title={`${effect.name}${effect.remainingRounds === null ? ' · без срока' : ` · ${effect.remainingRounds} раунд.`}`}>
                              <b>{effect.name}</b>
                              {effect.remainingRounds !== null && <i>{effect.remainingRounds}</i>}
                            </span>
                          ))}
                        </span>
                      )}
                      {token.hidden && mode === 'gm' && <em className="hidden-token-mark">скрыт</em>}
                    </button>
                  );
                })}

                {activeScene.fog_enabled && <FogLayer reveals={reveals} draft={fogDraft} gm={mode === 'gm'} />}
              </div>

              <div className="map-view-hint">Колесо — масштаб · Space + drag / средняя кнопка — двигать карту</div>
              <div className="scene-chip">СЦЕНА · {activeScene.name}</div>
              {mode === 'gm' && fogDrawMode && <div className="fog-mode-chip">♟ Рисуйте область, которую увидят игроки</div>}
            </>
          ) : null}

          {mode === 'gm' && activeScene && sceneToolsOpen && (
            <OnlineSceneTools
              campaignId={campaign.id}
              scene={activeScene}
              actors={actors}
              tokens={tokens}
              fogDrawMode={fogDrawMode}
              onFogDrawMode={setFogDrawMode}
              onClose={() => { setSceneToolsOpen(false); setFogDrawMode(false); }}
              onChanged={scheduleRefresh}
              onMessage={setMessage}
            />
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
            onCreateHero={() => void createPlayerActor()}
            onHp={(actor, delta) => void changeHp(actor, delta)}
            onOpenWorkshop={() => { setWorkshopOpen(true); setSceneToolsOpen(false); }}
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
            <CombatCard runtime={runtime} actors={actors} />
          </aside>
        )}
      </main>

      {mode === 'gm' && selectedTokenIds.length > 0 && (
        <div className="gm-token-bulk-bar" data-wheel-isolation="true" role="toolbar" aria-label="Действия с выбранными фишками">
          <span className="gm-token-bulk-count">Выбрано: <strong>{selectedTokenIds.length}</strong></span>
          <button type="button" className="button" disabled={bulkBusy} onClick={() => void bulkUpdateHidden(true)} title="Скрыть от игроков">Скрыть</button>
          <button type="button" className="button" disabled={bulkBusy} onClick={() => void bulkUpdateHidden(false)} title="Показать игрокам">Показать</button>
          <button type="button" className="button" disabled={bulkBusy} onClick={() => void bulkRemoveFromScene()} title="Убрать со сцены">Убрать</button>
          <button type="button" className="button" disabled={bulkBusy} onClick={selectAllNpcTokens} title="Выделить всех NPC на сцене">Все NPC</button>
          <button type="button" className="button" disabled={bulkBusy} onClick={clearTokenSelection} title="Снять выделение">×</button>
        </div>
      )}

      <DiceTray
        campaignId={campaign.id}
        mode={mode}
        history={diceHistory}
        onRoll={onDiceRoll}
        onClearHistory={() => setDiceHistory([])}
        onMessage={setMessage}
      />

    </div>
  );
}

function FogLayer({ reveals, draft, gm }: { reveals: FogReveal[]; draft: FogReveal | null; gm: boolean }) {
  const maskId = gm ? 'ttv-fog-mask-gm' : 'ttv-fog-mask-player';
  return (
    <svg className={`online-fog-layer ${gm ? 'gm' : 'player'}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <mask id={maskId}>
          <rect x="0" y="0" width="100" height="100" fill="white" />
          {reveals.map((reveal) => <rect key={reveal.id} x={reveal.x} y={reveal.y} width={reveal.width} height={reveal.height} fill="black" />)}
          {draft && <rect x={draft.x} y={draft.y} width={draft.width} height={draft.height} fill="black" />}
        </mask>
      </defs>
      <rect x="0" y="0" width="100" height="100" className="fog-fill" mask={`url(#${maskId})`} />
      {gm && reveals.map((reveal) => <rect key={`outline-${reveal.id}`} x={reveal.x} y={reveal.y} width={reveal.width} height={reveal.height} className="fog-reveal-outline" />)}
      {gm && draft && <rect x={draft.x} y={draft.y} width={draft.width} height={draft.height} className="fog-draft-outline" />}
    </svg>
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

function CombatCard({ runtime, actors }: { runtime: CombatRuntime; actors: Actor[] }) {
  const order = runtime.combat_order
    .map((id, index) => ({ actor: actors.find((value) => value.id === id) ?? null, index }))
    .filter((entry): entry is { actor: Actor; index: number } => Boolean(entry.actor));
  const currentId = runtime.combat_active ? runtime.combat_order[runtime.combat_turn] : null;
  const current = currentId ? actors.find((actor) => actor.id === currentId) ?? null : null;
  return (
    <section className="online-combat-card">
      {runtime.combat_active && (
        <div className="combat-v06-player-summary" aria-label="Инициатива и эффекты">
          {order.map(({ actor }) => {
            const effects = combatEffectsForActor(runtime, actor.id);
            return (
              <div key={`v06-${actor.id}`}>
                <span>Инициатива {combatInitiative(runtime, actor.id)}</span>
                <strong>{actor.name}</strong>
                {effects.length > 0 && <small>{effects.map((effect) => effect.name).join(' · ')}</small>}
              </div>
            );
          })}
        </div>
      )}
      <div className="online-section-title"><strong>Бой</strong>{runtime.combat_active && <span>Раунд {runtime.combat_round}</span>}</div>
      {!runtime.combat_active ? <div className="online-small-empty">Сейчас боя нет.</div> : <><div className="online-combat-current"><span>Сейчас ход</span><b>{current?.name ?? 'Ход мастера'}</b></div><div className="online-combat-order">{order.map(({ actor, index }, visibleIndex) => <div key={actor.id} className={index === runtime.combat_turn ? 'current' : ''}><span>{visibleIndex + 1}</span><b>{actor.name}</b><em>{actor.system_data?.hp?.current ?? '—'} HP</em></div>)}</div></>}
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
