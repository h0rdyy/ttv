import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('GM workspace uses a left library and right actor inspector around the map', async () => {
  const [sidebar, css, layout] = await Promise.all([
    readFile(new URL('../src/features/campaign/OnlineGmSidebar.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/online-table-contextual.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/layout.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(sidebar, /className={`gm-library \$\{libraryOpen \? 'expanded' : 'collapsed'\}`}/);
  assert.match(sidebar, /className="gm-inspector"/);
  assert.match(sidebar, /<CharacterLibrary \{\.\.\.props\} \/>/);
  assert.match(sidebar, /<ContentLibrary \{\.\.\.props\} \/>/);
  assert.match(sidebar, /<NotesPanel \{\.\.\.props\} \/>/);
  assert.match(sidebar, /<SessionLibrary \{\.\.\.props\} \/>/);
  assert.match(sidebar, /<ActorInspector \{\.\.\.props\} \/>/);
  assert.match(sidebar, /type InspectorView = 'sheet' \| 'inventory' \| 'token'/);
  assert.match(sidebar, />Лист<\/button>/);
  assert.match(sidebar, />Инвентарь<\/button>/);
  assert.match(sidebar, />Фишка<\/button>/);

  assert.match(css, /grid-template-areas:\s*"library map inspector"/);
  assert.match(css, /\.gm-library\s*\{[\s\S]*grid-area:\s*library/);
  assert.match(css, /\.gm-inspector\s*\{[\s\S]*grid-area:\s*inspector/);
  assert.match(css, /@media \(max-width: 1300px\)/);
  assert.match(layout, /import '\.\/online-table-contextual\.css';/);
});
