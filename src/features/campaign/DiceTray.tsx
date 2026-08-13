'use client';

import { useMemo, useState } from 'react';

const DICE = [4, 6, 8, 10, 12, 20, 100] as const;

type Roll = {
  id: number;
  formula: string;
  values: number[];
  sides: number[];
  modifier: number;
  total: number;
  visibility: 'public' | 'gm';
};

function secureDie(sides: number) {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return (value[0] % sides) + 1;
}

function buildFormula(sidesList: number[], modifier: number) {
  if (!sidesList.length) return 'Выберите кубы';
  const counts = new Map<number, number>();
  sidesList.forEach((sides) => counts.set(sides, (counts.get(sides) ?? 0) + 1));
  const dice = [...counts.entries()].map(([sides, count]) => `${count}d${sides}`).join(' + ');
  if (!modifier) return dice;
  return `${dice} ${modifier > 0 ? '+' : '−'} ${Math.abs(modifier)}`;
}

export function DiceTray({ displayName, mode }: { displayName: string; mode: 'gm' | 'player' }) {
  const [open, setOpen] = useState(false);
  const [pool, setPool] = useState<number[]>([]);
  const [modifier, setModifier] = useState(0);
  const [visibility, setVisibility] = useState<'public' | 'gm'>('public');
  const [history, setHistory] = useState<Roll[]>([]);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [rolling, setRolling] = useState(false);
  const [lastRoll, setLastRoll] = useState<Roll | null>(null);

  const formula = useMemo(() => {
    return buildFormula(pool, modifier);
  }, [modifier, pool]);

  const removeSettledDie = (index: number) => {
    if (rolling) return;
    setLastRoll((current) => {
      if (!current) return null;
      const values = current.values.filter((_, valueIndex) => valueIndex !== index);
      const sides = current.sides.filter((_, sideIndex) => sideIndex !== index);
      if (!values.length) return null;
      return {
        ...current,
        values,
        sides,
        formula: buildFormula(sides, current.modifier),
        total: values.reduce((sum, value) => sum + value, 0) + current.modifier,
      };
    });
  };

  const roll = () => {
    if (!pool.length || rolling) return;
    const values = pool.map(secureDie);
    const total = values.reduce((sum, value) => sum + value, 0) + modifier;
    const nextRoll = {
      id: Date.now(),
      formula,
      values,
      sides: [...pool],
      modifier,
      total,
      visibility,
    };
    setLastRoll(nextRoll);
    setRolling(true);
    window.setTimeout(() => {
      setRolling(false);
      setHistoryOpen(true);
      setHistory((current) => [nextRoll, ...current].slice(0, 5));
    }, 720);
  };

  return (
    <div className={`dice-tray-anchor ${open ? 'open' : ''}`}>
      {open && (
        <section className="dice-tray" aria-label="Лоток с кубами">
          <header className="dice-tray-head">
            <div><span>ЛОТОК КУБОВ</span><strong>{formula}</strong></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть">×</button>
          </header>

          <div className="dice-tray-board">
            <aside className="dice-picker" aria-label="Добавить куб">
              {DICE.map((sides) => {
                const count = pool.filter((value) => value === sides).length;
                return <button key={sides} type="button" className={`die-button die-d${sides}`} onClick={() => setPool((current) => [...current, sides])}><span>{sides === 100 ? '%' : sides}</span>{count > 0 && <em>{count}</em>}</button>;
              })}
            </aside>

            <div className={`dice-roll-surface ${rolling ? 'rolling' : 'settled'}`} aria-live="polite">
              <div className="dice-roll-felt">
                {!lastRoll && <div className="dice-empty-felt"><span>⚄</span><strong>Соберите бросок</strong><small>Выберите кубы слева</small></div>}
                {lastRoll?.values.map((value, index) => (
                  <div
                    key={`${lastRoll.id}-${index}`}
                    className={`rolled-die rolled-d${lastRoll.sides[index]} ${!rolling && value === lastRoll.sides[index] ? 'max' : ''} ${!rolling && value === 1 ? 'one' : ''}`}
                    style={{ '--die-index': index } as React.CSSProperties}
                    onClick={() => removeSettledDie(index)}
                    title={rolling ? undefined : 'Нажмите, чтобы убрать куб'}
                  >
                    <small>d{lastRoll.sides[index]}</small>
                    <strong>{rolling ? '·' : value}</strong>
                  </div>
                ))}
              </div>
              <div className="dice-roll-total"><span>{rolling ? 'Кубы летят…' : lastRoll ? lastRoll.formula : 'Результат броска'}</span><b>{rolling || !lastRoll ? '—' : lastRoll.total}</b></div>
            </div>
          </div>

          <div className="dice-pool">
            <span>Набор</span>
            <div>{pool.length ? pool.map((sides, index) => <button type="button" key={`${sides}-${index}`} onClick={() => setPool((current) => current.filter((_, itemIndex) => itemIndex !== index))}>d{sides}<i>×</i></button>) : <small>Пока пусто</small>}</div>
          </div>

          <div className="dice-controls">
            <div className="dice-modifier">
              <span>Модификатор</span>
              <div><button type="button" onClick={() => setModifier((value) => value - 1)}>−</button><b>{modifier > 0 ? `+${modifier}` : modifier}</b><button type="button" onClick={() => setModifier((value) => value + 1)}>+</button></div>
            </div>
            <label>
              Кто увидит
              <select value={visibility} onChange={(event) => setVisibility(event.target.value as 'public' | 'gm')}>
                <option value="public">Все игроки</option>
                <option value="gm">{mode === 'gm' ? 'Только я' : 'Только мастер'}</option>
              </select>
            </label>
          </div>

          <div className="dice-actions">
            <button type="button" className="button" onClick={() => { setPool([]); setModifier(0); }}>Очистить</button>
            <button type="button" className="button primary dice-roll-button" disabled={!pool.length || rolling} onClick={roll}>{rolling ? 'Бросаем…' : 'Бросить'}</button>
          </div>

          <div className="dice-history">
            <header>
              <button type="button" className="dice-history-toggle" onClick={() => setHistoryOpen((value) => !value)}><span>{historyOpen ? '⌄' : '›'}</span> Последние броски {history.length > 0 && <em>{history.length}</em>}</button>
              <div><small>Прототип · локально</small>{history.length > 0 && <button type="button" onClick={() => setHistory([])}>Очистить</button>}</div>
            </header>
            {historyOpen && (history.length === 0 ? <p>Здесь появятся результаты бросков.</p> : history.map((item) => (
              <article key={item.id}>
                <div><strong>{displayName}</strong><small>{item.visibility === 'public' ? 'Всем' : mode === 'gm' ? 'Скрытый' : 'Мастеру'} · {item.formula}</small></div>
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