'use client';

import { FormEvent, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';

// `party` stays as a short-lived compatibility value because OnlineTable still
// initializes the sidebar with the pre-redesign tab id. The sidebar normalizes
// it to `characters`, so the visible navigation only exposes the new workflow tabs.
export type GmSidebarTab = 'session' | 'characters' | 'content' | 'notes' | 'party';

type Actor = {
  id: string;
  campaign_id: string;
  owner_user_id: string | null;
  type: string;
  name: string;
  subtitle: string;
  avatar: string;
  system_data: Record<string, any>;
};
type Inventory = { id: string; owner_actor_id: string };
type Container = { id: string; inventory_id: string; name: string; type: string; capacity: number | null; sort_order: number };
type ItemInstance = { id: string; definition_id: string; container_id: string; quantity: number; custom_name: string | null; equipped: boolean; state: Record<string, any> };
type ItemDefinition = { id: string; name: string; category: string; icon: string; weight: number | null };
type Runtime = { combat_active: boolean; combat_round: number; combat_turn: number; combat_order: string[] };
type Note = { id: string; title: string | null; body: string; pinned: boolean; created_at: string; updated_at: string };

type Props = {
  campaignId: string;
  tab: GmSidebarTab;
  onTab: (tab: GmSidebarTab) => void;
  actors: Actor[];
  selectedActorId: string;
  onSelectActor: (id: string) => void;
  inventories: Inventory[];
  containers: Container[];
  instances: ItemInstance[];
  items: ItemDefinition[];
  runtime: Runtime;
  notes: Note[];
  busy: boolean;
  onCreateHero: () => void;
  onHp: (actor: Actor, delta: number) => void;
  onCombat: (action: 'start' | 'next' | 'stop') => void;
  onOpenWorkshop: () => void;
  onChanged: () => void;
  onMessage: (message: string) => void;
};

const tabs: [Exclude<GmSidebarTab, 'party'>, string][] = [
  ['session', 'СЕССИЯ'],
  ['characters', 'ПЕРСОНАЖИ'],
  ['content', 'КОНТЕНТ'],
  ['notes', 'ЗАМЕТКИ'],
];

// These are now character filters inside one workflow, not top-level sidebar tabs.
const characterKinds = [
  ['party', 'ГРУППА'],
  ['npc', 'NPC'],
] as const;

type CharacterKind = 'all' | typeof characterKinds[number][0];
type CharacterView = 'overview' | 'inventory';

export function OnlineGmSidebar(props: Props) {
  const visibleTab = props.tab === 'party' ? 'characters' : props.tab;

  return (
    <aside className="session-sidebar online-session-sidebar">
      <nav className="sidebar-tabs" aria-label="Панель мастера">
        {tabs.map(([id, label]) => (
          <button key={id} className={visibleTab === id ? 'active' : ''} onClick={() => props.onTab(id)}>{label}</button>
        ))}
      </nav>
      <div className="sidebar-body">
        {visibleTab === 'session' && <SessionPanel {...props} />}
        {visibleTab === 'characters' && <CharactersPanel {...props} />}
        {visibleTab === 'content' && <ContentPanel {...props} />}
        {visibleTab === 'notes' && <NotesPanel {...props} />}
      </div>
    </aside>
  );
}

function SessionPanel({ runtime, actors, busy, onCombat }: Props) {
  const order = runtime.combat_order
    .map((id) => actors.find((actor) => actor.id === id))
    .filter((actor): actor is Actor => Boolean(actor));
  const current = runtime.combat_active ? order[runtime.combat_turn] ?? null : null;
  const heroes = actors.filter((actor) => actor.type === 'player').length;
  const npcs = actors.length - heroes;

  return (
    <>
      <h3 className="sidebar-heading first">СЕССИЯ</h3>
      <section className="online-actor-card">
        <div className="online-section-title"><strong>Сейчас за столом</strong>{runtime.combat_active && <span>Раунд {runtime.combat_round}</span>}</div>
        <div className="online-stat-grid">
          <div><span>Герои</span><b>{heroes}</b></div>
          <div><span>NPC</span><b>{npcs}</b></div>
        </div>
      </section>

      <h3 className="sidebar-heading">БОЙ</h3>
      {!runtime.combat_active ? (
        <>
          <p className="muted">Бой сейчас не идёт. Запускайте его отсюда — основные действия сессии остаются в одном месте.</p>
          <button className="button primary sidebar-primary" disabled={busy} onClick={() => onCombat('start')}>⚔ Начать бой</button>
        </>
      ) : (
        <>
          <div className="combat-focus"><h3>Раунд {runtime.combat_round}</h3><p>Сейчас ходит: <strong>{current?.name ?? '—'}</strong></p></div>
          <div className="combat-list">
            {order.map((actor, index) => (
              <div key={actor.id} className={index === runtime.combat_turn ? 'active' : ''}>
                <span>{index + 1}</span>
                <strong>{actor.name}</strong>
                <small>{actor.system_data?.hp?.current ?? '—'} HP</small>
                {index === runtime.combat_turn && <i>ХОД</i>}
              </div>
            ))}
          </div>
          <button className="button primary sidebar-primary" disabled={busy} onClick={() => onCombat('next')}>Следующий ход →</button>
          <button className="button sidebar-primary" disabled={busy} onClick={() => onCombat('stop')}>Закончить бой</button>
        </>
      )}
    </>
  );
}

function CharactersPanel(props: Props) {
  const {
    campaignId,
    actors,
    selectedActorId,
    onSelectActor,
    busy,
    onCreateHero,
    onHp,
    inventories,
    containers,
    instances,
    items,
    onChanged,
    onMessage,
    onOpenWorkshop,
  } = props;
  const [kind, setKind] = useState<CharacterKind>('all');
  const [view, setView] = useState<CharacterView>('overview');
  const [deleting, setDeleting] = useState(false);
  const [dragged, setDragged] = useState<string | null>(null);
  const selected = actors.find((actor) => actor.id === selectedActorId) ?? actors[0] ?? null;
  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const filtered = actors.filter((actor) => {
    if (kind === 'all') return true;
    if (kind === 'party') return actor.type === 'player';
    return actor.type !== 'player';
  });

  const inventory = inventories.find((value) => value.owner_actor_id === selected?.id);
  const actorContainers = inventory ? containers.filter((value) => value.inventory_id === inventory.id) : [];

  const deleteHero = async () => {
    if (!selected || selected.type !== 'player' || !window.confirm(`Удалить героя «${selected.name}» из кампании? Вместе с ним удалятся его фишки, лист и инвентарь. Игрок останется участником кампании.`)) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('delete_campaign_actor', { target_campaign: campaignId, target_actor: selected.id });
    if (error) onMessage(friendlyError(error, 'Не удалось удалить героя.'));
    else {
      onSelectActor('');
      onMessage(`Герой «${selected.name}» удалён.`);
      onChanged();
    }
    setDeleting(false);
  };

  const move = async (containerId: string) => {
    if (!dragged) return;
    const supabase = createClient();
    const { error } = await supabase.rpc('move_item_instance', { target_campaign: campaignId, target_instance: dragged, target_container: containerId });
    if (error) onMessage(friendlyError(error, 'Не удалось переместить предмет.'));
    else onChanged();
    setDragged(null);
  };

  const removeItem = async (instanceId: string) => {
    const supabase = createClient();
    const { error } = await supabase.rpc('remove_item_instance', { target_campaign: campaignId, target_instance: instanceId });
    if (error) onMessage(friendlyError(error, 'Не удалось убрать предмет.'));
    else onChanged();
  };

  return (
    <>
      <div className="sidebar-heading-row">
        <h3 className="sidebar-heading first">ПЕРСОНАЖИ</h3>
        <button className="button" disabled={busy} onClick={onCreateHero}>＋ Герой</button>
      </div>

      <div className="filter-row">
        <button className={`button ${kind === 'all' ? 'active' : ''}`} onClick={() => setKind('all')}>Все</button>
        {characterKinds.map(([id, label]) => (
          <button key={id} className={`button ${kind === id ? 'active' : ''}`} onClick={() => setKind(id)}>{label}</button>
        ))}
      </div>

      <div className="online-actor-list">
        {filtered.map((actor) => (
          <button key={actor.id} className={selected?.id === actor.id ? 'selected' : ''} onClick={() => onSelectActor(actor.id)}>
            <span>{actor.avatar || (actor.type === 'player' ? '🧙' : '👤')}</span>
            <span><b>{actor.name}</b><small>{actor.subtitle || (actor.type === 'player' ? 'Персонаж игрока' : 'Персонаж мира')}</small></span>
            <em>{actor.system_data?.hp?.current ?? '—'} HP</em>
          </button>
        ))}
      </div>
      {!filtered.length && <div className="online-small-empty">В этой группе персонажей пока нет.</div>}

      {selected && (
        <section className="online-actor-card">
          <div className="online-actor-title">
            <span>{selected.avatar || (selected.type === 'player' ? '🧙' : '👤')}</span>
            <div><h2>{selected.name}</h2><p>{selected.subtitle || (selected.type === 'player' ? 'Персонаж игрока' : 'Персонаж мира')}</p></div>
          </div>

          <div className="filter-row">
            <button className={`button ${view === 'overview' ? 'active' : ''}`} onClick={() => setView('overview')}>Обзор</button>
            <button className={`button ${view === 'inventory' ? 'active' : ''}`} onClick={() => setView('inventory')}>Инвентарь</button>
          </div>

          {view === 'overview' && (
            <>
              {selected.system_data?.hp && (
                <div className="online-hp-box">
                  <span>Здоровье</span>
                  <b>{selected.system_data.hp.current} / {selected.system_data.hp.max}</b>
                  <div><button onClick={() => onHp(selected, -1)}>−</button><button onClick={() => onHp(selected, 1)}>＋</button></div>
                </div>
              )}
              {selected.type !== 'player' && <button className="button full sidebar-primary" onClick={onOpenWorkshop}>⚒ Редактировать NPC</button>}
              {selected.type === 'player' && (
                <button className="button danger full party-delete-hero" disabled={deleting} onClick={() => void deleteHero()}>{deleting ? 'Удаление…' : 'Удалить героя'}</button>
              )}
            </>
          )}

          {view === 'inventory' && (
            <>
              {!actorContainers.length && <div className="online-small-empty">У персонажа пока нет контейнеров инвентаря.</div>}
              {actorContainers.map((container) => {
                const rows = instances.filter((row) => row.container_id === container.id);
                return (
                  <section className="inventory-container" key={container.id} onDragOver={(event) => event.preventDefault()} onDrop={() => void move(container.id)}>
                    <header><strong>{container.name}</strong><span>{rows.length}</span></header>
                    <div className="inventory-slot-list">
                      {rows.map((instance) => {
                        const item = itemMap.get(instance.definition_id);
                        return (
                          <div className="inventory-row" draggable key={instance.id} onDragStart={() => setDragged(instance.id)} onDragEnd={() => setDragged(null)}>
                            <span className="inventory-icon">{item?.icon ?? '📦'}</span>
                            <span><strong>{instance.custom_name || item?.name || 'Предмет'}</strong><small>{item?.category ?? ''}{item?.weight != null ? ` · ${item.weight}` : ''}</small></span>
                            <b>×{instance.quantity}</b>
                            <button className="close-button tiny" title="Убрать" onClick={() => void removeItem(instance.id)}>×</button>
                          </div>
                        );
                      })}
                      {!rows.length && <div className="empty-drop">Перетащите предмет сюда</div>}
                    </div>
                  </section>
                );
              })}
              <button className="button sidebar-primary" onClick={onOpenWorkshop}>⚒ Предметы и лут</button>
            </>
          )}
        </section>
      )}
    </>
  );
}

function ContentPanel({ actors, items, instances, onOpenWorkshop }: Props) {
  const npcs = actors.filter((actor) => actor.type !== 'player').length;
  const issuedItems = instances.reduce((total, instance) => total + Math.max(0, instance.quantity || 0), 0);

  return (
    <>
      <h3 className="sidebar-heading first">КОНТЕНТ</h3>
      <p className="muted">Подготовка мира вынесена из игрового управления: предметы, лут и таблицы живут здесь, а персонажи — во вкладке «Персонажи».</p>
      <section className="online-actor-card">
        <div className="online-section-title"><strong>Библиотека кампании</strong></div>
        <div className="online-stat-grid">
          <div><span>Предметы</span><b>{items.length}</b></div>
          <div><span>Выдано</span><b>{issuedItems}</b></div>
          <div><span>NPC</span><b>{npcs}</b></div>
          <div><span>Инструменты</span><b>Лут · Таблицы</b></div>
        </div>
      </section>
      <button className="button primary sidebar-primary" onClick={onOpenWorkshop}>⚒ Открыть мастерскую</button>
    </>
  );
}

function NotesPanel({ campaignId, notes, onChanged, onMessage }: Props) {
  const [selectedId, setSelectedId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [editing, setEditing] = useState(false);

  const openNew = () => {
    setSelectedId('');
    setTitle('');
    setBody('');
    setPinned(false);
    setEditing(true);
  };

  const openEdit = (note: Note) => {
    setSelectedId(note.id);
    setTitle(note.title ?? '');
    setBody(note.body);
    setPinned(note.pinned);
    setEditing(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const supabase = createClient();
    const result = selectedId
      ? await supabase.rpc('update_gm_note', { target_campaign: campaignId, target_note: selectedId, note_title: title, note_body: body, note_pinned: pinned })
      : await supabase.rpc('create_gm_note', { target_campaign: campaignId, note_title: title, note_body: body, note_pinned: pinned });
    if (result.error) onMessage(friendlyError(result.error, 'Не удалось сохранить заметку.'));
    else {
      setEditing(false);
      onChanged();
    }
  };

  const remove = async (note: Note) => {
    if (!window.confirm('Удалить заметку?')) return;
    const supabase = createClient();
    const { error } = await supabase.rpc('delete_gm_note', { target_campaign: campaignId, target_note: note.id });
    if (error) onMessage(friendlyError(error, 'Не удалось удалить заметку.'));
    else {
      setSelectedId('');
      setEditing(false);
      onChanged();
    }
  };

  if (editing) {
    return (
      <form onSubmit={save}>
        <h3 className="sidebar-heading first">{selectedId ? 'ЗАМЕТКА' : 'НОВАЯ ЗАМЕТКА'}</h3>
        <input className="control full" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Заголовок" />
        <textarea className="control notes-area" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Текст заметки..." />
        <label><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} /> Закрепить</label>
        <button className="button primary sidebar-primary">Сохранить</button>
        <button type="button" className="button sidebar-primary" onClick={() => setEditing(false)}>Отмена</button>
      </form>
    );
  }

  return (
    <>
      <h3 className="sidebar-heading first">ЗАМЕТКИ</h3>
      <button className="button primary sidebar-primary" onClick={openNew}>＋ Новая заметка</button>
      {notes.map((note) => (
        <div className="note-card" key={note.id}>
          <strong>{note.pinned ? '📌 ' : ''}{note.title || 'Без названия'}</strong>
          <p>{note.body || 'Пустая заметка'}</p>
          <div>
            <button className="button" onClick={() => openEdit(note)}>Править</button>{' '}
            <button className="button danger" onClick={() => void remove(note)}>Удалить</button>
          </div>
        </div>
      ))}
      {!notes.length && <div className="online-small-empty">Заметок пока нет.</div>}
    </>
  );
}
