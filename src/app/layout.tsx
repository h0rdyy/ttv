import type { Metadata } from 'next';
import './globals.css';
import './mvp.css';
import './v1.css';
import './player.css';
import './player-switch.css';

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
