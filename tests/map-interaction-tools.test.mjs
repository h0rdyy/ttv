import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const tools = fs.readFileSync('src/features/campaign/MapInteractionTools.tsx', 'utf8');
const wrapper = fs.readFileSync('src/features/campaign/OnlineTableV05.tsx', 'utf8');
const contextUi = fs.readFileSync('src/features/campaign/TabletopContextUi.tsx', 'utf8');
const layout = fs.readFileSync('src/app/layout.tsx', 'utf8');
const css = fs.readFileSync('src/app/map-interaction-tools.css', 'utf8');

test('map tools are mounted on the current scene and exposed from contextual UI', () => {
  assert.match(wrapper, /<MapInteractionTools/);
  assert.match(wrapper, /campaignId=\{props\.campaign\.id\}/);
  assert.match(wrapper, /scene=\{activeScene\}/);
  assert.match(contextUi, /id: 'map-tools'/);
  assert.match(contextUi, /label: 'Инструменты'/);
  assert.match(contextUi, /'ttv:map-tools:toggle'/);
  assert.match(contextUi, /\['map-tools', 'dice'\]/);
});

test('players receive ruler and ping while freehand drawing stays GM-only', () => {
  assert.match(tools, /toggleTool\('ruler'\)/);
  assert.match(tools, /toggleTool\('ping'\)/);
  assert.match(tools, /mode === 'gm' && \(/);
  assert.match(tools, /toggleTool\('draw'\)/);
  assert.match(tools, /mode === 'gm' && tool === 'draw'/);
});

test('ping and temporary drawings synchronize through campaign realtime broadcasts', () => {
  assert.match(tools, /const PING_EVENT = 'map_ping'/);
  assert.match(tools, /const DRAW_EVENT = 'map_draw'/);
  assert.match(tools, /const CLEAR_EVENT = 'map_draw_clear'/);
  assert.match(tools, /private: true/);
  assert.match(tools, /broadcast: \{ self: false \}/);
  assert.match(tools, /supabase\.realtime\.setAuth\(\)/);
});

test('ruler uses calibrated scene measurement with legacy grid fallback', () => {
  assert.match(tools, /scene\.measurement_units_per_map_width/);
  assert.match(tools, /gridUnitsPerMapWidth/);
  assert.match(tools, /formatMovementDistance\(rulerDistance\)/);
  assert.match(tools, /scene\?\.measurement_unit\?\.trim\(\) \|\| DEFAULT_DISTANCE_UNIT/);
});

test('interaction styles load after contextual shell styles and preserve the map layer', () => {
  const contextualIndex = layout.indexOf("import './tabletop-context-ui-zones.css';");
  const toolsIndex = layout.indexOf("import './map-interaction-tools.css';");
  assert.ok(contextualIndex >= 0 && toolsIndex > contextualIndex);
  assert.match(css, /\.map-interaction-hit-layer\.active/);
  assert.match(css, /\.map-tools-palette/);
  assert.match(css, /ui-chrome-hidden \.map-tools-palette/);
});
