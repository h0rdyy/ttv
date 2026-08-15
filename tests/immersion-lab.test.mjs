import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  actorMovementSpeed,
  gridMovementDistance,
  remainingMovement,
} from '../src/features/campaign/movement.ts';

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

test('player immersion lab keeps map primary and adds turn and movement HUD', async () => {
  const [wrapper, hud, css] = await Promise.all([
    readFile(new URL('../src/features/campaign/OnlineTableV05.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/campaign/PlayerImmersionHud.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/online-table-immersion.css', import.meta.url), 'utf8'),
  ]);

  assert.match(wrapper, /<PlayerImmersionHud/);
  assert.match(wrapper, /player-immersion-details-open/);
  assert.doesNotMatch(wrapper, /sheet-dock \$\{props\.mode === 'player'/);

  assert.match(hud, /ТВОЙ ХОД/);
  assert.match(hud, /gridMovementDistance/);
  assert.match(hud, /pointerdown/);
  assert.match(hud, /pointermove/);
  assert.match(hud, /sessionStorage/);
  assert.match(hud, /превышение/);

  assert.match(css, /\.player-immersion \.player-mode \.online-table-workspace[\s\S]*grid-template-columns:\s*minmax\(0,1fr\)/);
  assert.match(css, /\.player-immersion \.player-mode \.online-table-sidebar[\s\S]*position:\s*fixed/);
  assert.match(css, /\.player-immersion-dock/);
  assert.match(css, /\.player-movement-ruler/);
});
