import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  classicFantasySheetSchema,
  normalizeSheetSchema,
  removeSheetField,
  removeSheetSection,
} from '../src/features/campaign/actorSheets.ts';
import {
  buildDiceFormula,
  mergeDiceRollHistory,
  parseDiceRoll,
  removeDieFromRoll,
} from '../src/features/campaign/dice.ts';

const firstRoll = {
  id: '7fd97df9-c7ab-48ab-9d05-92b6ee9fd354',
  senderUserId: '4feaf7d5-d7ef-4b1f-a25c-d60e74038450',
  displayName: 'Игрок',
  sides: [20, 6],
  values: [17, 4],
  modifier: 2,
  total: 23,
  visibility: 'public',
  createdAt: '2026-08-13T10:00:00.000Z',
};

test('classic fantasy sheet has stable unique sections and field keys', () => {
  const schema = classicFantasySheetSchema();
  const sectionIds = schema.sections.map((section) => section.id);
  const fields = schema.sections.flatMap((section) => section.fields);

  assert.equal(schema.version, 1);
  assert.equal(schema.sections.length, 12);
  assert.equal(new Set(sectionIds).size, sectionIds.length);
  assert.equal(new Set(fields.map((field) => field.id)).size, fields.length);
  assert.equal(new Set(fields.map((field) => field.key)).size, fields.length);
});

test('GM deletion helpers remove built-in sections and fields without mutating the source', () => {
  const schema = classicFantasySheetSchema();
  const withoutAbilities = removeSheetSection(schema, 'classic-abilities');
  const withoutStrength = removeSheetField(schema, 'classic-abilities', 'classic-strength');

  assert.equal(schema.sections.some((section) => section.id === 'classic-abilities'), true);
  assert.equal(withoutAbilities.sections.some((section) => section.id === 'classic-abilities'), false);
  assert.equal(schema.sections.find((section) => section.id === 'classic-abilities')?.fields.length, 6);
  assert.equal(withoutStrength.sections.find((section) => section.id === 'classic-abilities')?.fields.length, 5);
  assert.equal(withoutStrength.sections.find((section) => section.id === 'classic-abilities')?.fields.some((field) => field.id === 'classic-strength'), false);
});

test('sheet schema normalization safely repairs malformed values', () => {
  const schema = normalizeSheetSchema({ sections: [{ title: '', slot: 'unknown', fields: [{ type: 'wrong' }] }] });
  assert.deepEqual(schema, {
    version: 1,
    sections: [{
      id: 'section-0',
      title: 'Раздел',
      slot: 'custom',
      fields: [{ id: 'field-0-0', key: 'field_0_0', label: 'Поле', type: 'text', hint: '' }],
    }],
  });
});

test('dice formulas group equal dice and include a signed modifier', () => {
  assert.equal(buildDiceFormula([], 0), 'Выберите кубы');
  assert.equal(buildDiceFormula([20, 6, 20], 3), '2d20 + 1d6 + 3');
  assert.equal(buildDiceFormula([8], -2), '1d8 − 2');
});

test('realtime dice payload accepts a canonical server result and rejects tampering', () => {
  const parsed = parseDiceRoll(firstRoll);
  assert.ok(parsed);
  assert.equal(parsed.formula, '1d20 + 1d6 + 2');
  assert.equal(parseDiceRoll({ ...firstRoll, total: 24 }), null);
  assert.equal(parseDiceRoll({ ...firstRoll, sides: [20, 7] }), null);
  assert.equal(parseDiceRoll({ ...firstRoll, values: [17] }), null);
  assert.equal(parseDiceRoll({ ...firstRoll, displayName: '' }), null);
});

test('dice history deduplicates realtime echoes, sorts newest first, and stays bounded', () => {
  const parsed = parseDiceRoll(firstRoll);
  assert.ok(parsed);
  const newer = parseDiceRoll({
    ...firstRoll,
    id: 'e4408800-72ca-4d10-82e2-4b40b44de4f8',
    createdAt: '2026-08-13T10:01:00.000Z',
  });
  assert.ok(newer);

  assert.deepEqual(mergeDiceRollHistory([parsed], parsed), [parsed]);
  assert.deepEqual(mergeDiceRollHistory([parsed], newer, 1), [newer]);
});

test('clicking a settled die removes it and recalculates the visible tray total', () => {
  const parsed = parseDiceRoll(firstRoll);
  assert.ok(parsed);
  const oneDie = removeDieFromRoll(parsed, 0);
  assert.ok(oneDie);
  assert.deepEqual(oneDie.sides, [6]);
  assert.deepEqual(oneDie.values, [4]);
  assert.equal(oneDie.formula, '1d6 + 2');
  assert.equal(oneDie.total, 6);
  assert.equal(removeDieFromRoll(oneDie, 0), null);
});

test('v0.5.1 release files contain production wiring and no release markers', async () => {
  const paths = [
    'src/features/campaign/DiceTray.tsx',
    'src/features/campaign/OnlineSheetWorkshop.tsx',
    'src/features/campaign/OnlineTable.tsx',
    'src/features/campaign/MapCropDialog.tsx',
    'supabase/migrations/0016_classic_fantasy_sheet_default.sql',
    'supabase/migrations/0017_realtime_dice_rolls.sql',
  ];
  const sources = await Promise.all(paths.map((path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')));
  const joined = sources.join('\n');
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  assert.equal(packageJson.version, '0.5.1');
  assert.doesNotMatch(joined, /\b(?:TODO|FIXME|HACK)\b|Прототип\s*·\s*локально/i);
  assert.match(sources[0], /rpc\('broadcast_dice_roll'/);
  assert.match(sources[1], /removeSheetSection/);
  assert.match(sources[5], /campaign-gm:/);
  assert.doesNotMatch(sources[5], /create\s+table/i);
});

test('responsive table keeps controls reachable and isolates nested wheel scrolling', async () => {
  const componentPaths = [
    'src/features/campaign/OnlineGmWorkshop.tsx',
    'src/features/campaign/OnlineSceneTools.tsx',
    'src/features/campaign/MapCropDialog.tsx',
    'src/features/campaign/DiceTray.tsx',
    'src/features/campaign/OnlineTableV05.tsx',
    'src/features/campaign/OnlineActorSheet.tsx',
  ];
  const [table, ...isolatedPanels] = await Promise.all([
    readFile(new URL('../src/features/campaign/OnlineTable.tsx', import.meta.url), 'utf8'),
    ...componentPaths.map((path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')),
  ]);
  const [tableCss, sceneCss, sheetCss, workshopCss] = await Promise.all([
    readFile(new URL('../src/app/online-table.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/scene-v04.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/sheet-v05.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/mvp.css', import.meta.url), 'utf8'),
  ]);

  assert.match(table, /closest\('\[data-wheel-isolation="true"\]'\)/);
  isolatedPanels.forEach((source, index) => {
    assert.match(source, /data-wheel-isolation="true"/, `${componentPaths[index]} must isolate its wheel events`);
  });
  assert.match(tableCss, /height:\s*100dvh/);
  assert.match(tableCss, /grid-template-rows:\s*clamp\(320px,\s*58dvh,\s*650px\)\s+auto/);
  assert.match(tableCss, /padding-bottom:\s*72px/);
  assert.match(tableCss, /@media\s*\(max-height:\s*480px\)[\s\S]*?\.online-table-shell\s*\{[\s\S]*?overflow:\s*visible/);
  assert.match(tableCss, /overscroll-behavior:\s*contain/);
  assert.match(sceneCss, /max-height:\s*calc\(100dvh\s*-\s*48px\)/);
  assert.doesNotMatch(sceneCss, /online-map-actions[^{}]*button:not\(\.active\)[^{]*\{[^}]*display:\s*none/);
  assert.match(sheetCss, /height:\s*min\(920px,\s*calc\(100dvh\s*-\s*32px\)\)/);
  assert.match(workshopCss, /\.module-list-scroll,[\s\S]*overscroll-behavior:\s*contain/);
});
