'use client';

import Link from 'next/link';
import { campaignPresets, type CampaignPresetId } from '@/config/campaignPresets';
import { useCampaignStore } from '@/store/useCampaignStore';

export function CampaignHub() {
  const { presetId, setPresetId } = useCampaignStore();

  return (
    <main className="hub-page">
      <header className="hub-topbar">
        <div>
          <div className="brand">✥ TTV</div>
          <p>Универсальная tabletop-платформа</p>
        </div>
        <Link className="button" href="/campaign/demo/play">Открыть последнюю кампанию</Link>
      </header>

      <section className="hub-hero">
        <span className="eyebrow">ПЕРВАЯ ВЕРСИЯ</span>
        <h1>Кампании без привязки к одной системе</h1>
        <p>Карта, персонажи, предметы, инвентари, бой и мастерская ДМа остаются общими. Правила, сеттинг и внешний вид подключаются отдельно.</p>
      </section>

      <section className="hub-section">
        <div className="hub-section-head">
          <div><span className="eyebrow">ДЕМО-КАМПАНИЯ</span><h2>Королевские пустоши</h2></div>
          <div className="hub-actions">
            <Link className="button" href="/campaign/demo/settings">Настройки</Link>
            <Link className="button primary" href="/campaign/demo/play">Продолжить игру</Link>
          </div>
        </div>

        <div className="preset-grid">
          {campaignPresets.map((preset) => (
            <button
              key={preset.id}
              className={`preset-card ${presetId === preset.id ? 'selected' : ''}`}
              onClick={() => setPresetId(preset.id as CampaignPresetId)}
            >
              <span className="preset-icon">{preset.icon}</span>
              <strong>{preset.name}</strong>
              <small>{preset.subtitle}</small>
              <p>{preset.description}</p>
              <span className="preset-status">{presetId === preset.id ? '✓ Активный пресет' : 'Использовать пресет'}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="hub-section architecture-strip">
        <div><b>Движок</b><span>Actor · Item · Scene · Inventory · Combat</span></div>
        <div><b>Game System</b><span>Правила и схемы данных</span></div>
        <div><b>Setting Pack</b><span>Контент кампании</span></div>
        <div><b>Theme</b><span>Цвета и атмосфера</span></div>
      </section>
    </main>
  );
}
