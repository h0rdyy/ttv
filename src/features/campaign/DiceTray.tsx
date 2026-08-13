'use client';

import { useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';
import {
  buildDiceFormula,
  DICE_SIDES,
  type DiceRoll,
  type DiceVisibility,
  parseDiceRoll,
  removeDieFromRoll,
} from './dice';

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
  const [pool, setPool] = useState<number[]>([]);
  const [modifier, setModifier] = useState(0);
  const [visibility, setVisibility] = useState<DiceVisibility>('public');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [rollingSides, setRollingSides] = useState<number[]>([]);
  const [lastRoll, setLastRoll] = useState<DiceRoll | null>(null);
  const rollingRef = useRef(false);

  const formula = useMemo(() => buildDiceFormula(pool, modifier), [modifier, pool]);
  const shownSides = rolling ? rollingSides : lastRoll?.sides ?? [];
  const shownValues = rolling ? rollingSides.map(() => 0) : lastRoll?.values ?? [];

  const addDie = (sides: number) => {
    setPool((current) => {
      if (current.length >= 20) {
        onMessage('В один бросок можно добавить до 20 кубов.');
        return current;
      }
      return [...current, sides];
    });
  };

  const removeDie = (sides: number) => {
    setPool((current) => {
      const index = current.lastIndexOf(sides);
      if (index === -1) return current;
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const resetBuilder = () => {
    if (rolling) return;
    setPool([]);
    setModifier(0);
  };

  const removeSettledDie = (index: number) => {
    if (rolling) return;
    setLastRoll((current) => current ? removeDieFromRoll(current, index) : null);
  };

  const roll = async () => {
    if (!pool.length || rollingRef.current) return;
    const requestedSides = [...pool];
    const requestedModifier = modifier;
    const requestedVisibility = visibility;
    const startedAt = performance.now();

    rollingRef.current = true;
    setRolling(true);
    setRollingSides(requestedSides);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('broadcast_dice_roll', {
        target_campaign: campaignId,
        roll_sides: requestedSides,
        roll_modifier: requestedModifier,
        roll_visibility: requestedVisibility,
      });
      const animationLeft = Math.max(0, 720 - (performance.now() - startedAt));
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

  return (
    <div className={`dice-tray-anchor ${open ? 'open' : ''}`}>
      {open && (
        <section className="dice-tray" data-wheel-isolation="true" aria-label="Лоток с кубами">
          <header className="dice-tray-head">
            <div><span>ЛОТОК КУБОВ</span><strong>Соберите бросок</strong></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть">×</button>
          </header>

          <section className="dice-builder" aria-label="Набор кубов">
            <header>
              <div><span>Набор</span><strong>{pool.length ? formula : 'Выберите кубы'}</strong></div>
              {pool.length > 0 && <button type="button" onClick={resetBuilder} disabled={rolling}>Сбросить</button>}
            </header>
            <div className="dice-picker">
              {DICE_SIDES.map((sides) => {
                const count = pool.filter((value) => value === sides).length;
                return (
                  <div key={sides} className={`dice-choice die-d${sides} ${count > 0 ? 'selected' : ''}`}>
                    <strong>d{sides}</strong>
                    <div className="dice-quantity" aria-label={`Количество d${sides}`}>
                      <button type="button" disabled={count === 0 || rolling} onClick={() => removeDie(sides)} aria-label={`Убрать один d${sides}`}>−</button>
                      <span aria-live="polite">{count}</span>
                      <button type="button" disabled={pool.length >= 20 || rolling} onClick={() => addDie(sides)} aria-label={`Добавить один d${sides}`}>+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="dice-tray-board">
            <div className={`dice-roll-surface ${rolling ? 'rolling' : 'settled'}`} aria-live="polite">
              <div className="dice-roll-felt">
                {!shownSides.length && <div className="dice-empty-felt"><span>⚄</span><strong>Результат появится здесь</strong><small>Добавьте кубы выше и нажмите «Бросить»</small></div>}
                {shownSides.map((sides, index) => {
                  const value = shownValues[index];
                  return (
                    <div
                      key={`${rolling ? 'rolling' : lastRoll?.id}-${index}`}
                      className={`rolled-die rolled-d${sides} ${!rolling && value === sides ? 'max' : ''} ${!rolling && value === 1 ? 'one' : ''}`}
                      style={{ '--die-index': index } as React.CSSProperties}
                      onClick={() => removeSettledDie(index)}
                      title={rolling ? undefined : 'Нажмите, чтобы убрать куб'}
                    >
                      <small>d{sides}</small>
                      <strong>{rolling ? '·' : value}</strong>
                    </div>
                  );
                })}
              </div>
              <div className="dice-roll-total"><span>{rolling ? 'Кубы летят…' : lastRoll ? lastRoll.formula : 'Результат броска'}</span><b>{rolling || !lastRoll ? '—' : lastRoll.total}</b></div>
            </div>
          </div>

          <div className="dice-controls">
            <div className="dice-modifier">
              <span>Модификатор</span>
              <div><button type="button" disabled={modifier <= -100} onClick={() => setModifier((value) => Math.max(-100, value - 1))}>−</button><b>{modifier > 0 ? `+${modifier}` : modifier}</b><button type="button" disabled={modifier >= 100} onClick={() => setModifier((value) => Math.min(100, value + 1))}>+</button></div>
            </div>
            <div className="dice-visibility">
              <span>Кто увидит</span>
              <div role="group" aria-label="Видимость броска">
                <button type="button" aria-pressed={visibility === 'public'} onClick={() => setVisibility('public')}>Всем</button>
                <button type="button" aria-pressed={visibility === 'gm'} onClick={() => setVisibility('gm')}>{mode === 'gm' ? 'Мастерам' : 'Мастеру'}</button>
              </div>
            </div>
          </div>

          <div className="dice-actions">
            <button type="button" className="button primary dice-roll-button" disabled={!pool.length || rolling} onClick={() => void roll()}>
              <span>{rolling ? 'Кубы летят…' : 'Бросить'}</span>
              <small>{pool.length ? formula : 'Сначала выберите кубы'}</small>
            </button>
          </div>

          <div className="dice-history">
            <header>
              <button type="button" className="dice-history-toggle" onClick={() => setHistoryOpen((value) => !value)}><span>{historyOpen ? '⌄' : '›'}</span> Последние броски {history.length > 0 && <em>{history.length}</em>}</button>
              <div><small>Только эта сессия</small>{history.length > 0 && <button type="button" onClick={onClearHistory}>Очистить историю</button>}</div>
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
        <span>⚄</span><strong>Кубы</strong>{pool.length > 0 && <em>{pool.length}</em>}
      </button>
    </div>
  );
}
