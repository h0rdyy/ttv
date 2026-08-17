import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  classicFantasySheetSchema,
  fieldKeyFromLabel,
  normalizeSheetSchema,
  removeSheetField,
  removeSheetSection,
} from '../../src/features/campaign/actorSheets';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('actor sheet schema helpers', () => {
  it('normalizes unknown schema input without trusting malformed values', () => {
    expect(normalizeSheetSchema(null)).toEqual({ version: 1, sections: [] });

    const schema = normalizeSheetSchema({
      version: 999,
      sections: [{
        title: '',
        slot: 'unknown',
        fields: [{ type: 'unsupported' }],
      }],
    });

    expect(schema).toEqual({
      version: 1,
      sections: [{
        id: 'section-0',
        title: 'Раздел',
        slot: 'custom',
        fields: [{
          id: 'field-0-0',
          key: 'field_0_0',
          label: 'Поле',
          type: 'text',
          hint: '',
        }],
      }],
    });
  });

  it('removes sections and fields immutably', () => {
    const source = classicFantasySheetSchema();
    const firstSection = source.sections[0];
    const firstField = firstSection.fields[0];

    const withoutField = removeSheetField(source, firstSection.id, firstField.id);
    const withoutSection = removeSheetSection(source, firstSection.id);

    expect(source.sections[0].fields.some((field) => field.id === firstField.id)).toBe(true);
    expect(withoutField.sections[0].fields.some((field) => field.id === firstField.id)).toBe(false);
    expect(source.sections.some((section) => section.id === firstSection.id)).toBe(true);
    expect(withoutSection.sections.some((section) => section.id === firstSection.id)).toBe(false);
  });

  it('creates deterministic field keys when a label has no usable characters', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    expect(fieldKeyFromLabel('Armor Class')).toBe('armor_class');
    expect(fieldKeyFromLabel(' *** ', 'custom')).toBe('custom_i');
  });
});
