import type { Metadata } from 'next';
import './globals.css';
import './mvp.css';
import './v1.css';

export const metadata: Metadata = {
  title: 'TTV — Панель мастера',
  description: 'Универсальная tabletop-платформа для кампаний, сцен, инвентарей и разных игровых систем',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
