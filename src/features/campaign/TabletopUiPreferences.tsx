'use client';

import { useEffect, useState } from 'react';

export type TabletopUiDensity = 'normal' | 'compact';

export type TabletopUiPreferences = {
  dice: boolean;
  movement: boolean;
  sceneInfo: boolean;
  presence: boolean;
  density: TabletopUiDensity;
};

const DEFAULT_PREFERENCES: TabletopUiPreferences = {
  dice: true,
  movement: true,
  sceneInfo: true,
  presence: true,
  density: 'normal',
};

export function useTabletopUiPreferences(userId: string) {
  const [preferences, setPreferences] = useState<TabletopUiPreferences>(DEFAULT_PREFERENCES);
  const storageKey = `ttv:ui-profile:v1:${userId}`;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<TabletopUiPreferences>;
      setPreferences({
        dice: typeof saved.dice === 'boolean' ? saved.dice : DEFAULT_PREFERENCES.dice,
        movement: typeof saved.movement === 'boolean' ? saved.movement : DEFAULT_PREFERENCES.movement,
        sceneInfo: typeof saved.sceneInfo === 'boolean' ? saved.sceneInfo : DEFAULT_PREFERENCES.sceneInfo,
        presence: typeof saved.presence === 'boolean' ? saved.presence : DEFAULT_PREFERENCES.presence,
        density: saved.density === 'compact' ? 'compact' : 'normal',
      });
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  const updatePreferences = (patch: Partial<TabletopUiPreferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...patch };
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };

  const resetPreferences = () => {
    window.localStorage.removeItem(storageKey);
    setPreferences(DEFAULT_PREFERENCES);
  };

  return { preferences, updatePreferences, resetPreferences };
}

export function TabletopUiPreferencesPanel({
  preferences,
  onChange,
  onReset,
}: {
  preferences: TabletopUiPreferences;
  onChange: (patch: Partial<TabletopUiPreferences>) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  return (
    <div className="tabletop-ui-preferences" data-wheel-isolation="true">
      <button
        type="button"
        className={`button tabletop-ui-preferences-trigger ${open ? 'active' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        ⚙ Интерфейс
      </button>

      {open && (
        <section className="tabletop-ui-preferences-panel" role="dialog" aria-label="Настройка интерфейса">
          <header>
            <div><span>ПРОФИЛЬ UI</span><strong>Интерфейс</strong></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть">×</button>
          </header>

          <p>Настройки сохраняются только для этого аккаунта в текущем браузере.</p>

          <div className="tabletop-ui-preferences-group">
            <strong>Показывать на столе</strong>
            <PreferenceToggle label="Кубы" checked={preferences.dice} onChange={(value) => onChange({ dice: value })} />
            <PreferenceToggle label="Движение" checked={preferences.movement} onChange={(value) => onChange({ movement: value })} />
            <PreferenceToggle label="Название сцены" checked={preferences.sceneInfo} onChange={(value) => onChange({ sceneInfo: value })} />
            <PreferenceToggle label="Игроки онлайн" checked={preferences.presence} onChange={(value) => onChange({ presence: value })} />
          </div>

          <div className="tabletop-ui-preferences-group">
            <strong>Плотность</strong>
            <div className="tabletop-ui-density" role="group" aria-label="Плотность интерфейса">
              <button type="button" className={preferences.density === 'normal' ? 'active' : ''} onClick={() => onChange({ density: 'normal' })}>Обычная</button>
              <button type="button" className={preferences.density === 'compact' ? 'active' : ''} onClick={() => onChange({ density: 'compact' })}>Компактная</button>
            </div>
          </div>

          <footer>
            <button type="button" className="button" onClick={onReset}>Сбросить</button>
            <button type="button" className="button primary" onClick={() => setOpen(false)}>Готово</button>
          </footer>
        </section>
      )}
    </div>
  );
}

function PreferenceToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="tabletop-ui-toggle">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
