export type SheetFieldType = 'text' | 'number' | 'checkbox' | 'resource';

export type SheetField = {
  id: string;
  key: string;
  label: string;
  type: SheetFieldType;
  hint?: string;
};

export type SheetSection = {
  id: string;
  title: string;
  fields: SheetField[];
};

export type ActorSheetSchema = {
  version: 1;
  sections: SheetSection[];
};

export type ActorSheetTemplate = {
  id: string;
  campaign_id: string;
  name: string;
  schema: ActorSheetSchema;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export function emptySheetSchema(): ActorSheetSchema {
  return { version: 1, sections: [] };
}

export function normalizeSheetSchema(value: unknown): ActorSheetSchema {
  if (!value || typeof value !== 'object') return emptySheetSchema();
  const raw = value as Record<string, unknown>;
  const sections = Array.isArray(raw.sections) ? raw.sections : [];
  return {
    version: 1,
    sections: sections
      .filter((section): section is Record<string, unknown> => Boolean(section) && typeof section === 'object')
      .map((section, sectionIndex) => ({
        id: typeof section.id === 'string' && section.id ? section.id : `section-${sectionIndex}`,
        title: typeof section.title === 'string' && section.title ? section.title : 'Раздел',
        fields: (Array.isArray(section.fields) ? section.fields : [])
          .filter((field): field is Record<string, unknown> => Boolean(field) && typeof field === 'object')
          .map((field, fieldIndex) => {
            const type: SheetFieldType = ['text', 'number', 'checkbox', 'resource'].includes(String(field.type))
              ? field.type as SheetFieldType
              : 'text';
            return {
              id: typeof field.id === 'string' && field.id ? field.id : `field-${sectionIndex}-${fieldIndex}`,
              key: typeof field.key === 'string' && field.key ? field.key : `field_${sectionIndex}_${fieldIndex}`,
              label: typeof field.label === 'string' && field.label ? field.label : 'Поле',
              type,
              hint: typeof field.hint === 'string' ? field.hint : '',
            };
          }),
      })),
  };
}

export function fieldKeyFromLabel(label: string, fallback = 'field') {
  const value = label
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return value || `${fallback}_${Math.random().toString(36).slice(2, 7)}`;
}
