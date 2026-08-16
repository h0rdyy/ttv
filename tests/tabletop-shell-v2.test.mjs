import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('tabletop shell progressively discloses contextual UI instead of a permanent rail', async () => {
  const [adapter, contextUi, css, diceCss, wrapper, layout] = await Promise.all([
    readFile(new URL('../src/features/campaign/TabletopShellV2.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/campaign/TabletopContextUi.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/tabletop-context-ui.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/tabletop-shell-v2-dice.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/campaign/OnlineTableV05.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/layout.tsx', import.meta.url), 'utf8'),
  ]);

  // Existing wrapper stays compatible while the adapter promotes it to v3.
  assert.match(wrapper, /<TabletopShellV2/);
  assert.match(adapter, /TabletopContextUi/);
  assert.match(adapter, /classList\.add\('tabletop-shell-v3'\)/);
  assert.match(adapter, /classList\.toggle\('ui-chrome-hidden', uiHidden\)/);
  assert.match(adapter, /classList\.toggle\('table-context-combat', combatActive\)/);
  assert.match(layout, /import '\.\/tabletop-context-ui\.css';/);

  // Default UI is one contextual launcher plus a tiny mode-aware discovery row,
  // not a permanent GM rail.
  assert.match(contextUi, /context-ui-launcher/);
  assert.match(contextUi, /context-ui-main-button/);
  assert.match(contextUi, /context-ui-quick-actions/);
  assert.doesNotMatch(contextUi, /tabletop-shell-v2-rail/);
  assert.match(contextUi, /const tableMode: TableMode = combatActive \? 'combat' : preferredMode/);
  assert.match(contextUi, /label: `Бой · \$\{combatRound\}`/);
  assert.match(contextUi, /label: 'Подготовка'/);
  assert.match(contextUi, /label: 'К игре'/);

  // Progressive disclosure and keyboard-first navigation are real behavior.
  assert.match(contextUi, /context-tools-palette/);
  assert.match(contextUi, /context-command-palette/);
  assert.match(contextUi, /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(contextUi, /event\.key\.toLocaleLowerCase\(\) === 'k'/);
  assert.match(contextUi, /event\.key === 'Escape'/);
  assert.match(contextUi, /event\.key\.toLocaleLowerCase\(\) === 'h'/);
  assert.match(contextUi, /closeAllTransient\(\)/);

  // Rare tools are opened on demand through the old business-logic hosts.
  assert.match(contextUi, /Настройки сцены/);
  assert.match(contextUi, /online-workshop-trigger/);
  assert.match(contextUi, /gm-library-rail button\[aria-label/);
  assert.match(contextUi, /scene-measurement-trigger/);
  assert.match(contextUi, /tabletop-ui-preferences-trigger/);

  // Floating legacy dice button remains invisible; contextual UI invokes it.
  assert.match(diceCss, /\.dice-tray-toggle/);
  assert.match(diceCss, /clip-path:\s*inset\(50%\)/);
  assert.match(diceCss, /pointer-events:\s*none/);
  assert.match(contextUi, /queryButton\('\.online-table-shell \.dice-tray-toggle'\)\?\.click\(\)/);

  // Map-first layout removes the permanent inspector and compacts player HUD.
  assert.match(css, /--v2-rail:\s*0px/);
  assert.match(css, /\.gm-mode \.gm-inspector \{ display: none !important; \}/);
  assert.match(css, /\.player-immersion-dock/);
  assert.match(css, /\.player-movement-chip \{ display: none; \}/);
  assert.match(css, /\.table-context-combat \.player-movement-chip \{ display: grid/);
  assert.match(css, /\.ui-chrome-hidden \.online-table-topbar/);
  assert.match(css, /\.context-ui-reveal/);
});
