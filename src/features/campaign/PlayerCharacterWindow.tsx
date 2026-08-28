'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';
import type { SheetActor } from './OnlineActorSheet';
import {
  classicFantasySheetSchema,
  normalizeSheetSchema,
  type ActorSheetTemplate,
  type SheetField,
  type SheetSection,
  type SheetSectionSlot,
} from './actorSheets';
import { actorMovementSpeed } from './movement';
import { TabletopIcon } from './TabletopIcon';

type Inventory = { id: string; owner_actor_id: string };
type Container = { id: string; inventory_id: string; name: string; type: string; sort_order: number };
type ItemInstance = { id: string; definition_id: string; container_id: string; quantity: number; custom_name: string | null; equipped: boolean };
type ItemDefinition = { id: string; name: string; icon: string; category: string; rarity: string };

type CharacterTab = 'overview' | 'skills' | 'combat' | 'inventory' | 'features' | 'bio' | 'custom';

type Props = {
  actor: SheetActor;
  template: ActorSheetTemplate | null;
  inventory: Inventory | null;
  containers: Container[];
  instances: ItemInstance[];
  items: ItemDefinition[];
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
  onMessage: (message: string) => void;
};

const TAB_DEFINITIONS: Array<{ id: CharacterTab; label: string; slots: SheetSectionSlot[] }> = [
  { id: 'overview', label: 'Обзор', slots: ['identity', 'training', 'abilities', 'health'] },
  { id: 'skills', label: 'Навыки', slots: ['saves', 'skills', 'proficiencies'] },
  { id: 'combat', label: 'Бой', slots: ['combat', 'attacks'] },
  { id: 'inventory', label: 'Инвентарь', slots: ['equipment'] },
  { id: 'features', label: 'Особенности', slots: ['features'] },
  { id: 'bio', label: 'Биография', slots: ['traits'] },
  { id: 'custom', label: 'Доп.', slots: ['custom'] },
];

export function PlayerCharacterWindow({
  actor,
  template,
  inventory,
  containers,
  instances,
  items,
  canEdit,
  onClose,
  onChanged,
  onMessage,
}: Props) {
  const [data, setData] = useState<Record<string, any>>(() => clone(actor.system_data));
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<CharacterTab>('overview');
  const [confirmClose, setConfirmClose] = useState(false);
  const loadedActorIdRef = useRef(actor.id);
  const pendingSavedRef = useRef(new Map<string, unknown>());

  const schema = useMemo(
    () => template ? normalizeSheetSchema(template.schema) : classicFantasySheetSchema(),
    [template],
  );

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const sortedContainers = useMemo(
    () => containers.filter((container) => container.inventory_id === inventory?.id).sort((a, b) => a.sort_order - b.sort_order),
    [containers, inventory?.id],
  );

  const availableTabs = useMemo(() => TAB_DEFINITIONS.filter((definition) => {
    if (definition.id === 'overview') return true;
    if (definition.id === 'inventory' && inventory) return true;
    return schema.sections.some((section) => definition.slots.includes(section.slot ?? 'custom'));
  }), [inventory, schema.sections]);

  useEffect(() => {
    if (availableTabs.some((definition) => definition.id === tab)) return;
    setTab(availableTabs[0]?.id ?? 'overview');
  }, [availableTabs, tab]);

  useEffect(() => {
    if (loadedActorIdRef.current !== actor.id) {
      loadedActorIdRef.current = actor.id;
      pendingSavedRef.current.clear();
      setData(clone(actor.system_data));
      setDirtyKeys(new Set());
      setConfirmClose(false);
      return;
    }

    setData((current) => {
      const incoming = clone(actor.system_data);
      for (const [key, savedValue] of pendingSavedRef.current) {
        if (sameValue(incoming[key], savedValue)) pendingSavedRef.current.delete(key);
        else incoming[key] = cloneValue(savedValue);
      }
      for (const key of dirtyKeys) {
        if (Object.prototype.hasOwnProperty.call(current, key)) incoming[key] = current[key];
      }
      return incoming;
    });
  }, [actor.id, actor.system_data, dirtyKeys]);

  const requestClose = () => {
    if (dirtyKeys.size > 0) {
      setConfirmClose(true);
      return;
    }
    onClose();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (confirmClose) setConfirmClose(false);
      else requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const patch = (key: string, value: unknown) => {
    pendingSavedRef.current.delete(key);
    setData((current) => ({ ...current, [key]: value }));
    setDirtyKeys((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });
  };

  const save = async () => {
    if (!canEdit || !template || dirtyKeys.size === 0) return;
    setBusy(true);
    const keys = [...dirtyKeys];
    const patchData = keys.reduce<Record<string, unknown>>((result, key) => {
      result[key] = data[key];
      return result;
    }, {});
    const supabase = createClient();
    const { data: saved, error } = await supabase.rpc('update_actor_sheet', {
      target_actor: actor.id,
      actor_system_data: patchData,
    });
    if (error) onMessage(friendlyError(error, 'Не удалось сохранить персонажа.'));
    else {
      const savedData = saved && typeof saved === 'object' ? saved as Record<string, any> : { ...data };
      for (const key of keys) pendingSavedRef.current.set(key, cloneValue(savedData[key]));
      setData(clone(savedData));
      setDirtyKeys(new Set());
      setConfirmClose(false);
      onMessage('Персонаж сохранён.');
      onChanged();
    }
    setBusy(false);
  };

  const hp = resourceValue(data, 'hit_points', 'hp');
  const hpCurrent = numericValue(hp?.current, 0);
  const hpMax = numericValue(hp?.max, 0);
  const armorClass = numericValue(data.armor_class ?? data.armor, 10);
  const initiative = numericValue(data.initiative, 0);
  const speed = actorMovementSpeed(data);
  const identity = compactIdentity(data);
  const activeDefinition = TAB_DEFINITIONS.find((definition) => definition.id === tab) ?? TAB_DEFINITIONS[0];
  const visibleSections = schema.sections.filter((section) => activeDefinition.slots.includes(section.slot ?? 'custom'));

  return (
    <>
      <section className="foundry-character-window" data-wheel-isolation="true" role="dialog" aria-modal="true" aria-label={`Персонаж ${actor.name}`}>
        <header className="foundry-character-head">
          <div className="foundry-character-portrait">{actor.avatar || '🧙'}</div>
          <div className="foundry-character-title">
            <span>ПЕРСОНАЖ</span>
            <h2>{actor.name}</h2>
            <p>{identity || actor.subtitle || 'Персонаж кампании'}</p>
          </div>
          <div className="foundry-quick-stats" aria-label="Быстрые характеристики">
            <QuickStat label="HP" value={hpMax > 0 ? `${hpCurrent} / ${hpMax}` : '— / —'} accent="health" />
            <QuickStat label="КД" value={String(armorClass)} />
            <QuickStat label="Скорость" value={`${speed} ft`} />
            <QuickStat label="Инициатива" value={signed(initiative)} />
          </div>
          <button className="foundry-character-close" type="button" onClick={requestClose} aria-label="Закрыть окно персонажа"><TabletopIcon name="close" /></button>
        </header>

        <nav className="foundry-character-tabs" aria-label="Разделы персонажа">
          {availableTabs.map((definition) => (
            <button key={definition.id} type="button" className={tab === definition.id ? 'active' : ''} onClick={() => setTab(definition.id)}>
              {definition.label}
            </button>
          ))}
        </nav>

        <div className="foundry-character-body">
          {tab === 'overview' && <OverviewStrip data={data} />}

          {tab === 'inventory' && inventory && (
            <InventoryView containers={sortedContainers} instances={instances} itemById={itemById} />
          )}

          <div className={`foundry-section-grid foundry-tab-${tab}`}>
            {visibleSections.map((section) => (
              <CharacterSection
                key={section.id}
                section={section}
                data={data}
                disabled={!canEdit || busy || !template}
                onPatch={patch}
              />
            ))}
          </div>

          {visibleSections.length === 0 && tab !== 'inventory' && (
            <div className="foundry-character-empty">
              <strong>В этом разделе пока нет полей.</strong>
              <span>Мастер может добавить их в шаблон листа, и они появятся здесь автоматически.</span>
            </div>
          )}
        </div>

        <footer className="foundry-character-footer">
          <span>
            {!template ? 'Мастер ещё не назначил шаблон листа.' : dirtyKeys.size > 0 ? `Изменено полей: ${dirtyKeys.size}` : 'Все изменения сохранены.'}
          </span>
          <div>
            <button className="button" type="button" onClick={requestClose}>Закрыть</button>
            {canEdit && template && (
              <button className="button primary" type="button" disabled={busy || dirtyKeys.size === 0} onClick={() => void save()}>
                {busy ? 'Сохраняем…' : dirtyKeys.size > 0 ? 'Сохранить' : 'Сохранено'}
              </button>
            )}
          </div>
        </footer>
      </section>

      {confirmClose && (
        <div className="foundry-confirm-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) setConfirmClose(false); }}>
          <section className="foundry-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="character-close-title" aria-describedby="character-close-description">
            <div className="foundry-confirm-icon"><TabletopIcon name="sheet" /></div>
            <div>
              <small>НЕСОХРАНЁННЫЕ ИЗМЕНЕНИЯ</small>
              <h3 id="character-close-title">Закрыть лист персонажа?</h3>
              <p id="character-close-description">Изменения в «{actor.name}» не сохранены. Можно вернуться к листу или закрыть его без сохранения.</p>
            </div>
            <footer>
              <button type="button" className="button" onClick={() => setConfirmClose(false)}>Продолжить редактирование</button>
              <button type="button" className="button danger" onClick={() => { setConfirmClose(false); onClose(); }}>Закрыть без сохранения</button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

function QuickStat({ label, value, accent = '' }: { label: string; value: string; accent?: string }) {
  return <div className={`foundry-quick-stat ${accent}`}><span>{label}</span><strong>{value}</strong></div>;
}

function OverviewStrip({ data }: { data: Record<string, any> }) {
  const values = [
    ['Класс / уровень', textValue(data.class_level)],
    ['Происхождение', textValue(data.ancestry)],
    ['Предыстория', textValue(data.background)],
    ['Мировоззрение', textValue(data.alignment)],
  ].filter(([, value]) => value);
  if (values.length === 0) return null;
  return (
    <div className="foundry-identity-strip">
      {values.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </div>
  );
}

function CharacterSection({
  section,
  data,
  disabled,
  onPatch,
}: {
  section: SheetSection;
  data: Record<string, any>;
  disabled: boolean;
  onPatch: (key: string, value: unknown) => void;
}) {
  return (
    <section className={`foundry-character-section slot-${section.slot ?? 'custom'}`}>
      <h3>{section.title}</h3>
      <div className="foundry-section-fields">
        {section.fields.map((field) => (
          <CharacterField
            key={field.id}
            field={field}
            value={fieldValue(data, field)}
            disabled={disabled}
            onChange={(value) => onPatch(field.key, value)}
          />
        ))}
      </div>
    </section>
  );
}

function CharacterField({ field, value, disabled, onChange }: { field: SheetField; value: unknown; disabled: boolean; onChange: (value: unknown) => void }) {
  if (field.type === 'ability') {
    const score = numericValue(value, 10);
    return (
      <label className="foundry-field foundry-ability">
        <span>{field.label}</span>
        <strong>{signed(Math.floor((score - 10) / 2))}</strong>
        <input type="number" value={score} disabled={disabled} onChange={(event) => onChange(numericInput(event.target.value, 10))} />
      </label>
    );
  }

  if (field.type === 'skill') {
    const skill = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const bonus = numericValue(skill.bonus ?? value, 0);
    return (
      <label className="foundry-field foundry-skill">
        <input type="checkbox" checked={Boolean(skill.proficient)} disabled={disabled} onChange={(event) => onChange({ ...skill, bonus, proficient: event.target.checked })} />
        <span><strong>{field.label}</strong>{field.hint && <small>{field.hint}</small>}</span>
        <input type="number" value={bonus} disabled={disabled} onChange={(event) => onChange({ ...skill, bonus: numericInput(event.target.value), proficient: Boolean(skill.proficient) })} aria-label={`${field.label}: бонус`} />
      </label>
    );
  }

  if (field.type === 'resource') {
    const resource = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return (
      <label className="foundry-field foundry-resource">
        <span><strong>{field.label}</strong>{field.hint && <small>{field.hint}</small>}</span>
        <div>
          <input type="number" value={numericValue(resource.current, 0)} disabled={disabled} onChange={(event) => onChange({ ...resource, current: numericInput(event.target.value, 0) })} />
          <em>/</em>
          <input type="number" value={numericValue(resource.max, 0)} disabled={disabled} onChange={(event) => onChange({ ...resource, max: numericInput(event.target.value, 0) })} />
        </div>
      </label>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label className="foundry-field foundry-checkbox">
        <input type="checkbox" checked={Boolean(value)} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
        <span><strong>{field.label}</strong>{field.hint && <small>{field.hint}</small>}</span>
      </label>
    );
  }

  if (field.type === 'textarea') {
    return (
      <label className="foundry-field foundry-textarea">
        <span><strong>{field.label}</strong>{field.hint && <small>{field.hint}</small>}</span>
        <textarea value={textValue(value)} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
      </label>
    );
  }

  if (field.type === 'number') {
    return (
      <label className="foundry-field foundry-number">
        <span><strong>{field.label}</strong>{field.hint && <small>{field.hint}</small>}</span>
        <input type="number" value={numericValue(value, 0)} disabled={disabled} onChange={(event) => onChange(numericInput(event.target.value, 0))} />
      </label>
    );
  }

  return (
    <label className="foundry-field foundry-text">
      <span><strong>{field.label}</strong>{field.hint && <small>{field.hint}</small>}</span>
      <input type="text" value={textValue(value)} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function InventoryView({
  containers,
  instances,
  itemById,
}: {
  containers: Container[];
  instances: ItemInstance[];
  itemById: Map<string, ItemDefinition>;
}) {
  if (containers.length === 0) {
    return <div className="foundry-character-empty"><strong>Инвентарь пуст.</strong><span>Выданные предметы появятся здесь автоматически.</span></div>;
  }
  return (
    <div className="foundry-inventory">
      {containers.map((container) => {
        const rows = instances.filter((instance) => instance.container_id === container.id);
        return (
          <section key={container.id}>
            <header><strong>{container.name}</strong><span>{rows.reduce((sum, row) => sum + Math.max(1, row.quantity), 0)} шт.</span></header>
            {rows.length === 0 ? <p>Пусто</p> : rows.map((instance) => {
              const item = itemById.get(instance.definition_id);
              return (
                <div className="foundry-item-row" key={instance.id}>
                  <span className="foundry-item-icon">{item?.icon || '◆'}</span>
                  <span><strong>{instance.custom_name || item?.name || 'Предмет'}</strong><small>{item?.category || item?.rarity || 'Предмет'}</small></span>
                  {instance.equipped && <em>Надето</em>}
                  <b>×{instance.quantity}</b>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

function compactIdentity(data: Record<string, any>) {
  return [textValue(data.class_level), textValue(data.ancestry)].filter(Boolean).join(' · ');
}

function fieldValue(data: Record<string, any>, field: SheetField) {
  if (Object.prototype.hasOwnProperty.call(data, field.key)) return data[field.key];
  if (field.key === 'hit_points') return data.hp;
  if (field.key === 'armor_class') return data.armor;
  if (field.key === 'speed' && data.movement && typeof data.movement === 'object') {
    const movement = data.movement as Record<string, unknown>;
    return movement.walk ?? movement.speed;
  }
  return undefined;
}

function resourceValue(data: Record<string, any>, ...keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (value && typeof value === 'object') return value as Record<string, unknown>;
  }
  return null;
}

function numericInput(value: string, fallback = 0) {
  if (value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function numericValue(value: unknown, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function textValue(value: unknown) {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : String(value);
}

function signed(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? {})) as T;
}

function cloneValue<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}
