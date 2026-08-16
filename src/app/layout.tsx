import type { Metadata } from 'next';
import './globals.css';
import './mvp.css';
import './v1.css';
import './player.css';
import './player-switch.css';
import './auth.css';
import './online-table.css';
import './online-table-contextual.css';
import './online-table-immersion.css';
import './scene-v04.css';
import './scene-measurement.css';
import './sheet-v05.css';
import './online-table-immersion-v2.css';
import './player-character-window.css';
import './gm-character-unified.css';
import './tabletop-ui-focus.css';
import './tabletop-ui-preferences.css';

export const metadata: Metadata = {
  title: 'TTV — виртуальный стол кампании',
  description: 'Универсальная tabletop-платформа для мастеров и игроков, сцен, инвентарей и разных игровых систем',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
