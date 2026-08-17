'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { TabletopIcon, type TabletopIconName } from './TabletopIcon';

type Mode = 'gm' | 'player';
type TableMode = 'play' | 'combat' | 'prepare';
type Surface = 'command' | null;

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
  keywords: string;
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
  const [query, setQuery] = useState('');
  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const tableMode: TableMode = combatActive ? 'combat' : preferredMode;

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
    setQuery('');
    closeLegacyDrawer();
    closeTransientWorkspace();
    closeDice();
    closeMeasurement();
    closeMapTools();
  };

  const toggleLegacyDrawer = (key: keyof typeof LEGACY_DRAWERS) => {
    closeTransientWorkspace();
    closeDice();
    closeMeasurement();
    closeMapTools();

    const label = LEGACY_DRAWERS[key];
    const button = queryButton(`.online-table-shell.gm-mode .gm-library-rail button[aria-label="${label}"]`);
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
  };

  const leavePrepare = () => {
    closeAllTransient();
    setPreferredMode('play');
  };

  const hideChrome = () => {
    closeAllTransient();
    onUiHiddenChange(true);
  };

  const actions = useMemo<Action[]>(() => {
    const common: Action[] = [
      {
        id: 'map-tools',
        icon: 'tools',
        label: 'Инструменты',
        hint: mode === 'gm' ? 'Линейка, пинг и рисование' : 'Линейка и пинг',
        keywords: 'линейка пинг рисовать рисунок карта ruler ping draw tools',
        run: openMapTools,
      },
      {
        id: 'dice',
        icon: 'dice',
        label: 'Кубы',
        hint: 'Открыть лоток бросков',
        keywords: 'кубы бросок roll dice',
        run: openDice,
      },
      {
        id: 'hide-ui',
        icon: 'eye',
        label: 'Скрыть UI',
        hint: 'Чистая карта · H вернёт интерфейс',
        keywords: 'скрыть ui карта immersion h',
        run: hideChrome,
      },
    ];

    if (mode === 'player') {
      return [
        ...(canOpenCharacter ? [{
          id: 'character',
          icon: 'sheet' as const,
          label: 'Персонаж',
          hint: 'Открыть полный лист',
          keywords: 'персонаж лист character sheet',
          run: () => { setSurface(null); onOpenCharacter(); },
        }] : []),
        ...common,
      ];
    }

    if (tableMode === 'prepare') {
      return [
        {
          id: 'scene',
          icon: 'scene',
          label: 'Сцена',
          hint: 'Карта, сетка, туман и токены',
          keywords: 'сцена карта сетка туман токены scene grid fog',
          run: openSceneWorkspace,
        },
        ...(activeSceneName ? [{
          id: 'measurement',
          icon: 'ruler' as const,
          label: 'Масштаб карты',
          hint: `Калибровка · ${activeSceneName}`,
          keywords: 'масштаб расстояние калибровка measurement',
          run: openMeasurement,
        }] : []),
        {
          id: 'workshop',
          icon: 'workshop',
          label: 'Мастерская',
          hint: 'Предметы, таблицы и контент',
          keywords: 'мастерская предметы таблицы контент workshop items',
          run: openWorkshop,
        },
        {
          id: 'characters',
          icon: 'characters',
          label: 'Персонажи',
          hint: 'Герои и NPC',
          keywords: 'персонажи герои npc actors',
          run: () => toggleLegacyDrawer('characters'),
        },
        {
          id: 'leave-prepare',
          icon: 'game',
          label: 'К игре',
          hint: 'Закрыть подготовку',
          keywords: 'игра выйти подготовка play',
          run: leavePrepare,
        },
        ...common,
      ];
    }

    const gmActions: Action[] = [
      {
        id: 'characters',
        icon: 'characters',
        label: 'Персонажи',
        hint: 'Герои и NPC',
        keywords: 'персонажи герои npc actors',
        run: () => toggleLegacyDrawer('characters'),
      },
      {
        id: 'notes',
        icon: 'notes',
        label: 'Заметки',
        hint: 'Заметки мастера',
        keywords: 'заметки notes journal',
        run: () => toggleLegacyDrawer('notes'),
      },
      {
        id: 'library',
        icon: 'library',
        label: 'Библиотека',
        hint: 'Контент кампании',
        keywords: 'библиотека контент library',
        run: () => toggleLegacyDrawer('library'),
      },
      {
        id: 'prepare',
        icon: 'prepare',
        label: 'Подготовка',
        hint: 'Сцена, сетка, туман и контент',
        keywords: 'подготовка сцена сетка туман prepare',
        run: enterPrepare,
      },
      ...common,
    ];

    if (tableMode === 'combat') {
      gmActions.unshift({
        id: 'combat',
        icon: 'combat',
        label: `Бой · ${combatRound}`,
        hint: 'Инициатива и текущий ход',
        keywords: 'бой раунд инициатива combat initiative',
        run: () => toggleLegacyDrawer('combat'),
      });
    }

    return gmActions;
  // Adapter callbacks intentionally use current DOM state rather than React state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSceneName, canOpenCharacter, combatRound, mode, onOpenCharacter, tableMode]);

  const filteredActions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru');
    if (!normalized) return actions;
    return actions.filter((action) => `${action.label} ${action.hint} ${action.keywords}`.toLocaleLowerCase('ru').includes(normalized));
  }, [actions, query]);

  const quickActionIds = mode === 'player'
    ? ['map-tools', 'dice']
    : tableMode === 'combat'
      ? ['combat', 'map-tools', 'dice']
      : tableMode === 'prepare'
        ? ['scene', 'map-tools', 'dice']
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
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
        if (isTypingTarget(event.target) && surface !== 'command') return;
        event.preventDefault();
        if (uiHidden) onUiHiddenChange(false);
        closeMapTools();
        setSurface((current) => current === 'command' ? null : 'command');
        setQuery('');
        window.requestAnimationFrame(() => commandInputRef.current?.focus());
        return;
      }

      if (event.key === 'Escape') {
        if (surface) {
          event.preventDefault();
          setSurface(null);
          setQuery('');
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

  const modeLabel = tableMode === 'combat'
    ? `Бой · ${combatRound}`
    : tableMode === 'prepare'
      ? 'Подготовка'
      : 'Игра';
  const modeIcon: TabletopIconName = tableMode === 'combat' ? 'combat' : tableMode === 'prepare' ? 'prepare' : 'game';

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
          className={`context-ui-mode-chip mode-${tableMode}`}
          onClick={tableMode === 'prepare' ? leavePrepare : undefined}
          aria-label={tableMode === 'prepare' ? 'Вернуться к игре' : `Режим: ${modeLabel}`}
          title={tableMode === 'prepare' ? 'Вернуться к игре' : modeLabel}
        >
          <TabletopIcon name={modeIcon} />
          <strong>{modeLabel}</strong>
        </button>

        {quickActions.map((action) => (
          <button key={action.id} type="button" onClick={action.run} title={action.hint} aria-label={action.label}>
            <TabletopIcon name={action.icon} />
            <strong>{action.label}</strong>
          </button>
        ))}

        <button
          type="button"
          className="context-ui-command-shortcut"
          onClick={() => {
            closeMapTools();
            setSurface('command');
            setQuery('');
            window.requestAnimationFrame(() => commandInputRef.current?.focus());
          }}
          title="Найти действие · Ctrl+K"
          aria-label="Найти действие"
        >
          <TabletopIcon name="search" />
          <strong>Поиск</strong>
          <kbd>Ctrl K</kbd>
        </button>
      </nav>

      {surface === 'command' && (
        <div className="context-command-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) setSurface(null); }}>
          <section className="context-command-palette" role="dialog" aria-modal="true" aria-label="Поиск действий" data-wheel-isolation="true">
            <header>
              <TabletopIcon name="search" />
              <input
                ref={commandInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Что сделать?"
                aria-label="Поиск действия"
              />
              <kbd>Esc</kbd>
            </header>
            <div className="context-command-results">
              {filteredActions.map((action) => (
                <button key={action.id} type="button" onClick={action.run}>
                  <TabletopIcon name={action.icon} />
                  <span><strong>{action.label}</strong><small>{action.hint}</small></span>
                </button>
              ))}
              {!filteredActions.length && <p>Действий не найдено.</p>}
            </div>
            <footer><span>{campaignName}</span><small>{activeSceneName || 'Сцена не выбрана'}</small></footer>
          </section>
        </div>
      )}
    </>
  );
}
