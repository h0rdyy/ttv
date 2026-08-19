'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_CELL_DISTANCE,
  DEFAULT_DISTANCE_UNIT,
  actorMovementSpeed,
  formatMovementDistance,
  gridUnitsPerMapWidth,
  mapMovementDistance,
  movementStorageKey,
  remainingMovement,
  roundMovementDistance,
  shouldBlockCombatGridMove,
} from './movement';

type Scene = {
  id: string;
  grid_enabled: boolean;
  grid_size: number;
  measurement_unit: string | null;
  measurement_units_per_map_width: number | null;
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
  mapWidthPixels: number;
  unitsPerMapWidth: number;
  usingLegacyGridScale: boolean;
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

function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
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
  const distanceUnit = scene?.measurement_unit?.trim() || DEFAULT_DISTANCE_UNIT;
  const turnKey = runtime.combat_active
    ? `${runtime.combat_round}:${runtime.combat_turn}:${currentActorId ?? 'gm'}`
    : 'free';
  const storageKey = actor && scene
    ? movementStorageKey(campaignId, actor.id, scene.id, turnKey)
    : '';

  // Restore movement budget for this exact scene + combat turn. Do not mirror
  // `spent` back to storage from an effect: on mount React runs effects with the
  // initial spent=0 state before the restored state render, which used to
  // overwrite a valid saved budget. Writes happen only when a move commits.
  useEffect(() => {
    if (!storageKey || !runtime.combat_active) {
      setSpent(0);
      return;
    }
    const stored = Number(window.sessionStorage.getItem(storageKey) ?? 0);
    setSpent(Number.isFinite(stored) && stored > 0 ? roundMovementDistance(stored) : 0);
  }, [storageKey, runtime.combat_active]);

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
      if (runtime.combat_active && isOwnTurn && remainingMovement(speed, spent) <= 0) {
        blockPointerEvent(event);
        setNotice(`Лимит движения ${formatMovementDistance(speed)} ${distanceUnit} уже израсходован`);
        return;
      }

      const world = token.closest<HTMLElement>('.online-map-world');
      if (!world) return;
      const worldRect = world.getBoundingClientRect();
      if (worldRect.width <= 0) return;

      const tokenRect = token.getBoundingClientRect();
      const persistedScale = positiveNumber(scene?.measurement_units_per_map_width);
      // Legacy scenes get a temporary bridge based on the current grid. The GM
      // calibrator automatically freezes this value into the scene, after which
      // changing grid_size no longer affects movement math.
      const fallbackScale = scene && world.offsetWidth > 0
        ? gridUnitsPerMapWidth(scene.grid_size || 64, world.offsetWidth, DEFAULT_CELL_DISTANCE)
        : 0;
      const unitsPerMapWidth = persistedScale ?? fallbackScale;
      const startX = tokenRect.left + tokenRect.width / 2;
      const startY = tokenRect.top + tokenRect.height / 2;
      const next: ActiveDrag = {
        pointerId: event.pointerId,
        startX,
        startY,
        x: event.clientX,
        y: event.clientY,
        mapWidthPixels: worldRect.width,
        unitsPerMapWidth,
        usingLegacyGridScale: !persistedScale,
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
      const distance = mapMovementDistance(
        event.clientX - current.startX,
        event.clientY - current.startY,
        current.mapWidthPixels,
        current.unitsPerMapWidth,
      );
      const scaleAvailable = current.mapWidthPixels > 0 && current.unitsPerMapWidth > 0;
      const blockCombatMove = runtime.combat_active
        && isOwnTurn
        && shouldBlockCombatGridMove(distance, spent, speed, scaleAvailable);

      let lastAllowedDistance = current.lastAllowedDistance;
      let lastAllowedX = current.lastAllowedX;
      let lastAllowedY = current.lastAllowedY;

      if (!blockCombatMove) {
        lastAllowedDistance = distance;
        lastAllowedX = event.clientX;
        lastAllowedY = event.clientY;
      } else {
        const available = remainingMovement(speed, spent);
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

      if (blockCombatMove) {
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

      const committedDistance = roundMovementDistance(current.lastAllowedDistance);
      if (current.unitsPerMapWidth > 0 && current.distance > committedDistance) {
        setNotice(`Лимит движения ${formatMovementDistance(speed)} ${distanceUnit} — фишка остановлена на точной допустимой позиции`);
      }
      if (committedDistance > 0) {
        setSpent((value) => {
          const nextSpent = roundMovementDistance(Math.min(speed, value + committedDistance));
          if (storageKey) window.sessionStorage.setItem(storageKey, String(nextSpent));
          return nextSpent;
        });
      }
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
  }, [
    actor,
    currentActor,
    distanceUnit,
    isOwnTurn,
    runtime.combat_active,
    scene?.grid_size,
    scene?.measurement_units_per_map_width,
    speed,
    spent,
    storageKey,
  ]);

  const hp = resourceValue(actor?.system_data, 'hit_points', 'hp');
  const hpCurrent = Number(hp?.current);
  const hpMax = Number(hp?.max);
  const hpPercent = Number.isFinite(hpCurrent) && Number.isFinite(hpMax) && hpMax > 0
    ? Math.max(0, Math.min(100, (hpCurrent / hpMax) * 100))
    : 0;
  const preview = drag?.distance ?? 0;
  const projected = roundMovementDistance(spent + preview);
  const remaining = remainingMovement(speed, spent, preview);
  const movementForHud = runtime.combat_active && isOwnTurn ? remaining : speed;
  const staminaPercent = speed > 0 ? Math.max(0, Math.min(100, (movementForHud / speed) * 100)) : 0;
  const overBudget = isOwnTurn && drag !== null && drag.unitsPerMapWidth > 0 && projected > speed;
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
            {drag.unitsPerMapWidth > 0 ? (
              <>
                <strong>{formatMovementDistance(drag.distance)} {distanceUnit}</strong>
                {runtime.combat_active && isOwnTurn && <small>{overBudget ? `лимит ${formatMovementDistance(speed)} · фишка остановится раньше` : `осталось ${formatMovementDistance(remaining)}`} {distanceUnit}</small>}
                {drag.usingLegacyGridScale && <small>Масштаб сцены ещё фиксируется мастером</small>}
              </>
            ) : (
              <><strong>Свободное движение</strong><small>Для сцены не задан масштаб</small></>
            )}
          </div>
        </>
      )}

      <div className="player-immersion-dock player-rpg-hud" data-wheel-isolation="true">
        <button type="button" className="player-rpg-character" onClick={onOpenCharacter} title="Открыть лист персонажа">
          <span className="player-identity-avatar">{actor.avatar || '🧙'}</span>
          <span className="player-rpg-character-copy">
            <strong>{actor.name}</strong>
            <small>{runtime.combat_active ? (isOwnTurn ? 'Ваш ход' : `Ход: ${currentActor?.name ?? 'мастера'}`) : 'Свободная сцена'}</small>
          </span>
        </button>

        <div className="player-rpg-bars" aria-label="Состояние персонажа">
          <div className="player-rpg-bar health">
            <div><span>Здоровье</span><strong>{Number.isFinite(hpCurrent) ? hpCurrent : '—'} / {Number.isFinite(hpMax) ? hpMax : '—'}</strong></div>
            <i><b style={{ width: `${hpPercent}%` }} /></i>
          </div>
          <div className={`player-rpg-bar stamina ${staminaPercent <= 0 && isOwnTurn ? 'empty' : ''}`} title="Оставшаяся скорость на текущий ход">
            <div><span>Скорость</span><strong>{hudDistance(movementForHud)} / {hudDistance(speed)}</strong></div>
            <i><b style={{ width: `${staminaPercent}%` }} /></i>
          </div>
        </div>

        <div className="player-rpg-speed" title="Максимальная скорость перемещения">
          <span>Скорость</span>
          <strong>{hudDistance(speed)} <small>{distanceUnit}</small></strong>
        </div>
      </div>

      {notice && <div className="player-immersion-notice">{notice}</div>}
    </>
  );
}

function availableDistance(drag: ActiveDrag) {
  return drag.lastAllowedDistance;
}

function hudDistance(value: number) {
  const rounded = roundMovementDistance(value);
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}