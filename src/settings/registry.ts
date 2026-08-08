export interface SettingPackDefinition {
  id: string;
  name: string;
  description: string;
  tags: string[];
  recommendedSystemId: string;
  starterContent: {
    actorArchetypes: string[];
    itemCategories: string[];
    sceneIdeas: string[];
  };
}

export const settingPacks: SettingPackDefinition[] = [
  {
    id: 'medieval-fantasy',
    name: 'Средневековое фэнтези',
    description: 'Замки, деревни, дороги, руины, ремесленники, рыцари и магические реликвии.',
    tags: ['fantasy', 'medieval', 'adventure'],
    recommendedSystemId: 'generic-fantasy',
    starterContent: {
      actorArchetypes: ['Рыцарь', 'Следопыт', 'Жрец', 'Торговец', 'Разбойник'],
      itemCategories: ['Оружие', 'Броня', 'Зелье', 'Снаряжение', 'Реликвия'],
      sceneIdeas: ['Лесная дорога', 'Старая башня', 'Таверна', 'Замок'],
    },
  },
  {
    id: 'grimdark-war',
    name: 'Гримдарк-война',
    description: 'Мрачная война, чума, религиозные культы, пороховое оружие и тяжелые последствия решений.',
    tags: ['grimdark', 'war', 'horror'],
    recommendedSystemId: 'generic-grimdark',
    starterContent: {
      actorArchetypes: ['Ветеран', 'Охотник на ведьм', 'Полевой хирург', 'Культист', 'Наёмник'],
      itemCategories: ['Холодное оружие', 'Огнестрельное', 'Броня', 'Припасы', 'Реликвия'],
      sceneIdeas: ['Осаждённый город', 'Поле боя', 'Чумной квартал', 'Разорённая часовня'],
    },
  },
  {
    id: 'deep-space',
    name: 'Глубокий космос',
    description: 'Корабли, станции, колонии, импланты, корпоративные конфликты и неизвестные сигналы.',
    tags: ['sci-fi', 'space', 'technology'],
    recommendedSystemId: 'generic-scifi',
    starterContent: {
      actorArchetypes: ['Пилот', 'Инженер', 'Медик', 'Офицер безопасности', 'Контрактник'],
      itemCategories: ['Оружие', 'Броня', 'Модуль', 'Имплант', 'Инструмент'],
      sceneIdeas: ['Орбитальная станция', 'Грузовой отсек', 'Планетарная колония', 'Заброшенный корабль'],
    },
  },
];

export function getSettingPack(id: string) {
  return settingPacks.find((pack) => pack.id === id) ?? settingPacks[0];
}
