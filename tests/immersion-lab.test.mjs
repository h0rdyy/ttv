import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  actorMovementSpeed,
  gridMovementDistance,
  remainingMovement,
  shouldBlockCombatGridMove,
} from '../src/features/campaign/movement.ts';

// UX-lab regression coverage: movement, GM actor actions, health and hot-path refreshes must stay deterministic, stable, and fast.
test('grid movement counts square distance in five-foot cells and charges intentional micro drags', () => {
  assert.equal(gridMovementDistance(0, 0, 64), 0);
  assert.equal(gridMovementDistance(1, 0, 64), 5);
  assert.equal(gridMovementDistance(64, 0, 64), 5);
  assert.equal(gridMovementDistance(64, 64, 64), 5);
  assert.equal(gridMovementDistance(128, 64, 64), 10);
  assert.equal(gridMovementDistance(95, 20, 64), 5);
});

test('combat grid movement allows clicks but blocks over-budget moves', () => {
  assert.equal(shouldBlockCombatGridMove(0, 0, 30, true), false);
  assert.equal(shouldBlockCombatGridMove(5, 25, 30, true), false);
  assert.equal(shouldBlockCombatGridMove(5, 30, 30, true), true);
  assert.equal(shouldBlockCombatGridMove(10, 25, 30, true), true);
  assert.equal(shouldBlockCombatGridMove(0, 30, 30, false), false);
});

test('actor movement speed supports generic and nested movement data', () => {
  assert.equal(actorMovementSpeed({ movement: { walk: 25 } }), 25);
  assert.equal(actorMovementSpeed({ speed: 35 }), 35);
  assert.equal(actorMovementSpeed({ walk_speed: '40' }), 40);
  assert.equal(actorMovementSpeed({}), 30);
  assert.equal(remainingMovement(30, 10, 5), 15);
  assert.equal(remainingMovement(30, 25, 10), 0);
});

test('immersion lab enforces movement and uses one flexible character window', async () => {
  const [wrapper, hud, css, character, characterCss, layout, legacySheet, gmSidebar, hpMigration, tokenRefreshMigration] = await Promise.all([
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
  ]);

  assert.match(wrapper, /<PlayerImmersionHud/);
  assert.match(wrapper, /onOpenCharacter=\{openSelectedCharacter\}/);
  assert.match(wrapper, /<PlayerCharacterWindow/);
  assert.match(wrapper, /characterActor &&/);
  assert.match(wrapper, /pendingOpenActorIdRef/);
  assert.match(wrapper, /!exists\) pendingOpenActorIdRef\.current = selectedActorId/);
  assert.match(wrapper, /setCharacterActorId\(pendingActorId\)/);
  assert.doesNotMatch(wrapper, /addedIds\.has\(selectedActorId\)/);
  assert.doesNotMatch(wrapper, /<OnlineActorSheet/);
  assert.doesNotMatch(wrapper, /<OnlineSheetWorkshop/);
  assert.doesNotMatch(wrapper, /sheet-dock gm/);

  assert.match(wrapper, /contextmenu/);
  assert.match(wrapper, /gm-library-actor/);
  assert.match(wrapper, /\.token/);
  assert.match(wrapper, /✎ Редактировать/);
  assert.match(wrapper, /× Удалить/);
  assert.match(wrapper, /delete_campaign_actor/);
  assert.match(wrapper, /blockRightDrag/);

  assert.match(wrapper, /const actors = props\.initialActors\.map\(withCompatibleHealth\)/);
  assert.match(wrapper, /const sheetHealth = objectResource\(data\.hit_points\)/);
  assert.match(wrapper, /system_data: \{ \.\.\.data, hp: health \}/);
  assert.match(wrapper, /initialActors=\{actors\}/);
  assert.match(wrapper, /actors=\{actors\}/);

  assert.match(gmSidebar, /type OptimisticHealth/);
  assert.match(gmSidebar, /hpQueueRef/);
  assert.match(gmSidebar, /changeQuickHp/);
  assert.match(gmSidebar, /effectiveDelta/);
  assert.match(gmSidebar, /adjust_actor_hp/);
  assert.match(gmSidebar, /objectResource\(data\?\.hit_points\) \?\? objectResource\(data\?\.hp\)/);
  assert.doesNotMatch(gmSidebar, /actor\.system_data\?\.hp\?\.current/);
  assert.match(hpMigration, /health_key = 'hit_points'/);
  assert.match(hpMigration, /return jsonb_set\(current_data, '\{hp\}', current_data->'hit_points', true\)/);

  assert.match(hud, /spent >= speed/);
  assert.match(hud, /lastAllowedX/);
  assert.match(hud, /new PointerEvent\('pointermove'/);
  assert.match(hud, /target\.dispatchEvent\(clamped\)/);
  assert.match(tokenRefreshMigration, /TG_TABLE_NAME = 'scene_tokens' and TG_OP = 'UPDATE'/);
  assert.match(tokenRefreshMigration, /to_jsonb\(NEW\) - array\['x', 'y', 'updated_at'\]/);

  assert.match(hud, /ТВОЙ ХОД/);
  assert.match(hud, /gridMovementDistance/);
  assert.match(hud, /shouldBlockCombatGridMove/);
  assert.match(hud, /stopImmediatePropagation/);
  assert.match(hud, /runtime\.combat_active && !isOwnTurn/);
  assert.match(hud, />◇ Персонаж<\/button>/);
  assert.doesNotMatch(hud, />◇ Лист<\/button>/);
  assert.doesNotMatch(hud, />🎒 Герой<\/button>/);

  assert.match(character, /Обзор/);
  assert.match(character, /Навыки/);
  assert.match(character, /Бой/);
  assert.match(character, /Инвентарь/);
  assert.match(character, /Особенности/);
  assert.match(character, /Биография/);
  assert.match(character, /normalizeSheetSchema/);
  assert.match(character, /slot-\$\{section\.slot/);
  assert.match(character, /update_actor_sheet/);

  assert.doesNotMatch(legacySheet, /export function OnlineActorSheet/);
  assert.match(legacySheet, /export type SheetActor/);

  assert.match(css, /\.player-immersion \.player-mode \.online-table-workspace[\s\S]*grid-template-columns:\s*minmax\(0,1fr\)/);
  assert.match(css, /\.player-immersion-dock/);
  assert.match(css, /\.player-movement-ruler/);
  assert.match(characterCss, /\.foundry-character-window/);
  assert.match(characterCss, /\.foundry-character-tabs/);
  assert.match(characterCss, /\.foundry-quick-stats/);
  assert.match(layout, /player-character-window\.css/);
});
