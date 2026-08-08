'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RollTable } from '@/domain/types';

export const seedRollTables: RollTable[] = [
  {
    id: 'road',
    campaignId: 'royal-wastes',
    name: 'Случайная встреча — дорога',
    rows: ['Пустая дорога и следы повозки', 'Патруль из трёх стражников', 'Раненый путник просит помощи', 'Разбойники готовят засаду', 'Торговый караван', 'Необычный след ведёт в лес'],
  },
  {
    id: 'tavern',
    campaignId: 'royal-wastes',
    name: 'Слухи в таверне',
    rows: ['В старой шахте снова видели огни', 'Королевский сборщик налогов пропал', 'Купец ищет охрану', 'На мосту появился новый разбойничий знак', 'Священник покупает редкие травы', 'Ночью слышны колокола заброшенной часовни'],
  },
  {
    id: 'loot-table',
    campaignId: 'royal-wastes',
    name: 'Мелкие находки',
    rows: ['Сломанный серебряный медальон', 'Ключ без замка', '11 серебряных монет', 'Карта с пометкой углём', 'Пузырёк неизвестного масла', 'Письмо с сорванной печатью'],
  },
];

interface RollTableStore {
  tables: RollTable[];
  upsert: (table: RollTable) => void;
  remove: (id: string) => void;
  reset: () => void;
  replaceAll: (tables: RollTable[]) => void;
}

const clone = (tables: RollTable[]) => JSON.parse(JSON.stringify(tables)) as RollTable[];

export const useRollTableStore = create<RollTableStore>()(
  persist(
    (set) => ({
      tables: clone(seedRollTables),
      upsert: (table) => set((state) => ({
        tables: state.tables.some((value) => value.id === table.id)
          ? state.tables.map((value) => value.id === table.id ? table : value)
          : [table, ...state.tables],
      })),
      remove: (id) => set((state) => state.tables.length <= 1 ? state : ({ tables: state.tables.filter((table) => table.id !== id) })),
      reset: () => set({ tables: clone(seedRollTables) }),
      replaceAll: (tables) => set({ tables: clone(tables.length ? tables : seedRollTables) }),
    }),
    { name: 'ttv-roll-tables-v1' },
  ),
);
