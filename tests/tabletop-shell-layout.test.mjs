import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('tabletop shell reserves safe zones for GM and player chrome', async () => {
  const [shellCss, layout, coordinator, dice, measurement, preferences] = await Promise.all([
    readFile(new URL('../src/app/tabletop-shell.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/layout.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/campaign/useExclusiveTabletopSurface.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/campaign/DiceTray.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/campaign/SceneMeasurementCalibrator.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/campaign/TabletopUiPreferences.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(layout, /import '\.\/tabletop-shell\.css';/);
  assert.match(shellCss, /grid-template-areas:\s*"library map inspector"/);
  assert.match(shellCss, /grid-area:\s*inspector/);
  assert.match(shellCss, /:has\(\.gm-library\.collapsed\)/);
  assert.match(shellCss, /--ttv-player-bottom-safe/);
  assert.match(shellCss, /100dvh - var\(--ttv-player-topbar\) - var\(--ttv-player-bottom-safe\)/);
  assert.match(shellCss, /:has\(\.dice-tray-anchor\.open\)/);
  assert.match(shellCss, /margin-right:\s*var\(--ttv-player-drawer\)/);
  assert.match(shellCss, /"library inspector"/);
  assert.match(shellCss, /:has\(\.foundry-character-window\) \.tabletop-ui-preferences/);

  assert.match(coordinator, /ttv:tabletop-surface-open/);
  assert.match(coordinator, /window\.dispatchEvent\(new CustomEvent/);
  assert.match(dice, /useExclusiveTabletopSurface\('dice-tray'/);
  assert.match(measurement, /useExclusiveTabletopSurface\('scene-measurement'/);
  assert.match(preferences, /useExclusiveTabletopSurface\('ui-preferences'/);
});
