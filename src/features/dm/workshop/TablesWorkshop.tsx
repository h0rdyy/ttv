'use client';

import { useMemo, useState } from 'react';
import type { RollTable } from '@/domain/types';
import { useRollTableStore } from '@/store/useRollTableStore';

export function TablesWorkshop() {
  const { tables, upsert, remove } = useRollTableStore();
  const [selectedId, setSelectedId] = useState(tables[0]?.id ?? '');
  const [history, setHistory] = useState<string[]>([]);
  const selected = useMemo(() => tables.find((table) => table.id === selectedId) ?? tables[0], [tables, selectedId]);

  const createTable = () => {
    const table: RollTable = {
      id: `table-${Date.now()}`,
      campaignId: 'royal-wastes',
      name: 'Новая таблица',
      rows: ['Первый результат', 'Второй результат'],
    };
    upsert(table);
    setSelectedId(table.id);
    setHistory([]);
  };

  if (!selected) {
    return <div className="placeholder-panel"><h2>Нет таблиц</h2><button className="button primary" onClick={createTable}>Создать таблицу</button></div>;
  }

  const updateSelected = (patch: Partial<RollTable>) => upsert({ ...selected, ...patch });

  const roll = () => {
    if (!selected.rows.length) return;
    const index = Math.floor(Math.random() * selected.rows.length);
    setHistory((value) => [`${index + 1} — ${selected.rows[index]}`, ...value].slice(0, 8));
  };

  const removeTable = () => {
    if (tables.length <= 1) return;
    const next = tables.find((table) => table.id !== selected.id);
    remove(selected.id);
    setSelectedId(next?.id ?? '');
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
            <p>Бросок d{Math.max(1, selected.rows.length)} · сохраняется автоматически</p>
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
