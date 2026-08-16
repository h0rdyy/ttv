// UI profile regression: the settings button must stay functional and persist per user.
// Keep the settings flow covered whenever the tabletop shell changes.
// CI synchronization marker for the UI-profile rollout.
// Main-target CI marker.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('tabletop UI preferences expose a real settings button and persist per user', async () => {
  const [panel, wrapper, css, layout] = await Promise.all([
    readFile(new URL('../src/features/campaign/TabletopUiPreferences.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/campaign/OnlineTableV05.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/tabletop-ui-preferences.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/layout.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(panel, /⚙ Интерфейс/);
  assert.match(panel, /ttv:ui-profile:v1:\$\{userId\}/);
  assert.match(panel, /localStorage\.getItem\(storageKey\)/);
  assert.match(panel, /localStorage\.setItem\(storageKey/);
  assert.match(panel, /localStorage\.removeItem\(storageKey\)/);
  assert.match(panel, /label="Кубы"/);
  assert.match(panel, /label="Движение"/);
  assert.match(panel, /label="Название сцены"/);
  assert.match(panel, /label="Игроки онлайн"/);
  assert.match(panel, /Обычная/);
  assert.match(panel, /Компактная/);
  assert.match(panel, /Сбросить/);

  assert.match(wrapper, /useTabletopUiPreferences\(props\.currentUserId\)/);
  assert.match(wrapper, /<TabletopUiPreferencesPanel/);
  assert.match(wrapper, /ui-hide-dice/);
  assert.match(wrapper, /ui-hide-movement/);
  assert.match(wrapper, /ui-hide-scene-info/);
  assert.match(wrapper, /ui-hide-presence/);
  assert.match(wrapper, /ui-density-compact/);

  assert.match(css, /\.ui-hide-dice \.dice-tray-anchor/);
  assert.match(css, /\.ui-hide-movement \.player-movement-chip/);
  assert.match(css, /\.ui-hide-scene-info \.scene-chip/);
  assert.match(css, /\.ui-hide-presence \.online-presence/);
  assert.match(css, /\.ui-density-compact \.player-immersion-dock/);
  assert.match(layout, /import '\.\/tabletop-ui-preferences\.css';/);
});
