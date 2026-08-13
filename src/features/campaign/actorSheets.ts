export type SheetFieldType = 'text' | 'textarea' | 'number' | 'checkbox' | 'resource' | 'ability' | 'skill';

export type SheetSectionSlot =
  | 'identity'
  | 'training'
  | 'abilities'
  | 'saves'
  | 'skills'
  | 'combat'
  | 'health'
  | 'traits'
  | 'attacks'
  | 'proficiencies'
  | 'equipment'
  | 'features'
  | 'custom';

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
  slot?: SheetSectionSlot;
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

export function classicFantasySheetSchema(): ActorSheetSchema {
  return {
    version: 1,
    sections: [
      {
        id: 'classic-identity',
        title: 'Основное',
        slot: 'identity',
        fields: [
          field('class_level', 'Класс и уровень', 'text'),
          field('background', 'Предыстория', 'text'),
          field('ancestry', 'Народ / происхождение', 'text'),
          field('alignment', 'Мировоззрение', 'text'),
          field('experience', 'Опыт', 'number'),
        ],
      },
      {
        id: 'classic-training',
        title: 'Подготовка',
        slot: 'training',
        fields: [
          field('inspiration', 'Вдохновение', 'checkbox'),
          field('proficiency_bonus', 'Бонус мастерства', 'number'),
        ],
      },
      {
        id: 'classic-abilities',
        title: 'Характеристики',
        slot: 'abilities',
        fields: [
          field('strength', 'Сила', 'ability'),
          field('dexterity', 'Ловкость', 'ability'),
          field('constitution', 'Телосложение', 'ability'),
          field('intelligence', 'Интеллект', 'ability'),
          field('wisdom', 'Мудрость', 'ability'),
          field('charisma', 'Харизма', 'ability'),
        ],
      },
      {
        id: 'classic-saves',
        title: 'Спасброски',
        slot: 'saves',
        fields: [
          field('strength_save', 'Сила', 'skill'),
          field('dexterity_save', 'Ловкость', 'skill'),
          field('constitution_save', 'Телосложение', 'skill'),
          field('intelligence_save', 'Интеллект', 'skill'),
          field('wisdom_save', 'Мудрость', 'skill'),
          field('charisma_save', 'Харизма', 'skill'),
        ],
      },
      {
        id: 'classic-skills',
        title: 'Навыки',
        slot: 'skills',
        fields: [
          field('acrobatics', 'Акробатика', 'skill', 'Ловкость'),
          field('animal_handling', 'Уход за животными', 'skill', 'Мудрость'),
          field('arcana', 'Магия', 'skill', 'Интеллект'),
          field('athletics', 'Атлетика', 'skill', 'Сила'),
          field('deception', 'Обман', 'skill', 'Харизма'),
          field('history', 'История', 'skill', 'Интеллект'),
          field('insight', 'Проницательность', 'skill', 'Мудрость'),
          field('intimidation', 'Запугивание', 'skill', 'Харизма'),
          field('investigation', 'Анализ', 'skill', 'Интеллект'),
          field('medicine', 'Медицина', 'skill', 'Мудрость'),
          field('nature', 'Природа', 'skill', 'Интеллект'),
          field('perception', 'Внимательность', 'skill', 'Мудрость'),
          field('performance', 'Выступление', 'skill', 'Харизма'),
          field('persuasion', 'Убеждение', 'skill', 'Харизма'),
          field('religion', 'Религия', 'skill', 'Интеллект'),
          field('sleight_of_hand', 'Ловкость рук', 'skill', 'Ловкость'),
          field('stealth', 'Скрытность', 'skill', 'Ловкость'),
          field('survival', 'Выживание', 'skill', 'Мудрость'),
        ],
      },
      {
        id: 'classic-combat',
        title: 'Бой',
        slot: 'combat',
        fields: [
          field('armor_class', 'Класс защиты', 'number'),
          field('initiative', 'Инициатива', 'number'),
          field('speed', 'Скорость', 'number'),
        ],
      },
      {
        id: 'classic-health',
        title: 'Здоровье',
        slot: 'health',
        fields: [
          field('hit_points', 'Хиты', 'resource'),
          field('temporary_hit_points', 'Временные хиты', 'number'),
          field('hit_dice', 'Кости хитов', 'text', 'Например: 3к8'),
          field('death_saves', 'Спасброски от смерти', 'text', 'Успехи / провалы'),
        ],
      },
      {
        id: 'classic-traits',
        title: 'Личность',
        slot: 'traits',
        fields: [
          field('personality_traits', 'Черты характера', 'textarea'),
          field('ideals', 'Идеалы', 'textarea'),
          field('bonds', 'Привязанности', 'textarea'),
          field('flaws', 'Слабости', 'textarea'),
        ],
      },
      {
        id: 'classic-attacks',
        title: 'Атаки и заклинания',
        slot: 'attacks',
        fields: [field('attacks_and_spells', 'Атаки, бонусы и урон', 'textarea', 'Название · бонус атаки · урон / эффект')],
      },
      {
        id: 'classic-proficiencies',
        title: 'Владения и языки',
        slot: 'proficiencies',
        fields: [field('proficiencies_and_languages', 'Прочие владения и языки', 'textarea')],
      },
      {
        id: 'classic-equipment',
        title: 'Снаряжение',
        slot: 'equipment',
        fields: [field('equipment_notes', 'Снаряжение и монеты', 'textarea')],
      },
      {
        id: 'classic-features',
        title: 'Умения и особенности',
        slot: 'features',
        fields: [field('features_and_traits', 'Умения, особенности и заметки', 'textarea')],
      },
    ],
  };
}

export function normalizeSheetSchema(value: unknown): ActorSheetSchema {
  if (!value || typeof value !== 'object') return emptySheetSchema();
  const raw = value as Record<string, unknown>;
  const sections = Array.isArray(raw.sections) ? raw.sections : [];
  const slots: SheetSectionSlot[] = ['identity', 'training', 'abilities', 'saves', 'skills', 'combat', 'health', 'traits', 'attacks', 'proficiencies', 'equipment', 'features', 'custom'];
  return {
    version: 1,
    sections: sections
      .filter((section): section is Record<string, unknown> => Boolean(section) && typeof section === 'object')
      .map((section, sectionIndex) => ({
        id: typeof section.id === 'string' && section.id ? section.id : `section-${sectionIndex}`,
        title: typeof section.title === 'string' && section.title ? section.title : 'Раздел',
        slot: slots.includes(section.slot as SheetSectionSlot) ? section.slot as SheetSectionSlot : 'custom',
        fields: (Array.isArray(section.fields) ? section.fields : [])
          .filter((field): field is Record<string, unknown> => Boolean(field) && typeof field === 'object')
          .map((field, fieldIndex) => {
            const type: SheetFieldType = ['text', 'textarea', 'number', 'checkbox', 'resource', 'ability', 'skill'].includes(String(field.type))
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

export function removeSheetSection(schema: ActorSheetSchema, sectionId: string): ActorSheetSchema {
  return {
    ...schema,
    sections: schema.sections.filter((section) => section.id !== sectionId),
  };
}

export function removeSheetField(schema: ActorSheetSchema, sectionId: string, fieldId: string): ActorSheetSchema {
  return {
    ...schema,
    sections: schema.sections.map((section) => section.id === sectionId ? {
      ...section,
      fields: section.fields.filter((field) => field.id !== fieldId),
    } : section),
  };
}

function field(key: string, label: string, type: SheetFieldType, hint = ''): SheetField {
  return { id: `classic-${key}`, key, label, type, hint };
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
