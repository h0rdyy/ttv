'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import {
  DEFAULT_CELL_DISTANCE,
  DEFAULT_DISTANCE_UNIT,
  formatMovementDistance,
  gridUnitsPerMapWidth,
  roundMovementDistance,
} from './movement';

type Mode = 'gm' | 'player';
type Tool = 'ruler' | 'ping' | 'draw' | null;
type DrawTone = 'accent' | 'danger' | 'cool';

type Scene = {
  id: string;
  grid_size: number;
  measurement_unit: string | null;
  measurement_units_per_map_width: number | null;
};

type Point = { x: number; y: number };
type RulerDraft = { start: Point; end: Point };
type Stroke = {
  id: string;
  sceneId: string;
  senderUserId: string;
  tone: DrawTone;
  points: Point[];
};
type Ping = {
  id: string;
  sceneId: string;
  senderUserId: string;
  senderName: string;
  point: Point;
};

type Props = {
  campaignId: string;
  mode: Mode;
  currentUserId: string;
  displayName: string;
  scene: Scene | null;
};

const TOGGLE_EVENT = 'ttv:map-tools:toggle';
const CLOSE_EVENT = 'ttv:map-tools:close';
const PING_EVENT = 'map_ping';
const DRAW_EVENT = 'map_draw';
const CLEAR_EVENT = 'map_draw_clear';
const MAX_STROKES = 80;
const MAX_STROKE_POINTS = 180;

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveNumber(value: unknown) {
  const number = finiteNumber(value);
  return number !== null && number > 0 ? number : null;
}

function validPoint(value: unknown): Point | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const x = finiteNumber(row.x);
  const y = finiteNumber(row.y);
  if (x === null || y === null) return null;
  return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
}

function validTone(value: unknown): DrawTone {
  return value === 'danger' || value === 'cool' ? value : 'accent';
}

export function MapInteractionTools({ campaignId, mode, currentUserId, displayName, scene }: Props) {
  const [open, setOpen] = useState(false);
  const [tool, setTool] = useState<Tool>(null);
  const [tone, setTone] = useState<DrawTone>('accent');
  const [world, setWorld] = useState<HTMLElement | null>(null);
  const [ruler, setRuler] = useState<RulerDraft | null>(null);
  const [draftStroke, setDraftStroke] = useState<Stroke | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [pings, setPings] = useState<Ping[]>([]);
  const pointerIdRef = useRef<number | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);
  const pingTimersRef = useRef<number[]>([]);

  useEffect(() => {
    const resolveWorld = () => {
      setWorld(document.querySelector<HTMLElement>('.v05-table-layer .online-map-world'));
    };
    resolveWorld();
    const observer = new MutationObserver(resolveWorld);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [scene?.id]);

  useEffect(() => {
    const toggle = () => setOpen((current) => !current);
    const close = () => {
      setOpen(false);
      setTool(null);
      setRuler(null);
      setDraftStroke(null);
      pointerIdRef.current = null;
    };
    window.addEventListener(TOGGLE_EVENT, toggle);
    window.addEventListener(CLOSE_EVENT, close);
    return () => {
      window.removeEventListener(TOGGLE_EVENT, toggle);
      window.removeEventListener(CLOSE_EVENT, close);
    };
  }, []);

  useEffect(() => {
    setTool(null);
    setRuler(null);
    setDraftStroke(null);
    setStrokes([]);
    setPings([]);
    pointerIdRef.current = null;
  }, [scene?.id]);

  useEffect(() => () => {
    pingTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    pingTimersRef.current = [];
  }, []);

  const showPing = (ping: Ping) => {
    setPings((current) => [...current.filter((value) => value.id !== ping.id), ping]);
    const timer = window.setTimeout(() => {
      setPings((current) => current.filter((value) => value.id !== ping.id));
    }, 1800);
    pingTimersRef.current.push(timer);
  };

  useEffect(() => {
    if (!scene) return;
    const supabase = createClient();
    let disposed = false;
    subscribedRef.current = false;
    const channel = supabase.channel(`campaign:${campaignId}`, {
      config: {
        private: true,
        broadcast: { self: false },
      },
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: PING_EVENT }, ({ payload }) => {
        const row = payload as Record<string, unknown>;
        if (row.sceneId !== scene.id || row.senderUserId === currentUserId) return;
        const point = validPoint(row.point);
        if (!point || typeof row.id !== 'string' || typeof row.senderUserId !== 'string') return;
        showPing({
          id: row.id,
          sceneId: scene.id,
          senderUserId: row.senderUserId,
          senderName: typeof row.senderName === 'string' && row.senderName ? row.senderName : 'Игрок',
          point,
        });
      })
      .on('broadcast', { event: DRAW_EVENT }, ({ payload }) => {
        const row = payload as Record<string, unknown>;
        if (row.sceneId !== scene.id || row.senderUserId === currentUserId || !Array.isArray(row.points)) return;
        const points = row.points.map(validPoint).filter((point): point is Point => Boolean(point)).slice(0, MAX_STROKE_POINTS);
        if (points.length < 2 || typeof row.id !== 'string' || typeof row.senderUserId !== 'string') return;
        const stroke: Stroke = {
          id: row.id,
          sceneId: scene.id,
          senderUserId: row.senderUserId,
          tone: validTone(row.tone),
          points,
        };
        setStrokes((current) => [...current.filter((value) => value.id !== stroke.id), stroke].slice(-MAX_STROKES));
      })
      .on('broadcast', { event: CLEAR_EVENT }, ({ payload }) => {
        const row = payload as Record<string, unknown>;
        if (row.sceneId === scene.id) setStrokes([]);
      });

    void (async () => {
      try {
        await supabase.realtime.setAuth();
        if (disposed) return;
        channel.subscribe((status) => {
          if (disposed) return;
          subscribedRef.current = status === 'SUBSCRIBED';
        });
      } catch {
        subscribedRef.current = false;
      }
    })();

    return () => {
      disposed = true;
      subscribedRef.current = false;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [campaignId, currentUserId, scene?.id]);

  const broadcast = (event: string, payload: Record<string, unknown>) => {
    const channel = channelRef.current;
    if (!channel || !subscribedRef.current) return;
    void channel.send({ type: 'broadcast', event, payload }).catch(() => undefined);
  };

  const eventPoint = (event: ReactPointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
    };
  };

  const addPing = (point: Point) => {
    if (!scene) return;
    const ping: Ping = {
      id: crypto.randomUUID(),
      sceneId: scene.id,
      senderUserId: currentUserId,
      senderName: displayName || (mode === 'gm' ? 'Мастер' : 'Игрок'),
      point,
    };
    showPing(ping);
    broadcast(PING_EVENT, ping as unknown as Record<string, unknown>);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!tool || event.button !== 0 || !scene) return;
    const point = eventPoint(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();

    if (tool === 'ping') {
      addPing(point);
      return;
    }

    pointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === 'ruler') {
      setRuler({ start: point, end: point });
      return;
    }
    if (tool === 'draw' && mode === 'gm') {
      setDraftStroke({
        id: crypto.randomUUID(),
        sceneId: scene.id,
        senderUserId: currentUserId,
        tone,
        points: [point],
      });
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    const point = eventPoint(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();

    if (tool === 'ruler') {
      setRuler((current) => current ? { ...current, end: point } : current);
      return;
    }
    if (tool === 'draw' && mode === 'gm') {
      setDraftStroke((current) => {
        if (!current || current.points.length >= MAX_STROKE_POINTS) return current;
        const last = current.points[current.points.length - 1];
        if (last && Math.hypot(point.x - last.x, point.y - last.y) < 0.18) return current;
        return { ...current, points: [...current.points, point] };
      });
    }
  };

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    pointerIdRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);

    if (tool === 'draw' && mode === 'gm' && draftStroke && draftStroke.points.length > 1) {
      const finished = draftStroke;
      setStrokes((current) => [...current, finished].slice(-MAX_STROKES));
      broadcast(DRAW_EVENT, finished as unknown as Record<string, unknown>);
    }
    setDraftStroke(null);
  };

  const clearDrawings = () => {
    if (!scene || mode !== 'gm') return;
    setStrokes([]);
    setDraftStroke(null);
    broadcast(CLEAR_EVENT, { sceneId: scene.id, senderUserId: currentUserId });
  };

  const toggleTool = (next: Exclude<Tool, null>) => {
    setTool((current) => current === next ? null : next);
    setDraftStroke(null);
    pointerIdRef.current = null;
    if (next !== 'ruler') setRuler(null);
  };

  const rulerDistance = useMemo(() => {
    if (!ruler || !scene || !world) return null;
    const worldWidth = world.offsetWidth;
    const worldHeight = world.offsetHeight;
    if (worldWidth <= 0 || worldHeight <= 0) return null;
    const unitsPerMapWidth = positiveNumber(scene.measurement_units_per_map_width)
      ?? gridUnitsPerMapWidth(scene.grid_size || 64, worldWidth, DEFAULT_CELL_DISTANCE);
    if (unitsPerMapWidth <= 0) return null;
    const dx = ((ruler.end.x - ruler.start.x) / 100) * unitsPerMapWidth;
    const dy = ((ruler.end.y - ruler.start.y) / 100) * unitsPerMapWidth * (worldHeight / worldWidth);
    return roundMovementDistance(Math.hypot(dx, dy));
  }, [ruler, scene, world]);

  const distanceUnit = scene?.measurement_unit?.trim() || DEFAULT_DISTANCE_UNIT;
  const overlay = world && scene ? createPortal(
    <>
      <svg className="map-annotation-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {strokes.map((stroke) => (
          <polyline
            key={stroke.id}
            className={`map-drawing-stroke tone-${stroke.tone}`}
            points={stroke.points.map((point) => `${point.x},${point.y}`).join(' ')}
          />
        ))}
        {draftStroke && (
          <polyline
            className={`map-drawing-stroke draft tone-${draftStroke.tone}`}
            points={draftStroke.points.map((point) => `${point.x},${point.y}`).join(' ')}
          />
        )}
        {ruler && <line className="map-ruler-line" x1={ruler.start.x} y1={ruler.start.y} x2={ruler.end.x} y2={ruler.end.y} />}
      </svg>

      {ruler && (
        <div className="map-ruler-label" style={{ left: `${ruler.end.x}%`, top: `${ruler.end.y}%` }}>
          {rulerDistance !== null ? <strong>{formatMovementDistance(rulerDistance)} {distanceUnit}</strong> : <strong>Без масштаба</strong>}
          <small>Линейка</small>
        </div>
      )}

      {pings.map((ping) => (
        <div key={ping.id} className="map-ping-marker" style={{ left: `${ping.point.x}%`, top: `${ping.point.y}%` }}>
          <i />
          <span>{ping.senderName}</span>
        </div>
      ))}

      <div
        className={`map-interaction-hit-layer ${tool ? `active tool-${tool}` : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
      />
    </>,
    world,
  ) : null;

  if (!scene) return null;

  return (
    <>
      {overlay}
      {open && (
        <section className={`map-tools-palette ${mode}`} data-wheel-isolation="true" aria-label="Инструменты карты">
          <header>
            <div><small>{mode === 'gm' ? 'МАСТЕР' : 'ИГРОК'}</small><strong>Инструменты карты</strong></div>
            <button type="button" aria-label="Закрыть инструменты карты" onClick={() => { setOpen(false); setTool(null); setRuler(null); }}>×</button>
          </header>

          <div className="map-tools-actions">
            <button type="button" className={tool === 'ruler' ? 'active' : ''} onClick={() => toggleTool('ruler')}>
              <span>⌁</span><strong>Линейка</strong><small>Потяните по карте</small>
            </button>
            <button type="button" className={tool === 'ping' ? 'active' : ''} onClick={() => toggleTool('ping')}>
              <span>◎</span><strong>Пинг</strong><small>Показать точку всем</small>
            </button>
            {mode === 'gm' && (
              <button type="button" className={tool === 'draw' ? 'active' : ''} onClick={() => toggleTool('draw')}>
                <span>✎</span><strong>Рисовать</strong><small>Временные пометки</small>
              </button>
            )}
          </div>

          {mode === 'gm' && tool === 'draw' && (
            <div className="map-tools-draw-options" aria-label="Цвет рисунка">
              <span>Цвет</span>
              {(['accent', 'danger', 'cool'] as DrawTone[]).map((value) => (
                <button key={value} type="button" className={`tone-${value} ${tone === value ? 'active' : ''}`} onClick={() => setTone(value)} aria-label={`Цвет ${value}`} />
              ))}
            </div>
          )}

          <footer>
            <span>{tool === 'ruler' ? 'Измерение остаётся только у вас' : tool === 'ping' ? 'Пинг исчезнет автоматически' : tool === 'draw' ? 'Рисунок видят подключённые игроки' : 'Выберите инструмент'}</span>
            {mode === 'gm' && strokes.length > 0 && <button type="button" onClick={clearDrawings}>Очистить рисунки</button>}
          </footer>
        </section>
      )}
    </>
  );
}
