import type { GameSystemDefinition } from '@/domain/types';

const genericFantasy: GameSystemDefinition = {
  id: 'generic-fantasy',
  name: 'Generic Fantasy',
  itemBuilder: {
    weapon: [
      { id: 'core', title: 'Основное', fields: [
        { key: 'damage', label: 'Урон', type: 'text' },
        { key: 'damageType', label: 'Тип урона', type: 'select', options: ['Рубящий', 'Колющий', 'Дробящий', 'Огонь', 'Холод'] },
        { key: 'range', label: 'Дистанция', type: 'text' },
      ] },
    ],
    armor: [
      { id: 'defense', title: 'Защита', fields: [
        { key: 'armor', label: 'Бонус защиты', type: 'number' },
        { key: 'strength', label: 'Требование силы', type: 'number' },
      ] },
    ],
  },
};

const grimdark: GameSystemDefinition = {
  id: 'generic-grimdark',
  name: 'Generic Grimdark',
  itemBuilder: {
    weapon: [
      { id: 'weapon', title: 'Оружие', fields: [
        { key: 'damage', label: 'Урон', type: 'text' },
        { key: 'penetration', label: 'Пробитие', type: 'number' },
        { key: 'range', label: 'Дальность', type: 'number' },
        { key: 'reload', label: 'Перезарядка', type: 'number' },
        { key: 'qualities', label: 'Качества', type: 'textarea' },
      ] },
    ],
  },
};

const sciFi: GameSystemDefinition = {
  id: 'generic-scifi',
  name: 'Generic Sci-Fi',
  itemBuilder: {
    weapon: [
      { id: 'weapon', title: 'Вооружение', fields: [
        { key: 'damage', label: 'Урон', type: 'text' },
        { key: 'energy', label: 'Расход энергии', type: 'number' },
        { key: 'range', label: 'Дальность', type: 'number' },
        { key: 'techLevel', label: 'Технологический уровень', type: 'number' },
      ] },
    ],
    module: [
      { id: 'module', title: 'Модуль', fields: [
        { key: 'powerDraw', label: 'Энергопотребление', type: 'number' },
        { key: 'slot', label: 'Слот', type: 'select', options: ['Броня', 'Корабль', 'Имплант', 'Инструмент'] },
      ] },
    ],
  },
};

export const gameSystems = [genericFantasy, grimdark, sciFi];

export function getGameSystem(id: string) {
  return gameSystems.find((system) => system.id === id) ?? genericFantasy;
}
