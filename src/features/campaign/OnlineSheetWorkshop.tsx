'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';
import {
  type ActorSheetSchema,
  type ActorSheetTemplate,
  classicFantasySheetSchema,
  fieldKeyFromLabel,
  normalizeSheetSchema,
  removeSheetField,
  removeSheetSection,
  type SheetFieldType,
} from './actorSheets';
type Props = {
  campaignId: string;
  templates: ActorSheetTemplate[];
  onChanged: () => void;
  onMessage: (message: string) => void;
};

type Draft = {
  id: string | null;
  schema: ActorSheetSchema;
};

const fieldTypes: [SheetFieldType, string][] = [
  ['text', 'Текст'],
  ['textarea', 'Большое текстовое поле'],
  ['number', 'Число'],
  ['checkbox', 'Флажок'],
  ['resource', 'Ресурс текущее / максимум'],
  ['ability', 'Характеристика с модификатором'],
  ['skill', 'Навык с владением и бонусом'],
];

export function OnlineSheetWorkshop(props: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const template = props.templates.find((value) => value.is_default) ?? props.templates[0] ?? null;

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
      template_name: 'Классический лист',
      template_schema: next.schema,
      make_default: true,
    });
    if (error) props.onMessage(friendlyError(error, 'Не удалось сохранить шаблон листа.'));
    else {
      setDraft(null);
      props.onMessage(typeof data === 'string' ? 'Классический лист сохранён.' : 'Лист сохранён.');
      props.onChanged();
    }
    setBusy(false);
  };

  if (draft) {
    return <SheetTemplateBuilder draft={draft} busy={busy} onCancel={() => setDraft(null)} onSave={save} onMessage={props.onMessage} />;
  }

  return (
    <div className="sheet-workshop-module sheet-workshop-single">
      <section className="module-detail sheet-template-detail">
        {template ? (
          <>
            <div className="inspector-header">
              <div><h2>Классический лист</h2><p>Один общий вид для всех героев кампании · игроки заполняют значения</p></div>
              <button className="button primary" onClick={() => setDraft(fromTemplate(template))}>✎ Настроить поля</button>
            </div>
            <div className="classic-workshop-note"><strong>Как это работает</strong><span>Базовые характеристики уже встроены. Мастер может добавлять и удалять разделы и поля, а игрок — заполнять их в своём листе.</span></div>
            <TemplatePreview template={template} />
          </>
        ) : (
          <div className="placeholder-panel"><h2>Классический лист готов</h2><p>Создайте его один раз для этой кампании. После сохранения он автоматически станет листом по умолчанию для героев.</p><button className="button primary" onClick={() => setDraft(newDraft())}>Создать классический лист</button></div>
        )}
      </section>
    </div>
  );
}

function SheetTemplateBuilder({ draft, busy, onCancel, onSave, onMessage }: { draft: Draft; busy: boolean; onCancel: () => void; onSave: (draft: Draft) => void; onMessage: (message: string) => void }) {
  const [value, setValue] = useState<Draft>(() => cloneDraft(draft));

  const submit = (event: FormEvent) => {
    event.preventDefault();
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
        sections: [...current.schema.sections, { id: crypto.randomUUID(), title: 'Новый раздел', slot: 'custom', fields: [] }],
      },
    }));
  };

  const removeSection = (sectionId: string) => {
    setValue((current) => ({ ...current, schema: removeSheetSection(current.schema, sectionId) }));
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
    setValue((current) => ({ ...current, schema: removeSheetField(current.schema, sectionId, fieldId) }));
  };

  return (
    <form className="builder-view sheet-builder" onSubmit={submit}>
      <header className="builder-head"><div><h2>КОНСТРУКТОР ЛИСТА</h2><p>Мастер может добавлять и удалять целые разделы и отдельные поля. После сохранения изменения появятся у всех игроков.</p></div><button type="button" className="button" onClick={onCancel}>← Назад</button></header>
      <div className="builder-scroll">
        {value.schema.sections.map((section, sectionIndex) => (
          <section className="builder-section sheet-builder-section" key={section.id}>
            <div className="sheet-section-title-row">
              <span className="eyebrow">РАЗДЕЛ {sectionIndex + 1}</span>
              <input value={section.title} readOnly={section.slot !== 'custom'} onChange={(event) => patchSection(section.id, event.target.value)} aria-label={`Название раздела ${sectionIndex + 1}`} />
              <div className="sheet-section-actions">
                {section.slot !== 'custom' && <span className="sheet-built-in-label">БАЗОВЫЙ</span>}
                <button type="button" className="button danger" onClick={() => removeSection(section.id)} aria-label={`Удалить раздел «${section.title}»`}>Удалить раздел</button>
              </div>
            </div>
            <div className="sheet-field-builder-list">
              {section.fields.map((field) => {
                const builtIn = field.id.startsWith('classic-');
                return (
                  <div className={`sheet-field-builder-row ${builtIn ? 'built-in' : ''}`} key={field.id}>
                    <input value={field.label} readOnly={builtIn} onChange={(event) => patchField(section.id, field.id, { label: event.target.value })} placeholder="Название характеристики" />
                    <select value={field.type} disabled={builtIn} onChange={(event) => patchField(section.id, field.id, { type: event.target.value as SheetFieldType })}>{fieldTypes.map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select>
                    <input value={field.hint ?? ''} readOnly={builtIn} onChange={(event) => patchField(section.id, field.id, { hint: event.target.value })} placeholder="Подсказка, необязательно" />
                    <button type="button" className="close-button tiny" onClick={() => removeField(section.id, field.id)} aria-label={`Удалить поле «${field.label}»`} title="Удалить характеристику">×</button>
                  </div>
                );
              })}
              {!section.fields.length && <div className="empty-drop">В этом разделе пока нет характеристик.</div>}
            </div>
            <button type="button" className="button" onClick={() => addField(section.id)}>＋ Добавить характеристику</button>
          </section>
        ))}

        <button type="button" className="button sheet-add-section" onClick={addSection}>＋ Добавить раздел</button>
      </div>
      <footer className="builder-actions"><button type="button" className="button" onClick={onCancel}>Отмена</button><button className="button primary" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить лист'}</button></footer>
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

function newDraft(): Draft {
  return {
    id: null,
    schema: classicFantasySheetSchema(),
  };
}

function fromTemplate(template: ActorSheetTemplate): Draft {
  return { id: template.id, schema: normalizeSheetSchema(template.schema) };
}

function cloneDraft(value: Draft): Draft {
  return JSON.parse(JSON.stringify(value)) as Draft;
}
