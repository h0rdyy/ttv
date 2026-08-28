'use client';

import { type CSSProperties, FormEvent, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';
import { useExclusiveTabletopSurface } from './useExclusiveTabletopSurface';
import {
  buildDiceFormula,
  changeDicePool,
  clampDiceModifier,
  DICE_SIDES,
  dicePoolToSides,
  diceSidesToPool,
  MAX_DICE_COUNT,
  MAX_DICE_MODIFIER,
  MIN_DICE_MODIFIER,
  type DicePool,
  type DiceRoll,
  type DiceSide,
  type DiceVisibility,
  parseDiceFormula,
  parseDiceRoll,
} from './dice';
import { TabletopIcon } from './TabletopIcon';

type Props = {
  campaignId: string;
  mode: 'gm' | 'player';
  localOnly?: boolean;
  displayName?: string;
  history: DiceRoll[];
  onRoll: (roll: DiceRoll) => void;
  onClearHistory: () => void;
  onMessage: (message: string) => void;
};

export function DiceTray({ campaignId, mode, localOnly = false, displayName = 'Игрок', history, onRoll, onClearHistory, onMessage }: Props) {
  const [open, setOpen] = useState(false);
  const [pool, setPool] = useState<DicePool>(() => diceSidesToPool([20]));
  const [modifier, setModifier] = useState(0);
  const [formulaText, setFormulaText] = useState('');
  const [formulaError, setFormulaError] = useState('');
  const [visibility, setVisibility] = useState<DiceVisibility>('public');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [rollingSides, setRollingSides] = useState<number[]>([]);
  const [lastRoll, setLastRoll] = useState<DiceRoll | null>(null);
  const rollingRef = useRef(false);
  useExclusiveTabletopSurface('dice-tray', open, () => setOpen(false));

  const selectedSides = dicePoolToSides(pool);
  const selectedFormula = buildDiceFormula(selectedSides, modifier);
  const shownSides = rolling ? rollingSides : lastRoll?.sides ?? [];
  const shownValues = rolling ? rollingSides.map(() => 0) : lastRoll?.values ?? [];

  const performRoll = async (sides: number[], rollModifier: number) => {
    if (!sides.length || rollingRef.current) return;
    const requestedSides = [...sides];
    const requestedModifier = rollModifier;
    const requestedVisibility = visibility;
    const startedAt = performance.now();

    rollingRef.current = true;
    setRolling(true);
    setRollingSides(requestedSides);
    setFormulaError('');

    try {
      if (localOnly) {
        await new Promise((resolve) => window.setTimeout(resolve, 520));
        const values = requestedSides.map((sides) => Math.floor(Math.random() * sides) + 1);
        const result: DiceRoll = {
          id: crypto.randomUUID(),
          senderUserId: '00000000-0000-4000-8000-000000000000',
          displayName,
          sides: requestedSides,
          values,
          modifier: requestedModifier,
          total: values.reduce((sum, value) => sum + value, 0) + requestedModifier,
          visibility: requestedVisibility,
          createdAt: new Date().toISOString(),
          formula: buildDiceFormula(requestedSides, requestedModifier),
        };
        setLastRoll(result);
        onRoll(result);
        return;
      }

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

  const changeDieCount = (sides: DiceSide, delta: number) => {
    setPool((current) => changeDicePool(current, sides, delta));
    setFormulaError('');
  };

  const submitFormula = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseDiceFormula(formulaText);
    if (!parsed) {
      setFormulaError('Пример: 2d6+3. До 20 кубов, модификатор от −100 до +100.');
      return;
    }
    setPool(diceSidesToPool(parsed.sides));
    setModifier(parsed.modifier);
    setFormulaText('');
    setFormulaError('');
  };

  const resetBuilder = () => {
    if (rolling) return;
    setPool(diceSidesToPool([20]));
    setModifier(0);
    setFormulaText('');
    setFormulaError('');
  };

  const clearBoard = () => {
    if (rolling) return;
    setLastRoll(null);
  };

  return (
    <div className={`dice-tray-anchor ${open ? 'open' : ''}`}>
      {open && (
        <section className="dice-tray dice-tray-v2" data-wheel-isolation="true" aria-label="Лоток кубов">
          <header className="dice-tray-head">
            <div><span>D&D КУБЫ</span><strong>Лоток броска</strong></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть"><TabletopIcon name="close" /></button>
          </header>

          <section className="dice-builder" aria-label="Настройка броска">
            <div className="dice-builder-title">
              <div>
                <span>НАБОР КУБОВ</span>
                <small>Нажимайте +, чтобы собрать бросок</small>
              </div>
              <b>{selectedSides.length}/{MAX_DICE_COUNT}</b>
            </div>

            <div className="dice-pool-grid">
              {DICE_SIDES.map((sides) => {
                const count = pool[sides] ?? 0;
                const cannotAdd = rolling || selectedSides.length >= MAX_DICE_COUNT;
                return (
                  <div key={sides} className={`dice-pool-card ${count > 0 ? 'selected' : ''} ${sides === 20 ? 'primary-die' : ''}`}>
                    <button
                      type="button"
                      className="dice-pool-pick"
                      disabled={cannotAdd}
                      onClick={() => changeDieCount(sides, 1)}
                      aria-label={`Добавить d${sides}`}
                    >
                      <DiceGlyph sides={sides} />
                      <strong>d{sides}</strong>
                    </button>
                    <div className="dice-count-stepper">
                      <button type="button" disabled={rolling || count === 0} onClick={() => changeDieCount(sides, -1)} aria-label={`Убрать d${sides}`}>−</button>
                      <span aria-label={`Выбрано d${sides}: ${count}`}>{count}</span>
                      <button type="button" disabled={cannotAdd} onClick={() => changeDieCount(sides, 1)} aria-label={`Добавить d${sides}`}>+</button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="dice-builder-meta">
              <label className="dice-modifier-control">
                <span>МОДИФИКАТОР</span>
                <div>
                  <button type="button" disabled={rolling || modifier <= MIN_DICE_MODIFIER} onClick={() => setModifier((value) => clampDiceModifier(value - 1))}>−</button>
                  <input
                    type="number"
                    min={MIN_DICE_MODIFIER}
                    max={MAX_DICE_MODIFIER}
                    value={modifier}
                    disabled={rolling}
                    onChange={(event) => setModifier(clampDiceModifier(event.target.valueAsNumber))}
                    aria-label="Модификатор броска"
                  />
                  <button type="button" disabled={rolling || modifier >= MAX_DICE_MODIFIER} onClick={() => setModifier((value) => clampDiceModifier(value + 1))}>+</button>
                </div>
              </label>
              <div className="dice-visibility compact">
                <span>КТО УВИДИТ</span>
                <div role="group" aria-label="Видимость броска">
                  <button type="button" aria-pressed={visibility === 'public'} onClick={() => setVisibility('public')}>Все</button>
                  <button type="button" aria-pressed={visibility === 'gm'} onClick={() => setVisibility('gm')}>{mode === 'gm' ? 'Только мастера' : 'Только мастер'}</button>
                </div>
              </div>
            </div>

            <div className="dice-roll-summary">
              <div>
                <span>ГОТОВО К БРОСКУ</span>
                <strong>{selectedFormula}</strong>
              </div>
              <button
                type="button"
                className="dice-roll-button"
                disabled={rolling || selectedSides.length === 0}
                onClick={() => void performRoll(selectedSides, modifier)}
              >
                <TabletopIcon name="dice" /> {rolling ? 'Бросаем…' : 'Бросить'}
              </button>
            </div>

            <form className="dice-formula" onSubmit={submitFormula}>
              <label htmlFor="dice-formula-input">Или введите формулу вручную</label>
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
                <button type="submit" disabled={rolling || !formulaText.trim()}>Применить</button>
              </div>
              <small className={formulaError ? 'error' : ''}>{formulaError || 'Поддерживаются d4, d6, d8, d10, d12, d20 и d100'}</small>
            </form>

            <button type="button" className="dice-reset-builder" disabled={rolling || (selectedSides.length === 1 && selectedSides[0] === 20 && modifier === 0)} onClick={resetBuilder}>
              Сбросить к 1d20
            </button>
          </section>

          <div className="dice-tray-board">
            <div className={`dice-roll-surface ${rolling ? 'rolling' : 'settled'}`} aria-live="polite">
              <div className="dice-roll-felt">
                {!shownSides.length && (
                  <div className="dice-empty-felt">
                    <TabletopIcon name="dice" />
                    <strong>Поле броска</strong>
                    <small>Соберите набор выше и нажмите «Бросить»</small>
                  </div>
                )}
                {shownSides.map((sides, index) => {
                  const value = shownValues[index];
                  return (
                    <div
                      key={`${rolling ? 'rolling' : lastRoll?.id}-${index}`}
                      className={`rolled-die rolled-d${sides} ${!rolling && value === sides ? 'max' : ''} ${!rolling && value === 1 ? 'one' : ''}`}
                      style={{ '--die-index': index } as CSSProperties}
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
            <button type="button" className="dice-clear-board" disabled={rolling || !lastRoll} onClick={clearBoard}>
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

export function LocalDiceTray({ mode, displayName }: { mode: 'gm' | 'player'; displayName: string }) {
  const [history, setHistory] = useState<DiceRoll[]>([]);

  return (
    <DiceTray
      campaignId="demo"
      mode={mode}
      localOnly
      displayName={displayName}
      history={history}
      onRoll={(roll) => setHistory((current) => [roll, ...current].slice(0, 12))}
      onClearHistory={() => setHistory([])}
      onMessage={() => undefined}
    />
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
