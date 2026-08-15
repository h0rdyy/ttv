'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_CELL_DISTANCE,
  DEFAULT_DISTANCE_UNIT,
  actorMovementSpeed,
  gridMovementDistance,
  remainingMovement,
  shouldBlockCombatGridMove,
} from './movement';

type Scene = {
  id: string;
  grid_enabled: boolean;
  grid_size: number;
};

type Actor = {
  id: string;
  owner_user_id: string | null;
  name: string;
  avatar: string;
  system_data: Record<string, unknown>;
};

type Runtime = {
  combat_active: boolean;
  combat_round: number;
  combat_turn: number;
  combat_order: string[];
};

type Props = {
  campaignId: string;
  actor: Actor | null;
  actors: Actor[];
  scene: Scene | null;
  runtime: Runtime;
  onOpenCharacter: () => void;
};

type ActiveDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  cellPixels: number;
  distance: number;
  lastAllowedDistance: number;
  lastAllowedX: number;
  lastAllowedY: number;
};

function blockPointerEvent(event: PointerEvent) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function resourceValue(systemData: Record<string, unknown> | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = systemData?.[key];
    if (value && typeof value === 'object') return value as Record<string, unknown>;
  }
  return null;
}

export function PlayerImmersionHud({ campaignId, actor, actors, scene, runtime, onOpenCharacter }: Props) {
  const [drag, setDrag] = useState<ActiveDrag | null>(null);
  const dragRef = useRef<ActiveDrag | null>(null);
  const [spent, setSpent] = useState(0);
  const [notice, setNotice] = useState('');

  const currentActorId = runtime.combat_active ? runtime.combat_order[runtime.combat_turn] ?? null : null;
  const currentActor = actors.find((value) => value.id === currentActorId) ?? null;
  const isOwnTurn = Boolean(actor && runtime.combat_active && currentActorId === actor.id);
  const speed = actorMovementSpeed(actor?.system_data);
  const distancePerCell = DEFAULT_CELL_DISTANCE;
  const distanceUnit = DEFAULT_DISTANCE_UNIT;
  const turnKey = runtime.combat_active
    ? `${runtime.combat_round}:${runtime.combat_turn}:${currentActorId ?? 'gm'}`
    : 'free';
  const storageKey = actor ? `ttv:movement:${campaignId}:${actor.id}:${turnKey}` : '';

  useEffect(() => {
    if (!storageKey || !runtime.combat_active) {
      setSpent(0);
      return;
    }
    const stored = Number(window.sessionStorage.getItem(storageKey) ?? 0);
    setSpent(Number.isFinite(stored) && stored > 0 ? stored : 0);
  }, [storageKey, runtime.combat_active]);

  useEffect(() => {
    if (!storageKey || !runtime.combat_active) return;
    window.sessionStorage.setItem(storageKey, String(spent));
  }, [spent, storageKey, runtime.combat_active]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 1800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!actor) return;
    const syntheticMoves = new WeakSet<Event>();

    const begin = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const token = target.closest<HTMLButtonElement>('.online-table-shell.player-mode .token.selected');
      if (!token) return;

      if (runtime.combat_active && !isOwnTurn) {
        blockPointerEvent(event);
        setNotice(currentActor ? `Сейчас ходит ${currentActor.name}` : 'Сейчас не ваш ход');
        return;
      }
      if (runtime.combat_active && isOwnTurn && scene?.grid_enabled && spent >= speed) {
        blockPointerEvent(event);
        setNotice(`Лимит движения ${speed} ${distanceUnit} уже израсходован`);
        return;
      }

      const world = token.closest<HTMLElement>('.online-map-world');
      if (!world) return;

      const tokenRect = token.getBoundingClientRect();
      const worldRect = world.getBoundingClientRect();
      const worldScale = world.offsetWidth > 0 ? worldRect.width / world.offsetWidth : 1;
      const cellPixels = scene?.grid_enabled ? Math.max(1, (scene.grid_size || 64) * worldScale) : 0;
      const startX = tokenRect.left + tokenRect.width / 2;
      const startY = tokenRect.top + tokenRect.height / 2;
      const next: ActiveDrag = {
        pointerId: event.pointerId,
        startX,
        startY,
        x: event.clientX,
        y: event.clientY,
        cellPixels,
        distance: 0,
        lastAllowedDistance: 0,
        lastAllowedX: startX,
        lastAllowedY: startY,
      };
      dragRef.current = next;
      setDrag(next);
    };

    const move = (event: PointerEvent) => {
      if (syntheticMoves.has(event)) return;
      const current = dragRef.current;
      if (!current || current.pointerId !== event.pointerId) return;
      const distance = current.cellPixels > 0
        ? gridMovementDistance(event.clientX - current.startX, event.clientY - current.startY, current.cellPixels, distancePerCell)
        : 0;
      const blockGridMove = runtime.combat_active
        && isOwnTurn
        && shouldBlockCombatGridMove(distance, spent, speed, current.cellPixels > 0);

      let lastAllowedDistance = current.lastAllowedDistance;
      let lastAllowedX = current.lastAllowedX;
      let lastAllowedY = current.lastAllowedY;

      if (!blockGridMove) {
        lastAllowedDistance = distance;
        lastAllowedX = event.clientX;
        lastAllowedY = event.clientY;
      } else {
        const available = Math.max(0, speed - spent);
        if (available > 0 && distance > 0) {
          const ratio = Math.max(0, Math.min(1, available / distance));
          lastAllowedDistance = available;
          lastAllowedX = current.startX + (event.clientX - current.startX) * ratio;
          lastAllowedY = current.startY + (event.clientY - current.startY) * ratio;
        }
      }

      const next: ActiveDrag = {
        ...current,
        x: event.clientX,
        y: event.clientY,
        distance,
        lastAllowedDistance,
        lastAllowedX,
        lastAllowedY,
      };
      dragRef.current = next;
      setDrag(next);

      if (blockGridMove) {
        // Instead of simply swallowing an over-budget move, send OnlineTable one
        // synthetic move at the furthest legal point. Fast drags therefore clamp
        // to the remaining movement instead of making the token appear broken.
        const target = event.target;
        if (availableDistance(next) > 0 && target instanceof Element) {
          const clamped = new PointerEvent('pointermove', {
            bubbles: true,
            cancelable: true,
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            isPrimary: event.isPrimary,
            buttons: event.buttons || 1,
            clientX: next.lastAllowedX,
            clientY: next.lastAllowedY,
          });
          syntheticMoves.add(clamped);
          target.dispatchEvent(clamped);
        }
        blockPointerEvent(event);
      }
    };

    const finish = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current || current.pointerId !== event.pointerId) return;
      dragRef.current = null;
      setDrag(null);
      if (!runtime.combat_active || !isOwnTurn) return;

      const committedDistance = current.lastAllowedDistance;
      if (current.cellPixels > 0 && current.distance > committedDistance) {
        setNotice(`Лимит движения ${speed} ${distanceUnit} — фишка остановлена на допустимой клетке`);
      }
      if (committedDistance > 0) setSpent((value) => Math.min(speed, value + committedDistance));
    };

    const cancel = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current || current.pointerId !== event.pointerId) return;
      dragRef.current = null;
      setDrag(null);
    };

    document.addEventListener('pointerdown', begin, true);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', finish, true);
    window.addEventListener('pointercancel', cancel, true);
    return () => {
      document.removeEventListener('pointerdown', begin, true);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', finish, true);
      window.removeEventListener('pointercancel', cancel, true);
    };
  }, [actor, currentActor, distancePerCell, distanceUnit, isOwnTurn, runtime.combat_active, scene?.grid_enabled, scene?.grid_size, speed, spent]);

  const hp = resourceValue(actor?.system_data, 'hit_points', 'hp');
  const hpCurrent = Number(hp?.current);
  const hpMax = Number(hp?.max);
  const preview = drag?.distance ?? 0;
  const projected = spent + preview;
  const remaining = remainingMovement(speed, spent, preview);
  const overBudget = isOwnTurn && drag !== null && drag.cellPixels > 0 && projected > speed;
  const ruler = useMemo(() => {
    if (!drag) return null;
    const dx = drag.x - drag.startX;
    const dy = drag.y - drag.startY;
    return {
      length: Math.hypot(dx, dy),
      angle: Math.atan2(dy, dx),
    };
  }, [drag]);

  if (!actor) return null;

  return (
    <>
      {isOwnTurn && (
        <div className="player-turn-banner" role="status">
          <span>РАУНД {runtime.combat_round}</span>
          <strong>ТВОЙ ХОД</strong>
        </div>
      )}

      {drag && ruler && (
        <>
          <div
            className={`player-movement-ruler ${overBudget ? 'over' : ''}`}
            style={{
              left: `${drag.startX}px`,
              top: `${drag.startY}px`,
              width: `${ruler.length}px`,
              transform: `rotate(${ruler.angle}rad)`,
            }}
          />
          <div className={`player-movement-bubble ${overBudget ? 'over' : ''}`} style={{ left: `${drag.x + 14}px`, top: `${drag.y + 14}px` }}>
            {scene?.grid_enabled ? (
              <>
                <strong>{drag.distance} {distanceUnit}</strong>
                {runtime.combat_active && isOwnTurn && <small>{overBudget ? `лимит ${speed} · фишка остановится раньше` : `осталось ${remaining}`} {distanceUnit}</small>}
              </>
            ) : (
              <><strong>Свободное движение</strong><small>На сцене выключена сетка</small></>
            )}
          </div>
        </>
      )}

      <div className="player-immersion-dock" data-wheel-isolation="true">
        <div className="player-identity">
          <span className="player-identity-avatar">{actor.avatar || '🧙'}</span>
          <span><strong>{actor.name}</strong><small>{runtime.combat_active ? (isOwnTurn ? 'Ваш ход' : `Ход: ${currentActor?.name ?? 'мастера'}`) : 'Свободная сцена'}</small></span>
        </div>
        <div className="player-vital-chip"><span>HP</span><strong>{Number.isFinite(hpCurrent) ? hpCurrent : '—'} / {Number.isFinite(hpMax) ? hpMax : '—'}</strong></div>
        <div className={`player-movement-chip ${spent >= speed && isOwnTurn ? 'over' : ''}`}>
          <span>Движение</span>
          <strong>{runtime.combat_active && isOwnTurn ? `${spent} / ${speed}` : `${speed}`} {distanceUnit}</strong>
          <i><b style={{ width: `${Math.min(100, speed > 0 ? (spent / speed) * 100 : 0)}%` }} /></i>
        </div>
        <button type="button" onClick={onOpenCharacter}>◇ Персонаж</button>
      </div>

      {notice && <div className="player-immersion-notice">{notice}</div>}
    </>
  );
}

function availableDistance(drag: ActiveDrag) {
  return drag.lastAllowedDistance;
}
