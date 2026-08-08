'use client';

import { useEffect, useMemo, useState } from 'react';
import { actors, campaign, items, scene } from '@/data/demo';
import { useCampaignStore } from '@/store/useCampaignStore';
import type { ItemDefinition } from '@/domain/types';

const rarityLabel: Record<string, string> = {
  common: 'Обычный', uncommon: 'Необычный', rare: 'Редкий', 'very-rare': 'Очень редкий', legendary: 'Легендарный', artifact: 'Артефакт'
};

export function DmDashboard() {
  const {
    selectedActorId, selectedItemId, sidebarTab, workshopTab, workshopOpen, builderOpen,
    inventories, lastAction,
    setActor, setItem, setSidebarTab, setWorkshopTab, setWorkshopOpen, setBuilderOpen,
    giveItem, moveItem, undo,
  } = useCampaignStore();

  const [search, setSearch] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [draggedInstance, setDraggedInstance] = useState<{ inventoryId: string; instanceId: string } | null>(null);

  const selectedActor = actors.find((x) => x.id === selectedActorId) ?? actors[0];
  const selectedItem = items.find((x) => x.id === selectedItemId) ?? items[0];
  const inventory = inventories.find((x) => x.ownerActorId === selectedActorId);
  const filteredItems = items.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        event.preventDefault();
        setWorkshopOpen(true);
        requestAnimationFrame(() => document.querySelector<HTMLInputElement>('[data-item-search]')?.focus());
      }
      if (event.key.toLowerCase() === 'n' && !event.ctrlKey && !event.metaKey && document.activeElement?.tagName !== 'INPUT') {
        setWorkshopOpen(true);
        setBuilderOpen(true);
      }
      if (event.key.toLowerCase() === 'e' && !event.ctrlKey && !event.metaKey && document.activeElement?.tagName !== 'INPUT') {
        setWorkshopOpen(true);
        setBuilderOpen(true);
      }
      if (event.key === 'Escape') setBuilderOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setBuilderOpen, setWorkshopOpen]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">✥ ПАНЕЛЬ МАСТЕРА</div>
        <select className="control campaign-select" defaultValue={campaign.id}>
          <option value={campaign.id}>{campaign.name}</option>
        </select>
        <div className="top-actions map-actions">
          <button className="button">▦ Сетка</button>
          <button className="button">♟ Туман</button>
          <button className="button">⌖ Метка</button>
          <button className="button">⌁ Линейка</button>
          <button className="button">▣ Сцена</button>
        </div>
        <div className="top-spacer" />
        <div className="top-actions global-actions">
          <button className="button">♟ Игроки</button>
          <button className="button">☠ NPC</button>
          <button className="button">▤ Книги</button>
          <button className={`button ${workshopOpen ? 'active' : ''}`} onClick={() => setWorkshopOpen(!workshopOpen)}>⚒ Мастерская</button>
          <button className="button icon-button">⚙</button>
        </div>
      </header>

      <main className="workspace">
        <section className="map-stage">
          <div className="map-river" />
          <div className="map-ruin" />
          <div className="map-tools">
            {['↖','✋','◇','✎','⌕','◉'].map((icon) => <button className="map-tool" key={icon}>{icon}</button>)}
          </div>

          {scene.tokens.map((token) => {
            const actor = actors.find((a) => a.id === token.actorId)!;
            const hp = actor.systemData.hp;
            const hpPct = hp ? (hp.current / hp.max) * 100 : 100;
            return (
              <button
                key={token.id}
                className={`token ${token.enemy ? 'enemy' : ''} ${selectedActorId === actor.id ? 'selected' : ''}`}
                style={{ left: `${token.x}%`, top: `${token.y}%` }}
                onClick={() => actor.type === 'player' && setActor(actor.id)}
              >
                <span className="token-avatar">{actor.avatar}</span>
                <span className="token-name">{actor.name}</span>
                <span className="token-hp"><i style={{ width: `${hpPct}%` }} /></span>
              </button>
            );
          })}

          {workshopOpen && (
            <Workshop
              selectedItem={selectedItem}
              filteredItems={filteredItems}
              search={search}
              builderOpen={builderOpen}
              workshopTab={workshopTab}
              onSearch={setSearch}
              onClose={() => setWorkshopOpen(false)}
              onSelectItem={(id) => { setItem(id); setBuilderOpen(false); }}
              onWorkshopTab={setWorkshopTab}
              onOpenBuilder={() => setBuilderOpen(true)}
              onCloseBuilder={() => setBuilderOpen(false)}
              onGive={() => giveItem(selectedActorId, selectedItem.id, quantity)}
            />
          )}
        </section>

        <aside className="session-sidebar">
          <nav className="sidebar-tabs">
            {[
              ['party','ГРУППА'],['combat','БОЙ'],['inventory','ИНВЕНТАРЬ'],['npc','NPC'],['notes','ЗАМЕТКИ']
            ].map(([id, label]) => (
              <button key={id} className={sidebarTab === id ? 'active' : ''} onClick={() => setSidebarTab(id as typeof sidebarTab)}>{label}</button>
            ))}
          </nav>

          <div className="sidebar-body">
            {sidebarTab === 'inventory' && (
              <InventoryPanel
                actorId={selectedActorId}
                inventory={inventory}
                selectedItemId={selectedItemId}
                draggedInstance={draggedInstance}
                onActor={setActor}
                onItem={setItem}
                onDrag={setDraggedInstance}
                onDrop={(containerId) => {
                  if (draggedInstance) moveItem(draggedInstance.inventoryId, draggedInstance.instanceId, containerId);
                  setDraggedInstance(null);
                }}
                onOpenWorkshop={() => setWorkshopOpen(true)}
              />
            )}
            {sidebarTab === 'party' && <PartyPanel selectedActorId={selectedActorId} onActor={setActor} />}
            {sidebarTab === 'combat' && <CombatPanel />}
            {sidebarTab === 'npc' && <NpcPanel />}
            {sidebarTab === 'notes' && <NotesPanel />}
          </div>

          {lastAction && (
            <div className="undo-bar">
              <span>{lastAction.label}</span>
              <button onClick={undo}>Отменить</button>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

function Workshop({
  selectedItem, filteredItems, search, builderOpen, workshopTab,
  onSearch, onClose, onSelectItem, onWorkshopTab, onOpenBuilder, onCloseBuilder, onGive,
}: {
  selectedItem: ItemDefinition;
  filteredItems: ItemDefinition[];
  search: string;
  builderOpen: boolean;
  workshopTab: string;
  onSearch: (value: string) => void;
  onClose: () => void;
  onSelectItem: (id: string) => void;
  onWorkshopTab: (tab: 'items' | 'npc' | 'loot' | 'tables') => void;
  onOpenBuilder: () => void;
  onCloseBuilder: () => void;
  onGive: () => void;
}) {
  return (
    <section className="workshop-panel">
      <header className="workshop-header">
        <div className="workshop-title">МАСТЕРСКАЯ ДМа</div>
        <nav className="workshop-tabs">
          {[['items','ПРЕДМЕТЫ'],['npc','NPC'],['loot','ЛУТ'],['tables','ТАБЛИЦЫ']].map(([id,label]) => (
            <button key={id} className={workshopTab === id ? 'active' : ''} onClick={() => onWorkshopTab(id as 'items' | 'npc' | 'loot' | 'tables')}>{label}</button>
          ))}
        </nav>
        <button className="close-button" onClick={onClose}>×</button>
      </header>

      {workshopTab !== 'items' ? (
        <div className="placeholder-panel">
          <div className="placeholder-icon">⚒</div>
          <h2>{workshopTab === 'npc' ? 'NPC' : workshopTab === 'loot' ? 'Лут' : 'Таблицы'}</h2>
          <p>Архитектура раздела уже заложена. Следующим этапом сюда подключается отдельный feature-модуль.</p>
        </div>
      ) : builderOpen ? (
        <ItemBuilder item={selectedItem} onBack={onCloseBuilder} />
      ) : (
        <div className="workshop-content">
          <div className="item-library">
            <div className="library-search-row">
              <input data-item-search className="control" value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Поиск предметов..." />
              <button className="button">⌕</button>
            </div>
            <div className="filter-row">
              <select className="control"><option>Все типы</option><option>Оружие</option><option>Зелья</option></select>
              <select className="control"><option>Все редкости</option><option>Обычные</option><option>Редкие</option></select>
              <select className="control"><option>Все источники</option><option>Книга игрока</option></select>
            </div>
            <div className="library-meta-row">
              <button className="button" onClick={onOpenBuilder}>＋ Создать предмет</button>
              <span>Найдено: {filteredItems.length}</span>
            </div>
            <div className="item-card-grid">
              {filteredItems.map((item) => (
                <button key={item.id} className={`item-card ${selectedItem.id === item.id ? 'selected' : ''}`} onClick={() => onSelectItem(item.id)}>
                  <span className="item-card-icon">{item.icon}</span>
                  <strong>{item.name}</strong>
                  <small className={`rarity rarity-${item.rarity}`}>{rarityLabel[item.rarity]} · {item.weight ?? 0} фн</small>
                </button>
              ))}
            </div>
          </div>
          <ItemInspector item={selectedItem} onEdit={onOpenBuilder} onGive={onGive} />
        </div>
      )}
    </section>
  );
}

function ItemInspector({ item, onEdit, onGive }: { item: ItemDefinition; onEdit: () => void; onGive: () => void }) {
  return (
    <div className="item-inspector">
      <header className="inspector-header">
        <div><h2>{item.name}</h2><p><span className={`rarity rarity-${item.rarity}`}>{rarityLabel[item.rarity]}</span> · {item.category}</p></div>
        <button className="button" onClick={onEdit}>✎ Редактировать</button>
      </header>
      <div className="inspector-grid">
        <div className="item-art">{item.icon}</div>
        <div>
          <p className="description">{item.description}</p>
          <div className="stat-list">
            <div><span>Вес</span><b>{item.weight ?? 0} фн</b></div>
            <div><span>Стоимость</span><b>{item.price ?? 0} {item.currency ?? ''}</b></div>
            <div><span>Источник</span><b>{item.source ?? 'Собственный'}</b></div>
            {Object.entries(item.properties).map(([key, value]) => <div key={key}><span>{key}</span><b>{String(value)}</b></div>)}
          </div>
        </div>
        <div className="inspector-actions">
          <button className="button primary" onClick={onGive}>Выдать предмет</button>
          <button className="button" onClick={onEdit}>Редактировать</button>
          <button className="button">Дублировать</button>
          <button className="button danger">Удалить</button>
        </div>
      </div>
      <section className="effect-box">
        <h3>МАГИЧЕСКИЕ СВОЙСТВА</h3>
        {item.effects.length ? item.effects.map((effect) => (
          <div className="effect-row" key={effect.id}>
            <span className="effect-icon">{effect.icon ?? '✦'}</span>
            <div><strong>{effect.name}</strong><p>{effect.description}</p></div>
          </div>
        )) : <p className="muted">У предмета нет эффектов.</p>}
      </section>
    </div>
  );
}

function ItemBuilder({ item, onBack }: { item: ItemDefinition; onBack: () => void }) {
  const [dirty, setDirty] = useState(false);
  const mark = () => setDirty(true);
  return (
    <div className="builder-view">
      <header className="builder-head">
        <div><h2>КОНСТРУКТОР ПРЕДМЕТА</h2><p>{dirty ? '● Есть несохранённые изменения' : 'Все изменения сохранены'}</p></div>
        <button className="button" onClick={onBack}>← К просмотру</button>
      </header>
      <div className="builder-scroll">
        <BuilderSection title="ОСНОВНОЕ">
          <Field label="Название"><input defaultValue={item.name} onChange={mark} /></Field>
          <Field label="Тип"><select defaultValue={item.category} onChange={mark}><option>{item.category}</option><option>Оружие</option><option>Зелье</option><option>Броня</option></select></Field>
          <Field label="Редкость"><select defaultValue={item.rarity} onChange={mark}>{Object.keys(rarityLabel).map((x) => <option value={x} key={x}>{rarityLabel[x]}</option>)}</select></Field>
          <Field label="Стоимость"><input type="number" defaultValue={item.price} onChange={mark} /></Field>
          <Field label="Вес"><input type="number" step="0.1" defaultValue={item.weight} onChange={mark} /></Field>
          <Field label="Источник"><input defaultValue={item.source ?? ''} onChange={mark} /></Field>
        </BuilderSection>
        <BuilderSection title="ХАРАКТЕРИСТИКИ">
          <Field label="Урон"><input defaultValue={String(item.properties.damage ?? '')} onChange={mark} /></Field>
          <Field label="Тип урона"><input defaultValue={String(item.properties.damageType ?? '')} onChange={mark} /></Field>
          <Field label="Дистанция"><input defaultValue={String(item.properties.range ?? '')} onChange={mark} /></Field>
          <Field label="Свойство"><input defaultValue={String(item.properties.trait ?? '')} onChange={mark} /></Field>
        </BuilderSection>
        <BuilderSection title="МАГИЧЕСКИЕ СВОЙСТВА">
          <div className="effects-builder">
            {item.effects.map((effect) => <div className="effect-row" key={effect.id}><span className="effect-icon">{effect.icon}</span><div><strong>{effect.name}</strong><p>{effect.description}</p></div><button className="button">✎</button></div>)}
            <button className="button">＋ Добавить свойство</button>
          </div>
        </BuilderSection>
        <BuilderSection title="ОПИСАНИЕ">
          <Field label="Описание" wide><textarea defaultValue={item.description} onChange={mark} /></Field>
        </BuilderSection>
      </div>
      <footer className="builder-footer"><button className="button" onClick={onBack}>Отмена</button><button className="button primary" onClick={() => setDirty(false)}>Сохранить предмет</button></footer>
    </div>
  );
}

function BuilderSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="builder-section"><h3>{title}</h3><div className="builder-grid">{children}</div></section>;
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}</label>;
}

function InventoryPanel({ actorId, inventory, selectedItemId, draggedInstance, onActor, onItem, onDrag, onDrop, onOpenWorkshop }: {
  actorId: string;
  inventory: ReturnType<typeof useCampaignStore.getState>['inventories'][number] | undefined;
  selectedItemId: string;
  draggedInstance: { inventoryId: string; instanceId: string } | null;
  onActor: (id: string) => void;
  onItem: (id: string) => void;
  onDrag: (value: { inventoryId: string; instanceId: string } | null) => void;
  onDrop: (containerId: string) => void;
  onOpenWorkshop: () => void;
}) {
  const playerActors = actors.filter((x) => x.type === 'player');
  const selectedDef = items.find((x) => x.id === selectedItemId);
  return (
    <>
      <div className="actor-picker">
        <span className="mini-avatar">{actors.find((x) => x.id === actorId)?.avatar}</span>
        <select value={actorId} onChange={(e) => onActor(e.target.value)}>
          {playerActors.map((actor) => <option value={actor.id} key={actor.id}>{actor.name}</option>)}
        </select>
      </div>
      <div className="weight-line"><span>21.3 / 60 фн</span><div className="meter"><i style={{ width: '36%' }} /></div><small>Норма</small></div>
      {inventory?.containers.map((container) => (
        <section
          className={`inventory-container ${draggedInstance ? 'drop-ready' : ''}`}
          key={container.id}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => onDrop(container.id)}
        >
          <header><strong>{container.name.toUpperCase()}</strong><span>{container.items.length}{container.capacity ? ` / ${container.capacity}` : ''}</span></header>
          {container.items.length === 0 && <div className="empty-drop">Перетащите предмет сюда</div>}
          {container.items.map((instance) => {
            const def = items.find((x) => x.id === instance.definitionId)!;
            return (
              <button
                draggable
                key={instance.id}
                className={`inventory-row ${selectedItemId === def.id ? 'selected' : ''}`}
                onDragStart={() => onDrag({ inventoryId: inventory.id, instanceId: instance.id })}
                onDragEnd={() => onDrag(null)}
                onClick={() => onItem(def.id)}
              >
                <span className="inventory-icon">{def.icon}</span><span className="inventory-name">{def.name}</span><b>×{instance.quantity}</b><small>{def.weight ?? 0} фн</small>
              </button>
            );
          })}
        </section>
      ))}
      {selectedDef && (
        <section className="context-card">
          <div className="context-icon">{selectedDef.icon}</div>
          <div><strong>{selectedDef.name}</strong><p>{selectedDef.description}</p></div>
          <button className="button" onClick={onOpenWorkshop}>Открыть</button>
        </section>
      )}
      <button className="button sidebar-primary" onClick={onOpenWorkshop}>＋ Выдать предмет</button>
      <h3 className="sidebar-heading">БЫСТРЫЙ ВЫБОР</h3>
      <div className="quick-grid">{['🧪','🔥','📜','🪢','＋'].map((x, i) => <button className="quick-slot" key={i}>{x}</button>)}</div>
    </>
  );
}

function PartyPanel({ selectedActorId, onActor }: { selectedActorId: string; onActor: (id: string) => void }) {
  return <><h3 className="sidebar-heading first">ГРУППА</h3>{actors.filter((x) => x.type === 'player').map((actor) => {
    const hp = actor.systemData.hp!; const pct = hp.current / hp.max * 100;
    return <button key={actor.id} className={`party-card ${selectedActorId === actor.id ? 'selected' : ''}`} onClick={() => onActor(actor.id)}><span className="party-avatar">{actor.avatar}</span><span><strong>{actor.name}</strong><small>{actor.subtitle}</small><span className="party-hp">♥ {hp.current} / {hp.max}<i><em style={{ width: `${pct}%` }} /></i></span></span><b>КД {actor.systemData.armor}</b></button>;
  })}<button className="button sidebar-primary">＋ Герой</button></>;
}

function CombatPanel() {
  return <><h3 className="sidebar-heading first">БОЙ · РАУНД 3</h3><div className="combat-list">{[['Альвис',18],['Гоблин',16],['Сулка',14],['Орк',11]].map(([name, init], index) => <div key={String(name)}><b>{index + 1}</b><span>{name}</span><strong>{init}</strong>{index === 1 && <i>ХОД</i>}</div>)}</div><section className="combat-focus"><h3>Гоблин</h3><p>HP</p><div><button className="button">−</button><b>5 / 7</b><button className="button">＋</button></div><p>Состояния</p><button className="button">Отравлен ×</button> <button className="button">＋</button></section><button className="button primary sidebar-primary">Следующий ход</button></>;
}

function NpcPanel() {
  return <><h3 className="sidebar-heading first">NPC</h3><input className="control full" placeholder="Поиск NPC..." />{['Торговец Брин','Король Арден','Гоблин-разведчик'].map((name) => <button className="npc-card" key={name}><strong>{name}</strong><small>Открыть карточку</small></button>)}<button className="button sidebar-primary">＋ Создать NPC</button></>;
}

function NotesPanel() {
  return <><h3 className="sidebar-heading first">ЗАМЕТКИ</h3><button className="button sidebar-primary">＋ Новая заметка</button><div className="note-card"><strong>Сегодня</strong><p>Игроки встретили Брина. Король подозревает Альвиса.</p></div><div className="note-card"><strong>📌 Закреплено</strong><p>Код двери: 4217</p></div><textarea className="control notes-area" placeholder="Быстрая заметка..." /></>;
}
