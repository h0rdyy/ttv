import type { Actor, Campaign, Inventory, ItemDefinition, Scene } from '@/domain/types';

export const campaign: Campaign = {
  id: 'royal-wastes',
  name: 'Королевские пустоши',
  systemId: 'generic-fantasy',
  settingId: 'medieval-fantasy',
  themeId: 'dark-fantasy',
};

export const actors: Actor[] = [
  { id: 'alvis', campaignId: campaign.id, type: 'player', name: 'Альвис', subtitle: 'Воин · 5 уровень', avatar: 'A', inventoryId: 'inv-alvis', systemData: { hp: { current: 42, max: 42 }, armor: 16, level: 5 } },
  { id: 'sulka', campaignId: campaign.id, type: 'player', name: 'Сулка', subtitle: 'Следопыт · 4 уровень', avatar: 'С', inventoryId: 'inv-sulka', systemData: { hp: { current: 31, max: 36 }, armor: 15, level: 4 } },
  { id: 'fyv', campaignId: campaign.id, type: 'player', name: 'Фыв', subtitle: 'Клирик · 4 уровень', avatar: 'Ф', inventoryId: 'inv-fyv', systemData: { hp: { current: 29, max: 29 }, armor: 17, level: 4 } },
  { id: 'goblin', campaignId: campaign.id, type: 'creature', name: 'Гоблин', subtitle: 'Враг', avatar: 'Г', systemData: { hp: { current: 5, max: 7 }, armor: 15 } },
  { id: 'orc', campaignId: campaign.id, type: 'creature', name: 'Орк', subtitle: 'Враг', avatar: 'О', systemData: { hp: { current: 11, max: 24 }, armor: 13 } },
];

export const items: ItemDefinition[] = [
  {
    id: 'flame-sword', systemId: 'generic-fantasy', name: 'Длинный меч пламени', description: 'Меч, выкованный в сердце древнего вулкана. Лезвие хранит внутреннее пламя.', category: 'Оружие', rarity: 'very-rare', icon: '⚔️', weight: 3, price: 750, currency: 'зм', source: 'Книга игрока', properties: { damage: '1d8', damageType: 'Рубящий', range: 'Ближний бой', trait: 'Универсальное' }, effects: [
      { id: 'fire', name: 'Пылающий клинок', description: '+1d6 огненного урона при попадании.', icon: '🔥', trigger: 'onHit', operation: 'addDamage', payload: { dice: '1d6', type: 'fire' } },
      { id: 'attune', name: 'Требует настройки', description: 'Предмет требует настройки владельцем.', icon: '✦' },
    ]
  },
  { id: 'healing-potion', systemId: 'generic-fantasy', name: 'Зелье лечения', description: 'Восстанавливает здоровье.', category: 'Зелье', rarity: 'common', icon: '🧪', weight: .5, price: 50, currency: 'зм', source: 'Книга игрока', properties: { heal: '2d4+2' }, effects: [] },
  { id: 'shield', systemId: 'generic-fantasy', name: 'Щит защиты', description: 'Надёжный щит.', category: 'Броня', rarity: 'common', icon: '🛡️', weight: 6, price: 10, currency: 'зм', properties: { armor: 2 }, effects: [] },
  { id: 'invisibility-ring', systemId: 'generic-fantasy', name: 'Кольцо невидимости', description: 'Редкое кольцо, скрывающее владельца.', category: 'Кольцо', rarity: 'very-rare', icon: '💍', weight: .05, price: 5000, currency: 'зм', properties: {}, effects: [] },
  { id: 'lightning-staff', systemId: 'generic-fantasy', name: 'Посох молнии', description: 'Проводник грозовой энергии.', category: 'Посох', rarity: 'rare', icon: '🪄', weight: 4, price: 1200, currency: 'зм', properties: {}, effects: [] },
  { id: 'agility-cloak', systemId: 'generic-fantasy', name: 'Плащ ловкости', description: 'Лёгкий зачарованный плащ.', category: 'Одежда', rarity: 'uncommon', icon: '🧥', weight: 2, price: 300, currency: 'зм', properties: {}, effects: [] },
  { id: 'torch', systemId: 'generic-fantasy', name: 'Факел', description: 'Простой источник света.', category: 'Снаряжение', rarity: 'common', icon: '🔥', weight: .5, price: 1, currency: 'мм', properties: {}, effects: [] },
  { id: 'rope', systemId: 'generic-fantasy', name: 'Верёвка 50 ф.', description: 'Прочная пеньковая верёвка.', category: 'Снаряжение', rarity: 'common', icon: '🪢', weight: 10, price: 1, currency: 'зм', properties: {}, effects: [] },
];

const instance = (id: string, definitionId: string, quantity = 1, containerId?: string, equipped = false) => ({ id, definitionId, quantity, containerId, equipped });

export const inventories: Inventory[] = [
  {
    id: 'inv-alvis', ownerActorId: 'alvis', containers: [
      { id: 'alvis-equipment', inventoryId: 'inv-alvis', name: 'Снаряжено', type: 'equipment', items: [instance('i-sword', 'flame-sword', 1, 'alvis-equipment', true), instance('i-shield', 'shield', 1, 'alvis-equipment', true)] },
      { id: 'alvis-backpack', inventoryId: 'inv-alvis', name: 'Рюкзак', type: 'container', capacity: 20, items: [instance('i-potion', 'healing-potion', 3, 'alvis-backpack'), instance('i-torch', 'torch', 5, 'alvis-backpack'), instance('i-rope', 'rope', 1, 'alvis-backpack')] },
      { id: 'alvis-belt', inventoryId: 'inv-alvis', name: 'Пояс', type: 'container', capacity: 5, items: [] },
      { id: 'alvis-bag', inventoryId: 'inv-alvis', name: 'Мешок', type: 'container', capacity: 30, items: [] },
    ]
  },
  { id: 'inv-sulka', ownerActorId: 'sulka', containers: [{ id: 'sulka-backpack', inventoryId: 'inv-sulka', name: 'Рюкзак', type: 'container', capacity: 20, items: [instance('s-potion', 'healing-potion', 1, 'sulka-backpack')] }] },
  { id: 'inv-fyv', ownerActorId: 'fyv', containers: [{ id: 'fyv-backpack', inventoryId: 'inv-fyv', name: 'Рюкзак', type: 'container', capacity: 20, items: [] }] },
];

export const scene: Scene = {
  id: 'forest-road', campaignId: campaign.id, name: 'Лесная дорога',
  tokens: [
    { id: 't-alvis', actorId: 'alvis', x: 24, y: 42 },
    { id: 't-sulka', actorId: 'sulka', x: 43, y: 28 },
    { id: 't-goblin', actorId: 'goblin', x: 70, y: 25, enemy: true },
    { id: 't-orc', actorId: 'orc', x: 60, y: 45, enemy: true },
  ]
};
