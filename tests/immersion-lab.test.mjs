import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  actorMovementSpeed,
  gridMovementDistance,
  remainingMovement,
} from '../src/features/campaign/movement.ts';

// UX-lab regression coverage: movement limits must remain behavioral, not cosmetic.
test('grid movement counts square distance in five-foot cells', () => {
  assert.equal(gridMovementDistance(0, 0, 64), 0);
  assert.equal(gridMovementDistance(64, 0, 64), 5);
  assert.equal(gridMovementDistance(64, 64, 64), 5);
  assert.equal(gridMovementDistance(128, 64, 64), 10);
  assert.equal(gridMovementDistance(95, 20, 64), 5);
});

test('actor movement speed supports generic and nested movement data', () => {
  assert.equal(actorMovementSpeed({ movement: { walk: 25 } }), 25);
  assert.equal(actorMovementSpeed({ speed: 35 }), 35);
  assert.equal(actorMovementSpeed({ walk_speed: '40' }), 40);
  assert.equal(actorMovementSpeed({}), 30);
  assert.equal(remainingMovement(30, 10, 5), 15);
  assert.equal(remainingMovement(30, 25, 10), 0);
});

test('player immersion lab enforces combat movement and uses one character window', async () => {
  const [wrapper, hud, css, overrides] = await Promise.all([
    readFile(new URL('../src/features/campaign/OnlineTableV05.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/campaign/PlayerImmersionHud.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/online-table-immersion.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/online-table-immersion-v2.css', import.meta.url), 'utf8'),
  ]);

  assert.match(wrapper, /<PlayerImmersionHud/);
  assert.match(wrapper, /onOpenCharacter=\{openSelectedCharacter\}/);
  assert.match(wrapper, /player-character-window/);
  assert.doesNotMatch(wrapper, /player-immersion-details-open/);
  assert.doesNotMatch(wrapper, /sheet-dock \$\{props\.mode === 'player'/);

  assert.match(hud, /ТВОЙ ХОД/);
  assert.match(hud, /gridMovementDistance/);
  assert.match(hud, /stopImmediatePropagation/);
  assert.match(hud, /runtime\.combat_active && !isOwnTurn/);
  assert.match(hud, /spent \+ distance > speed/);
  assert.match(hud, /последней допустимой клетке/);
  assert.match(hud, />◇ Персонаж<\/button>/);
  assert.doesNotMatch(hud, />◇ Лист<\/button>/);
  assert.doesNotMatch(hud, />🎒 Герой<\/button>/);

  assert.match(css, /\.player-immersion \.player-mode \.online-table-workspace[\s\S]*grid-template-columns:\s*minmax\(0,1fr\)/);
  assert.match(css, /\.player-immersion-dock/);
  assert.match(css, /\.player-movement-ruler/);
  assert.match(overrides, /\.player-immersion \.player-mode \.online-table-sidebar\s*\{[\s\S]*display:\s*none\s*!important/);
  assert.match(overrides, /\.player-character-window \.actor-sheet-overlay/);
});
