import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('contextual tabletop UI keeps keyboard actions global without firing while typing', async () => {
  const source = await readFile(new URL('../src/features/campaign/TabletopContextUi.tsx', import.meta.url), 'utf8');

  assert.match(source, /function isTypingTarget/);
  assert.match(source, /input, textarea, select, \[contenteditable="true"\]/);
  assert.match(source, /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(source, /event\.key\.toLocaleLowerCase\(\) === 'k'/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /event\.key\.toLocaleLowerCase\(\) === 'h'/);
  assert.match(source, /if \(uiHidden\) onUiHiddenChange\(false\)/);
  assert.match(source, /onUiHiddenChange\(true\)/);
  assert.match(source, /context-ui-reveal/);
});
