'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';

type Actor = {
  id: string;
  type: string;
  name: string;
  subtitle: string;
  avatar: string;
  system_data: Record<string, any>;
};

type ItemDefinition = {
  id: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  icon: string;
  weight: number | null;
  price: number | null;
  currency: string | null;
  source: string | null;
  properties: Record<string, any>;
  effects: any[];
};

type RollTable = {
  id: string;
  name: string;
  die: string;
  rows: any;
};

type Props = {
  campaignId: string;
  // Kept until the parent table call is cleaned up; workshop no longer uses scene context.
  activeSceneId: string | null;
  actors: Actor[];
  items: ItemDefinition[];
  tables: RollTable[];
  selectedActorId: string;
  onSelectActor: (id: string) => void;
  onClose: () => void;
  onChanged: () => void;
  onMessage: (message: string) => void;
};

const tabs = [
  ['items', 'ПРЕДМЕТЫ'],
  ['loot', 'ЛУТ'],
  ['tables', 'ТАБЛИЦЫ'],
] as const;

type WorkshopTab = typeof tabs[number][0];

const rarityLabels: Record<string, string> = {
  common: 'Обычный',
  uncommon: 'Необычный',
  rare: 'Редкий',
  'very-rare': 'Очень редкий',
  legendary: 'Легендарный',
  artifact: 'Артефакт',
};

export function OnlineGmWorkshop(props: Props) {
  const [tab, setTab] = useState<WorkshopTab>('items');

  return (
    <section className="workshop-panel online-workshop-panel" data-wheel-isolation="true">
      <header className="workshop-header">
        <div className="workshop-title">МАСТЕРСКАЯ ДМа</div>
        <nav className="workshop-tabs">
          {tabs.map(([id, label]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>
        <div className="workshop-shortcuts">Всё сохраняется в кампании</div>
        <button className="close-button" onClick={props.onClose}>×</button>
      </header>
      <div className="workshop-module-body">
        {tab === 'items' && <OnlineItemWorkshop {...props} />}
        {tab === 'loot' && <OnlineLootWorkshop {...props} />}
        {tab === 'tables' && <OnlineTablesWorkshop {...props} />}
      </div>
    </section>
  );
}

function OnlineItemWorkshop({ campaignId, actors, items, selectedActorId, onSelectActor, onChanged, onMessage }: Props) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [rarity, setRarity] = useState('all');
  const [quantity, setQuantity] = useState(1);
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (selectedId && items.some((item) => item.id === selectedId)) return;
    setSelectedId(items[0]?.id ?? '');
  }, [items, selectedId]);

  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;
  const categories = useMemo(() => [...new Set(items.map((item) => item.category))].sort(), [items]);
  const filtered = useMemo(() => items.filter((item) => {
    const q = search.trim().toLowerCase();
    return (!q || item.name.toLowerCase().includes(q))
      && (category === 'all' || item.category === category)
      && (rarity === 'all' || item.rarity === rarity);
  }), [items, search, category, rarity]);
  const receivers = actors.filter((actor) => actor.type === 'player');
  const receiverId = receivers.some((actor) => actor.id === selectedActorId) ? selectedActorId : receivers[0]?.id ?? '';

  const save = async (item: ItemDraft) => {
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('save_item_definition', {
      target_campaign: campaignId,
      target_definition: item.id,
      item_name: item.name.trim(),
      item_description: item.description,
      item_category: item.category,
      item_rarity: item.rarity,
      item_icon: item.icon,
      item_weight: item.weight,
      item_price: item.price,
      item_currency: item.currency,
      item_source: item.source,
      item_properties: item.properties,
      item_effects: item.effects,
    });
    if (error) onMessage(friendlyError(error, 'Не удалось сохранить предмет.'));
    else {
      setDraft(null);
      if (typeof data === 'string') setSelectedId(data);
      onMessage('Предмет сохранён.');
      onChanged();
    }
    setBusy(false);
  };

  const duplicate = async () => {
    if (!selected) return;
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('duplicate_item_definition', {
      target_campaign: campaignId,
      target_definition: selected.id,
    });
    if (error) onMessage(friendlyError(error, 'Не удалось дублировать предмет.'));
    else {
      if (typeof data === 'string') setSelectedId(data);
      onChanged();
    }
    setBusy(false);
  };

  const remove = async () => {
    if (!selected || !window.confirm(`Удалить «${selected.name}» из библиотеки?`)) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('delete_item_definition', {
      target_campaign: campaignId,
      target_definition: selected.id,
    });
    if (error) {
      const message = String(error.message || '').toLowerCase().includes('item is in use')
        ? 'Этот предмет уже выдан персонажу. Сначала уберите его из инвентаря.'
        : friendlyError(error, 'Не удалось удалить предмет.');
      onMessage(message);
    } else {
      setSelectedId('');
      onChanged();
    }
    setBusy(false);
  };

  const give = async () => {
    if (!selected || !receiverId) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('give_item_definition', {
      target_campaign: campaignId,
      target_actor: receiverId,
      target_definition: selected.id,
      item_quantity: quantity,
    });
    if (error) onMessage(friendlyError(error, 'Не удалось выдать предмет.'));
    else {
      onMessage(`Выдано: ${selected.name} ×${quantity}`);
      onChanged();
    }
    setBusy(false);
  };

  if (draft) {
    return <OnlineItemBuilder draft={draft} busy={busy} onCancel={() => setDraft(null)} onSave={save} />;
  }

  return (
    <div className="workshop-content">
      <section className="item-library">
        <div className="library-search-row">
          <input data-item-search className="control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск предметов..." />
          <button className="button" onClick={() => setDraft(emptyItem())}>＋</button>
        </div>
        <div className="filter-row">
          <select className="control" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">Все типы</option>
            {categories.map((value) => <option key={value}>{value}</option>)}
          </select>
          <select className="control" value={rarity} onChange={(event) => setRarity(event.target.value)}>
            <option value="all">Все редкости</option>
            {Object.entries(rarityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="library-meta-row">
          <button className="button" onClick={() => setDraft(emptyItem())}>＋ Создать предмет</button>
          <span>Найдено: {filtered.length}</span>
        </div>
        <div className="item-card-grid">
          {filtered.map((item) => (
            <button key={item.id} className={`item-card ${selected?.id === item.id ? 'selected' : ''}`} onClick={() => setSelectedId(item.id)}>
              <span className="item-card-icon">{item.icon}</span>
              <strong>{item.name}</strong>
              <small className={`rarity rarity-${item.rarity}`}>{rarityLabels[item.rarity] ?? item.rarity} · {item.weight ?? 0}</small>
            </button>
          ))}
        </div>
      </section>

      {selected ? (
        <section className="item-inspector">
          <header className="inspector-header">
            <div><h2>{selected.name}</h2><p>{rarityLabels[selected.rarity] ?? selected.rarity} · {selected.category}</p></div>
            <button className="button" onClick={() => setDraft(fromItem(selected))}>✎ Редактировать</button>
          </header>
          <div className="inspector-grid">
            <div className="item-art">{selected.icon}</div>
            <div>
              <p className="description">{selected.description || 'Описание пока не добавлено.'}</p>
              <div className="stat-list">
                <div><span>Вес</span><b>{selected.weight ?? 0}</b></div>
                <div><span>Стоимость</span><b>{selected.price ?? 0} {selected.currency ?? ''}</b></div>
                <div><span>Источник</span><b>{selected.source ?? 'Собственный'}</b></div>
                {Object.entries(selected.properties ?? {}).map(([key, value]) => <div key={key}><span>{key}</span><b>{String(value)}</b></div>)}
              </div>
            </div>
            <div className="inspector-actions">
              <select className="control" value={receiverId} onChange={(event) => onSelectActor(event.target.value)}>
                {receivers.map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}
              </select>
              <div className="quantity-control">
                <button className="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button>
                <input className="control" type="number" min={1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} />
                <button className="button" onClick={() => setQuantity((value) => value + 1)}>＋</button>
              </div>
              <button className="button primary" disabled={busy || !receiverId} onClick={give}>Выдать</button>
              <button className="button" disabled={busy} onClick={() => setDraft(fromItem(selected))}>Редактировать</button>
              <button className="button" disabled={busy} onClick={duplicate}>Дублировать</button>
              <button className="button danger" disabled={busy} onClick={remove}>Удалить</button>
            </div>
          </div>
          <section className="effect-box">
            <h3>СВОЙСТВА И ЭФФЕКТЫ</h3>
            {Array.isArray(selected.effects) && selected.effects.length ? selected.effects.map((effect, index) => (
              <div className="effect-row" key={effect?.id ?? index}>
                <span className="effect-icon">{effect?.icon ?? '✦'}</span>
                <div><strong>{effect?.name ?? 'Эффект'}</strong><p>{effect?.description ?? ''}</p></div>
              </div>
            )) : <p className="muted">У предмета нет эффектов.</p>}
          </section>
        </section>
      ) : (
        <div className="placeholder-panel"><h2>Библиотека пуста</h2><button className="button primary" onClick={() => setDraft(emptyItem())}>Создать предмет</button></div>
      )}
    </div>
  );
}

type ItemDraft = Omit<ItemDefinition, 'id'> & { id: string | null };

function emptyItem(): ItemDraft {
  return {
    id: null,
    name: 'Новый предмет',
    description: '',
    category: 'Снаряжение',
    rarity: 'common',
    icon: '📦',
    weight: 0,
    price: 0,
    currency: '',
    source: 'Собственный',
    properties: {},
    effects: [],
  };
}

function fromItem(item: ItemDefinition): ItemDraft {
  return JSON.parse(JSON.stringify(item)) as ItemDraft;
}

function OnlineItemBuilder({ draft, busy, onCancel, onSave }: { draft: ItemDraft; busy: boolean; onCancel: () => void; onSave: (item: ItemDraft) => void }) {
  const [item, setItem] = useState<ItemDraft>(() => JSON.parse(JSON.stringify(draft)) as ItemDraft);
  const [propertyKey, setPropertyKey] = useState('');
  const [propertyValue, setPropertyValue] = useState('');
  const [effectName, setEffectName] = useState('');
  const [effectDescription, setEffectDescription] = useState('');

  const patch = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) => setItem((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (item.name.trim()) onSave(item);
  };

  return (
    <form className="builder-view" onSubmit={submit}>
      <header className="builder-head"><div><h2>КОНСТРУКТОР ПРЕДМЕТА</h2><p>Предмет сохранится в библиотеке этой кампании.</p></div><button type="button" className="button" onClick={onCancel}>← К просмотру</button></header>
      <div className="builder-scroll">
        <section className="builder-section">
          <h3>ОСНОВНОЕ</h3>
          <div className="builder-grid">
            <Field label="Название"><input required value={item.name} onChange={(e) => patch('name', e.target.value)} /></Field>
            <Field label="Иконка"><input value={item.icon} onChange={(e) => patch('icon', e.target.value)} /></Field>
            <Field label="Тип"><input value={item.category} onChange={(e) => patch('category', e.target.value)} /></Field>
            <Field label="Редкость"><select value={item.rarity} onChange={(e) => patch('rarity', e.target.value)}>{Object.entries(rarityLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Стоимость"><input type="number" value={item.price ?? 0} onChange={(e) => patch('price', Number(e.target.value))} /></Field>
            <Field label="Валюта"><input value={item.currency ?? ''} onChange={(e) => patch('currency', e.target.value)} /></Field>
            <Field label="Вес"><input type="number" step="0.1" value={item.weight ?? 0} onChange={(e) => patch('weight', Number(e.target.value))} /></Field>
            <Field label="Источник"><input value={item.source ?? ''} onChange={(e) => patch('source', e.target.value)} /></Field>
            <Field label="Описание" full><textarea value={item.description} onChange={(e) => patch('description', e.target.value)} /></Field>
          </div>
        </section>
        <section className="builder-section">
          <h3>ХАРАКТЕРИСТИКИ</h3>
          <div className="property-list">
            {Object.entries(item.properties).map(([key,value]) => <div className="property-chip" key={key}><b>{key}</b><span>{String(value)}</span><button type="button" onClick={() => setItem((current) => { const properties={...current.properties}; delete properties[key]; return {...current,properties}; })}>×</button></div>)}
          </div>
          <div className="inline-form three"><input value={propertyKey} onChange={(e) => setPropertyKey(e.target.value)} placeholder="Название"/><input value={propertyValue} onChange={(e) => setPropertyValue(e.target.value)} placeholder="Значение"/><button type="button" className="button" onClick={() => { const key=propertyKey.trim(); if(!key)return; setItem((current)=>({...current,properties:{...current.properties,[key]:propertyValue}})); setPropertyKey(''); setPropertyValue(''); }}>Добавить</button></div>
        </section>
        <section className="builder-section">
          <h3>ЭФФЕКТЫ</h3>
          {item.effects.map((effect,index) => <div className="effect-row editable" key={effect?.id ?? index}><span className="effect-icon">{effect?.icon ?? '✦'}</span><div><strong>{effect?.name ?? 'Эффект'}</strong><p>{effect?.description ?? ''}</p></div><button type="button" className="close-button tiny" onClick={() => setItem((current)=>({...current,effects:current.effects.filter((_,i)=>i!==index)}))}>×</button></div>)}
          <div className="inline-form effect-form"><input value={effectName} onChange={(e)=>setEffectName(e.target.value)} placeholder="Название эффекта"/><input value={effectDescription} onChange={(e)=>setEffectDescription(e.target.value)} placeholder="Описание"/><button type="button" className="button" onClick={() => { if(!effectName.trim())return; setItem((current)=>({...current,effects:[...current.effects,{id:`effect-${Date.now()}`,name:effectName.trim(),description:effectDescription.trim(),icon:'✦'}]})); setEffectName(''); setEffectDescription(''); }}>＋ Эффект</button></div>
        </section>
      </div>
      <footer className="builder-actions"><button type="button" className="button" onClick={onCancel}>Отмена</button><button className="button primary" disabled={busy}>Сохранить предмет</button></footer>
    </form>
  );
}

function OnlineLootWorkshop({ campaignId, actors, items, onChanged, onMessage }: Props) {
  const receivers = actors.filter((actor)=>actor.type==='player');
  const [actorId,setActorId]=useState(receivers[0]?.id ?? '');
  const [lootIds,setLootIds]=useState<string[]>([]);
  const [gold,setGold]=useState(0);
  const [busy,setBusy]=useState(false);
  const loot=lootIds.map((id)=>items.find((item)=>item.id===id)).filter((item): item is ItemDefinition=>Boolean(item));

  const addRandom=()=>{ if(!items.length)return; setLootIds((value)=>[...value,items[Math.floor(Math.random()*items.length)].id]); };
  const distribute=async()=>{
    if(!actorId || !loot.length)return;
    setBusy(true);
    const supabase=createClient();
    const results=await Promise.all(loot.map((item)=>supabase.rpc('give_item_definition',{target_campaign:campaignId,target_actor:actorId,target_definition:item.id,item_quantity:1})));
    const failed=results.find((result)=>result.error)?.error;
    if(failed) onMessage(friendlyError(failed,'Не удалось выдать весь лут.'));
    else {
      if(gold>0) await supabase.rpc('create_gm_note',{target_campaign:campaignId,note_title:'Выдан лут',note_body:`Монеты: ${gold}. Получатель: ${receivers.find((actor)=>actor.id===actorId)?.name ?? 'персонаж'}.`,note_pinned:false});
      onMessage(`Выдано предметов: ${loot.length}${gold>0?` · ${gold} монет записано в заметки`:''}.`);
      setLootIds([]);
      onChanged();
    }
    setBusy(false);
  };

  return <div className="loot-layout"><section className="builder-section loot-builder"><div className="inspector-header"><div><h2>Набор лута</h2><p>Соберите награду из библиотеки кампании.</p></div><button className="button" onClick={addRandom}>🎲 Случайный предмет</button></div><div className="loot-coins"><label><span>Монеты</span><input className="control" type="number" min={0} value={gold} onChange={(e)=>setGold(Math.max(0,Number(e.target.value)||0))}/></label><span className="coin-pill">{gold}</span></div><div className="inline-form"><select className="control" defaultValue="" onChange={(e)=>{if(e.target.value){setLootIds((value)=>[...value,e.target.value]);e.target.value='';}}}><option value="">＋ Добавить предмет…</option>{items.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="loot-items">{loot.map((item,index)=><div className="loot-row" key={`${item.id}-${index}`}><span className="inventory-icon">{item.icon}</span><span><strong>{item.name}</strong><small>{item.category}</small></span><button className="close-button tiny" onClick={()=>setLootIds((ids)=>ids.filter((_,i)=>i!==index))}>×</button></div>)}{!loot.length&&<div className="empty-drop">Добавьте предметы из библиотеки.</div>}</div></section><aside className="loot-delivery"><span className="eyebrow">ВЫДАЧА</span><h2>Кому передать?</h2><select className="control full" value={actorId} onChange={(e)=>setActorId(e.target.value)}>{receivers.map((actor)=><option key={actor.id} value={actor.id}>{actor.name}</option>)}</select><div className="loot-summary"><div><span>Предметов</span><b>{loot.length}</b></div><div><span>Монет</span><b>{gold}</b></div></div><button className="button primary full" disabled={busy||!loot.length||!actorId} onClick={distribute}>Выдать лут</button></aside></div>;
}

function OnlineTablesWorkshop({ campaignId, tables, onChanged, onMessage }: Props) {
  const [selectedId,setSelectedId]=useState(tables[0]?.id ?? '');
  const [editing,setEditing]=useState(false);
  const [name,setName]=useState('');
  const [die,setDie]=useState('d6');
  const [rowsText,setRowsText]=useState('');
  const [history,setHistory]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);

  useEffect(()=>{if(selectedId&&tables.some((table)=>table.id===selectedId))return;setSelectedId(tables[0]?.id??'');},[tables,selectedId]);
  const selected=tables.find((table)=>table.id===selectedId)??tables[0]??null;
  const rows=tableRows(selected?.rows);
  const openEdit=(table:RollTable|null)=>{setName(table?.name??'Новая таблица');setDie(table?.die??'d6');setRowsText(tableRows(table?.rows).join('\n'));setEditing(true);if(!table)setSelectedId('');};
  const save=async(event:FormEvent)=>{event.preventDefault();setBusy(true);const supabase=createClient();const rowsValue=rowsText.split('\n').map((row)=>row.trim()).filter(Boolean);const {data,error}=await supabase.rpc('save_roll_table',{target_campaign:campaignId,target_table:selected?.id??null,table_name:name,table_die:die,table_rows:rowsValue});if(error)onMessage(friendlyError(error,'Не удалось сохранить таблицу.'));else{if(typeof data==='string')setSelectedId(data);setEditing(false);onChanged();}setBusy(false);};
  const remove=async()=>{if(!selected||!window.confirm(`Удалить таблицу «${selected.name}»?`))return;setBusy(true);const supabase=createClient();const {error}=await supabase.rpc('delete_roll_table',{target_campaign:campaignId,target_table:selected.id});if(error)onMessage(friendlyError(error,'Не удалось удалить таблицу.'));else{setSelectedId('');onChanged();}setBusy(false);};
  const roll=()=>{if(!rows.length)return;const index=Math.floor(Math.random()*rows.length);setHistory((value)=>[`${index+1} — ${rows[index]}`,...value].slice(0,8));};

  if(editing)return <form className="builder-view" onSubmit={save}><header className="builder-head"><div><h2>ТАБЛИЦА</h2><p>По одному результату на строку.</p></div><button type="button" className="button" onClick={()=>setEditing(false)}>← Назад</button></header><div className="builder-scroll"><section className="builder-section"><div className="builder-grid"><Field label="Название"><input required value={name} onChange={(e)=>setName(e.target.value)}/></Field><Field label="Кость"><input value={die} onChange={(e)=>setDie(e.target.value)}/></Field><Field label="Результаты" full><textarea rows={12} value={rowsText} onChange={(e)=>setRowsText(e.target.value)}/></Field></div></section></div><footer className="builder-actions"><button type="button" className="button" onClick={()=>setEditing(false)}>Отмена</button><button className="button primary" disabled={busy}>Сохранить</button></footer></form>;

  return <div className="module-split tables-module"><section className="module-list"><div className="library-meta-row"><strong>Таблицы</strong><button className="button" onClick={()=>openEdit(null)}>＋ Создать</button></div><div className="module-list-scroll">{tables.map((table)=><button key={table.id} className={`module-row ${selected?.id===table.id?'selected':''}`} onClick={()=>setSelectedId(table.id)}><span className="module-avatar">🎲</span><span><strong>{table.name}</strong><small>{table.die} · {tableRows(table.rows).length} результатов</small></span></button>)}{!tables.length&&<div className="online-small-empty">Таблиц пока нет.</div>}</div></section><section className="module-detail">{selected?<><div className="inspector-header"><div><h2>{selected.name}</h2><p>Бросок {selected.die}</p></div><button className="button primary" onClick={roll}>🎲 Бросить</button></div><div className="roll-table">{rows.map((row,index)=><div key={`${row}-${index}`}><b>{index+1}</b><span>{row}</span></div>)}</div><div className="module-actions"><button className="button" onClick={()=>openEdit(selected)}>Редактировать</button><button className="button danger" disabled={busy} onClick={remove}>Удалить</button></div><div className="builder-section compact-section"><h3>ИСТОРИЯ БРОСКОВ</h3>{history.length?history.map((entry,index)=><div className="history-entry" key={`${entry}-${index}`}>{entry}</div>):<p className="muted">Бросков пока не было.</p>}</div></>:<div className="placeholder-panel"><h2>Создайте первую таблицу</h2></div>}</section></div>;
}

function tableRows(value:any):string[]{
  if(Array.isArray(value))return value.map((row)=>typeof row==='string'?row:typeof row?.text==='string'?row.text:String(row)).filter(Boolean);
  return [];
}

function Field({label,full=false,children}:{label:string;full?:boolean;children:React.ReactNode}){
  return <label className={`builder-field ${full?'full-span':''}`}><span>{label}</span>{children}</label>;
}
