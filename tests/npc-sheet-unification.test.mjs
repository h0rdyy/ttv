import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('NPCs are created from Characters and use the shared Actor Sheet', async () => {
  const [sidebar, workshop, css, migration] = await Promise.all([
    readFile(new URL('../src/features/campaign/OnlineGmSidebar.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/campaign/OnlineGmWorkshop.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/online-table-contextual.css', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/0019_npc_sheet_unification.sql', import.meta.url), 'utf8'),
  ]);

  assert.match(sidebar, /actor_kind:\s*'npc'/);
  assert.match(sidebar, /NPC создан\. Его характеристики редактируются через единый лист персонажа\./);
  assert.match(sidebar, /NPC используют тот же лист персонажа, что и герои\./);
  assert.match(sidebar, /Герои и NPC используют один Actor Sheet/);
  assert.doesNotMatch(sidebar, /Создать \/ редактировать NPC/);
  assert.doesNotMatch(sidebar, /Открыть NPC в мастерской/);
  assert.match(sidebar, /Предметы · Лут · Таблицы/);

  assert.match(workshop, /\['items',\s*'ПРЕДМЕТЫ'\][\s\S]*\['loot',\s*'ЛУТ'\][\s\S]*\['tables',\s*'ТАБЛИЦЫ'\]/);
  assert.doesNotMatch(workshop, /\['npc',\s*'NPC'\]/);
  assert.doesNotMatch(workshop, /OnlineNpcWorkshop/);
  assert.doesNotMatch(workshop, /РЕДАКТОР NPC/);
  assert.doesNotMatch(workshop, /update_campaign_actor/);
  assert.doesNotMatch(css, /workshop-tabs > button:nth-child/);

  assert.match(migration, /update public\.actors[\s\S]*name=btrim\(actor_name\)[\s\S]*subtitle=coalesce\(actor_subtitle,''\)[\s\S]*avatar=coalesce\(actor_avatar,''\)/);
  assert.doesNotMatch(migration, /system_data\s*=/);
  assert.match(migration, /actor_system_data is intentionally ignored/);
});
