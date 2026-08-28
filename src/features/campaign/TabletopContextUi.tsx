'use client';

import { useEffect, useMemo, useState } from 'react';
import { TabletopIcon, type TabletopIconName } from './TabletopIcon';

type Mode = 'gm' | 'player';
type TableMode = 'play' | 'combat' | 'prepare';
type Surface = 'mode' | null;

type Props = {
  mode: Mode;
  campaignName: string;
  activeSceneName: string | null;
  combatActive: boolean;
  combatRound: number;
  focusActive: boolean;
  uiHidden: boolean;
  canOpenCharacter: boolean;
  onOpenCharacter: () => void;
  onUiHiddenChange: (hidden: boolean) => void;
};

type Action = {
  id: string;
  icon: TabletopIconName;
  label: string;
  hint: string;
  run: () => void;
};

const LEGACY_DRAWERS = {
  characters: 'ПЕРСОНАЖИ',
  combat: 'СЕССИЯ',
  library: 'КОНТЕНТ',
  notes: 'ЗАМЕТКИ',
} as const;

const MAP_TOOLS_TOGGLE_EVENT = 'ttv:map-tools:toggle';
const MAP_TOOLS_CLOSE_EVENT = 'ttv:map-tools:close';

function queryButton(selector: string) {
  return document.querySelector<HTMLButtonElement>(selector);
}

function buttonWithText(selector: string, text: string) {
  return [...document.querySelectorAll<HTMLButtonElement>(selector)]
    .find((button) => button.textContent?.includes(text)) ?? null;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

export function TabletopContextUi({
  mode,
  campaignName,
  activeSceneName,
  combatActive,
  combatRound,
  focusActive,
  uiHidden,
  canOpenCharacter,
  onOpenCharacter,
  onUiHiddenChange,
}: Props) {
  const [surface, setSurface] = useState<Surface>(null);
  const [preferredMode, setPreferredMode] = useState<Exclude<TableMode, 'combat'>>('play');
  // Combat is an overlay on the table — it must not lock out scene/characters/workshop.
  const tableMode: TableMode = preferredMode;
  const inCombat = combatActive;

  const closeLegacyDrawer = () => {
    const library = document.querySelector('.online-table-shell.gm-mode .gm-library.expanded');
    if (library) queryButton('.online-table-shell.gm-mode .gm-library-collapse')?.click();
  };

  const closeTransientWorkspace = () => {
    queryButton('.online-table-shell.gm-mode .scene-tools-panel .close-button')?.click();
    queryButton('.online-table-shell.gm-mode .online-workshop-panel .close-button')?.click();
  };

  const closeDice = () => {
    if (document.querySelector('.online-table-shell .dice-tray-anchor.open')) {
      queryButton('.online-table-shell .dice-tray-toggle')?.click();
    }
  };

  const closeMeasurement = () => {
    if (document.querySelector('.scene-measurement-popover')) {
      queryButton('.scene-measurement-trigger')?.click();
    }
  };

  const closeMapTools = () => {
    window.dispatchEvent(new CustomEvent(MAP_TOOLS_CLOSE_EVENT));
  };

  const closeAllTransient = () => {
    setSurface(null);
    closeLegacyDrawer();
    closeTransientWorkspace();
    closeDice();
    closeMeasurement();
    closeMapTools();
  };

  const drawerButton = (key: keyof typeof LEGACY_DRAWERS) => {
    const label = LEGACY_DRAWERS[key];
    return queryButton(`.online-table-shell.gm-mode .gm-library-rail button[aria-label="${label}"]`);
  };

  const ensureLegacyDrawer = (key: keyof typeof LEGACY_DRAWERS) => {
    closeTransientWorkspace();
    closeDice();
    closeMeasurement();
    closeMapTools();

    const button = drawerButton(key);
    if (!button) return false;
    const library = document.querySelector('.online-table-shell.gm-mode .gm-library');
    const alreadyOpen = library?.classList.contains('expanded') && button.getAttribute('aria-pressed') === 'true';
    if (!alreadyOpen) button.click();
    setSurface(null);
    return true;
  };

  const toggleLegacyDrawer = (key: keyof typeof LEGACY_DRAWERS) => {
    closeTransientWorkspace();
    closeDice();
    closeMeasurement();
    closeMapTools();

    const button = drawerButton(key);
    if (!button) return;
    button.click();
    setSurface(null);
  };

  const openSceneWorkspace = () => {
    closeLegacyDrawer();
    closeDice();
    closeMeasurement();
    closeMapTools();
    queryButton('.online-table-shell.gm-mode .online-workshop-panel .close-button')?.click();

    const trigger = buttonWithText('.online-table-shell.gm-mode .online-menu-trigger', 'Сцена');
    if (!trigger) return;
    trigger.click();
    window.requestAnimationFrame(() => {
      buttonWithText('.online-table-shell.gm-mode .scene-menu button', 'Настройки сцены')?.click();
    });
    setSurface(null);
  };

  const openWorkshop = () => {
    closeLegacyDrawer();
    closeTransientWorkspace();
    closeDice();
    closeMeasurement();
    closeMapTools();
    queryButton('.online-table-shell.gm-mode .online-workshop-trigger')?.click();
    setSurface(null);
  };

  const openDice = () => {
    closeLegacyDrawer();
    closeTransientWorkspace();
    closeMeasurement();
    closeMapTools();
    queryButton('.online-table-shell .dice-tray-toggle')?.click();
    setSurface(null);
  };

  const openMeasurement = () => {
    closeLegacyDrawer();
    closeTransientWorkspace();
    closeDice();
    closeMapTools();
    queryButton('.scene-measurement-trigger')?.click();
    setSurface(null);
  };

  const openMapTools = () => {
    closeLegacyDrawer();
    closeTransientWorkspace();
    closeDice();
    closeMeasurement();
    window.dispatchEvent(new CustomEvent(MAP_TOOLS_TOGGLE_EVENT));
    setSurface(null);
  };

  const enterPrepare = () => {
    closeAllTransient();
    setPreferredMode('prepare');
    setSurface('mode');
  };

  const leavePrepare = () => {
    closeAllTransient();
    setPreferredMode('play');
  };

  const hideChrome = () => {
    closeAllTransient();
    onUiHiddenChange(true);
  };

  const startCombat = () => {
    if (mode !== 'gm' || combatActive) return;
    const opened = ensureLegacyDrawer('combat');
    if (!opened) return;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        buttonWithText('.online-table-shell.gm-mode .gm-library-drawer button', 'Начать бой')?.click();
      });
    });
  };

  const actions = useMemo<Action[]>(() => {
    const common: Action[] = [
      {
        id: 'map-tools',
        icon: 'tools',
        label: 'Инструменты',
        hint: mode === 'gm' ? 'Линейка, пинг и рисование' : 'Линейка и пинг',
        run: openMapTools,
      },
      {
        id: 'dice',
        icon: 'dice',
        label: 'Кубы',
        hint: 'Открыть лоток бросков',
        run: openDice,
      },
    ];

    if (mode === 'player') {
      return [
        ...(canOpenCharacter ? [{
          id: 'character',
          icon: 'sheet' as const,
          label: 'Персонаж',
          hint: 'Открыть полный лист',
          run: () => { setSurface(null); onOpenCharacter(); },
        }] : []),
        ...common,
      ];
    }

    const gmActions: Action[] = [];

    if (inCombat) {
      gmActions.push({
        id: 'combat',
        icon: 'combat',
        label: `Бой · ${combatRound}`,
        hint: 'Инициатива и текущий ход',
        run: () => toggleLegacyDrawer('combat'),
      });
    }

    if (tableMode === 'prepare') {
      gmActions.push(
        {
          id: 'scene',
          icon: 'scene',
          label: 'Сцена',
          hint: 'Карта, сетка, туман и токены',
          run: openSceneWorkspace,
        },
        ...(activeSceneName ? [{
          id: 'measurement',
          icon: 'ruler' as const,
          label: 'Масштаб карты',
          hint: `Калибровка · ${activeSceneName}`,
          run: openMeasurement,
        }] : []),
        {
          id: 'workshop',
          icon: 'workshop',
          label: 'Мастерская',
          hint: 'Предметы, таблицы и контент',
          run: openWorkshop,
        },
      );
    }

    gmActions.push(
      {
        id: 'characters',
        icon: 'characters',
        label: 'Персонажи',
        hint: 'Герои и NPC',
        run: () => toggleLegacyDrawer('characters'),
      },
      ...common,
    );

    return gmActions;
  // Adapter callbacks intentionally use current DOM state rather than React state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSceneName, canOpenCharacter, combatRound, inCombat, mode, onOpenCharacter, tableMode]);

  const quickActionIds = mode === 'player'
    ? ['map-tools', 'dice']
    : inCombat
      ? (tableMode === 'prepare'
          ? ['combat', 'scene', 'characters', 'map-tools', 'dice']
          : ['combat', 'characters', 'map-tools', 'dice'])
      : tableMode === 'prepare'
        ? ['scene', 'characters', 'map-tools', 'dice']
        : ['characters', 'map-tools', 'dice'];
  const quickActions = quickActionIds
    .map((id) => actions.find((action) => action.id === id))
    .filter((action): action is Action => Boolean(action));

  useEffect(() => {
    if (mode !== 'gm') return;
    const frame = window.requestAnimationFrame(() => closeLegacyDrawer());
    return () => window.cancelAnimationFrame(frame);
  }, [mode]);

  useEffect(() => {
    if (!focusActive) return;
    setSurface(null);
    closeMapTools();
  }, [focusActive]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (surface) {
          event.preventDefault();
          setSurface(null);
          return;
        }
        closeAllTransient();
        return;
      }

      if (event.key.toLocaleLowerCase() === 'h' && !isTypingTarget(event.target)) {
        event.preventDefault();
        if (uiHidden) onUiHiddenChange(false);
        else hideChrome();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (focusActive) return null;

  const modeLabel = inCombat
    ? `Бой · ${combatRound}`
    : tableMode === 'prepare'
      ? 'Подготовка'
      : 'Игра';
  const modeIcon: TabletopIconName = inCombat ? 'combat' : tableMode === 'prepare' ? 'prepare' : 'game';

  if (uiHidden) {
    return (
      <button
        type="button"
        className="context-ui-reveal"
        onClick={() => onUiHiddenChange(false)}
        aria-label="Показать интерфейс"
        title="Показать интерфейс · H"
      >
        <TabletopIcon name="eye" />
      </button>
    );
  }

  return (
    <>
      <nav className={`context-ui-actionbar ${mode}`} aria-label="Действия на столе" data-wheel-isolation="true">
        <button
          type="button"
          className={`context-ui-mode-chip mode-${inCombat ? "combat" : tableMode}`}
          onClick={mode === 'gm' ? () => setSurface((current) => current === 'mode' ? null : 'mode') : undefined}
          aria-expanded={mode === 'gm' ? surface === 'mode' : undefined}
          aria-haspopup={mode === 'gm' ? 'menu' : undefined}
          aria-label={mode === 'gm' ? `Меню стола · ${modeLabel}` : `Режим: ${modeLabel}`}
          title={mode === 'gm' ? 'Меню стола' : modeLabel}
        >
          <TabletopIcon name={modeIcon} />
          <strong>{modeLabel}</strong>
        </button>

        {quickActions.map((action) => (
          <button key={action.id} type="button" data-action={action.id} onClick={action.run} title={action.hint} aria-label={action.label}>
            <TabletopIcon name={action.icon} />
            <strong>{action.label}</strong>
          </button>
        ))}
      </nav>

      {surface === 'mode' && mode === 'gm' && (
        <section className="context-mode-menu" role="menu" aria-label="Меню стола" data-wheel-isolation="true">
          <header>
            <span>СТОЛ МАСТЕРА</span>
            <strong>{campaignName}</strong>
            <small>{activeSceneName || 'Сцена не выбрана'}</small>
          </header>

          <div className="context-mode-section">
            <span>РЕЖИМ</span>
            <button type="button" className={!inCombat && tableMode === 'play' ? 'active' : ''} onClick={leavePrepare} role="menuitem">
              <TabletopIcon name="game" />
              <span><strong>Игра</strong><small>Ведение обычной сцены</small></span>
            </button>
            <button type="button" className={!inCombat && tableMode === 'prepare' ? 'active' : ''} onClick={enterPrepare} role="menuitem">
              <TabletopIcon name="prepare" />
              <span><strong>Подготовка</strong><small>Сцена, карта, сетка и контент</small></span>
            </button>
            {!inCombat && (
              <button type="button" className="combat-action" onClick={startCombat} role="menuitem">
                <TabletopIcon name="combat" />
                <span><strong>Начать бой</strong><small>Создать очередь и открыть раунд 1</small></span>
              </button>
            )}
            {inCombat && (
              <button type="button" className="active combat-action" onClick={() => toggleLegacyDrawer('combat')} role="menuitem">
                <TabletopIcon name="combat" />
                <span><strong>Бой · раунд {combatRound}</strong><small>Инициатива, текущий ход и завершение боя</small></span>
              </button>
            )}
          </div>

          {(tableMode === 'prepare' || inCombat) && (
            <div className="context-mode-section prepare-tools">
              <span>{inCombat ? 'ИНСТРУМЕНТЫ СТОЛА' : 'ПОДГОТОВКА'}</span>
              <button type="button" onClick={openSceneWorkspace} role="menuitem">
                <TabletopIcon name="scene" />
                <span><strong>Настройки сцены</strong><small>Карта, сетка, туман и токены</small></span>
              </button>
              {activeSceneName && (
                <button type="button" onClick={openMeasurement} role="menuitem">
                  <TabletopIcon name="ruler" />
                  <span><strong>Масштаб карты</strong><small>Настроить реальные расстояния</small></span>
                </button>
              )}
              <button type="button" onClick={openWorkshop} role="menuitem">
                <TabletopIcon name="workshop" />
                <span><strong>Мастерская</strong><small>Предметы, лут и таблицы</small></span>
              </button>
            </div>
          )}

          <div className="context-mode-section secondary">
            <span>ПАНЕЛИ</span>
            <button type="button" onClick={() => toggleLegacyDrawer('characters')} role="menuitem"><TabletopIcon name="characters" /><span><strong>Персонажи</strong><small>Герои и NPC</small></span></button>
            <button type="button" onClick={() => toggleLegacyDrawer('notes')} role="menuitem"><TabletopIcon name="notes" /><span><strong>Заметки</strong><small>Заметки мастера</small></span></button>
            <button type="button" onClick={() => toggleLegacyDrawer('library')} role="menuitem"><TabletopIcon name="library" /><span><strong>Библиотека</strong><small>Контент кампании</small></span></button>
            <button type="button" onClick={hideChrome} role="menuitem"><TabletopIcon name="eye" /><span><strong>Скрыть интерфейс</strong><small>Вернуть клавишей H</small></span></button>
          </div>
        </section>
      )}
    </>
  );
}
