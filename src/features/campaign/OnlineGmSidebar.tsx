'use client';

import { FormEvent, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';

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

type InspectorView = 'sheet' | 'inventory' | 'token';

const libraryTabs: [Exclude<GmSidebarTab, 'party'>, string, string][] = [
  ['characters', 'ПЕРСОНАЖИ', '♟'],
  ['content', 'КОНТЕНТ', '◆'],
  ['notes', 'ЗАМЕТКИ', '✎'],
  ['session', 'СЕССИЯ', '⚔'],
];

const actorLibraryGroups = [
  ['party', 'ГРУППА'],
  ['npc', 'NPC'],
] as const;

export function OnlineGmSidebar(props: Props) {
  const visibleTab = props.tab === 'party' ? 'characters' : props.tab;
  const [libraryOpen, setLibraryOpen] = useState(true);

  const selectLibrary = (tab: Exclude<GmSidebarTab, 'party'>) => {
    if (visibleTab === tab) {
      setLibraryOpen((value) => !value);
      return;
    }
    props.onTab(tab);
    setLibraryOpen(true);
  };

  return (
    <>
      <aside className={`gm-library ${libraryOpen ? 'expanded' : 'collapsed'}`} data-wheel-isolation="true">
        <nav className="gm-library-rail" aria-label="Библиотека мастера">
          <div className="gm-library-mark" title="Библиотека мастера">✥</div>
          {libraryTabs.map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              className={visibleTab === id ? 'active' : ''}
              title={label}
              aria-label={label}
              aria-pressed={visibleTab === id && libraryOpen}
              onClick={() => selectLibrary(id)}
            >
              <span aria-hidden="true">{icon}</span>
              <small>{label.slice(0, 4)}</small>
            </button>
          ))}
          <button className="gm-library-collapse" type="button" title={libraryOpen ? 'Свернуть библиотеку' : 'Развернуть библиотеку'} onClick={() => setLibraryOpen((value) => !value)}>
            {libraryOpen ? '‹' : '›'}
          </button>
        </nav>

        {libraryOpen && (
          <div className="gm-library-drawer">
            {visibleTab === 'characters' && <CharacterLibrary {...props} />}
            {visibleTab === 'content' && <ContentLibrary {...props} />}
            {visibleTab === 'notes' && <NotesPanel {...props} />}
            {visibleTab === 'session' && <SessionLibrary {...props} />}
          </div>
        )}
      </aside>

      <aside className="gm-inspector" data-wheel-isolation="true">
        <ActorInspector {...props} />
      </aside>
    </>
  );
}

function CharacterLibrary({ actors, selectedActorId, onSelectActor, busy, onCreateHero, onOpenWorkshop }: Props) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase('ru');
  const filtered = actors.filter((actor) => !query || `${actor.name} ${actor.subtitle}`.toLocaleLowerCase('ru').includes(query));
  const heroes = filtered.filter((actor) => actor.type === 'player');
  const npcs = filtered.filter((actor) => actor.type !== 'player');

  const actorRow = (actor: Actor) => (
    <button key={actor.id} className={`gm-library-actor ${selectedActorId === actor.id ? 'selected' : ''}`} onClick={() => onSelectActor(actor.id)}>
      <span className="gm-library-avatar">{actor.avatar || (actor.type === 'player' ? '🧙' : '👤')}</span>
      <span><strong>{actor.name}</strong><small>{actor.subtitle || (actor.type === 'player' ? 'Персонаж игрока' : 'Персонаж мира')}</small></span>
      <em>{actor.system_data?.hp?.current ?? '—'}</em>
    </button>
  );

  return (
    <>
      <header className="gm-library-header">
        <div><span>БИБЛИОТЕКА</span><h2>Персонажи</h2></div>
        <button className="button" disabled={busy} onClick={onCreateHero}>＋ Герой</button>
      </header>
      <input className="control full gm-library-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск персонажа…" />

      <section className="gm-library-section">
        <div className="gm-library-section-title"><strong>{actorLibraryGroups[0][1]}</strong><span>{heroes.length}</span></div>
        <div className="gm-library-list">{heroes.map(actorRow)}</div>
        {!heroes.length && <div className="online-small-empty">Героев не найдено.</div>}
      </section>

      <section className="gm-library-section">
        <div className="gm-library-section-title"><strong>{actorLibraryGroups[1][1]}</strong><span>{npcs.length}</span></div>
        <div className="gm-library-list">{npcs.map(actorRow)}</div>
        {!npcs.length && <div className="online-small-empty">NPC не найдены.</div>}
        <button className="button full gm-library-secondary" onClick={onOpenWorkshop}>＋ Создать / редактировать NPC</button>
      </section>
    </>
  );
}

function ContentLibrary({ actors, items, instances, onOpenWorkshop }: Props) {
  const npcs = actors.filter((actor) => actor.type !== 'player').length;
  const issuedItems = instances.reduce((total, instance) => total + Math.max(0, instance.quantity || 0), 0);

  return (
    <>
      <header className="gm-library-header"><div><span>БИБЛИОТЕКА</span><h2>Контент</h2></div></header>
      <p className="muted">Предметы, лут и таблицы собраны отдельно от управления персонажами.</p>
      <div className="gm-library-stats">
        <div><span>Предметы</span><strong>{items.length}</strong></div>
        <div><span>Выдано</span><strong>{issuedItems}</strong></div>
        <div><span>NPC</span><strong>{npcs}</strong></div>
      </div>
      <button className="button primary full" onClick={onOpenWorkshop}>⚒ Открыть мастерскую</button>
      <div className="gm-library-hint">Предметы · NPC · Лут · Таблицы</div>
    </>
  );
}

function SessionLibrary({ runtime, actors, busy, onCombat }: Props) {
  const order = runtime.combat_order
    .map((id) => actors.find((actor) => actor.id === id))
    .filter((actor): actor is Actor => Boolean(actor));
  const current = runtime.combat_active ? order[runtime.combat_turn] ?? null : null;
  const heroes = actors.filter((actor) => actor.type === 'player').length;
  const npcs = actors.length - heroes;

  return (
    <>
      <header className="gm-library-header"><div><span>ИГРОВОЙ СТОЛ</span><h2>Сессия</h2></div></header>
      <div className="gm-library-stats">
        <div><span>Герои</span><strong>{heroes}</strong></div>
        <div><span>NPC</span><strong>{npcs}</strong></div>
        <div><span>Раунд</span><strong>{runtime.combat_active ? runtime.combat_round : '—'}</strong></div>
      </div>

      <section className="gm-library-section">
        <div className="gm-library-section-title"><strong>БОЙ</strong><span>{runtime.combat_active ? 'ИДЁТ' : 'ПАУЗА'}</span></div>
        {!runtime.combat_active ? (
          <button className="button primary full" disabled={busy} onClick={() => onCombat('start')}>⚔ Начать бой</button>
        ) : (
          <>
            <div className="gm-combat-focus"><span>Сейчас ходит</span><strong>{current?.name ?? '—'}</strong></div>
            <div className="gm-combat-order">
              {order.map((actor, index) => (
                <div key={actor.id} className={index === runtime.combat_turn ? 'active' : ''}>
                  <span>{index + 1}</span><strong>{actor.name}</strong><small>{actor.system_data?.hp?.current ?? '—'} HP</small>
                </div>
              ))}
            </div>
            <button className="button primary full" disabled={busy} onClick={() => onCombat('next')}>Следующий ход →</button>
            <button className="button full" disabled={busy} onClick={() => onCombat('stop')}>Закончить бой</button>
          </>
        )}
      </section>
    </>
  );
}

function ActorInspector(props: Props) {
  const {
    campaignId,
    actors,
    selectedActorId,
    onSelectActor,
    inventories,
    containers,
    instances,
    items,
    runtime,
    onHp,
    onOpenWorkshop,
    onChanged,
    onMessage,
  } = props;
  const [view, setView] = useState<InspectorView>('sheet');
  const [deleting, setDeleting] = useState(false);
  const [dragged, setDragged] = useState<string | null>(null);
  const actor = actors.find((value) => value.id === selectedActorId) ?? null;
  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const inventory = inventories.find((value) => value.owner_actor_id === actor?.id);
  const actorContainers = inventory ? containers.filter((value) => value.inventory_id === inventory.id) : [];

  const deleteHero = async () => {
    if (!actor || actor.type !== 'player' || !window.confirm(`Удалить героя «${actor.name}» из кампании? Вместе с ним удалятся его фишки, лист и инвентарь. Игрок останется участником кампании.`)) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('delete_campaign_actor', { target_campaign: campaignId, target_actor: actor.id });
    if (error) onMessage(friendlyError(error, 'Не удалось удалить героя.'));
    else {
      onSelectActor('');
      onMessage(`Герой «${actor.name}» удалён.`);
      onChanged();
    }
    setDeleting(false);
  };

  const moveItem = async (containerId: string) => {
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

  if (!actor) {
    const heroes = actors.filter((value) => value.type === 'player').length;
    return (
      <div className="gm-inspector-empty">
        <span className="gm-inspector-sigil">✥</span>
        <h2>Ничего не выбрано</h2>
        <p>Выберите фишку на карте или персонажа в библиотеке — здесь появятся его лист, инвентарь и настройки.</p>
        <div className="gm-library-stats">
          <div><span>Герои</span><strong>{heroes}</strong></div>
          <div><span>NPC</span><strong>{actors.length - heroes}</strong></div>
          <div><span>Бой</span><strong>{runtime.combat_active ? `Раунд ${runtime.combat_round}` : 'Нет'}</strong></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="gm-inspector-head">
        <div className="gm-inspector-avatar">{actor.avatar || (actor.type === 'player' ? '🧙' : '👤')}</div>
        <div><span>{actor.type === 'player' ? 'ПЕРСОНАЖ ИГРОКА' : 'NPC'}</span><h2>{actor.name}</h2><p>{actor.subtitle || (actor.type === 'player' ? 'Персонаж игрока' : 'Персонаж мира')}</p></div>
        <button className="close-button" title="Снять выбор" onClick={() => onSelectActor('')}>×</button>
      </header>

      <nav className="gm-inspector-tabs" aria-label="Выбранный персонаж">
        <button className={view === 'sheet' ? 'active' : ''} onClick={() => setView('sheet')}>Лист</button>
        <button className={view === 'inventory' ? 'active' : ''} onClick={() => setView('inventory')}>Инвентарь</button>
        <button className={view === 'token' ? 'active' : ''} onClick={() => setView('token')}>Фишка</button>
      </nav>

      <div className="gm-inspector-body">
        {view === 'sheet' && (
          <>
            <section className="gm-inspector-card">
              <div className="gm-inspector-card-title"><strong>Быстрые параметры</strong><span>Контекст персонажа</span></div>
              {actor.system_data?.hp ? (
                <div className="gm-hp-control">
                  <div><span>Здоровье</span><strong>{actor.system_data.hp.current} / {actor.system_data.hp.max}</strong></div>
                  <div className="gm-hp-actions">
                    <button onClick={() => onHp(actor, -5)}>−5</button>
                    <button onClick={() => onHp(actor, -1)}>−1</button>
                    <button onClick={() => onHp(actor, 1)}>＋1</button>
                    <button onClick={() => onHp(actor, 5)}>＋5</button>
                  </div>
                </div>
              ) : <div className="online-small-empty">Для персонажа не задан ресурс здоровья.</div>}
              <div className="gm-quick-stats">
                <div><span>Броня</span><strong>{actor.system_data?.armor ?? actor.system_data?.ac ?? '—'}</strong></div>
                <div><span>Тип</span><strong>{actor.type === 'player' ? 'Герой' : 'NPC'}</strong></div>
              </div>
            </section>

            <div className="gm-inspector-note">Полный классический лист открывается кнопкой «Лист» в нижней панели. Выбор персонажа уже синхронизирован с ней.</div>
            {actor.type !== 'player' && <button className="button full" onClick={onOpenWorkshop}>⚒ Открыть NPC в мастерской</button>}
            {actor.type === 'player' && <button className="button danger full" disabled={deleting} onClick={() => void deleteHero()}>{deleting ? 'Удаление…' : 'Удалить героя'}</button>}
          </>
        )}

        {view === 'inventory' && (
          <>
            {!actorContainers.length && <div className="online-small-empty">У персонажа пока нет контейнеров инвентаря.</div>}
            {actorContainers.map((container) => {
              const rows = instances.filter((row) => row.container_id === container.id);
              return (
                <section className="inventory-container" key={container.id} onDragOver={(event) => event.preventDefault()} onDrop={() => void moveItem(container.id)}>
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
            <button className="button full" onClick={onOpenWorkshop}>⚒ Предметы и лут</button>
          </>
        )}

        {view === 'token' && (
          <section className="gm-inspector-card">
            <div className="gm-inspector-card-title"><strong>Фишка на сцене</strong><span>Контекст карты</span></div>
            <p className="muted">Размер, видимость, изображение и удаление фишки пока остаются в «Сцена → Настройки сцены». Этот раздел уже зарезервирован под перенос этих действий сюда следующим шагом.</p>
          </section>
        )}
      </div>
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
      <form className="gm-notes-editor" onSubmit={save}>
        <header className="gm-library-header"><div><span>ЗАМЕТКИ</span><h2>{selectedId ? 'Редактирование' : 'Новая заметка'}</h2></div></header>
        <input className="control full" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Заголовок" />
        <textarea className="control notes-area" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Текст заметки..." />
        <label><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} /> Закрепить</label>
        <button className="button primary full">Сохранить</button>
        <button type="button" className="button full" onClick={() => setEditing(false)}>Отмена</button>
      </form>
    );
  }

  return (
    <>
      <header className="gm-library-header"><div><span>БИБЛИОТЕКА</span><h2>Заметки</h2></div><button className="button" onClick={openNew}>＋</button></header>
      <div className="gm-note-list">
        {notes.map((note) => (
          <article className="note-card" key={note.id}>
            <strong>{note.pinned ? '📌 ' : ''}{note.title || 'Без названия'}</strong>
            <p>{note.body || 'Пустая заметка'}</p>
            <div><button className="button" onClick={() => openEdit(note)}>Править</button> <button className="button danger" onClick={() => void remove(note)}>Удалить</button></div>
          </article>
        ))}
      </div>
      {!notes.length && <div className="online-small-empty">Заметок пока нет.</div>}
    </>
  );
}
