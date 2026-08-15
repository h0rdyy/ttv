'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';
import {
  classicFantasySheetSchema,
  type ActorSheetTemplate,
  normalizeSheetSchema,
  type SheetField,
  type SheetSection,
  type SheetSectionSlot,
} from './actorSheets';

export type SheetActor = {
  id: string;
  campaign_id: string;
  owner_user_id: string | null;
  type: string;
  name: string;
  subtitle: string;
  avatar: string;
  system_data: Record<string, any>;
  sheet_template_id: string | null;
};

type Props = {
  actor: SheetActor;
  template: ActorSheetTemplate | null;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
  onMessage: (message: string) => void;
};

type ValueFieldProps = {
  field: SheetField;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
};

export function OnlineActorSheet({ actor, template, canEdit, onClose, onChanged, onMessage }: Props) {
  const [data, setData] = useState<Record<string, any>>(() => clone(actor.system_data));
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const loadedActorIdRef = useRef(actor.id);
  const pendingSavedRef = useRef(new Map<string, unknown>());

  useEffect(() => {
    if (loadedActorIdRef.current !== actor.id) {
      loadedActorIdRef.current = actor.id;
      pendingSavedRef.current.clear();
      setData(clone(actor.system_data));
      setDirtyKeys(new Set());
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (dirtyKeys.size > 0 && !window.confirm('В листе есть несохранённые изменения. Закрыть без сохранения?')) return;
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dirtyKeys.size, onClose]);

  const schema = useMemo(
    () => template ? normalizeSheetSchema(template.schema) : classicFantasySheetSchema(),
    [template],
  );
  const sections = useMemo(() => groupSections(schema.sections), [schema.sections]);

  const patch = (key: string, value: unknown) => {
    pendingSavedRef.current.delete(key);
    setData((current) => ({ ...current, [key]: value }));
    setDirtyKeys((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });
  };

  const requestClose = () => {
    if (dirtyKeys.size > 0 && !window.confirm('В листе есть несохранённые изменения. Закрыть без сохранения?')) return;
    onClose();
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
    if (error) onMessage(friendlyError(error, 'Не удалось сохранить лист персонажа.'));
    else {
      const savedData = saved && typeof saved === 'object' ? saved as Record<string, any> : { ...data };
      for (const key of keys) pendingSavedRef.current.set(key, cloneValue(savedData[key]));
      setData(clone(savedData));
      setDirtyKeys(new Set());
      onMessage('Лист персонажа сохранён.');
      onChanged();
    }
    setBusy(false);
  };

  const renderField = (field: SheetField) => (
    <SheetValueField
      key={field.id}
      field={field}
      value={data[field.key]}
      disabled={!canEdit || busy || !template}
      onChange={(value) => patch(field.key, value)}
    />
  );

  return (
    <section className="actor-sheet-overlay classic-sheet-overlay" data-wheel-isolation="true" role="dialog" aria-modal="true" aria-label={`Лист ${actor.name}`}>
      <header className="actor-sheet-head">
        <div className="actor-sheet-identity">
          <span className="actor-sheet-avatar">{actor.avatar || (actor.type === 'player' ? '🧙' : '👤')}</span>
          <div><span className="eyebrow">КЛАССИЧЕСКИЙ ФЭНТЕЗИ-ЛИСТ</span><h2>{actor.name}</h2><p>{actor.subtitle || 'Персонаж кампании'}</p></div>
        </div>
        <div className="actor-sheet-head-actions">
          {template && <span className="sheet-template-badge">{template.name}</span>}
          <button className="close-button" onClick={requestClose} aria-label="Закрыть лист">×</button>
        </div>
      </header>

      <div className="actor-sheet-scroll classic-sheet-scroll">
        <article className="classic-sheet-page">
          <header className="classic-sheet-banner">
            <div className="classic-sheet-brand"><span>✥</span><strong>TTV</strong><small>ЛИСТ ИСКАТЕЛЯ ПРИКЛЮЧЕНИЙ</small></div>
            <div className="classic-character-name"><strong>{actor.name}</strong><span>ИМЯ ПЕРСОНАЖА</span></div>
            <div className="classic-identity-grid">
              {sections.identity.flatMap((section) => section.fields).map(renderField)}
            </div>
          </header>

          {!template && (
            <div className="classic-sheet-notice">
              Мастер ещё не назначил этому герою стандартный лист. Поля доступны для просмотра, но сохранять их пока нельзя.
            </div>
          )}

          <div className="classic-sheet-columns">
            <div className="classic-sheet-column classic-sheet-left">
              {sections.training.map((section) => <ClassicPanel section={section} key={section.id} className="classic-training-panel">{section.fields.map(renderField)}</ClassicPanel>)}
              {sections.abilities.map((section) => (
                <ClassicPanel section={section} key={section.id} className="classic-abilities-panel">
                  <div className="classic-ability-list">{section.fields.map(renderField)}</div>
                </ClassicPanel>
              ))}
              {sections.saves.map((section) => <ClassicPanel section={section} key={section.id} className="classic-list-panel">{section.fields.map(renderField)}</ClassicPanel>)}
              {sections.skills.map((section) => <ClassicPanel section={section} key={section.id} className="classic-list-panel classic-skills-panel">{section.fields.map(renderField)}</ClassicPanel>)}
              {sections.proficiencies.map((section) => <ClassicPanel section={section} key={section.id} className="classic-writing-panel">{section.fields.map(renderField)}</ClassicPanel>)}
            </div>

            <div className="classic-sheet-column classic-sheet-center">
              {sections.combat.map((section) => (
                <ClassicPanel section={section} key={section.id} className="classic-combat-panel">
                  <div className="classic-combat-stats">{section.fields.map(renderField)}</div>
                </ClassicPanel>
              ))}
              {sections.health.map((section) => <ClassicPanel section={section} key={section.id} className="classic-health-panel">{section.fields.map(renderField)}</ClassicPanel>)}
              {sections.attacks.map((section) => <ClassicPanel section={section} key={section.id} className="classic-writing-panel classic-attacks-panel">{section.fields.map(renderField)}</ClassicPanel>)}
              {sections.equipment.map((section) => <ClassicPanel section={section} key={section.id} className="classic-writing-panel classic-equipment-panel">{section.fields.map(renderField)}</ClassicPanel>)}
            </div>

            <div className="classic-sheet-column classic-sheet-right">
              {sections.traits.map((section) => <ClassicPanel section={section} key={section.id} className="classic-writing-panel classic-traits-panel">{section.fields.map(renderField)}</ClassicPanel>)}
              {sections.features.map((section) => <ClassicPanel section={section} key={section.id} className="classic-writing-panel classic-features-panel">{section.fields.map(renderField)}</ClassicPanel>)}
            </div>
          </div>

          {sections.custom.length > 0 && (
            <div className="classic-custom-sections">
              {sections.custom.map((section) => <ClassicPanel section={section} key={section.id} className="classic-custom-panel"><div className="classic-custom-fields">{section.fields.map(renderField)}</div></ClassicPanel>)}
            </div>
          )}
        </article>
      </div>

      <footer className="actor-sheet-actions">
        {!canEdit && <span className="muted">Этот лист доступен только для просмотра.</span>}
        {canEdit && !template && <span className="muted">Для сохранения мастер должен назначить шаблон.</span>}
        {canEdit && template && dirtyKeys.size > 0 && <span className="muted">Есть несохранённые изменения.</span>}
        {canEdit && template && dirtyKeys.size === 0 && <span className="muted">Все изменения сохранены.</span>}
        <button className="button" onClick={requestClose}>Закрыть</button>
        {canEdit && template && <button className="button primary" disabled={busy || dirtyKeys.size === 0} onClick={() => void save()}>{busy ? 'Сохраняем…' : dirtyKeys.size > 0 ? 'Сохранить лист' : 'Сохранено'}</button>}
      </footer>
    </section>
  );
}

function ClassicPanel({ section, className = '', children }: { section: SheetSection; className?: string; children: ReactNode }) {
  return (
    <section className={`classic-sheet-panel ${className}`}>
      <h3>{section.title}</h3>
      <div className="classic-panel-body">{children}</div>
    </section>
  );
}

function SheetValueField({ field, value, disabled, onChange }: ValueFieldProps) {
  if (field.type === 'ability') {
    const score = numberValue(value, 10);
    return (
      <label className="classic-ability-field">
        <span>{field.label}</span>
        <input type="number" value={score} disabled={disabled} onChange={(event) => onChange(numericInput(event.target.value, 10))} />
        <strong>{signed(Math.floor((score - 10) / 2))}</strong>
        <small>МОДИФИКАТОР</small>
      </label>
    );
  }

  if (field.type === 'skill') {
    const skill = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const bonus = numberValue(skill.bonus ?? value);
    return (
      <label className="classic-skill-field">
        <input type="checkbox" checked={Boolean(skill.proficient)} disabled={disabled} onChange={(event) => onChange({ ...skill, bonus, proficient: event.target.checked })} aria-label={`${field.label}: владение`} />
        <input className="classic-skill-bonus" type="number" value={bonus} disabled={disabled} onChange={(event) => onChange({ ...skill, bonus: numericInput(event.target.value), proficient: Boolean(skill.proficient) })} aria-label={`${field.label}: бонус`} />
        <span><strong>{field.label}</strong>{field.hint && <small>{field.hint}</small>}</span>
      </label>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label className="sheet-value-field sheet-checkbox-field">
        <input type="checkbox" checked={Boolean(value)} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
        <span><strong>{field.label}</strong>{field.hint && <small>{field.hint}</small>}</span>
      </label>
    );
  }

  if (field.type === 'resource') {
    const resource = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const current = numberValue(resource.current);
    const max = numberValue(resource.max);
    return (
      <label className="sheet-value-field sheet-resource-field">
        <span><strong>{field.label}</strong>{field.hint && <small>{field.hint}</small>}</span>
        <div className="sheet-resource-inputs">
          <input type="number" value={current} disabled={disabled} onChange={(event) => onChange({ ...resource, current: numericInput(event.target.value) })} aria-label={`${field.label}: текущее`} />
          <em>/</em>
          <input type="number" value={max} disabled={disabled} onChange={(event) => onChange({ ...resource, max: numericInput(event.target.value) })} aria-label={`${field.label}: максимум`} />
        </div>
      </label>
    );
  }

  if (field.type === 'textarea') {
    return (
      <label className="sheet-value-field sheet-textarea-field">
        <span><strong>{field.label}</strong>{field.hint && <small>{field.hint}</small>}</span>
        <textarea value={stringValue(value)} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
      </label>
    );
  }

  if (field.type === 'number') {
    return (
      <label className="sheet-value-field sheet-number-field">
        <span><strong>{field.label}</strong>{field.hint && <small>{field.hint}</small>}</span>
        <input type="number" value={numberValue(value)} disabled={disabled} onChange={(event) => onChange(numericInput(event.target.value))} />
      </label>
    );
  }

  return (
    <label className="sheet-value-field sheet-text-field">
      <span><strong>{field.label}</strong>{field.hint && <small>{field.hint}</small>}</span>
      <input value={stringValue(value)} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function groupSections(sections: SheetSection[]) {
  const slots: SheetSectionSlot[] = ['identity', 'training', 'abilities', 'saves', 'skills', 'combat', 'health', 'traits', 'attacks', 'proficiencies', 'equipment', 'features', 'custom'];
  const grouped = slots.reduce<Record<SheetSectionSlot, SheetSection[]>>((result, slot) => {
    result[slot] = [];
    return result;
  }, {} as Record<SheetSectionSlot, SheetSection[]>);
  sections.forEach((section) => grouped[section.slot ?? 'custom'].push(section));
  return grouped;
}

function numericInput(value: string, fallback = 0) {
  if (value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : typeof value === 'string' && value !== '' && Number.isFinite(Number(value))
      ? Number(value)
      : fallback;
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function signed(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function cloneValue<T>(value: T): T {
  if (value == null || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function clone(value: Record<string, any>) {
  return JSON.parse(JSON.stringify(value ?? {})) as Record<string, any>;
}
