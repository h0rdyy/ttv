'use client';

import { FormEvent, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';
import { useExclusiveTabletopSurface } from './useExclusiveTabletopSurface';
import {
  buildDiceFormula,
  DICE_SIDES,
  type DiceRoll,
  type DiceVisibility,
  parseDiceFormula,
  parseDiceRoll,
} from './dice';
import { TabletopIcon } from './TabletopIcon';

type Props = {
  campaignId: string;
  mode: 'gm' | 'player';
  history: DiceRoll[];
  onRoll: (roll: DiceRoll) => void;
  onClearHistory: () => void;
  onMessage: (message: string) => void;
};

export function DiceTray({ campaignId, mode, history, onRoll, onClearHistory, onMessage }: Props) {
  const [open, setOpen] = useState(false);
  const [quickModifier, setQuickModifier] = useState(0);
  const [formulaText, setFormulaText] = useState('');
  const [formulaError, setFormulaError] = useState('');
  const [visibility, setVisibility] = useState<DiceVisibility>('public');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [rollingSides, setRollingSides] = useState<number[]>([]);
  const [lastRoll, setLastRoll] = useState<DiceRoll | null>(null);
  const rollingRef = useRef(false);
  useExclusiveTabletopSurface('dice-tray', open, () => setOpen(false));

  const shownSides = rolling ? rollingSides : lastRoll?.sides ?? [];
  const shownValues = rolling ? rollingSides.map(() => 0) : lastRoll?.values ?? [];

  const performRoll = async (sides: number[], modifier: number) => {
    if (!sides.length || rollingRef.current) return;
    const requestedSides = [...sides];
    const requestedModifier = modifier;
    const requestedVisibility = visibility;
    const startedAt = performance.now();

    rollingRef.current = true;
    setRolling(true);
    setRollingSides(requestedSides);
    setFormulaError('');

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('broadcast_dice_roll', {
        target_campaign: campaignId,
        roll_sides: requestedSides,
        roll_modifier: requestedModifier,
        roll_visibility: requestedVisibility,
      });
      const animationLeft = Math.max(0, 520 - (performance.now() - startedAt));
      if (animationLeft > 0) await new Promise((resolve) => window.setTimeout(resolve, animationLeft));

      if (error) {
        onMessage(friendlyError(error.message, 'Не удалось выполнить бросок. Проверьте соединение и попробуйте ещё раз.'));
        return;
      }
      const result = parseDiceRoll(data);
      if (!result) {
        onMessage('Сервер вернул некорректный результат броска. Попробуйте ещё раз.');
        return;
      }

      setLastRoll(result);
      onRoll(result);
    } catch (error) {
      onMessage(friendlyError(error, 'Не удалось выполнить бросок. Проверьте соединение и попробуйте ещё раз.'));
    } finally {
      rollingRef.current = false;
      setRolling(false);
      setRollingSides([]);
    }
  };

  const submitFormula = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseDiceFormula(formulaText);
    if (!parsed) {
      setFormulaError('Пример: 2d6+3. До 20 кубов, модификатор от −100 до +100.');
      return;
    }
    setFormulaText(buildDiceFormula(parsed.sides, parsed.modifier).replace(/\s/g, ''));
    void performRoll(parsed.sides, parsed.modifier);
  };

  const clearBoard = () => {
    if (rolling) return;
    setLastRoll(null);
    setFormulaText('');
    setFormulaError('');
  };

  return (
    <div className={`dice-tray-anchor ${open ? 'open' : ''}`}>
      {open && (
        <section className="dice-tray dice-tray-v2" data-wheel-isolation="true" aria-label="Лоток кубов">
          <header className="dice-tray-head">
            <div><span>КУБЫ</span><strong>Быстрый бросок</strong></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть"><TabletopIcon name="close" /></button>
          </header>

          <section className="dice-quick-section" aria-label="Быстрые кубы">
            <div className="dice-quick-grid">
              {DICE_SIDES.map((sides) => (
                <button
                  key={sides}
                  type="button"
                  className={sides === 20 ? 'primary-die' : ''}
                  disabled={rolling}
                  onClick={() => void performRoll([sides], quickModifier)}
                  aria-label={`Бросить d${sides}${quickModifier ? ` с модификатором ${quickModifier}` : ''}`}
                >
                  <DiceGlyph sides={sides} />
                  <strong>d{sides}</strong>
                </button>
              ))}
            </div>
            <div className="dice-quick-meta">
              <div className="dice-quick-modifier">
                <span>Модификатор быстрого броска</span>
                <div>
                  <button type="button" disabled={rolling || quickModifier <= -100} onClick={() => setQuickModifier((value) => Math.max(-100, value - 1))}>−</button>
                  <b>{quickModifier > 0 ? `+${quickModifier}` : quickModifier}</b>
                  <button type="button" disabled={rolling || quickModifier >= 100} onClick={() => setQuickModifier((value) => Math.min(100, value + 1))}>＋</button>
                </div>
              </div>
              <div className="dice-visibility compact">
                <span>Видимость</span>
                <div role="group" aria-label="Видимость броска">
                  <button type="button" aria-pressed={visibility === 'public'} onClick={() => setVisibility('public')}>Всем</button>
                  <button type="button" aria-pressed={visibility === 'gm'} onClick={() => setVisibility('gm')}>{mode === 'gm' ? 'Мастерам' : 'Мастеру'}</button>
                </div>
              </div>
            </div>
          </section>

          <form className="dice-formula" onSubmit={submitFormula}>
            <label htmlFor="dice-formula-input">Сложный бросок</label>
            <div>
              <input
                id="dice-formula-input"
                value={formulaText}
                disabled={rolling}
                onChange={(event) => { setFormulaText(event.target.value); setFormulaError(''); }}
                placeholder="2d6+3"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" disabled={rolling || !formulaText.trim()}><TabletopIcon name="dice" /> Бросить</button>
            </div>
            <small className={formulaError ? 'error' : ''}>{formulaError || 'Например: d20+5, 2d6+3, 3d8−2'}</small>
          </form>

          <div className="dice-tray-board">
            <div className={`dice-roll-surface ${rolling ? 'rolling' : 'settled'}`} aria-live="polite">
              <div className="dice-roll-felt">
                {!shownSides.length && (
                  <div className="dice-empty-felt">
                    <TabletopIcon name="dice" />
                    <strong>Поле броска</strong>
                    <small>Нажмите на куб выше — бросок произойдёт сразу</small>
                  </div>
                )}
                {shownSides.map((sides, index) => {
                  const value = shownValues[index];
                  return (
                    <div
                      key={`${rolling ? 'rolling' : lastRoll?.id}-${index}`}
                      className={`rolled-die rolled-d${sides} ${!rolling && value === sides ? 'max' : ''} ${!rolling && value === 1 ? 'one' : ''}`}
                      style={{ '--die-index': index } as React.CSSProperties}
                    >
                      <small>d{sides}</small>
                      <strong>{rolling ? '·' : value}</strong>
                    </div>
                  );
                })}
              </div>
              <div className="dice-roll-total">
                <span>{rolling ? 'Кубы летят…' : lastRoll ? lastRoll.formula : 'Результат броска'}</span>
                <b>{rolling || !lastRoll ? '—' : lastRoll.total}</b>
              </div>
            </div>
            <button type="button" className="dice-clear-board" disabled={rolling || (!lastRoll && !formulaText)} onClick={clearBoard}>
              <TabletopIcon name="clear" /> Очистить поле
            </button>
          </div>

          <div className="dice-history">
            <header>
              <button type="button" className="dice-history-toggle" onClick={() => setHistoryOpen((value) => !value)}>
                <span>{historyOpen ? '⌄' : '›'}</span> Последние броски {history.length > 0 && <em>{history.length}</em>}
              </button>
              <div>{history.length > 0 && <button type="button" onClick={onClearHistory}>Очистить историю</button>}</div>
            </header>
            {historyOpen && (history.length === 0 ? <p>Здесь появятся результаты бросков.</p> : history.map((item) => (
              <article key={item.id}>
                <div><strong>{item.displayName}</strong><small>{item.visibility === 'public' ? 'Всем' : 'Мастеру'} · {item.formula}</small></div>
                <span className="dice-values">{item.values.join(' · ')}{item.modifier ? ` ${item.modifier > 0 ? '+' : '−'} ${Math.abs(item.modifier)}` : ''}</span>
                <b>{item.total}</b>
              </article>
            )))}
          </div>
        </section>
      )}

      <button type="button" className="dice-tray-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <TabletopIcon name="dice" /><strong>Кубы</strong>
      </button>
    </div>
  );
}

function DiceGlyph({ sides }: { sides: number }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {sides === 4 ? <path d="M16 3 29 27H3z" /> :
        sides === 6 ? <rect x="5" y="5" width="22" height="22" rx="4" /> :
        sides === 8 ? <path d="M16 2 29 16 16 30 3 16z" /> :
        sides === 10 ? <path d="M16 2 29 13 24 28H8L3 13z" /> :
        sides === 12 ? <path d="m16 2 10 5 4 10-7 11H9L2 17 6 7z" /> :
        sides === 20 ? <><path d="M16 2 29 10l-5 17H8L3 10z" /><path d="m3 10 13 7 13-7M16 2v15M8 27l8-10 8 10" /></> :
        <circle cx="16" cy="16" r="13" />}
    </svg>
  );
}
