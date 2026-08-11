'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';
import { type ActorSheetTemplate, normalizeSheetSchema, type SheetField } from './actorSheets';

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

export function OnlineActorSheet({ actor, template, canEdit, onClose, onChanged, onMessage }: Props) {
  const [data, setData] = useState<Record<string, any>>(() => clone(actor.system_data));
  const [busy, setBusy] = useState(false);

  useEffect(() => setData(clone(actor.system_data)), [actor.id, actor.system_data]);

  const schema = useMemo(() => normalizeSheetSchema(template?.schema), [template?.schema]);
  const fieldCount = schema.sections.reduce((sum, section) => sum + section.fields.length, 0);

  const patch = (key: string, value: unknown) => {
    setData((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    if (!canEdit) return;
    setBusy(true);
    const supabase = createClient();
    const { data: saved, error } = await supabase.rpc('update_actor_sheet', {
      target_actor: actor.id,
      actor_system_data: data,
    });
    if (error) onMessage(friendlyError(error, 'Не удалось сохранить лист персонажа.'));
    else {
      if (saved && typeof saved === 'object') setData(saved as Record<string, any>);
      onMessage('Лист персонажа сохранён.');
      onChanged();
    }
    setBusy(false);
  };

  return (
    <section className="actor-sheet-overlay" role="dialog" aria-modal="true" aria-label={`Лист ${actor.name}`}>
      <header className="actor-sheet-head">
        <div className="actor-sheet-identity">
          <span className="actor-sheet-avatar">{actor.avatar || (actor.type === 'player' ? '🧙' : '👤')}</span>
          <div><span className="eyebrow">ЛИСТ ПЕРСОНАЖА</span><h2>{actor.name}</h2><p>{actor.subtitle || 'Без описания'}</p></div>
        </div>
        <div className="actor-sheet-head-actions">
          {template && <span className="sheet-template-badge">{template.name}</span>}
          <button className="close-button" onClick={onClose}>×</button>
        </div>
      </header>

      <div className="actor-sheet-scroll">
        {!template ? (
          <div className="actor-sheet-empty">
            <span>◇</span>
            <h3>Шаблон листа не назначен</h3>
            <p>Мастер может создать шаблон кнопкой «Листы» и назначить его этому персонажу.</p>
          </div>
        ) : fieldCount === 0 ? (
          <div className="actor-sheet-empty">
            <span>✎</span>
            <h3>{template.name} пока пуст</h3>
            <p>Добавьте секции и характеристики в конструкторе листов.</p>
          </div>
        ) : (
          schema.sections.map((section) => (
            <section className="actor-sheet-section" key={section.id}>
              <h3>{section.title}</h3>
              <div className="actor-sheet-fields">
                {section.fields.map((field) => (
                  <SheetValueField
                    key={field.id}
                    field={field}
                    value={data[field.key]}
                    disabled={!canEdit || busy}
                    onChange={(value) => patch(field.key, value)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <footer className="actor-sheet-actions">
        {!canEdit && <span className="muted">Этот лист доступен только для просмотра.</span>}
        <button className="button" onClick={onClose}>Закрыть</button>
        {canEdit && template && <button className="button primary" disabled={busy} onClick={() => void save()}>{busy ? 'Сохраняем…' : 'Сохранить лист'}</button>}
      </footer>
    </section>
  );
}

function SheetValueField({ field, value, disabled, onChange }: { field: SheetField; value: unknown; disabled: boolean; onChange: (value: unknown) => void }) {
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

  if (field.type === 'number') {
    return (
      <label className="sheet-value-field">
        <span><strong>{field.label}</strong>{field.hint && <small>{field.hint}</small>}</span>
        <input type="number" value={numberValue(value)} disabled={disabled} onChange={(event) => onChange(numericInput(event.target.value))} />
      </label>
    );
  }

  return (
    <label className="sheet-value-field">
      <span><strong>{field.label}</strong>{field.hint && <small>{field.hint}</small>}</span>
      <input value={typeof value === 'string' ? value : value == null ? '' : String(value)} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function numericInput(value: string) {
  if (value.trim() === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && value !== '' && Number.isFinite(Number(value)) ? Number(value) : 0;
}

function clone(value: Record<string, any>) {
  return JSON.parse(JSON.stringify(value ?? {})) as Record<string, any>;
}