'use client';

import { useMemo, useState } from 'react';
import type { Actor } from '@/domain/types';
import { actors, campaign } from '@/data/demo';
import { useCampaignStore } from '@/store/useCampaignStore';

const newNpc = (): Actor => ({
  id: `npc-${Date.now()}`,
  campaignId: campaign.id,
  type: 'npc',
  name: 'Новый NPC',
  subtitle: 'Нейтральный персонаж',
  avatar: 'Н',
  systemData: { hp: { current: 10, max: 10 }, armor: 10 },
});

export function NpcWorkshop() {
  const { customActors, upsertActor, deleteActor, addActorToScene } = useCampaignStore();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(customActors[0]?.id ?? actors.find((actor) => actor.type !== 'player')?.id ?? '');
  const [draft, setDraft] = useState<Actor | null>(null);

  const list = useMemo(() => [...customActors, ...actors.filter((actor) => actor.type !== 'player')]
    .filter((actor) => actor.name.toLowerCase().includes(search.toLowerCase())), [customActors, search]);

  const selected = list.find((actor) => actor.id === selectedId) ?? list[0];
  const isCustom = selected ? customActors.some((actor) => actor.id === selected.id) : false;

  const createNpc = () => {
    const npc = newNpc();
    setDraft(npc);
    setSelectedId(npc.id);
  };

  const editSelected = () => {
    if (!selected) return;
    const copy: Actor = isCustom
      ? JSON.parse(JSON.stringify(selected)) as Actor
      : { ...JSON.parse(JSON.stringify(selected)) as Actor, id: `npc-${Date.now()}`, name: `${selected.name} — копия`, type: 'npc' };
    setDraft(copy);
  };

  if (draft) {
    return <NpcBuilder draft={draft} onCancel={() => setDraft(null)} onSave={(actor) => { upsertActor(actor); setSelectedId(actor.id); setDraft(null); }} />;
  }

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
              <span className="module-avatar">{npc.avatar || npc.name.slice(0, 1)}</span>
              <span><strong>{npc.name}</strong><small>{npc.subtitle}</small></span>
              <b>КД {npc.systemData.armor ?? 10}</b>
            </button>
          ))}
        </div>
      </section>

      <section className="module-detail">
        {selected ? <>
          <div className="inspector-header">
            <div><h2>{selected.name}</h2><p>{selected.subtitle} · {isCustom ? 'NPC кампании' : 'Базовый NPC'}</p></div>
            <button className="button primary" disabled={!isCustom} onClick={() => isCustom && addActorToScene(selected.id)}>Добавить на карту</button>
          </div>
          <div className="settings-kv two-col">
            <div><span>HP</span><b>{selected.systemData.hp?.current ?? '—'} / {selected.systemData.hp?.max ?? '—'}</b></div>
            <div><span>Защита</span><b>{selected.systemData.armor ?? '—'}</b></div>
            <div><span>Тип</span><b>{selected.type}</b></div>
            <div><span>Статус</span><b>{isCustom ? 'Редактируемый' : 'Шаблон'}</b></div>
          </div>
          <div className="builder-section compact-section">
            <h3>СИСТЕМНЫЕ ДАННЫЕ</h3>
            <pre className="system-json">{JSON.stringify(selected.systemData, null, 2)}</pre>
          </div>
          <div className="module-actions">
            <button className="button" onClick={editSelected}>{isCustom ? 'Редактировать' : 'Создать копию'}</button>
            <button className="button" onClick={() => {
              const copy = { ...JSON.parse(JSON.stringify(selected)) as Actor, id: `npc-${Date.now()}`, name: `${selected.name} — копия`, type: 'npc' as const };
              upsertActor(copy);
              setSelectedId(copy.id);
            }}>Дублировать</button>
            {isCustom && <button className="button danger" onClick={() => { deleteActor(selected.id); setSelectedId(''); }}>Удалить</button>}
          </div>
        </> : <div className="placeholder-panel"><h2>NPC не найден</h2><button className="button primary" onClick={createNpc}>Создать NPC</button></div>}
      </section>
    </div>
  );
}

function NpcBuilder({ draft, onCancel, onSave }: { draft: Actor; onCancel: () => void; onSave: (actor: Actor) => void }) {
  const [actor, setActor] = useState<Actor>(() => JSON.parse(JSON.stringify(draft)) as Actor);
  const hp = actor.systemData.hp ?? { current: 10, max: 10 };
  const armor = actor.systemData.armor ?? 10;

  const patchSystem = (next: Partial<{ hp: { current: number; max: number }; armor: number }>) => setActor((current) => ({ ...current, systemData: { ...current.systemData, ...next } }));

  return (
    <div className="builder-view">
      <header className="builder-head"><div><h2>КОНСТРУКТОР NPC</h2><p>Actor остаётся generic, а характеристики живут в systemData.</p></div><button className="button" onClick={onCancel}>← К просмотру</button></header>
      <div className="builder-scroll">
        <section className="builder-section">
          <h3>ОСНОВНОЕ</h3>
          <div className="builder-grid">
            <label className="builder-field"><span>Имя</span><input value={actor.name} onChange={(event) => setActor((current) => ({ ...current, name: event.target.value }))} /></label>
            <label className="builder-field"><span>Иконка</span><input value={actor.avatar} onChange={(event) => setActor((current) => ({ ...current, avatar: event.target.value.slice(0, 2) }))} /></label>
            <label className="builder-field full-span"><span>Роль / описание</span><input value={actor.subtitle} onChange={(event) => setActor((current) => ({ ...current, subtitle: event.target.value }))} /></label>
            <label className="builder-field"><span>Тип Actor</span><select value={actor.type} onChange={(event) => setActor((current) => ({ ...current, type: event.target.value as Actor['type'] }))}><option value="npc">NPC</option><option value="creature">Существо</option><option value="companion">Спутник</option><option value="vehicle">Транспорт</option><option value="summon">Призыв</option></select></label>
            <label className="builder-field"><span>Защита</span><input type="number" value={armor} onChange={(event) => patchSystem({ armor: Number(event.target.value) })} /></label>
          </div>
        </section>
        <section className="builder-section">
          <h3>РЕСУРСЫ</h3>
          <div className="builder-grid">
            <label className="builder-field"><span>HP сейчас</span><input type="number" value={hp.current} onChange={(event) => patchSystem({ hp: { ...hp, current: Number(event.target.value) } })} /></label>
            <label className="builder-field"><span>HP максимум</span><input type="number" value={hp.max} onChange={(event) => patchSystem({ hp: { ...hp, max: Number(event.target.value) } })} /></label>
          </div>
        </section>
      </div>
      <footer className="builder-actions"><button className="button" onClick={onCancel}>Отмена</button><button className="button primary" onClick={() => onSave({ ...actor, name: actor.name.trim() || 'NPC' })}>Сохранить NPC</button></footer>
    </div>
  );
}
