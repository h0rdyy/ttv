'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Mode = 'gm' | 'player';
type TableMode = 'play' | 'combat' | 'prepare';
type Surface = 'tools' | 'command' | null;

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
  icon: string;
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

  const closeUiPreferences = () => {
    if (document.querySelector('.tabletop-ui-preferences-panel')) {
      queryButton('.tabletop-ui-preferences-trigger')?.click();
    }
  };

  const closeMeasurement = () => {
    if (document.querySelector('.scene-measurement-popover')) {
      queryButton('.scene-measurement-trigger')?.click();
    }
  };

  const closeAllTransient = () => {
    setSurface(null);
    setQuery('');
    closeLegacyDrawer();
    closeTransientWorkspace();
    closeDice();
    closeUiPreferences();
    closeMeasurement();
  };

  const toggleLegacyDrawer = (key: keyof typeof LEGACY_DRAWERS) => {
    closeTransientWorkspace();
    closeDice();
    closeUiPreferences();
    closeMeasurement();

    const label = LEGACY_DRAWERS[key];
    const button = queryButton(`.online-table-shell.gm-mode .gm-library-rail button[aria-label="${label}"]`);
    const library = document.querySelector('.online-table-shell.gm-mode .gm-library');
    if (!button || !library) return;

    button.click();
    setSurface(null);
  };

  const openSceneWorkspace = () => {
    closeLegacyDrawer();
    closeDice();
    closeUiPreferences();
    closeMeasurement();
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
    closeUiPreferences();
    closeMeasurement();
    queryButton('.online-table-shell.gm-mode .online-workshop-trigger')?.click();
    setSurface(null);
  };

  const openDice = () => {
    closeLegacyDrawer();
    closeTransientWorkspace();
    closeUiPreferences();
    closeMeasurement();
    queryButton('.online-table-shell .dice-tray-toggle')?.click();
    setSurface(null);
  };

  const openUiPreferences = () => {
    closeLegacyDrawer();
    closeTransientWorkspace();
    closeDice();
    closeMeasurement();
    queryButton('.tabletop-ui-preferences-trigger')?.click();
    setSurface(null);
  };

  const openMeasurement = () => {
    closeLegacyDrawer();
    closeTransientWorkspace();
    closeDice();
    closeUiPreferences();
    queryButton('.scene-measurement-trigger')?.click();
    setSurface(null);
  };

  const enterPrepare = () => {
    closeAllTransient();
    setPreferredMode('prepare');
    window.requestAnimationFrame(() => setSurface('tools'));
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
        id: 'dice',
        icon: '⚄',
        label: 'Кубы',
        hint: 'Открыть лоток бросков',
        keywords: 'кубы бросок roll dice',
        run: openDice,
      },
      {
        id: 'interface',
        icon: '⚙',
        label: 'Интерфейс',
        hint: 'Видимость и плотность UI',
        keywords: 'интерфейс настройки ui',
        run: openUiPreferences,
      },
      {
        id: 'hide-ui',
        icon: '◌',
        label: 'Скрыть весь UI',
        hint: 'Чистая карта · H вернёт интерфейс',
        keywords: 'скрыть ui карта immersion h',
        run: hideChrome,
      },
    ];

    if (mode === 'player') {
      return [
        ...(canOpenCharacter ? [{
          id: 'character',
          icon: '◇',
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
          icon: '🗺',
          label: 'Сцена',
          hint: 'Карта, сетка, туман и токены',
          keywords: 'сцена карта сетка туман токены scene grid fog',
          run: openSceneWorkspace,
        },
        ...(activeSceneName ? [{
          id: 'measurement',
          icon: '📏',
          label: 'Масштаб карты',
          hint: `Калибровка · ${activeSceneName}`,
          keywords: 'масштаб расстояние калибровка measurement',
          run: openMeasurement,
        }] : []),
        {
          id: 'workshop',
          icon: '⚒',
          label: 'Мастерская',
          hint: 'Предметы, таблицы и контент',
          keywords: 'мастерская предметы таблицы контент workshop items',
          run: openWorkshop,
        },
        {
          id: 'characters',
          icon: '♟',
          label: 'Персонажи',
          hint: 'Герои и NPC',
          keywords: 'персонажи герои npc actors',
          run: () => toggleLegacyDrawer('characters'),
        },
        {
          id: 'leave-prepare',
          icon: '▶',
          label: 'К игре',
          hint: 'Закрыть инструменты подготовки',
          keywords: 'игра выйти подготовка play',
          run: leavePrepare,
        },
        ...common,
      ];
    }

    const playActions: Action[] = [
      {
        id: 'characters',
        icon: '♟',
        label: 'Персонажи',
        hint: 'Герои и NPC',
        keywords: 'персонажи герои npc actors',
        run: () => toggleLegacyDrawer('characters'),
      },
      {
        id: 'notes',
        icon: '✎',
        label: 'Заметки',
        hint: 'Заметки мастера',
        keywords: 'заметки notes journal',
        run: () => toggleLegacyDrawer('notes'),
      },
      {
        id: 'library',
        icon: '◆',
        label: 'Библиотека',
        hint: 'Контент кампании',
        keywords: 'библиотека контент library',
        run: () => toggleLegacyDrawer('library'),
      },
    ];

    if (tableMode === 'combat') {
      playActions.unshift({
        id: 'combat',
        icon: '⚔',
        label: `Бой · ${combatRound}`,
        hint: 'Инициатива и текущий ход',
        keywords: 'бой раунд инициатива combat initiative',
        run: () => toggleLegacyDrawer('combat'),
      });
    }

    playActions.push({
      id: 'prepare',
      icon: '🛠',
      label: 'Подготовка',
      hint: 'Сцена, сетка, туман и контент',
      keywords: 'подготовка сцена сетка туман prepare',
      run: enterPrepare,
    });

    return [...playActions, ...common];
  // Adapter callbacks intentionally use current DOM state rather than React state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSceneName, canOpenCharacter, combatRound, mode, onOpenCharacter, tableMode]);

  const filteredActions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru');
    if (!normalized) return actions;
    return actions.filter((action) => `${action.label} ${action.hint} ${action.keywords}`.toLocaleLowerCase('ru').includes(normalized));
  }, [actions, query]);

  const quickActions = useMemo(() => {
    const ids = mode === 'player'
      ? ['character', 'dice']
      : tableMode === 'combat'
        ? ['combat', 'characters', 'dice']
        : tableMode === 'prepare'
          ? ['scene', 'workshop', 'leave-prepare']
          : ['characters', 'dice', 'prepare'];
    return ids.map((id) => actions.find((action) => action.id === id)).filter((action): action is Action => Boolean(action));
  }, [actions, mode, tableMode]);

  useEffect(() => {
    if (mode !== 'gm') return;
    const frame = window.requestAnimationFrame(() => closeLegacyDrawer());
    return () => window.cancelAnimationFrame(frame);
  }, [mode]);

  useEffect(() => {
    if (!focusActive) return;
    setSurface(null);
  }, [focusActive]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
        if (isTypingTarget(event.target) && surface !== 'command') return;
        event.preventDefault();
        if (uiHidden) onUiHiddenChange(false);
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
  const modeIcon = tableMode === 'combat' ? '⚔' : tableMode === 'prepare' ? '🛠' : '⌘';

  if (uiHidden) {
    return (
      <button
        type="button"
        className="context-ui-reveal"
        onClick={() => onUiHiddenChange(false)}
        aria-label="Показать интерфейс"
        title="Показать интерфейс · H"
      >
        ◌
      </button>
    );
  }

  return (
    <>
      <div className={`context-ui-launcher ${mode}`} data-wheel-isolation="true">
        <button
          type="button"
          className={`context-ui-main-button mode-${tableMode}`}
          onClick={() => setSurface((current) => current === 'tools' ? null : 'tools')}
          aria-expanded={surface === 'tools'}
          aria-label="Открыть инструменты"
          title="Все инструменты · Ctrl+K для поиска"
        >
          <span>{modeIcon}</span>
          <small>{modeLabel}</small>
        </button>
      </div>

      {surface === null && quickActions.length > 0 && (
        <nav className={`context-ui-quick-actions ${mode}`} aria-label="Быстрые действия" data-wheel-isolation="true">
          {quickActions.map((action) => (
            <button key={action.id} type="button" onClick={action.run} title={action.hint} aria-label={action.label}>
              <span aria-hidden="true">{action.icon}</span>
              <strong>{action.label}</strong>
            </button>
          ))}
          <button
            type="button"
            className="context-ui-command-shortcut"
            onClick={() => { setSurface('command'); setQuery(''); window.requestAnimationFrame(() => commandInputRef.current?.focus()); }}
            title="Найти любое действие"
            aria-label="Найти действие"
          >
            <span aria-hidden="true">⌕</span>
            <strong>Поиск</strong>
            <kbd>Ctrl K</kbd>
          </button>
        </nav>
      )}

      {surface === 'tools' && (
        <section className={`context-tools-palette ${mode}`} aria-label="Контекстные инструменты" data-wheel-isolation="true">
          <header>
            <div>
              <small>{mode === 'gm' ? 'МАСТЕР' : 'ИГРОК'}</small>
              <strong>{modeLabel}</strong>
            </div>
            <button type="button" onClick={() => setSurface(null)} aria-label="Закрыть">×</button>
          </header>
          <div className="context-tools-actions">
            {actions.slice(0, mode === 'gm' ? 7 : 5).map((action) => (
              <button key={action.id} type="button" onClick={action.run}>
                <span>{action.icon}</span>
                <span><strong>{action.label}</strong><small>{action.hint}</small></span>
              </button>
            ))}
          </div>
          <button type="button" className="context-tools-search" onClick={() => { setSurface('command'); setQuery(''); window.requestAnimationFrame(() => commandInputRef.current?.focus()); }}>
            <span>⌕ Найти действие</span><kbd>Ctrl K</kbd>
          </button>
        </section>
      )}

      {surface === 'command' && (
        <div className="context-command-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) setSurface(null); }}>
          <section className="context-command-palette" role="dialog" aria-modal="true" aria-label="Палитра действий" data-wheel-isolation="true">
            <header>
              <span>⌕</span>
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
                  <span>{action.icon}</span>
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
