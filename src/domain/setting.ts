export interface SettingPack {
  id: string;
  name: string;
  description: string;
  systemIds: string[];
  tags: string[];
  content: {
    actorTemplates: string[];
    itemTemplates: string[];
    encounterTables: string[];
    journalEntries: string[];
  };
}

export const settingPacks: SettingPack[] = [
  {
    id: 'medieval-fantasy',
    name: 'Средневековое фэнтези',
    description: 'Замки, трактиры, лесные дороги, магия и классическое приключение.',
    systemIds: ['generic-fantasy'],
    tags: ['medieval', 'fantasy'],
    content: {
      actorTemplates: ['knight', 'merchant', 'bandit', 'goblin'],
      itemTemplates: ['sword', 'shield', 'potion', 'rope'],
      encounterTables: ['road', 'forest', 'tavern'],
      journalEntries: ['kingdoms', 'guilds'],
    },
  },
  {
    id: 'grimdark-industrial',
    name: 'Мрачный индустриальный мир',
    description: 'Жестокий мир войн, пороха, коррупции, религиозных орденов и опасной магии.',
    systemIds: ['generic-fantasy'],
    tags: ['grimdark', 'industrial', 'war'],
    content: {
      actorTemplates: ['soldier', 'cultist', 'witch-hunter', 'mutant'],
      itemTemplates: ['sabre', 'blackpowder-pistol', 'armor', 'relic'],
      encounterTables: ['city', 'battlefield', 'wasteland'],
      journalEntries: ['factions', 'faiths'],
    },
  },
];
