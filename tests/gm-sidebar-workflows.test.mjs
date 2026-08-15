import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('GM sidebar is organized around session workflows instead of entity tables', async () => {
  const sidebar = await readFile(new URL('../src/features/campaign/OnlineGmSidebar.tsx', import.meta.url), 'utf8');
  const topTabs = sidebar.match(/const tabs:[\s\S]*?= \[([\s\S]*?)\];/)?.[1] ?? '';

  assert.match(topTabs, /\['session', 'СЕССИЯ'\]/);
  assert.match(topTabs, /\['characters', 'ПЕРСОНАЖИ'\]/);
  assert.match(topTabs, /\['content', 'КОНТЕНТ'\]/);
  assert.match(topTabs, /\['notes', 'ЗАМЕТКИ'\]/);
  assert.doesNotMatch(topTabs, /\['combat'|\['inventory'|\['npc'/);

  assert.match(sidebar, /visibleTab === 'session' && <SessionPanel/);
  assert.match(sidebar, /visibleTab === 'characters' && <CharactersPanel/);
  assert.match(sidebar, /visibleTab === 'content' && <ContentPanel/);
  assert.match(sidebar, /type CharacterView = 'overview' \| 'inventory'/);
  assert.match(sidebar, /const characterKinds = \[[\s\S]*\['party', 'ГРУППА'\][\s\S]*\['npc', 'NPC'\]/);
});
