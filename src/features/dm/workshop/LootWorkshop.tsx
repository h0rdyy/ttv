'use client';

import { useMemo, useState } from 'react';
import { actors } from '@/data/demo';
import { useCampaignStore } from '@/store/useCampaignStore';

export function LootWorkshop() {
  const { itemDefinitions, giveItem } = useCampaignStore();
  const [selectedActorId, setSelectedActorId] = useState(actors.find((a) => a.type === 'player')?.id ?? 'alvis');
  const [lootIds, setLootIds] = useState<string[]>(['healing-potion', 'torch']);
  const [gold, setGold] = useState(120);
  const [message, setMessage] = useState('');

  const loot = useMemo(() => lootIds.map((id) => itemDefinitions.find((item) => item.id === id)).filter(Boolean), [itemDefinitions, lootIds]);

  const addRandom = () => {
    if (!itemDefinitions.length) return;
    const candidate = itemDefinitions[Math.floor(Math.random() * itemDefinitions.length)];
    setLootIds((value) => [...value, candidate.id]);
  };

  const distribute = () => {
    lootIds.forEach((id) => giveItem(selectedActorId, id, 1));
    const actor = actors.find((a) => a.id === selectedActorId);
    setMessage(`Выдано ${lootIds.length} предметов → ${actor?.name ?? 'герой'}. Монеты записаны в журнал лута.`);
  };

  return (
    <div className="loot-layout">
      <section className="builder-section loot-builder">
        <div className="inspector-header">
          <div><h2>Набор лута</h2><p>Соберите награду и выдайте её герою без модального окна.</p></div>
          <button className="button" onClick={addRandom}>🎲 Случайный предмет</button>
        </div>

        <label className="module-label">Название набора</label>
        <input className="control full" defaultValue="Сундук разбойников" />

        <div className="loot-coins">
          <label><span>Монеты</span><input className="control" type="number" value={gold} onChange={(event) => setGold(Number(event.target.value))} /></label>
          <span className="coin-pill">{gold} зм</span>
        </div>

        <div className="loot-items">
          {loot.map((item, index) => item && (
            <div className="loot-row" key={`${item.id}-${index}`}>
              <span className="inventory-icon">{item.icon}</span>
              <span><strong>{item.name}</strong><small>{item.category} · {item.weight ?? 0} фн</small></span>
              <button className="close-button tiny" onClick={() => setLootIds((ids) => ids.filter((_, i) => i !== index))}>×</button>
            </div>
          ))}
          {!loot.length && <div className="empty-drop">Набор пуст. Добавьте предмет из библиотеки или сгенерируйте случайный.</div>}
        </div>
      </section>

      <aside className="loot-delivery">
        <span className="eyebrow">ВЫДАЧА</span>
        <h2>Кому передать?</h2>
        <select className="control full" value={selectedActorId} onChange={(event) => setSelectedActorId(event.target.value)}>
          {actors.filter((actor) => actor.type === 'player').map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}
        </select>
        <div className="loot-summary">
          <div><span>Предметов</span><b>{loot.length}</b></div>
          <div><span>Монет</span><b>{gold} зм</b></div>
        </div>
        <button className="button primary full" onClick={distribute} disabled={!loot.length}>Выдать лут</button>
        {message && <p className="success-note">✓ {message}</p>}
      </aside>
    </div>
  );
}
