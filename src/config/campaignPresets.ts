export type CampaignPresetId = 'medieval-fantasy' | 'grimdark' | 'sci-fi';

export interface CampaignPreset {
  id: CampaignPresetId;
  name: string;
  subtitle: string;
  systemId: string;
  settingId: string;
  themeId: string;
  icon: string;
  description: string;
  cssVars: Record<string, string>;
}

export const campaignPresets: CampaignPreset[] = [
  {
    id: 'medieval-fantasy',
    name: 'Средневековое фэнтези',
    subtitle: 'Золото, дерево и старый пергамент',
    systemId: 'generic-fantasy',
    settingId: 'medieval-fantasy',
    themeId: 'dark-fantasy',
    icon: '⚔️',
    description: 'Универсальный пресет для классического фэнтези, рыцарских и низкомагических кампаний.',
    cssVars: {
      '--bg': '#0a0907', '--panel': '#11100d', '--panel-2': '#17130f', '--panel-3': '#1d1711',
      '--line': '#4d3921', '--line-soft': '#2e251a', '--gold': '#c89a52', '--gold-2': '#e2c07d',
      '--text': '#e9ddc8', '--muted': '#9d8f79', '--green': '#669e54', '--red': '#b5523d', '--purple': '#a36bd0', '--blue': '#5a87cb'
    }
  },
  {
    id: 'grimdark',
    name: 'Гримдарк',
    subtitle: 'Железо, пепел и кровавые акценты',
    systemId: 'generic-grimdark',
    settingId: 'grimdark-war',
    themeId: 'grimdark',
    icon: '☠️',
    description: 'Для мрачных военных миров, опасных культов, чумы, пороха и тяжелой брони.',
    cssVars: {
      '--bg': '#090909', '--panel': '#111111', '--panel-2': '#171513', '--panel-3': '#1d1917',
      '--line': '#4b352d', '--line-soft': '#2b2320', '--gold': '#9f7550', '--gold-2': '#c6a277',
      '--text': '#ddd6ca', '--muted': '#8f867d', '--green': '#71834c', '--red': '#a83f34', '--purple': '#7c5b84', '--blue': '#536b78'
    }
  },
  {
    id: 'sci-fi',
    name: 'Научная фантастика',
    subtitle: 'Холодный металл и интерфейс корабля',
    systemId: 'generic-scifi',
    settingId: 'deep-space',
    themeId: 'sci-fi',
    icon: '🚀',
    description: 'Для космических экспедиций, колоний, мегакорпораций и техно-хоррора.',
    cssVars: {
      '--bg': '#071014', '--panel': '#0c151a', '--panel-2': '#111d23', '--panel-3': '#14242b',
      '--line': '#294651', '--line-soft': '#1b323a', '--gold': '#55a2ad', '--gold-2': '#8bd2da',
      '--text': '#d8e6e8', '--muted': '#829ba0', '--green': '#57a878', '--red': '#c05b5b', '--purple': '#806db5', '--blue': '#4e99c0'
    }
  }
];

export function getCampaignPreset(id?: string) {
  return campaignPresets.find((preset) => preset.id === id) ?? campaignPresets[0];
}
