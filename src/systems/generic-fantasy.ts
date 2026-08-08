import type { GameSystemDefinition } from '@/domain/types';

export const genericFantasySystem: GameSystemDefinition = {
  id: 'generic-fantasy',
  name: 'Универсальное фэнтези',
  itemBuilder: {
    Оружие: [
      {
        id: 'core', title: 'Основное', fields: [
          { key: 'name', label: 'Название', type: 'text' },
          { key: 'rarity', label: 'Редкость', type: 'select', options: ['common','uncommon','rare','very-rare','legendary','artifact'] },
          { key: 'weight', label: 'Вес', type: 'number' },
          { key: 'price', label: 'Стоимость', type: 'number' },
          { key: 'source', label: 'Источник', type: 'text' },
        ]
      },
      {
        id: 'weapon', title: 'Характеристики', fields: [
          { key: 'damage', label: 'Урон', type: 'text' },
          { key: 'damageType', label: 'Тип урона', type: 'select', options: ['Рубящий','Колющий','Дробящий','Огонь','Холод','Молния'] },
          { key: 'range', label: 'Дистанция', type: 'text' },
          { key: 'trait', label: 'Свойство', type: 'text' },
        ]
      },
      { id: 'description', title: 'Описание', fields: [{ key: 'description', label: 'Описание', type: 'textarea' }] }
    ],
    Зелье: [
      { id: 'core', title: 'Основное', fields: [
        { key: 'name', label: 'Название', type: 'text' },
        { key: 'rarity', label: 'Редкость', type: 'select', options: ['common','uncommon','rare','very-rare','legendary'] },
        { key: 'weight', label: 'Вес', type: 'number' },
        { key: 'price', label: 'Стоимость', type: 'number' },
      ]},
      { id: 'effect', title: 'Эффект', fields: [
        { key: 'effect', label: 'Эффект', type: 'text' },
        { key: 'duration', label: 'Длительность', type: 'text' },
        { key: 'description', label: 'Описание', type: 'textarea' },
      ]}
    ]
  }
};
