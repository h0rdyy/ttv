'use client';

import { useEffect, useState } from 'react';

type Mode = 'gm' | 'player';
type GmSurface = 'scene' | 'characters' | 'combat' | 'library' | 'notes' | null;

type Props = {
  mode: Mode;
  campaignName: string;
  activeSceneName: string | null;
  combatActive: boolean;
  combatRound: number;
  focusActive: boolean;
};

const LEGACY_DRAWERS: Record<Exclude<GmSurface, 'scene' | null>, string> = {
  characters: 'ПЕРСОНАЖИ',
  combat: 'СЕССИЯ',
  library: 'КОНТЕНТ',
  notes: 'ЗАМЕТКИ',
};

function queryButton(selector: string) {
  return document.querySelector<HTMLButtonElement>(selector);
}

function buttonWithText(selector: string, text: string) {
  return [...document.querySelectorAll<HTMLButtonElement>(selector)]
    .find((button) => button.textContent?.includes(text)) ?? null;
}

export function TabletopShellV2({ mode, campaignName, activeSceneName, combatActive, combatRound, focusActive }: Props) {
  const [surface, setSurface] = useState<GmSurface>(null);

  useEffect(() => {
    if (mode !== 'gm') return;
    // v2 starts map-first. The old sidebar owns the business logic for now, but
    // its drawer should not consume the viewport until the new rail asks for it.
    const frame = window.requestAnimationFrame(() => {
      const library = document.querySelector('.online-table-shell.gm-mode .gm-library.expanded');
      if (library) queryButton('.online-table-shell.gm-mode .gm-library-collapse')?.click();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mode]);

  useEffect(() => {
    if (!focusActive) return;
    setSurface(null);
  }, [focusActive]);

  const closeLegacyDrawer = () => {
    const library = document.querySelector('.online-table-shell.gm-mode .gm-library.expanded');
    if (library) queryButton('.online-table-shell.gm-mode .gm-library-collapse')?.click();
  };

  const closeTransientWorkspace = () => {
    queryButton('.online-table-shell.gm-mode .scene-tools-panel .close-button')?.click();
    queryButton('.online-table-shell.gm-mode .online-workshop-panel .close-button')?.click();
  };

  const toggleLegacyDrawer = (next: Exclude<GmSurface, 'scene' | null>) => {
    closeTransientWorkspace();
    const label = LEGACY_DRAWERS[next];
    const button = queryButton(`.online-table-shell.gm-mode .gm-library-rail button[aria-label="${label}"]`);
    const library = document.querySelector('.online-table-shell.gm-mode .gm-library');
    if (!button || !library) return;

    const expanded = library.classList.contains('expanded');
    const active = button.classList.contains('active');
    if (expanded && active) {
      button.click();
      setSurface(null);
      return;
    }
    button.click();
    setSurface(next);
  };

  const openSceneWorkspace = () => {
    closeLegacyDrawer();
    queryButton('.online-table-shell.gm-mode .online-workshop-panel .close-button')?.click();
    const trigger = buttonWithText('.online-table-shell.gm-mode .online-menu-trigger', 'Сцена');
    if (!trigger) return;
    trigger.click();
    window.requestAnimationFrame(() => {
      const settings = buttonWithText('.online-table-shell.gm-mode .scene-menu button', 'Настройки сцены');
      settings?.click();
      if (settings) setSurface('scene');
    });
  };

  const openDice = () => queryButton('.online-table-shell .dice-tray-toggle')?.click();
  const openUiPreferences = () => queryButton('.tabletop-ui-preferences-trigger')?.click();
  const openMeasurement = () => queryButton('.scene-measurement-trigger')?.click();

  if (focusActive) return null;

  return (
    <>
      {mode === 'gm' ? (
        <nav className="tabletop-shell-v2-rail" aria-label="Инструменты мастера" data-wheel-isolation="true">
          <div className="tabletop-shell-v2-mark" title={campaignName}>✦</div>
          <ShellButton icon="🗺" label="Сцена" active={surface === 'scene'} onClick={openSceneWorkspace} />
          <ShellButton icon="♟" label="Персонажи" active={surface === 'characters'} onClick={() => toggleLegacyDrawer('characters')} />
          <ShellButton icon="⚔" label={combatActive ? `Бой · раунд ${combatRound}` : 'Бой'} active={surface === 'combat'} badge={combatActive ? String(combatRound) : undefined} onClick={() => toggleLegacyDrawer('combat')} />
          <ShellButton icon="◆" label="Библиотека" active={surface === 'library'} onClick={() => toggleLegacyDrawer('library')} />
          <ShellButton icon="✎" label="Заметки" active={surface === 'notes'} onClick={() => toggleLegacyDrawer('notes')} />
          <ShellButton icon="⚄" label="Кубы" onClick={openDice} />
          <span className="tabletop-shell-v2-spacer" />
          {surface === 'scene' && activeSceneName && <ShellButton icon="📏" label={`Масштаб · ${activeSceneName}`} onClick={openMeasurement} compact />}
          <ShellButton icon="⚙" label="Интерфейс" onClick={openUiPreferences} compact />
        </nav>
      ) : (
        <div className="tabletop-shell-v2-player-actions" data-wheel-isolation="true">
          <button type="button" className="tabletop-shell-v2-player-dice" onClick={openDice} aria-label="Открыть кубы" title="Кубы">⚄</button>
          <button type="button" className="tabletop-shell-v2-player-settings" onClick={openUiPreferences} aria-label="Настроить интерфейс" title="Интерфейс">⚙</button>
        </div>
      )}
    </>
  );
}

function ShellButton({
  icon,
  label,
  active = false,
  badge,
  compact = false,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
  badge?: string;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${active ? 'active ' : ''}${compact ? 'compact' : ''}`.trim()}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">{icon}</span>
      {badge && <em>{badge}</em>}
    </button>
  );
}
