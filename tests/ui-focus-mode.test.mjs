// Focus-mode regression: editor footers must never be covered by persistent tabletop controls.
// This file intentionally stays tiny so focus chrome rules remain easy to review.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('dense editors hide persistent bottom tabletop chrome', async () => {
  const [css, layout] = await Promise.all([
    readFile(new URL('../src/app/tabletop-ui-focus.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/layout.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(css, /:has\(\.foundry-character-window\)/);
  assert.match(css, /:has\(\.online-workshop-panel \.builder-view\)/);
  assert.match(css, /\.dice-tray-anchor/);
  assert.match(css, /\.scene-measurement-anchor/);
  assert.match(css, /\.player-immersion-dock/);
  assert.match(css, /\.sheet-dock/);
  assert.match(css, /display:\s*none\s*!important/);
  assert.match(layout, /import '\.\/tabletop-ui-focus\.css';/);
});
