import type { ThemeId } from '@/domain/types';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  cssVariables: Record<string, string>;
}

export const themeRegistry: Record<ThemeId, ThemeDefinition> = {
  'dark-fantasy': {
    id: 'dark-fantasy',
    name: 'Тёмное фэнтези',
    cssVariables: {
      '--bg': '#0a0907',
      '--panel': '#11100d',
      '--panel-2': '#17130f',
      '--line': '#4d3921',
      '--gold': '#c89a52',
      '--gold-2': '#e2c07d'
    }
  },
  grimdark: {
    id: 'grimdark',
    name: 'Мрачный индустриальный',
    cssVariables: {
      '--bg': '#080807',
      '--panel': '#11110f',
      '--panel-2': '#191814',
      '--line': '#514834',
      '--gold': '#9f8757',
      '--gold-2': '#cfbb84'
    }
  },
  medieval: {
    id: 'medieval',
    name: 'Средневековье',
    cssVariables: {
      '--bg': '#16110c',
      '--panel': '#211910',
      '--panel-2': '#2a2015',
      '--line': '#705432',
      '--gold': '#bf985c',
      '--gold-2': '#ead09c'
    }
  }
};
