'use client';

import Link from 'next/link';
import { campaignPresets, type CampaignPresetId } from '@/config/campaignPresets';
import { useCampaignStore } from '@/store/useCampaignStore';

export function CampaignSettings() {
  const { presetId, setPresetId } = useCampaignStore();
  const active = campaignPresets.find((x) => x.id === presetId) ?? campaignPresets[0];

  return (
    <main className="settings-page">
      <header className="settings-header">
        <div>
          <Link className="back-link" href="/campaigns">← Кампании</Link>
          <h1>Королевские пустоши</h1>
          <p>Настройки системы, сеттинга и интерфейса кампании.</p>
        </div>
        <Link className="button primary" href="/campaign/demo/play">Открыть игровой стол</Link>
      </header>

      <div className="settings-layout">
        <aside className="settings-nav">
          <button className="active">Общие</button>
          <button>Участники</button>
          <button>Права</button>
          <button>Сцены</button>
          <button>Импорт</button>
        </aside>

        <section className="settings-content">
          <div className="settings-card">
            <span className="eyebrow">АРХИТЕКТУРА КАМПАНИИ</span>
            <h2>Активный пресет</h2>
            <div className="current-preset">
              <span className="preset-icon">{active.icon}</span>
              <div><strong>{active.name}</strong><small>{active.subtitle}</small></div>
            </div>
            <div className="settings-kv">
              <div><span>Game System</span><b>{active.systemId}</b></div>
              <div><span>Setting Pack</span><b>{active.settingId}</b></div>
              <div><span>Theme</span><b>{active.themeId}</b></div>
            </div>
          </div>

          <div className="settings-card">
            <span className="eyebrow">ПРЕСЕТЫ</span>
            <h2>Сменить направление кампании</h2>
            <p className="settings-help">Пресет меняет правила по умолчанию, визуальную тему и набор контентных ожиданий, но не ломает общие сущности Actor, Item, Inventory и Scene.</p>
            <div className="preset-grid compact">
              {campaignPresets.map((preset) => (
                <button
                  key={preset.id}
                  className={`preset-card ${presetId === preset.id ? 'selected' : ''}`}
                  onClick={() => setPresetId(preset.id as CampaignPresetId)}
                >
                  <span className="preset-icon">{preset.icon}</span>
                  <strong>{preset.name}</strong>
                  <small>{preset.subtitle}</small>
                  <span className="preset-status">{presetId === preset.id ? '✓ Выбрано' : 'Выбрать'}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="settings-card">
            <span className="eyebrow">MVP</span>
            <h2>Что уже считается частью первой версии</h2>
            <div className="check-grid">
              {['Карта и токены','Группа и Actor','Инвентарь и контейнеры','Бой','Мастерская предметов','NPC','Лут','Таблицы','Заметки','Темы и сеттинги','Undo действий','Локальное сохранение'].map((item) => <div key={item}>✓ {item}</div>)}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
