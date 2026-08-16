import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('contextual UI separates persistent controls into safe zones and exposes mode-aware quick actions', async () => {
  const [source, css, layout] = await Promise.all([
    readFile(new URL('../src/features/campaign/TabletopContextUi.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/tabletop-context-ui-zones.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/layout.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(layout, /import '\.\/tabletop-context-ui-zones\.css';/);
  assert.match(source, /context-ui-quick-actions/);
  assert.match(source, /\['characters', 'map-tools', 'dice'\]/);
  assert.match(source, /\['combat', 'map-tools', 'dice'\]/);
  assert.match(source, /\['scene', 'map-tools', 'leave-prepare'\]/);
  assert.match(source, /\['map-tools', 'dice'\]/);
  assert.match(source, /context-ui-command-shortcut/);

  assert.match(css, /\.map-zoom-controls\s*\{/);
  assert.match(css, /bottom:\s*14px\s*!important/);
  assert.match(css, /left:\s*50%\s*!important/);
  assert.match(css, /transform:\s*translateX\(-50%\)/);
  assert.match(css, /\.context-ui-quick-actions\s*\{/);
  assert.match(css, /left:\s*98px/);
  assert.match(css, /\.ui-chrome-hidden \.map-zoom-controls/);
});
