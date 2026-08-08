import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TTV — Панель мастера',
  description: 'Универсальная tabletop-платформа для кампаний и разных игровых систем',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
