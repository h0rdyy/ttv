'use client';

import { useMemo, useState } from 'react';
import { actors } from '@/data/demo';

export function NpcWorkshop() {
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState([
    { id: 'merchant-brin', name: 'Торговец Брин', role: 'Торговец', faction: 'Город', hp: 12, armor: 10 },
    { id: 'king-arden', name: 'Король Арден', role: 'Правитель', faction: 'Корона', hp: 58, armor: 17 },
  ]);
  const [selectedId, setSelectedId] = useState(drafts[0]?.id ?? '');

  const list = useMemo(() => {
    const builtIn = actors.filter((actor) => actor.type !== 'player').map((actor) => ({
      id: actor.id,
      name: actor.name,
      role: actor.subtitle,
      faction: actor.type,
      hp: actor.systemData.hp?.max ?? 1,
      armor: actor.systemData.armor ?? 10,
    }));
    return [...drafts, ...builtIn].filter((npc) => npc.name.toLowerCase().includes(search.toLowerCase()));
  }, [drafts, search]);

  const selected = list.find((npc) => npc.id === selectedId) ?? list[0];

  const createNpc = () => {
    const npc = { id: `npc-${Date.now()}`, name: 'Новый NPC', role: 'Не назначено', faction: 'Нейтральный', hp: 10, armor: 10 };
    setDrafts((value) => [npc, ...value]);
    setSelectedId(npc.id);
  };

  return (
    <div className="module-split">
      <section className="module-list">
        <div className="library-search-row">
          <input className="control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск NPC..." />
          <button className="button" onClick={createNpc}>＋</button>
        </div>
        <div className="module-list-scroll">
          {list.map((npc) => (
            <button key={npc.id} className={`module-row ${selected?.id === npc.id ? 'selected' : ''}`} onClick={() => setSelectedId(npc.id)}>
              <span className="module-avatar">{npc.name.slice(0, 1)}</span>
              <span><strong>{npc.name}</strong><small>{npc.role}</small></span>
              <b>КД {npc.armor}</b>
            </button>
          ))}
        </div>
      </section>

      <section className="module-detail">
        {selected ? <>
          <div className="inspector-header">
            <div><h2>{selected.name}</h2><p>{selected.role} · {selected.faction}</p></div>
            <button className="button">Добавить на карту</button>
          </div>
          <div className="settings-kv two-col">
            <div><span>HP</span><b>{selected.hp}</b></div>
            <div><span>Защита</span><b>{selected.armor}</b></div>
            <div><span>Фракция</span><b>{selected.faction}</b></div>
            <div><span>Статус</span><b>Доступен</b></div>
          </div>
          <div className="builder-section compact-section">
            <h3>ЗАМЕТКА ДМа</h3>
            <textarea className="module-textarea" defaultValue="Мотивация, секреты, отношение к группе и поведение в сцене." />
          </div>
          <div className="module-actions">
            <button className="button">Редактировать</button>
            <button className="button">Дублировать</button>
            <button className="button danger">Удалить</button>
          </div>
        </> : <div className="placeholder-panel"><h2>NPC не найден</h2></div>}
      </section>
    </div>
  );
}
