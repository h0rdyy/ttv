'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';
import {
  type ActorSheetSchema,
  type ActorSheetTemplate,
  fieldKeyFromLabel,
  normalizeSheetSchema,
  type SheetFieldType,
} from './actorSheets';
import type { SheetActor } from './OnlineActorSheet';

type Props = {
  campaignId: string;
  actors: SheetActor[];
  templates: ActorSheetTemplate[];
  selectedActorId: string;
  onSelectActor: (id: string) => void;
  onChanged: () => void;
  onMessage: (message: string) => void;
};

type Draft = {
  id: string | null;
  name: string;
  isDefault: boolean;
  schema: ActorSheetSchema;
};

const fieldTypes: [SheetFieldType, string][] = [
  ['text', 'Текст'],
  ['number', 'Число'],
  ['checkbox', 'Флажок'],
  ['resource', 'Ресурс текущее / максимум'],
];

export function OnlineSheetWorkshop(props: Props) {
  const [selectedId, setSelectedId] = useState(props.templates[0]?.id ?? '');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (selectedId && props.templates.some((template) => template.id === selectedId)) return;
    setSelectedId(props.templates[0]?.id ?? '');
  }, [props.templates, selectedId]);

  const selected = props.templates.find((template) => template.id === selectedId) ?? props.templates[0] ?? null;
  const actor = props.actors.find((value) => value.id === props.selectedActorId) ?? props.actors[0] ?? null;

  const save = async (next: Draft) => {
    const keys = next.schema.sections.flatMap((section) => section.fields.map((field) => field.key));
    if (new Set(keys).size !== keys.length) {
      props.onMessage('В одном листе не должно быть двух характеристик с одинаковым названием.');
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('save_actor_sheet_template', {
      target_campaign: props.campaignId,
      target_template: next.id,
      template_name: next.name.trim(),
      template_schema: next.schema,
      make_default: next.isDefault,
    });
    if (error) props.onMessage(friendlyError(error, 'Не удалось сохранить шаблон листа.'));
    else {
      if (typeof data === 'string') setSelectedId(data);
      setDraft(null);
      props.onMessage('Шаблон листа сохранён.');
      props.onChanged();
    }
    setBusy(false);
  };

  const remove = async () => {
    if (!selected || !window.confirm(`Удалить шаблон «${selected.name}»? Персонажи останутся, но лист будет отвязан.`)) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('delete_actor_sheet_template', {
      target_campaign: props.campaignId,
      target_template: selected.id,
    });
    if (error) props.onMessage(friendlyError(error, 'Не удалось удалить шаблон листа.'));
    else {
      setSelectedId('');
      props.onChanged();
    }
    setBusy(false);
  };

  const assign = async (templateId: string) => {
    if (!actor) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('assign_actor_sheet_template', {
      target_campaign: props.campaignId,
      target_actor: actor.id,
      target_template: templateId || null,
    });
    if (error) props.onMessage(friendlyError(error, 'Не удалось назначить лист персонажу.'));
    else {
      props.onMessage(templateId ? 'Шаблон назначен персонажу.' : 'Шаблон снят с персонажа.');
      props.onChanged();
    }
    setBusy(false);
  };

  if (draft) {
    return <SheetTemplateBuilder draft={draft} busy={busy} onCancel={() => setDraft(null)} onSave={save} onMessage={props.onMessage} />;
  }

  return (
    <div className="module-split sheet-workshop-module">
      <section className="module-list">
        <div className="library-meta-row">
          <strong>Шаблоны листов</strong>
          <button className="button" onClick={() => setDraft(newDraft(props.templates.length === 0))}>＋ Создать</button>
        </div>
        <div className="module-list-scroll">
          {props.templates.map((template) => {
            const schema = normalizeSheetSchema(template.schema);
            const fieldCount = schema.sections.reduce((sum, section) => sum + section.fields.length, 0);
            return (
              <button key={template.id} className={`module-row ${selected?.id === template.id ? 'selected' : ''}`} onClick={() => setSelectedId(template.id)}>
                <span className="module-avatar">◇</span>
                <span><strong>{template.name}</strong><small>{schema.sections.length} разделов · {fieldCount} полей</small></span>
                {template.is_default && <b>ОСНОВНОЙ</b>}
              </button>
            );
          })}
          {!props.templates.length && <div className="online-small-empty">Создайте первый шаблон: например лист для героев или NPC.</div>}
        </div>
      </section>

      <section className="module-detail sheet-template-detail">
        {selected ? (
          <>
            <div className="inspector-header">
              <div><h2>{selected.name}</h2><p>{selected.is_default ? 'Назначается новым персонажам автоматически' : 'Шаблон кампании'}</p></div>
              <button className="button primary" onClick={() => setDraft(fromTemplate(selected))}>✎ Редактировать</button>
            </div>
            <TemplatePreview template={selected} />
            <div className="module-actions"><button className="button danger" disabled={busy} onClick={() => void remove()}>Удалить шаблон</button></div>
          </>
        ) : (
          <div className="placeholder-panel"><h2>Конструктор листов</h2><p>Соберите характеристики под любую систему без изменения кода TTV.</p><button className="button primary" onClick={() => setDraft(newDraft(true))}>Создать первый шаблон</button></div>
        )}

        <section className="builder-section compact-section sheet-assignment-box">
          <h3>ЛИСТ ПЕРСОНАЖА</h3>
          <select className="control full" value={actor?.id ?? ''} onChange={(event) => props.onSelectActor(event.target.value)}>
            {props.actors.map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}
          </select>
          {actor ? (
            <select className="control full" value={actor.sheet_template_id ?? ''} disabled={busy} onChange={(event) => void assign(event.target.value)}>
              <option value="">Без шаблона</option>
              {props.templates.map((template) => <option key={template.id} value={template.id}>{template.name}{template.is_default ? ' · основной' : ''}</option>)}
            </select>
          ) : <p className="muted">В кампании пока нет персонажей.</p>}
        </section>
      </section>
    </div>
  );
}

function SheetTemplateBuilder({ draft, busy, onCancel, onSave, onMessage }: { draft: Draft; busy: boolean; onCancel: () => void; onSave: (draft: Draft) => void; onMessage: (message: string) => void }) {
  const [value, setValue] = useState<Draft>(() => cloneDraft(draft));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!value.name.trim()) return;
    if (value.schema.sections.length > 20) {
      onMessage('В одном листе можно создать до 20 разделов.');
      return;
    }
    onSave(value);
  };

  const addSection = () => {
    setValue((current) => ({
      ...current,
      schema: {
        ...current.schema,
        sections: [...current.schema.sections, { id: crypto.randomUUID(), title: 'Новый раздел', fields: [] }],
      },
    }));
  };

  const removeSection = (sectionId: string) => {
    setValue((current) => ({ ...current, schema: { ...current.schema, sections: current.schema.sections.filter((section) => section.id !== sectionId) } }));
  };

  const patchSection = (sectionId: string, title: string) => {
    setValue((current) => ({ ...current, schema: { ...current.schema, sections: current.schema.sections.map((section) => section.id === sectionId ? { ...section, title } : section) } }));
  };

  const addField = (sectionId: string) => {
    setValue((current) => {
      const used = new Set(current.schema.sections.flatMap((section) => section.fields.map((field) => field.key)));
      let key = fieldKeyFromLabel('Характеристика');
      let index = 2;
      while (used.has(key)) key = `характеристика_${index++}`;
      return {
        ...current,
        schema: {
          ...current.schema,
          sections: current.schema.sections.map((section) => section.id === sectionId ? {
            ...section,
            fields: [...section.fields, { id: crypto.randomUUID(), key, label: 'Характеристика', type: 'number', hint: '' }],
          } : section),
        },
      };
    });
  };

  const patchField = (sectionId: string, fieldId: string, patch: { label?: string; type?: SheetFieldType; hint?: string }) => {
    setValue((current) => ({
      ...current,
      schema: {
        ...current.schema,
        sections: current.schema.sections.map((section) => {
          if (section.id !== sectionId) return section;
          return {
            ...section,
            fields: section.fields.map((field) => {
              if (field.id !== fieldId) return field;
              const nextLabel = patch.label ?? field.label;
              const shouldRegenerateKey = patch.label !== undefined && field.key === fieldKeyFromLabel(field.label, field.key);
              return { ...field, ...patch, label: nextLabel, key: shouldRegenerateKey ? fieldKeyFromLabel(nextLabel, field.key) : field.key };
            }),
          };
        }),
      },
    }));
  };

  const removeField = (sectionId: string, fieldId: string) => {
    setValue((current) => ({
      ...current,
      schema: {
        ...current.schema,
        sections: current.schema.sections.map((section) => section.id === sectionId ? { ...section, fields: section.fields.filter((field) => field.id !== fieldId) } : section),
      },
    }));
  };

  return (
    <form className="builder-view sheet-builder" onSubmit={submit}>
      <header className="builder-head"><div><h2>КОНСТРУКТОР ЛИСТА</h2><p>Разделы и характеристики будут одинаковыми для всех персонажей с этим шаблоном.</p></div><button type="button" className="button" onClick={onCancel}>← Назад</button></header>
      <div className="builder-scroll">
        <section className="builder-section">
          <h3>ОСНОВНОЕ</h3>
          <div className="builder-grid">
            <label className="builder-field"><span>Название шаблона</span><input required value={value.name} onChange={(event) => setValue((current) => ({ ...current, name: event.target.value }))} /></label>
            <label className="sheet-default-toggle"><input type="checkbox" checked={value.isDefault} onChange={(event) => setValue((current) => ({ ...current, isDefault: event.target.checked }))} /> Назначать новым персонажам</label>
          </div>
        </section>

        {value.schema.sections.map((section, sectionIndex) => (
          <section className="builder-section sheet-builder-section" key={section.id}>
            <div className="sheet-section-title-row">
              <span className="eyebrow">РАЗДЕЛ {sectionIndex + 1}</span>
              <input value={section.title} onChange={(event) => patchSection(section.id, event.target.value)} aria-label={`Название раздела ${sectionIndex + 1}`} />
              <button type="button" className="button danger" onClick={() => removeSection(section.id)}>Удалить раздел</button>
            </div>
            <div className="sheet-field-builder-list">
              {section.fields.map((field) => (
                <div className="sheet-field-builder-row" key={field.id}>
                  <input value={field.label} onChange={(event) => patchField(section.id, field.id, { label: event.target.value })} placeholder="Название характеристики" />
                  <select value={field.type} onChange={(event) => patchField(section.id, field.id, { type: event.target.value as SheetFieldType })}>{fieldTypes.map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select>
                  <input value={field.hint ?? ''} onChange={(event) => patchField(section.id, field.id, { hint: event.target.value })} placeholder="Подсказка, необязательно" />
                  <button type="button" className="close-button tiny" onClick={() => removeField(section.id, field.id)}>×</button>
                </div>
              ))}
              {!section.fields.length && <div className="empty-drop">В этом разделе пока нет характеристик.</div>}
            </div>
            <button type="button" className="button" onClick={() => addField(section.id)}>＋ Добавить характеристику</button>
          </section>
        ))}

        <button type="button" className="button sheet-add-section" onClick={addSection}>＋ Добавить раздел</button>
      </div>
      <footer className="builder-actions"><button type="button" className="button" onClick={onCancel}>Отмена</button><button className="button primary" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить шаблон'}</button></footer>
    </form>
  );
}

function TemplatePreview({ template }: { template: ActorSheetTemplate }) {
  const schema = useMemo(() => normalizeSheetSchema(template.schema), [template.schema]);
  return (
    <div className="sheet-template-preview">
      {schema.sections.map((section) => <section key={section.id}><strong>{section.title}</strong><div>{section.fields.map((field) => <span key={field.id}>{field.label}<small>{fieldTypes.find(([type]) => type === field.type)?.[1] ?? field.type}</small></span>)}</div></section>)}
      {!schema.sections.length && <div className="online-small-empty">Шаблон пока пуст.</div>}
    </div>
  );
}

function newDraft(isDefault: boolean): Draft {
  return {
    id: null,
    name: 'Новый лист',
    isDefault,
    schema: { version: 1, sections: [{ id: crypto.randomUUID(), title: 'Основное', fields: [] }] },
  };
}

function fromTemplate(template: ActorSheetTemplate): Draft {
  return { id: template.id, name: template.name, isDefault: template.is_default, schema: normalizeSheetSchema(template.schema) };
}

function cloneDraft(value: Draft): Draft {
  return JSON.parse(JSON.stringify(value)) as Draft;
}
