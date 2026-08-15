import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('tabletop uses one actor selection state owned by OnlineTableV05', async () => {
  const [layer, table] = await Promise.all([
    readFile(new URL('../src/features/campaign/OnlineTableV05.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/campaign/OnlineTable.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(layer, /<OnlineTable[\s\S]*selectedActorId=\{selectedActorId\}[\s\S]*onSelectActor=\{setSelectedActorId\}/);
  assert.match(table, /selectedActorId:\s*string;/);
  assert.match(table, /onSelectActor:\s*\(id:\s*string\)\s*=>\s*void;/);
  assert.match(table, /onSelectActor:\s*setSelectedActorId/);
  assert.doesNotMatch(table, /const \[selectedActorId, setSelectedActorId\] = useState/);
  assert.match(table, /onSelectActor=\{setSelectedActorId\}/);
  assert.match(table, /setSelectedActorId\(actor\.id\)/);
});
