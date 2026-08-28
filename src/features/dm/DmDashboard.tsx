'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { actors, campaign, scene } from '@/data/demo';
import type { Inventory } from '@/domain/types';
import { useCampaignStore } from '@/store/useCampaignStore';
import { getCampaignPreset } from '@/config/campaignPresets';
import { LocalDiceTray } from '@/features/campaign/DiceTray';
import { ItemWorkshop } from './workshop/ItemWorkshop';
import { NpcWorkshop } from './workshop/NpcWorkshop';
import { LootWorkshop } from './workshop/LootWorkshop';
import { TablesWorkshop } from './workshop/TablesWorkshop';

const sidebarTabs = [
  ['party', 'ГРУППА'],
  ['combat', 'БОЙ'],
  ['inventory', 'ИНВЕНТАРЬ'],
  ['npc', 'NPC'],
  ['notes', 'ЗАМЕТКИ'],
] as const;

const workshopTabs = [
  ['items', 'ПРЕДМЕТЫ'],
  ['npc', 'NPC'],
  ['loot', 'ЛУТ'],
  ['tables', 'ТАБЛИЦЫ'],
] as const;

const combatOrder = ['alvis', 'goblin', 'sulka', 'orc'];

export function DmDashboard() {
  const {
    presetId,
    selectedActorId,
    selectedItemId,
    sidebarTab,
    workshopTab,
    workshopOpen,
    mapGrid,
    mapFog,
    tokenPositions,
    customActors,
    customTokens,
    inventories,
    itemDefinitions,
    lastAction,
    setActor,
    setItem,
    setSidebarTab,
    setWorkshopTab,
    setWorkshopOpen,
    setBuilderOpen,
    toggleMapGrid,
    toggleMapFog,
    moveToken,
    moveItem,
    undo,
  } = useCampaignStore();

  const [draggedInstance, setDraggedInstance] = useState<{ inventoryId: string; instanceId: string } | null>(null);
  const [draggingTokenId, setDraggingTokenId] = useState<string | null>(null);
  const allActors = useMemo(() => [...actors, ...customActors], [customActors]);
  const allTokens = useMemo(() => [...scene.tokens, ...customTokens], [customTokens]);
  const selectedActor = allActors.find((actor) => actor.id === selectedActorId) ?? actors[0];
  const inventory = inventories.find((value) => value.ownerActorId === selectedActor.id);
  const preset = getCampaignPreset(presetId);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? '');
      if (event.key === '/' && !editing) {
        event.preventDefault();
        setWorkshopOpen(true);
        setWorkshopTab('items');
        requestAnimationFrame(() => document.querySelector<HTMLInputElement>('[data-item-search]')?.focus());
      }
      if (event.key.toLowerCase() === 'n' && !editing && !event.ctrlKey && !event.metaKey) {
        setWorkshopOpen(true);
        setWorkshopTab('items');
        setBuilderOpen(true);
      }
      if (event.key.toLowerCase() === 'e' && !editing && !event.ctrlKey && !event.metaKey) {
        setWorkshopOpen(true);
        setWorkshopTab('items');
        setBuilderOpen(true);
      }
      if (event.key.toLowerCase() === 'g' && !editing && !event.ctrlKey && !event.metaKey) {
        setWorkshopOpen(true);
        setWorkshopTab('items');
      }
      if (event.key === 'Escape') {
        setBuilderOpen(false);
        setDraggingTokenId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setBuilderOpen, setWorkshopOpen, setWorkshopTab]);

  const moveDraggingToken = (event: React.PointerEvent<HTMLElement>) => {
    if (!draggingTokenId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    moveToken(draggingTokenId, x, y);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">✥ ПАНЕЛЬ МАСТЕРА</div>
        <div className="campaign-badge">
          <strong>{campaign.name}</strong>
          <small>{preset.icon} {preset.name}</small>
        </div>
        <div className="top-actions map-actions">
          <button className={`button ${mapGrid ? 'active' : ''}`} onClick={toggleMapGrid}>▦ Сетка</button>
          <button className={`button ${mapFog ? 'active' : ''}`} onClick={toggleMapFog}>♟ Туман</button>
          <button className="button">⌖ Метка</button>
          <button className="button">⌁ Линейка</button>
          <button className="button">▣ Сцена</button>
        </div>
        <div className="top-spacer" />
        <div className="top-actions global-actions">
          <button className="button" onClick={() => setSidebarTab('party')}>♟ Игроки</button>
          <button className="button" onClick={() => setSidebarTab('npc')}>☠ NPC</button>
          <button className="button">▤ Книги</button>
          <button className={`button ${workshopOpen ? 'active' : ''}`} onClick={() => setWorkshopOpen(!workshopOpen)}>⚒ Мастерская</button>
          <Link className="button icon-link" href="/campaign/demo/settings" title="Настройки кампании">⚙</Link>
        </div>
      </header>

      <main className="workspace">
        <section
          className={`map-stage ${mapGrid ? '' : 'grid-off'} ${draggingTokenId ? 'token-dragging' : ''}`}
          onPointerMove={moveDraggingToken}
          onPointerUp={() => setDraggingTokenId(null)}
          onPointerCancel={() => setDraggingTokenId(null)}
          onPointerLeave={() => setDraggingTokenId(null)}
        >
          <div className="map-river" />
          <div className="map-ruin" />
          <div className="map-location location-a">Старая башня</div>
          <div className="map-location location-b">Лесная дорога</div>
          {mapFog && <div className="fog-layer" />}

          <div className="map-tools">
            {['↖', '✋', '◇', '✎', '⌕', '◉'].map((icon) => <button className="map-tool" key={icon}>{icon}</button>)}
          </div>

          {allTokens.map((token) => {
            const actor = allActors.find((value) => value.id === token.actorId);
            if (!actor) return null;
            const hp = actor.systemData.hp;
            const hpPct = hp ? Math.max(0, Math.min(100, (hp.current / hp.max) * 100)) : 100;
            const position = tokenPositions[token.id] ?? { x: token.x, y: token.y };
            return (
              <button
                key={token.id}
                className={`token ${token.enemy ? 'enemy' : ''} ${selectedActorId === actor.id ? 'selected' : ''}`}
                style={{ left: `${position.x}%`, top: `${position.y}%` }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  setDraggingTokenId(token.id);
                  if (actor.type === 'player') setActor(actor.id);
                  else setSidebarTab('combat');
                }}
                onClick={() => {
                  if (actor.type === 'player') setActor(actor.id);
                  else setSidebarTab('combat');
                }}
              >
                <span className="token-avatar">{actor.avatar}</span>
                <span className="token-name">{actor.name}</span>
                <span className="token-hp"><i style={{ width: `${hpPct}%` }} /></span>
              </button>
            );
          })}

          <div className="scene-chip">СЦЕНА · {scene.name}</div>

          {workshopOpen && (
            <section className="workshop-panel">
              <header className="workshop-header">
                <div className="workshop-title">МАСТЕРСКАЯ ДМа</div>
                <nav className="workshop-tabs">
                  {workshopTabs.map(([id, label]) => (
                    <button key={id} className={workshopTab === id ? 'active' : ''} onClick={() => { setWorkshopTab(id); setBuilderOpen(false); }}>{label}</button>
                  ))}
                </nav>
                <div className="workshop-shortcuts">/ поиск · N новый · E правка · G выдача</div>
                <button className="close-button" onClick={() => setWorkshopOpen(false)}>×</button>
              </header>
              <div className="workshop-module-body">
                {workshopTab === 'items' && <ItemWorkshop />}
                {workshopTab === 'npc' && <NpcWorkshop />}
                {workshopTab === 'loot' && <LootWorkshop />}
                {workshopTab === 'tables' && <TablesWorkshop />}
              </div>
            </section>
          )}
        </section>

        <aside className="session-sidebar">
          <nav className="sidebar-tabs">
            {sidebarTabs.map(([id, label]) => (
              <button key={id} className={sidebarTab === id ? 'active' : ''} onClick={() => setSidebarTab(id)}>{label}</button>
            ))}
          </nav>

          <div className="sidebar-body">
            {sidebarTab === 'party' && <PartyPanel selectedActorId={selectedActorId} onActor={setActor} />}
            {sidebarTab === 'combat' && <CombatPanel />}
            {sidebarTab === 'inventory' && (
              <InventoryPanel
                inventory={inventory}
                selectedActorId={selectedActorId}
                selectedItemId={selectedItemId}
                draggedInstance={draggedInstance}
                onActor={setActor}
                onItem={setItem}
                onDrag={setDraggedInstance}
                onDrop={(containerId) => {
                  if (draggedInstance) moveItem(draggedInstance.inventoryId, draggedInstance.instanceId, containerId);
                  setDraggedInstance(null);
                }}
                onOpenWorkshop={() => { setWorkshopOpen(true); setWorkshopTab('items'); }}
              />
            )}
            {sidebarTab === 'npc' && <NpcPanel onOpenWorkshop={() => { setWorkshopOpen(true); setWorkshopTab('npc'); }} />}
            {sidebarTab === 'notes' && <NotesPanel />}
          </div>

          {lastAction && (
            <div className="undo-bar">
              <span>{lastAction.label}</span>
              {lastAction.undo && <button onClick={undo}>Отменить</button>}
            </div>
          )}
        </aside>
      </main>
      <LocalDiceTray mode="gm" displayName="Мастер" />
    </div>
  );
}

function PartyPanel({ selectedActorId, onActor }: { selectedActorId: string; onActor: (id: string) => void }) {
  const party = actors.filter((actor) => actor.type === 'player');
  return (
    <>
      <h3 className="sidebar-heading first">ГРУППА</h3>
      {party.map((actor) => {
        const hp = actor.systemData.hp;
        const percent = hp ? (hp.current / hp.max) * 100 : 100;
        return (
          <button key={actor.id} className={`party-card ${selectedActorId === actor.id ? 'selected' : ''}`} onClick={() => onActor(actor.id)}>
            <span className="party-avatar">{actor.avatar}</span>
            <span>
              <strong>{actor.name}</strong>
              <small>{actor.subtitle}</small>
              <span className="party-hp">♥ {hp?.current ?? '—'} / {hp?.max ?? '—'}<i><em style={{ width: `${percent}%` }} /></i></span>
            </span>
            <b>КД {actor.systemData.armor ?? '—'}</b>
          </button>
        );
      })}
      <button className="button full">＋ Добавить героя</button>
    </>
  );
}

function CombatPanel() {
  const { combatRound, combatTurn, nextCombatTurn } = useCampaignStore();
  const participants = combatOrder.map((id, index) => ({ actor: actors.find((value) => value.id === id)!, initiative: [18, 16, 14, 11][index] }));
  const current = participants[combatTurn] ?? participants[0];

  return (
    <>
      <div className="sidebar-section-head"><h3 className="sidebar-heading first">БОЙ</h3><span>Раунд {combatRound}</span></div>
      <div className="combat-list">
        {participants.map(({ actor, initiative }, index) => (
          <div key={actor.id} className={combatTurn === index ? 'current-turn' : ''}>
            <b>{index + 1}</b><span>{actor.name}</span><strong>{initiative}</strong>{combatTurn === index ? <i>ХОД</i> : <i />}
          </div>
        ))}
      </div>
      <div className="combat-focus">
        <h3>{current.actor.name}</h3>
        <p>{current.actor.subtitle}</p>
        <div><span>HP</span><b>{current.actor.systemData.hp?.current ?? '—'} / {current.actor.systemData.hp?.max ?? '—'}</b><span>КД</span><b>{current.actor.systemData.armor ?? '—'}</b></div>
      </div>
      <button className="button primary full" onClick={() => nextCombatTurn(participants.length)}>Следующий ход →</button>
    </>
  );
}

function InventoryPanel({
  inventory,
  selectedActorId,
  selectedItemId,
  draggedInstance,
  onActor,
  onItem,
  onDrag,
  onDrop,
  onOpenWorkshop,
}: {
  inventory?: Inventory;
  selectedActorId: string;
  selectedItemId: string;
  draggedInstance: { inventoryId: string; instanceId: string } | null;
  onActor: (id: string) => void;
  onItem: (id: string) => void;
  onDrag: (value: { inventoryId: string; instanceId: string } | null) => void;
  onDrop: (containerId: string) => void;
  onOpenWorkshop: () => void;
}) {
  const { itemDefinitions } = useCampaignStore();
  const players = actors.filter((actor) => actor.type === 'player');
  const actor = players.find((value) => value.id === selectedActorId) ?? players[0];

  const totalWeight = useMemo(() => {
    if (!inventory) return 0;
    return inventory.containers.flatMap((container) => container.items).reduce((sum, instance) => {
      const definition = itemDefinitions.find((item) => item.id === instance.definitionId);
      return sum + (definition?.weight ?? 0) * instance.quantity;
    }, 0);
  }, [inventory, itemDefinitions]);

  const selected = itemDefinitions.find((item) => item.id === selectedItemId);

  return (
    <>
      <div className="actor-picker">
        <span className="mini-avatar">{actor.avatar}</span>
        <select value={selectedActorId} onChange={(event) => onActor(event.target.value)}>
          {players.map((value) => <option key={value.id} value={value.id}>{value.name} — {value.subtitle}</option>)}
        </select>
      </div>
      <div className="weight-line"><span>{totalWeight.toFixed(1)} / 60 фн</span><div className="meter"><i style={{ width: `${Math.min(100, totalWeight / 60 * 100)}%` }} /></div><small>{totalWeight > 60 ? 'Перегруз' : 'Норма'}</small></div>

      <h3 className="sidebar-heading">ИНВЕНТАРЬ</h3>
      {inventory?.containers.map((container) => (
        <section
          className={`inventory-container ${draggedInstance ? 'drop-ready' : ''}`}
          key={container.id}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => onDrop(container.id)}
        >
          <header><span>{container.name.toUpperCase()}</span><span>{container.items.length}{container.capacity ? ` / ${container.capacity}` : ''}</span></header>
          {container.items.map((instance) => {
            const definition = itemDefinitions.find((item) => item.id === instance.definitionId);
            if (!definition) return null;
            return (
              <button
                draggable
                key={instance.id}
                className={`inventory-row ${selectedItemId === definition.id ? 'selected' : ''}`}
                onClick={() => onItem(definition.id)}
                onDragStart={() => onDrag({ inventoryId: inventory.id, instanceId: instance.id })}
                onDragEnd={() => onDrag(null)}
              >
                <span className="inventory-icon">{definition.icon}</span>
                <span className="inventory-name">{instance.customName ?? definition.name}</span>
                <b>×{instance.quantity}</b>
                <small>{((definition.weight ?? 0) * instance.quantity).toFixed(1)} фн</small>
              </button>
            );
          })}
          {!container.items.length && <div className="empty-drop">Перетащите предмет сюда</div>}
        </section>
      ))}

      {selected && (
        <div className="context-card">
          <span className="context-icon">{selected.icon}</span>
          <div><strong>{selected.name}</strong><p>{selected.description}</p></div>
          <button className="button icon-button" onClick={onOpenWorkshop}>↗</button>
        </div>
      )}

      <button className="button sidebar-primary" onClick={onOpenWorkshop}>＋ Выдать предмет</button>
      <h3 className="sidebar-heading">БЫСТРЫЙ ВЫБОР</h3>
      <div className="quick-grid">
        {itemDefinitions.slice(0, 4).map((item) => <button key={item.id} className="quick-slot" title={item.name} onClick={() => onItem(item.id)}>{item.icon}</button>)}
        <button className="quick-slot" onClick={onOpenWorkshop}>＋</button>
      </div>
    </>
  );
}

function NpcPanel({ onOpenWorkshop }: { onOpenWorkshop: () => void }) {
  const customActors = useCampaignStore((state) => state.customActors);
  const npc = [...customActors, ...actors.filter((actor) => actor.type !== 'player')];
  return (
    <>
      <div className="sidebar-section-head"><h3 className="sidebar-heading first">NPC И СУЩЕСТВА</h3><button className="text-button" onClick={onOpenWorkshop}>Мастерская</button></div>
      {npc.map((actor) => <button className="npc-card" key={actor.id}><strong>{actor.name}</strong><small>{actor.subtitle} · HP {actor.systemData.hp?.current ?? '—'} · КД {actor.systemData.armor ?? '—'}</small></button>)}
      <button className="button full" onClick={onOpenWorkshop}>＋ Создать NPC</button>
    </>
  );
}

function NotesPanel() {
  const { notes, addNote, removeNote } = useCampaignStore();
  const [draft, setDraft] = useState('');
  const submit = () => {
    addNote(draft);
    setDraft('');
  };

  return (
    <>
      <h3 className="sidebar-heading first">ЗАМЕТКИ ДМа</h3>
      <textarea className="control notes-area" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Быстрая заметка..." />
      <button className="button full" onClick={submit}>＋ Сохранить заметку</button>
      <div className="notes-list">
        {notes.map((note, index) => (
          <div className="note-card" key={`${note}-${index}`}><div><strong>{index === 0 ? 'Последняя' : 'Заметка'}</strong><button onClick={() => removeNote(index)}>×</button></div><p>{note}</p></div>
        ))}
      </div>
    </>
  );
}
