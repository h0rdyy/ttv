import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('tabletop shell v2 is map-first and keeps one controlled GM navigation rail', async () => {
  const [shell, css, diceCss, wrapper, layout] = await Promise.all([
    readFile(new URL('../src/features/campaign/TabletopShellV2.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/tabletop-shell-v2.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/tabletop-shell-v2-dice.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/campaign/OnlineTableV05.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/layout.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(wrapper, /tabletop-shell-v2/);
  assert.match(wrapper, /<TabletopShellV2/);
  assert.match(layout, /import '\.\/tabletop-shell-v2\.css';/);
  assert.match(layout, /import '\.\/tabletop-shell-v2-dice\.css';/);

  assert.match(shell, /tabletop-shell-v2-rail/);
  assert.match(shell, /label="Сцена"/);
  assert.match(shell, /label="Персонажи"/);
  assert.match(shell, /label=\{combatActive \? `Бой · раунд \$\{combatRound\}` : 'Бой'\}/);
  assert.match(shell, /label="Библиотека"/);
  assert.match(shell, /label="Заметки"/);
  assert.match(shell, /label="Кубы"/);
  assert.match(shell, /label="Интерфейс"/);
  assert.match(shell, /gm-library\.expanded/);
  assert.match(shell, /Настройки сцены/);
  assert.match(shell, /scene-measurement-trigger/);

  assert.match(css, /grid-template-columns:\s*var\(--v2-rail\) minmax\(0, 1fr\)/);
  assert.match(css, /:has\(\.gm-library\.expanded\)/);
  assert.match(css, /calc\(var\(--v2-rail\) \+ var\(--v2-drawer\)\)/);
  assert.match(css, /:has\(\.gm-inspector-head\) \.online-map-stage/);
  assert.match(css, /\.scene-tools-panel/);
  assert.match(css, /\.online-workshop-panel/);
  assert.match(css, /\.tabletop-ui-preferences-trigger/);
  assert.match(css, /\.scene-measurement-trigger/);

  // The legacy dice toggle must stay mounted for the adapter, but it must never
  // float over the map in v2. GM uses the rail; player gets a compact top action.
  assert.match(diceCss, /\.dice-tray-toggle/);
  assert.match(diceCss, /clip-path:\s*inset\(50%\)/);
  assert.match(diceCss, /pointer-events:\s*none/);
  assert.match(shell, /tabletop-shell-v2-player-actions/);
  assert.match(shell, /tabletop-shell-v2-player-dice/);
  assert.match(shell, /aria-label="Открыть кубы"/);
  assert.match(shell, /const openDice = \(\) => queryButton\('\.online-table-shell \.dice-tray-toggle'\)\?\.click\(\)/);

  // The legacy scene/workshop controls stay mounted only as transition adapters,
  // but must not remain visible in the new top bar.
  assert.match(css, /\.gm-mode \.online-topbar-menu:not\(\.session-menu-root\)/);
  assert.match(css, /\.gm-mode \.online-workshop-trigger/);
});
