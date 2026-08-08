'use client';

import { useMemo, useState } from 'react';

const tables = [
  {
    id: 'road',
    name: 'Случайная встреча — дорога',
    die: 'd6',
    rows: ['Пустая дорога и следы повозки', 'Патруль из трёх стражников', 'Раненый путник просит помощи', 'Разбойники готовят засаду', 'Торговый караван', 'Необычный след ведёт в лес']
  },
  {
    id: 'tavern',
    name: 'Слухи в таверне',
    die: 'd6',
    rows: ['В старой шахте снова видели огни', 'Королевский сборщик налогов пропал', 'Купец ищет охрану', 'На мосту появился новый разбойничий знак', 'Священник покупает редкие травы', 'Ночью слышны колокола заброшенной часовни']
  },
  {
    id: 'loot',
    name: 'Мелкие находки',
    die: 'd6',
    rows: ['Сломанный серебряный медальон', 'Ключ без замка', '11 серебряных монет', 'Карта с пометкой углём', 'Пузырёк неизвестного масла', 'Письмо с сорванной печатью']
  }
];

export function TablesWorkshop() {
  const [selectedId, setSelectedId] = useState(tables[0].id);
  const [history, setHistory] = useState<string[]>([]);
  const selected = useMemo(() => tables.find((table) => table.id === selectedId) ?? tables[0], [selectedId]);

  const roll = () => {
    const index = Math.floor(Math.random() * selected.rows.length);
    setHistory((value) => [`${index + 1} — ${selected.rows[index]}`, ...value].slice(0, 8));
  };

  return (
    <div className="module-split tables-module">
      <section className="module-list">
        <div className="library-meta-row"><strong>Таблицы</strong><button className="button">＋ Создать</button></div>
        <div className="module-list-scroll">
          {tables.map((table) => (
            <button key={table.id} className={`module-row ${selected.id === table.id ? 'selected' : ''}`} onClick={() => setSelectedId(table.id)}>
              <span className="module-avatar">🎲</span>
              <span><strong>{table.name}</strong><small>{table.die} · {table.rows.length} результатов</small></span>
            </button>
          ))}
        </div>
      </section>

      <section className="module-detail">
        <div className="inspector-header">
          <div><h2>{selected.name}</h2><p>Бросок {selected.die}</p></div>
          <button className="button primary" onClick={roll}>🎲 Бросить</button>
        </div>
        <div className="roll-table">
          {selected.rows.map((row, index) => <div key={row}><b>{index + 1}</b><span>{row}</span></div>)}
        </div>
        <div className="builder-section compact-section">
          <h3>ИСТОРИЯ БРОСКОВ</h3>
          {history.length ? history.map((entry, index) => <div className="history-entry" key={`${entry}-${index}`}>{entry}</div>) : <p className="muted">Бросков пока не было.</p>}
        </div>
      </section>
    </div>
  );
}
