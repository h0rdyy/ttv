'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { ItemDefinition, Rarity } from '@/domain/types';
import { actors } from '@/data/demo';
import { useCampaignStore } from '@/store/useCampaignStore';

const rarityLabel: Record<Rarity, string> = {
  common: 'Обычный',
  uncommon: 'Необычный',
  rare: 'Редкий',
  'very-rare': 'Очень редкий',
  legendary: 'Легендарный',
  artifact: 'Артефакт',
};

const emptyItem = (): ItemDefinition => ({
  id: `custom-${Date.now()}`,
  systemId: 'generic-fantasy',
  name: 'Новый предмет',
  description: '',
  category: 'Снаряжение',
  rarity: 'common',
  icon: '📦',
  weight: 0,
  price: 0,
  currency: 'зм',
  source: 'Собственный',
  properties: {},
  effects: [],
});

export function ItemWorkshop() {
  const {
    selectedActorId,
    selectedItemId,
    itemDefinitions,
    builderOpen,
    setItem,
    setBuilderOpen,
    upsertItem,
    duplicateItem,
    deleteItem,
    giveItem,
  } = useCampaignStore();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [rarity, setRarity] = useState('all');
  const [quantity, setQuantity] = useState(1);
  const [draft, setDraft] = useState<ItemDefinition | null>(null);

  const filtered = useMemo(() => itemDefinitions.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || item.category === category;
    const matchesRarity = rarity === 'all' || item.rarity === rarity;
    return matchesSearch && matchesCategory && matchesRarity;
  }), [itemDefinitions, search, category, rarity]);

  const selected = itemDefinitions.find((item) => item.id === selectedItemId) ?? itemDefinitions[0];
  const categories = Array.from(new Set(itemDefinitions.map((item) => item.category))).sort();

  const openCreate = () => {
    setDraft(emptyItem());
    setBuilderOpen(true);
  };

  const openEdit = (item: ItemDefinition) => {
    setDraft(JSON.parse(JSON.stringify(item)) as ItemDefinition);
    setBuilderOpen(true);
  };

  if (builderOpen) {
    return (
      <ItemBuilder
        draft={draft ?? selected ?? emptyItem()}
        onCancel={() => { setDraft(null); setBuilderOpen(false); }}
        onSave={(item) => { upsertItem(item); setDraft(null); }}
      />
    );
  }

  return (
    <div className="workshop-content">
      <section className="item-library">
        <div className="library-search-row">
          <input data-item-search className="control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск предметов..." />
          <button className="button" onClick={openCreate}>＋</button>
        </div>
        <div className="filter-row">
          <select className="control" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">Все типы</option>
            {categories.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select className="control" value={rarity} onChange={(event) => setRarity(event.target.value)}>
            <option value="all">Все редкости</option>
            {Object.entries(rarityLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="control" defaultValue="name">
            <option value="name">По названию</option>
            <option value="rarity">По редкости</option>
            <option value="weight">По весу</option>
          </select>
        </div>
        <div className="library-meta-row">
          <button className="button" onClick={openCreate}>＋ Создать предмет</button>
          <span>Найдено: {filtered.length}</span>
        </div>
        <div className="item-card-grid">
          {filtered.map((item) => (
            <button key={item.id} className={`item-card ${selected?.id === item.id ? 'selected' : ''}`} onClick={() => setItem(item.id)}>
              <span className="item-card-icon">{item.icon}</span>
              <strong>{item.name}</strong>
              <small className={`rarity rarity-${item.rarity}`}>{rarityLabel[item.rarity]} · {item.weight ?? 0} фн</small>
            </button>
          ))}
        </div>
      </section>

      {selected ? (
        <section className="item-inspector">
          <header className="inspector-header">
            <div>
              <h2>{selected.name}</h2>
              <p><span className={`rarity rarity-${selected.rarity}`}>{rarityLabel[selected.rarity]}</span> · {selected.category}</p>
            </div>
            <button className="button" onClick={() => openEdit(selected)}>✎ Редактировать</button>
          </header>

          <div className="inspector-grid">
            <div className="item-art">{selected.icon}</div>
            <div>
              <p className="description">{selected.description || 'Описание пока не добавлено.'}</p>
              <div className="stat-list">
                <div><span>Вес</span><b>{selected.weight ?? 0} фн</b></div>
                <div><span>Стоимость</span><b>{selected.price ?? 0} {selected.currency ?? ''}</b></div>
                <div><span>Источник</span><b>{selected.source ?? 'Собственный'}</b></div>
                {Object.entries(selected.properties).map(([key, value]) => <div key={key}><span>{key}</span><b>{String(value)}</b></div>)}
              </div>
            </div>
            <div className="inspector-actions">
              <select className="control" value={selectedActorId} onChange={(event) => useCampaignStore.getState().setActor(event.target.value)}>
                {actors.filter((actor) => actor.type === 'player').map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}
              </select>
              <div className="quantity-control">
                <button className="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button>
                <input className="control" type="number" min={1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} />
                <button className="button" onClick={() => setQuantity((value) => value + 1)}>＋</button>
              </div>
              <button className="button primary" onClick={() => giveItem(selectedActorId, selected.id, quantity)}>Выдать</button>
              <button className="button" onClick={() => openEdit(selected)}>Редактировать</button>
              <button className="button" onClick={() => duplicateItem(selected.id)}>Дублировать</button>
              <button className="button danger" onClick={() => deleteItem(selected.id)}>Удалить</button>
            </div>
          </div>

          <section className="effect-box">
            <h3>СВОЙСТВА И ЭФФЕКТЫ</h3>
            {selected.effects.length ? selected.effects.map((effect) => (
              <div className="effect-row" key={effect.id}>
                <span className="effect-icon">{effect.icon ?? '✦'}</span>
                <div><strong>{effect.name}</strong><p>{effect.description}</p></div>
              </div>
            )) : <p className="muted">У предмета нет структурированных эффектов.</p>}
          </section>
        </section>
      ) : <div className="placeholder-panel"><h2>Библиотека пуста</h2><button className="button primary" onClick={openCreate}>Создать предмет</button></div>}
    </div>
  );
}

function ItemBuilder({ draft, onCancel, onSave }: { draft: ItemDefinition; onCancel: () => void; onSave: (item: ItemDefinition) => void }) {
  const [item, setItem] = useState<ItemDefinition>(() => JSON.parse(JSON.stringify(draft)) as ItemDefinition);
  const [propertyKey, setPropertyKey] = useState('damage');
  const [propertyValue, setPropertyValue] = useState('');
  const [effectName, setEffectName] = useState('');
  const [effectDescription, setEffectDescription] = useState('');

  const patch = <K extends keyof ItemDefinition>(key: K, value: ItemDefinition[K]) => setItem((current) => ({ ...current, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!item.name.trim()) return;
    onSave({ ...item, name: item.name.trim() });
  };

  const addProperty = () => {
    const key = propertyKey.trim();
    if (!key) return;
    setItem((current) => ({ ...current, properties: { ...current.properties, [key]: propertyValue } }));
    setPropertyValue('');
  };

  const addEffect = () => {
    if (!effectName.trim()) return;
    setItem((current) => ({
      ...current,
      effects: [...current.effects, { id: `effect-${Date.now()}`, name: effectName.trim(), description: effectDescription.trim(), icon: '✦' }]
    }));
    setEffectName('');
    setEffectDescription('');
  };

  return (
    <form className="builder-view" onSubmit={submit}>
      <header className="builder-head">
        <div><h2>КОНСТРУКТОР ПРЕДМЕТА</h2><p>Изменения сохраняются в локальной библиотеке кампании.</p></div>
        <button type="button" className="button" onClick={onCancel}>← К просмотру</button>
      </header>

      <div className="builder-scroll">
        <section className="builder-section">
          <h3>ОСНОВНОЕ</h3>
          <div className="builder-grid">
            <Field label="Название"><input value={item.name} onChange={(event) => patch('name', event.target.value)} /></Field>
            <Field label="Иконка"><input value={item.icon} onChange={(event) => patch('icon', event.target.value)} /></Field>
            <Field label="Тип"><input value={item.category} onChange={(event) => patch('category', event.target.value)} /></Field>
            <Field label="Редкость"><select value={item.rarity} onChange={(event) => patch('rarity', event.target.value as Rarity)}>{Object.entries(rarityLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Стоимость"><input type="number" value={item.price ?? 0} onChange={(event) => patch('price', Number(event.target.value))} /></Field>
            <Field label="Валюта"><input value={item.currency ?? ''} onChange={(event) => patch('currency', event.target.value)} /></Field>
            <Field label="Вес"><input type="number" step="0.1" value={item.weight ?? 0} onChange={(event) => patch('weight', Number(event.target.value))} /></Field>
            <Field label="Источник"><input value={item.source ?? ''} onChange={(event) => patch('source', event.target.value)} /></Field>
            <Field label="Описание" full><textarea value={item.description} onChange={(event) => patch('description', event.target.value)} /></Field>
          </div>
        </section>

        <section className="builder-section">
          <h3>ХАРАКТЕРИСТИКИ</h3>
          <div className="property-list">
            {Object.entries(item.properties).map(([key, value]) => (
              <div key={key} className="property-chip"><b>{key}</b><span>{String(value)}</span><button type="button" onClick={() => setItem((current) => { const properties = { ...current.properties }; delete properties[key]; return { ...current, properties }; })}>×</button></div>
            ))}
          </div>
          <div className="inline-form three">
            <input value={propertyKey} onChange={(event) => setPropertyKey(event.target.value)} placeholder="Ключ, например damage" />
            <input value={propertyValue} onChange={(event) => setPropertyValue(event.target.value)} placeholder="Значение" />
            <button type="button" className="button" onClick={addProperty}>Добавить</button>
          </div>
        </section>

        <section className="builder-section">
          <h3>ЭФФЕКТЫ</h3>
          {item.effects.map((effect, index) => (
            <div className="effect-row editable" key={effect.id}>
              <span className="effect-icon">{effect.icon ?? '✦'}</span>
              <div><strong>{effect.name}</strong><p>{effect.description}</p></div>
              <button type="button" className="close-button tiny" onClick={() => setItem((current) => ({ ...current, effects: current.effects.filter((_, i) => i !== index) }))}>×</button>
            </div>
          ))}
          <div className="inline-form effect-form">
            <input value={effectName} onChange={(event) => setEffectName(event.target.value)} placeholder="Название эффекта" />
            <input value={effectDescription} onChange={(event) => setEffectDescription(event.target.value)} placeholder="Краткое описание" />
            <button type="button" className="button" onClick={addEffect}>＋ Эффект</button>
          </div>
        </section>
      </div>

      <footer className="builder-actions">
        <button type="button" className="button" onClick={onCancel}>Отмена</button>
        <button className="button primary" type="submit">Сохранить предмет</button>
      </footer>
    </form>
  );
}

function Field({ label, full = false, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return <label className={`builder-field ${full ? 'full-span' : ''}`}><span>{label}</span>{children}</label>;
}
