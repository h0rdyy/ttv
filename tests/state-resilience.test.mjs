import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('character window preserves dirty fields across realtime refreshes and saves patches only', async () => {
  const [character, layer, migration] = await Promise.all([
    readFile(new URL('../src/features/campaign/PlayerCharacterWindow.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/campaign/OnlineTableV05.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/0018_actor_sheet_conflict_fix.sql', import.meta.url), 'utf8'),
  ]);

  assert.match(character, /const \[dirtyKeys, setDirtyKeys\] = useState<Set<string>>/);
  assert.match(character, /pendingSavedRef/);
  assert.match(character, /for \(const key of dirtyKeys\)/);
  assert.match(character, /const patchData = keys\.reduce/);
  assert.doesNotMatch(character, /useEffect\(\(\) => setData\(clone\(actor\.system_data\)\)/);
  assert.match(character, /несохранённые изменения/);
  assert.doesNotMatch(layer, /<OnlineActorSheet/);
  assert.doesNotMatch(layer, /<OnlineSheetWorkshop/);

  assert.match(migration, /where id=target_actor\s+for update;/);
  assert.match(migration, /current_data := coalesce\(current_data,'\{\}'::jsonb\)/);
  assert.match(migration, /jsonb_set\(current_data, array\[key_name\], patch_data->key_name, true\)/);
  assert.doesNotMatch(migration, /system_data=next_data/);
});

test('grid snap toggle persists immediately instead of waiting for scene save', async () => {
  const tools = await readFile(new URL('../src/features/campaign/OnlineSceneTools.tsx', import.meta.url), 'utf8');

  assert.match(tools, /const setSnapImmediately = async \(next: boolean\)/);
  assert.match(tools, /scene_grid_snap: next/);
  assert.match(tools, /onChange=\{\(event\) => void setSnapImmediately\(event\.target\.checked\)\}/);
});
