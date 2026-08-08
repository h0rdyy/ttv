'use client';

import { useMemo, useState } from 'react';

interface RollTable {
  id: string;
  name: string;
  rows: string[];
}

const seedTables: RollTable[] = [
  {
    id: 'road',
    name: 'Случайная встреча — дорога',
    rows: ['Пустая дорога и следы повозки', 'Патруль из трёх стражников', 'Раненый путник просит помощи', 'Разбойники готовят засаду', 'Торговый караван', 'Необычный след ведёт в лес']
  },
  {
    id: 'tavern',
    name: 'Слухи в таверне',
    rows: ['В старой шахте снова видели огни', 'Королевский сборщик налогов пропал', 'Купец ищет охрану', 'На мосту появился новый разбойничий знак', 'Священник покупает редкие травы', 'Ночью слышны колокола заброшенной часовни']
  },
  {
    id: 'loot',
    name: 'Мелкие находки',
    rows: ['Сломанный серебряный медальон', 'Ключ без замка', '11 серебряных монет', 'Карта с пометкой углём', 'Пузырёк неизвестного масла', 'Письмо с сорванной печатью']
  }
];

export function TablesWorkshop() {
  const [tables, setTables] = useState(seedTables);
  const [selectedId, setSelectedId] = useState(seedTables[0].id);
  const [history, setHistory] = useState<string[]>([]);
  const selected = useMemo(() => tables.find((table) => table.id === selectedId) ?? tables[0], [tables, selectedId]);

  const createTable = () => {
    const table: RollTable = { id: `table-${Date.now()}`, name: 'Новая таблица', rows: ['Первый результат', 'Второй результат'] };
    setTables((value) => [table, ...value]);
    setSelectedId(table.id);
    setHistory([]);
  };

  const updateSelected = (patch: Partial<RollTable>) => setTables((value) => value.map((table) => table.id === selected.id ? { ...table, ...patch } : table));

  const roll = () => {
    if (!selected.rows.length) return;
    const index = Math.floor(Math.random() * selected.rows.length);
    setHistory((value) => [`${index + 1} — ${selected.rows[index]}`, ...value].slice(0, 8));
  };

  const removeTable = () => {
    if (tables.length <= 1) return;
    const next = tables.filter((table) => table.id !== selected.id);
    setTables(next);
    setSelectedId(next[0].id);
    setHistory([]);
  };

  return (
    <div className="module-split tables-module">
      <section className="module-list">
        <div className="library-meta-row"><strong>Таблицы</strong><button className="button" onClick={createTable}>＋ Создать</button></div>
        <div className="module-list-scroll">
          {tables.map((table) => (
            <button key={table.id} className={`module-row ${selected.id === table.id ? 'selected' : ''}`} onClick={() => { setSelectedId(table.id); setHistory([]); }}>
              <span className="module-avatar">🎲</span>
              <span><strong>{table.name}</strong><small>d{Math.max(1, table.rows.length)} · {table.rows.length} результатов</small></span>
            </button>
          ))}
        </div>
      </section>

      <section className="module-detail">
        <div className="inspector-header">
          <div>
            <input className="table-title-input" value={selected.name} onChange={(event) => updateSelected({ name: event.target.value })} />
            <p>Бросок d{Math.max(1, selected.rows.length)}</p>
          </div>
          <div className="module-actions compact-actions"><button className="button primary" onClick={roll} disabled={!selected.rows.length}>🎲 Бросить</button><button className="button danger" onClick={removeTable} disabled={tables.length <= 1}>Удалить</button></div>
        </div>

        <div className="roll-table editable-table">
          {selected.rows.map((row, index) => <div key={`${selected.id}-${index}`}><b>{index + 1}</b><input value={row} onChange={(event) => updateSelected({ rows: selected.rows.map((value, rowIndex) => rowIndex === index ? event.target.value : value) })} /><button className="close-button tiny" onClick={() => updateSelected({ rows: selected.rows.filter((_, rowIndex) => rowIndex !== index) })}>×</button></div>)}
        </div>
        <button className="button table-add-row" onClick={() => updateSelected({ rows: [...selected.rows, `Результат ${selected.rows.length + 1}`] })}>＋ Добавить результат</button>

        <div className="builder-section compact-section">
          <h3>ИСТОРИЯ БРОСКОВ</h3>
          {history.length ? history.map((entry, index) => <div className="history-entry" key={`${entry}-${index}`}>{entry}</div>) : <p className="muted">Бросков пока не было.</p>}
        </div>
      </section>
    </div>
  );
}
