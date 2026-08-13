'use client';

import { FormEvent, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';

export type GmSidebarTab = 'party' | 'combat' | 'inventory' | 'npc' | 'notes';

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
  onHp: (actor: Actor, delta: number) => void;
  onCombat: (action: 'start' | 'next' | 'stop') => void;
  onOpenWorkshop: () => void;
  onChanged: () => void;
  onMessage: (message: string) => void;
};

const tabs: [GmSidebarTab, string][] = [
  ['party', 'ГРУППА'],
  ['combat', 'БОЙ'],
  ['inventory', 'ИНВЕНТАРЬ'],
  ['npc', 'NPC'],
  ['notes', 'ЗАМЕТКИ'],
];

export function OnlineGmSidebar(props: Props) {
  return (
    <aside className="session-sidebar online-session-sidebar">
      <nav className="sidebar-tabs">
        {tabs.map(([id, label]) => (
          <button key={id} className={props.tab === id ? 'active' : ''} onClick={() => props.onTab(id)}>{label}</button>
        ))}
      </nav>
      <div className="sidebar-body">
        {props.tab === 'party' && <PartyPanel {...props} />}
        {props.tab === 'combat' && <CombatPanel {...props} />}
        {props.tab === 'inventory' && <InventoryPanel {...props} />}
        {props.tab === 'npc' && <NpcPanel {...props} />}
        {props.tab === 'notes' && <NotesPanel {...props} />}
      </div>
    </aside>
  );
}

function PartyPanel({ campaignId, actors, selectedActorId, onSelectActor, onHp, onChanged, onMessage }: Props) {
  const party = actors.filter((actor) => actor.type === 'player');
  const selected = actors.find((actor) => actor.id === selectedActorId) ?? party[0] ?? null;
  const [deleting, setDeleting] = useState(false);

  const deleteHero = async () => {
    if (!selected || !window.confirm(`Удалить героя «${selected.name}» из кампании? Вместе с ним удалятся его фишки, лист и инвентарь. Игрок останется участником кампании.`)) return;
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

  return (
    <>
      <h3 className="sidebar-heading first">ГРУППА</h3>
      {party.map((actor) => {
        const hp = actor.system_data?.hp;
        const pct = hp?.max ? Math.max(0, Math.min(100, (hp.current / hp.max) * 100)) : 100;
        return (
          <button className={`party-card ${selectedActorId === actor.id ? 'selected' : ''}`} key={actor.id} onClick={() => onSelectActor(actor.id)}>
            <span className="party-avatar">{actor.avatar || '🧙'}</span>
            <span>
              <strong>{actor.name}</strong>
              <small>{actor.subtitle || 'Персонаж игрока'}</small>
              <span className="party-hp">♥ {hp?.current ?? '—'} / {hp?.max ?? '—'}<i><em style={{ width: `${pct}%` }} /></i></span>
            </span>
          </button>
        );
      })}
      {!party.length && <div className="online-small-empty">Персонажей игроков пока нет.</div>}
      {selected && selected.system_data?.hp && (
        <section className="online-actor-card">
          <div className="online-actor-title"><span>{selected.avatar || '👤'}</span><div><h2>{selected.name}</h2><p>{selected.subtitle}</p></div></div>
          <div className="online-hp-box"><span>Здоровье</span><b>{selected.system_data.hp.current} / {selected.system_data.hp.max}</b><div><button onClick={() => onHp(selected, -1)}>−</button><button onClick={() => onHp(selected, 1)}>＋</button></div></div>
          <button className="button danger full party-delete-hero" disabled={deleting} onClick={() => void deleteHero()}>{deleting ? 'Удаление…' : 'Удалить героя'}</button>
        </section>
      )}
    </>
  );
}

function CombatPanel({ runtime, actors, busy, onCombat }: Props) {
  const order = runtime.combat_order.map((id) => actors.find((actor) => actor.id === id)).filter((actor): actor is Actor => Boolean(actor));
  const current = runtime.combat_active ? order[runtime.combat_turn] ?? null : null;

  return (
    <>
      <h3 className="sidebar-heading first">БОЙ</h3>
      {!runtime.combat_active ? (
        <>
          <p className="muted">Бой сейчас не идёт.</p>
          <button className="button primary sidebar-primary" disabled={busy} onClick={() => onCombat('start')}>⚔ Начать бой</button>
        </>
      ) : (
        <>
          <div className="combat-focus"><h3>Раунд {runtime.combat_round}</h3><p>Сейчас ходит: <strong>{current?.name ?? '—'}</strong></p></div>
          <div className="combat-list">
            {order.map((actor, index) => (
              <div key={actor.id} className={index === runtime.combat_turn ? 'active' : ''}><span>{index + 1}</span><strong>{actor.name}</strong><small>{actor.system_data?.hp?.current ?? '—'} HP</small>{index === runtime.combat_turn && <i>ХОД</i>}</div>
            ))}
          </div>
          <button className="button primary sidebar-primary" disabled={busy} onClick={() => onCombat('next')}>Следующий ход →</button>
          <button className="button sidebar-primary" disabled={busy} onClick={() => onCombat('stop')}>Закончить бой</button>
        </>
      )}
    </>
  );
}

function InventoryPanel({ campaignId, actors, selectedActorId, onSelectActor, inventories, containers, instances, items, onChanged, onMessage, onOpenWorkshop }: Props) {
  const actor = actors.find((value) => value.id === selectedActorId) ?? actors[0] ?? null;
  const inventory = inventories.find((value) => value.owner_actor_id === actor?.id);
  const actorContainers = inventory ? containers.filter((value) => value.inventory_id === inventory.id) : [];
  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const [dragged, setDragged] = useState<string | null>(null);

  const move = async (containerId: string) => {
    if (!dragged) return;
    const supabase = createClient();
    const { error } = await supabase.rpc('move_item_instance', { target_campaign: campaignId, target_instance: dragged, target_container: containerId });
    if (error) onMessage(friendlyError(error, 'Не удалось переместить предмет.'));
    else onChanged();
    setDragged(null);
  };

  const remove = async (instanceId: string) => {
    const supabase = createClient();
    const { error } = await supabase.rpc('remove_item_instance', { target_campaign: campaignId, target_instance: instanceId });
    if (error) onMessage(friendlyError(error, 'Не удалось убрать предмет.'));
    else onChanged();
  };

  return (
    <>
      <h3 className="sidebar-heading first">ИНВЕНТАРЬ</h3>
      <select className="control full" value={actor?.id ?? ''} onChange={(event) => onSelectActor(event.target.value)}>
        {actors.map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}
      </select>
      {!actor && <div className="online-small-empty">Нет персонажей.</div>}
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
                    <button className="close-button tiny" title="Убрать" onClick={() => void remove(instance.id)}>×</button>
                  </div>
                );
              })}
              {!rows.length && <div className="empty-drop">Перетащите предмет сюда</div>}
            </div>
          </section>
        );
      })}
      <button className="button sidebar-primary" onClick={onOpenWorkshop}>⚒ Открыть мастерскую</button>
    </>
  );
}

function NpcPanel({ actors, selectedActorId, onSelectActor, onOpenWorkshop }: Props) {
  const npcs = actors.filter((actor) => actor.type !== 'player');
  return (
    <>
      <h3 className="sidebar-heading first">NPC</h3>
      <button className="button primary sidebar-primary" onClick={onOpenWorkshop}>＋ Создать / редактировать NPC</button>
      {npcs.map((npc) => (
        <button key={npc.id} className={`npc-card ${selectedActorId === npc.id ? 'selected' : ''}`} onClick={() => onSelectActor(npc.id)}>
          <strong>{npc.avatar || '👤'} {npc.name}</strong>
          <small>{npc.subtitle || 'Персонаж мира'} · {npc.system_data?.hp?.current ?? '—'} HP</small>
        </button>
      ))}
      {!npcs.length && <div className="online-small-empty">NPC пока нет.</div>}
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