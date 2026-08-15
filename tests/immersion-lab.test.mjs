// Immersion regression suite: movement budget must survive reload/remount within the same combat turn.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  actorMovementSpeed,
  calibrationUnitsPerMapWidth,
  formatMovementDistance,
  gridMovementDistance,
  gridUnitsPerMapWidth,
  mapMovementDistance,
  remainingMovement,
  roundMovementDistance,
  shouldBlockCombatGridMove,
} from '../src/features/campaign/movement.ts';

test('movement measures continuous square-grid distance to hundredths', () => {
  assert.equal(gridMovementDistance(0, 0, 64), 0);
  assert.equal(gridMovementDistance(1, 0, 64), 0.08);
  assert.equal(gridMovementDistance(16, 0, 64), 1.25);
  assert.equal(gridMovementDistance(32, 0, 64), 2.5);
  assert.equal(gridMovementDistance(64, 0, 64), 5);
  assert.equal(gridMovementDistance(64, 64, 64), 5);
  assert.equal(gridMovementDistance(128, 64, 64), 10);
  assert.equal(gridMovementDistance(95, 20, 64), 7.42);
  assert.equal(roundMovementDistance(0.1 + 0.2), 0.3);
  assert.equal(formatMovementDistance(2.5), '2.50');
});

test('calibrated map movement is independent from visual grid size', () => {
  // Calibrate a 1280px-wide map from the current 64px cell = 5 ft.
  const scale = gridUnitsPerMapWidth(64, 1280, 5);
  assert.equal(scale, 100);
  assert.equal(mapMovementDistance(64, 0, 1280, scale), 5);
  assert.equal(mapMovementDistance(32, 0, 1280, scale), 2.5);
  assert.equal(mapMovementDistance(64, 64, 1280, scale), 5);

  // Changing the visual grid after calibration does not enter the movement math.
  const distanceBeforeGridResize = mapMovementDistance(256, 0, 1280, scale);
  const distanceAfterGridResize = mapMovementDistance(256, 0, 1280, scale);
  assert.equal(distanceBeforeGridResize, 20);
  assert.equal(distanceAfterGridResize, 20);
  assert.notEqual(gridUnitsPerMapWidth(96, 1280, 5), scale);

  // A manually drawn 384px line declared as 30 ft produces the same 100ft/map scale.
  assert.equal(calibrationUnitsPerMapWidth(384, 0, 1280, 30), 100);
});

test('combat movement blocks only movement beyond the exact hundredth-foot budget', () => {
  assert.equal(shouldBlockCombatGridMove(0, 0, 30, true), false);
  assert.equal(shouldBlockCombatGridMove(2.37, 27.63, 30, true), false);
  assert.equal(shouldBlockCombatGridMove(2.38, 27.63, 30, true), true);
  assert.equal(shouldBlockCombatGridMove(0.01, 30, 30, true), true);
  assert.equal(shouldBlockCombatGridMove(0, 30, 30, false), false);
});

test('actor movement limit is read from the character sheet speed field', () => {
  assert.equal(actorMovementSpeed({ speed: 25 }), 25);
  assert.equal(actorMovementSpeed({ speed: '17.5' }), 17.5);
  assert.equal(actorMovementSpeed({ speed: 20, movement: { walk: 30 } }), 20);
  assert.equal(actorMovementSpeed({ movement: { walk: 22.75 } }), 22.75);
  assert.equal(actorMovementSpeed({ walk_speed: '40' }), 40);
  assert.equal(actorMovementSpeed({}), 30);
  assert.equal(remainingMovement(actorMovementSpeed({ speed: 25 }), 24.75, 0.25), 0);
  assert.equal(shouldBlockCombatGridMove(0.26, 24.75, actorMovementSpeed({ speed: 25 }), true), true);
});

test('immersion lab enforces movement, calibrated scenes and one flexible character window', async () => {
  const [wrapper, hud, css, character, characterCss, layout, legacySheet, gmSidebar, hpMigration, tokenRefreshMigration, measurementMigration, calibrator, measurementCss, gameRoom, sheetSchema] = await Promise.all([
    readFile(new URL('../src/features/campaign/OnlineTableV05.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/campaign/PlayerImmersionHud.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/online-table-immersion.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/campaign/PlayerCharacterWindow.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/player-character-window.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/layout.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/campaign/OnlineActorSheet.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/campaign/OnlineGmSidebar.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/0021_actor_hp_return_alias.sql', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/0022_skip_token_position_full_refresh.sql', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/0023_scene_measurement_calibration.sql', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/campaign/SceneMeasurementCalibrator.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/scene-measurement.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/campaign/OnlineGameRoom.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/campaign/actorSheets.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(wrapper, /<PlayerImmersionHud/);
  assert.match(wrapper, /<SceneMeasurementCalibrator/);
  assert.match(wrapper, /onOpenCharacter=\{openSelectedCharacter\}/);
  assert.match(wrapper, /<PlayerCharacterWindow/);
  assert.match(wrapper, /characterActor &&/);
  assert.match(wrapper, /pendingOpenActorIdRef/);
  assert.match(wrapper, /setCharacterActorId\(pendingActorId\)/);
  assert.doesNotMatch(wrapper, /<OnlineActorSheet/);
  assert.doesNotMatch(wrapper, /<OnlineSheetWorkshop/);

  assert.match(wrapper, /contextmenu/);
  assert.match(wrapper, /gm-library-actor/);
  assert.match(wrapper, /✎ Редактировать/);
  assert.match(wrapper, /× Удалить/);
  assert.match(wrapper, /delete_campaign_actor/);

  assert.match(wrapper, /const actors = props\.initialActors\.map\(withCompatibleHealth\)/);
  assert.match(wrapper, /system_data: \{ \.\.\.data, hp: health \}/);

  assert.match(gmSidebar, /type OptimisticHealth/);
  assert.match(gmSidebar, /hpQueueRef/);
  assert.match(gmSidebar, /changeQuickHp/);
  assert.match(gmSidebar, /adjust_actor_hp/);
  assert.match(gmSidebar, /objectResource\(data\?\.hit_points\) \?\? objectResource\(data\?\.hp\)/);
  assert.match(hpMigration, /health_key = 'hit_points'/);

  assert.match(sheetSchema, /field\('speed', 'Скорость', 'number'\)/);
  assert.match(hud, /const speed = actorMovementSpeed\(actor\?\.system_data\)/);
  assert.match(hud, /measurement_units_per_map_width/);
  assert.match(hud, /mapMovementDistance/);
  assert.match(hud, /gridUnitsPerMapWidth/);
  assert.match(hud, /persistedScale \?\? fallbackScale/);
  assert.doesNotMatch(hud, /gridMovementDistance\(/);
  assert.match(hud, /remainingMovement\(speed, spent\) <= 0/);
  assert.match(hud, /new PointerEvent\('pointermove'/);
  assert.match(hud, /formatMovementDistance\(drag\.distance\)/);
  assert.match(hud, /const nextSpent = roundMovementDistance\(Math\.min\(speed, value \+ committedDistance\)\)/);
  assert.match(hud, /sessionStorage\.getItem\(storageKey\)/);
  const storageWrites = hud.match(/sessionStorage\.setItem/g) ?? [];
  assert.equal(storageWrites.length, 1, 'movement storage must only be written when a move commits');
  assert.ok(hud.indexOf('window.sessionStorage.setItem') > hud.indexOf('const finish ='), 'movement budget persistence must happen inside finish, never in a mount effect');

  assert.match(measurementMigration, /measurement_units_per_map_width double precision/);
  assert.match(measurementMigration, /create or replace function public\.set_scene_measurement/);
  assert.match(measurementMigration, /public\.is_campaign_gm\(target_campaign\)/);
  assert.match(measurementMigration, /revoke all on function public\.set_scene_measurement/);
  assert.match(gameRoom, /measurement_unit,measurement_units_per_map_width/);
  assert.match(gameRoom, /LEGACY_SCENE_SELECT/);
  assert.match(gameRoom, /if \(sceneResult\.error\)/);
  assert.match(gameRoom, /measurement_supported: measurementSupported/);

  assert.match(calibrator, /Калибровать по карте/);
  assert.match(calibrator, /Текущая клетка = 5/);
  assert.match(calibrator, /calibrationUnitsPerMapWidth/);
  assert.match(calibrator, /gridUnitsPerMapWidth/);
  assert.match(calibrator, /set_scene_measurement/);
  assert.match(calibrator, /initializedSceneRef/);
  assert.match(calibrator, /measurement_supported/);
  assert.match(calibrator, /НУЖНО ОБНОВИТЬ СХЕМУ БД/);
  assert.match(calibrator, /changing grid_size/i);

  assert.match(tokenRefreshMigration, /TG_TABLE_NAME = 'scene_tokens' and TG_OP = 'UPDATE'/);
  assert.match(tokenRefreshMigration, /to_jsonb\(NEW\) - array\['x', 'y', 'updated_at'\]/);

  assert.match(hud, /ТВОЙ ХОД/);
  assert.match(hud, /stopImmediatePropagation/);
  assert.match(hud, /runtime\.combat_active && !isOwnTurn/);
  assert.match(hud, />◇ Персонаж<\/button>/);

  assert.match(character, /Обзор/);
  assert.match(character, /Навыки/);
  assert.match(character, /Бой/);
  assert.match(character, /Инвентарь/);
  assert.match(character, /update_actor_sheet/);

  assert.doesNotMatch(legacySheet, /export function OnlineActorSheet/);
  assert.match(legacySheet, /export type SheetActor/);

  assert.match(css, /\.player-immersion-dock/);
  assert.match(css, /\.player-movement-ruler/);
  assert.match(characterCss, /\.foundry-character-window/);
  assert.match(characterCss, /\.foundry-character-tabs/);
  assert.match(measurementCss, /\.scene-measurement-popover/);
  assert.match(measurementCss, /\.scene-measurement-calibration-line/);
  assert.match(layout, /scene-measurement\.css/);
});
