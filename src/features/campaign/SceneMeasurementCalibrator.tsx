'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';
import {
  DEFAULT_CELL_DISTANCE,
  DEFAULT_DISTANCE_UNIT,
  calibrationUnitsPerMapWidth,
  formatMovementDistance,
  gridUnitsPerMapWidth,
  roundMovementDistance,
} from './movement';

type Scene = {
  id: string;
  grid_size: number;
  measurement_unit: string | null;
  measurement_units_per_map_width: number | null;
};

type Props = {
  campaignId: string;
  scene: Scene | null;
  onChanged: () => void;
  onMessage: (message: string) => void;
};

type CalibrationDraft = {
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  mapWidth: number;
};

function blockPointerEvent(event: PointerEvent) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function mapWorld() {
  return document.querySelector<HTMLElement>('.online-table-shell.gm-mode .online-map-world');
}

function validScale(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function convertScale(value: number, from: string, to: string) {
  if (from === to) return value;
  if (from === 'ft' && to === 'm') return roundMovementDistance(value * 0.3048);
  if (from === 'm' && to === 'ft') return roundMovementDistance(value / 0.3048);
  return value;
}

export function SceneMeasurementCalibrator({ campaignId, scene, onChanged, onMessage }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [draft, setDraft] = useState<CalibrationDraft | null>(null);
  const draftRef = useRef<CalibrationDraft | null>(null);
  const initializedSceneRef = useRef(new Set<string>());

  const sceneScale = validScale(scene?.measurement_units_per_map_width);
  const sceneUnit = scene?.measurement_unit?.trim() || DEFAULT_DISTANCE_UNIT;

  const saveMeasurement = async (scale: number, unit = sceneUnit, announce = true) => {
    if (!scene || !Number.isFinite(scale) || scale <= 0) return false;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('set_scene_measurement', {
      target_campaign: campaignId,
      target_scene: scene.id,
      scene_measurement_unit: unit,
      scene_units_per_map_width: scale,
    });
    if (error) {
      onMessage(friendlyError(error, 'Не удалось сохранить масштаб расстояний.'));
      setBusy(false);
      return false;
    }
    if (announce) onMessage(`Масштаб сцены сохранён: ${formatMovementDistance(scale)} ${unit} по ширине карты.`);
    setBusy(false);
    onChanged();
    return true;
  };

  const useCurrentGridAsFiveFeet = async (announce = true) => {
    if (!scene) return false;
    const world = mapWorld();
    if (!world || world.offsetWidth <= 0) {
      if (announce) onMessage('Карта ещё не готова для калибровки.');
      return false;
    }
    const scale = gridUnitsPerMapWidth(scene.grid_size || 64, world.offsetWidth, DEFAULT_CELL_DISTANCE);
    if (scale <= 0) return false;
    return saveMeasurement(scale, sceneUnit, announce);
  };

  // Existing scenes predate independent measurement. On the first GM visit,
  // freeze their current visual cell as 5 ft once. After this one-time bridge,
  // changing grid_size never changes movement math again.
  useEffect(() => {
    if (!scene || sceneScale || initializedSceneRef.current.has(scene.id)) return;
    initializedSceneRef.current.add(scene.id);
    let cancelled = false;
    let attempts = 0;
    const tryInitialize = () => {
      if (cancelled) return;
      const world = mapWorld();
      if (world && world.offsetWidth > 0) {
        void useCurrentGridAsFiveFeet(false);
        return;
      }
      attempts += 1;
      if (attempts < 60) window.requestAnimationFrame(tryInitialize);
    };
    window.requestAnimationFrame(tryInitialize);
    return () => { cancelled = true; };
  }, [scene?.id, sceneScale]);

  useEffect(() => {
    if (!calibrating || !scene) return;

    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('.online-table-shell.gm-mode .online-map-world')) return;
      const world = mapWorld();
      const rect = world?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;
      blockPointerEvent(event);
      const next: CalibrationDraft = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        mapWidth: rect.width,
      };
      draftRef.current = next;
      setDraft(next);
    };

    const pointerMove = (event: PointerEvent) => {
      const current = draftRef.current;
      if (!current || current.pointerId !== event.pointerId) return;
      blockPointerEvent(event);
      const next = { ...current, x: event.clientX, y: event.clientY };
      draftRef.current = next;
      setDraft(next);
    };

    const pointerUp = (event: PointerEvent) => {
      const current = draftRef.current;
      if (!current || current.pointerId !== event.pointerId) return;
      blockPointerEvent(event);
      draftRef.current = null;
      setDraft(null);
      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      if (Math.hypot(dx, dy) < 8) {
        onMessage('Проведите калибровочную линию подлиннее.');
        return;
      }
      const raw = window.prompt(`Какое расстояние между точками в ${sceneUnit}?`, '30');
      if (raw === null) {
        setCalibrating(false);
        setOpen(true);
        return;
      }
      const knownDistance = Number(raw.trim().replace(',', '.'));
      const scale = calibrationUnitsPerMapWidth(dx, dy, current.mapWidth, knownDistance);
      if (scale <= 0) {
        onMessage('Введите корректное расстояние больше нуля.');
        return;
      }
      setCalibrating(false);
      setOpen(true);
      void saveMeasurement(scale, sceneUnit, true);
    };

    const keyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      draftRef.current = null;
      setDraft(null);
      setCalibrating(false);
      setOpen(true);
    };

    document.addEventListener('pointerdown', pointerDown, true);
    window.addEventListener('pointermove', pointerMove, true);
    window.addEventListener('pointerup', pointerUp, true);
    window.addEventListener('keydown', keyDown, true);
    return () => {
      document.removeEventListener('pointerdown', pointerDown, true);
      window.removeEventListener('pointermove', pointerMove, true);
      window.removeEventListener('pointerup', pointerUp, true);
      window.removeEventListener('keydown', keyDown, true);
    };
  }, [calibrating, scene?.id, sceneUnit]);

  if (!scene) return null;

  const changeUnit = async (nextUnit: string) => {
    if (!sceneScale || nextUnit === sceneUnit) return;
    const converted = convertScale(sceneScale, sceneUnit, nextUnit);
    await saveMeasurement(converted, nextUnit, true);
  };

  const currentCellDistance = (() => {
    if (!sceneScale) return null;
    const world = typeof document !== 'undefined' ? mapWorld() : null;
    if (!world || world.offsetWidth <= 0) return null;
    return roundMovementDistance((scene.grid_size / world.offsetWidth) * sceneScale);
  })();

  const lineLength = draft ? Math.hypot(draft.x - draft.startX, draft.y - draft.startY) : 0;
  const lineAngle = draft ? Math.atan2(draft.y - draft.startY, draft.x - draft.startX) : 0;

  return (
    <>
      <div className="scene-measurement-anchor" data-wheel-isolation="true">
        <button type="button" className={`button scene-measurement-trigger ${open ? 'active' : ''}`} onClick={() => setOpen((value) => !value)}>
          📏 Масштаб
        </button>
        {open && (
          <section className="scene-measurement-popover" role="dialog" aria-label="Масштаб расстояний сцены">
            <header><strong>Расстояния</strong><button type="button" onClick={() => setOpen(false)}>×</button></header>
            <p>Сетка отвечает только за вид и snap. Этот масштаб отдельно определяет футы движения.</p>
            <div className="scene-measurement-status">
              <span>{sceneScale ? 'МАСШТАБ ЗАФИКСИРОВАН' : 'НАСЛЕДУЕМЫЙ МАСШТАБ'}</span>
              <strong>{sceneScale ? `${formatMovementDistance(sceneScale)} ${sceneUnit} по ширине карты` : 'Текущая клетка временно считается за 5 ft'}</strong>
              {currentCellDistance !== null && <small>Текущая визуальная клетка ≈ {formatMovementDistance(currentCellDistance)} {sceneUnit}</small>}
            </div>
            <label className="scene-measurement-unit">
              <span>Единица</span>
              <select className="control" value={sceneUnit} disabled={busy || !sceneScale} onChange={(event) => void changeUnit(event.target.value)}>
                <option value="ft">ft</option>
                <option value="m">m</option>
              </select>
            </label>
            <button type="button" className="button full" disabled={busy} onClick={() => void useCurrentGridAsFiveFeet(true)}>
              Текущая клетка = 5 {sceneUnit}
            </button>
            <button type="button" className="button primary full" disabled={busy} onClick={() => { setOpen(false); setCalibrating(true); }}>
              Калибровать по карте
            </button>
            <small>Проведите линию между двумя известными точками и введите реальное расстояние.</small>
          </section>
        )}
      </div>

      {calibrating && (
        <div className="scene-measurement-calibration-hint">
          <strong>КАЛИБРОВКА РАССТОЯНИЯ</strong>
          <span>Зажмите ЛКМ и проведите линию по карте · Esc — отмена</span>
        </div>
      )}

      {draft && (
        <>
          <div
            className="scene-measurement-calibration-line"
            style={{
              left: `${draft.startX}px`,
              top: `${draft.startY}px`,
              width: `${lineLength}px`,
              transform: `rotate(${lineAngle}rad)`,
            }}
          />
          <div className="scene-measurement-calibration-point" style={{ left: draft.startX, top: draft.startY }} />
          <div className="scene-measurement-calibration-point" style={{ left: draft.x, top: draft.y }} />
        </>
      )}
    </>
  );
}
