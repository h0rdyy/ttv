import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  actorMovementSpeed,
  gridMovementDistance,
  remainingMovement,
  shouldBlockCombatGridMove,
} from '../src/features/campaign/movement.ts';

// UX-lab regression coverage: movement limits must remain behavioral, not cosmetic.
test('grid movement counts square distance in five-foot cells', () => {
  assert.equal(gridMovementDistance(0, 0, 64), 0);
  assert.equal(gridMovementDistance(64, 0, 64), 5);
  assert.equal(gridMovementDistance(64, 64, 64), 5);
  assert.equal(gridMovementDistance(128, 64, 64), 10);
  assert.equal(gridMovementDistance(95, 20, 64), 5);
});

test('combat grid movement blocks zero-foot micro drags and over-budget moves', () => {
  assert.equal(shouldBlockCombatGridMove(0, 0, 30, true), true);
  assert.equal(shouldBlockCombatGridMove(0, 30, 30, true), true);
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

test('player immersion lab enforces combat movement and uses one flexible character window', async () => {
  const [wrapper, hud, css, character, characterCss, layout] = await Promise.all([
    readFile(new URL('../src/features/campaign/OnlineTableV05.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/campaign/PlayerImmersionHud.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/online-table-immersion.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/campaign/PlayerCharacterWindow.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/player-character-window.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/layout.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(wrapper, /<PlayerImmersionHud/);
  assert.match(wrapper, /onOpenCharacter=\{openSelectedCharacter\}/);
  assert.match(wrapper, /<PlayerCharacterWindow/);
  assert.match(wrapper, /sheetActor && props\.mode === 'player'/);
  assert.doesNotMatch(wrapper, /player-immersion-details-open/);
  assert.doesNotMatch(wrapper, /sheet-dock \$\{props\.mode === 'player'/);

  assert.match(hud, /ТВОЙ ХОД/);
  assert.match(hud, /gridMovementDistance/);
  assert.match(hud, /shouldBlockCombatGridMove/);
  assert.match(hud, /stopImmediatePropagation/);
  assert.match(hud, /runtime\.combat_active && !isOwnTurn/);
  assert.match(hud, /0-ft micro drags/);
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

  assert.match(css, /\.player-immersion \.player-mode \.online-table-workspace[\s\S]*grid-template-columns:\s*minmax\(0,1fr\)/);
  assert.match(css, /\.player-immersion-dock/);
  assert.match(css, /\.player-movement-ruler/);
  assert.match(characterCss, /\.foundry-character-window/);
  assert.match(characterCss, /\.foundry-character-tabs/);
  assert.match(characterCss, /\.foundry-quick-stats/);
  assert.match(layout, /player-character-window\.css/);
});
