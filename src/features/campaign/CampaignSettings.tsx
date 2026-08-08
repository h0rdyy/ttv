'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { campaignPresets, type CampaignPresetId } from '@/config/campaignPresets';
import { permissionsFor, type CampaignRole } from '@/core/permissions';
import { applyCampaignSnapshot, parseCampaignSnapshot } from '@/core/snapshot';
import { scene } from '@/data/demo';
import { useCampaignStore } from '@/store/useCampaignStore';

type SettingsTab = 'general' | 'members' | 'permissions' | 'scenes' | 'import';

const initialMembers: { id: string; name: string; role: CampaignRole; character?: string }[] = [
  { id: 'm1', name: 'Мастер', role: 'owner' },
  { id: 'm2', name: 'Игрок Альвиса', role: 'player', character: 'Альвис' },
  { id: 'm3', name: 'Игрок Сулки', role: 'player', character: 'Сулка' },
  { id: 'm4', name: 'Наблюдатель', role: 'spectator' },
];

export function CampaignSettings() {
  const { presetId, setPresetId, itemDefinitions, inventories, notes, combatRound, combatTurn, resetDemo } = useCampaignStore();
  const [tab, setTab] = useState<SettingsTab>('general');
  const [members, setMembers] = useState(initialMembers);
  const [importText, setImportText] = useState('');
  const [importMessage, setImportMessage] = useState('');

  const exportJson = useMemo(() => JSON.stringify({
    version: 1,
    campaign: { id: 'demo', name: 'Королевские пустоши', presetId },
    library: itemDefinitions,
    inventories,
    notes,
    combat: { round: combatRound, turn: combatTurn },
  }, null, 2), [presetId, itemDefinitions, inventories, notes, combatRound, combatTurn]);

  const updateRole = (id: string, role: CampaignRole) => setMembers((current) => current.map((member) => member.id === id ? { ...member, role } : member));

  const importSnapshot = () => {
    try {
      const parsed = parseCampaignSnapshot(importText);
      applyCampaignSnapshot(parsed);
      setImportMessage('✓ Снимок v0.1 импортирован. Библиотека, инвентари, заметки, бой и пресет восстановлены.');
    } catch {
      setImportMessage('Не удалось импортировать JSON: формат не соответствует снимку v0.1.');
    }
  };

  return (
    <main className="settings-page">
      <header className="settings-header">
        <div>
          <Link className="back-link" href="/campaigns">← Кампании</Link>
          <h1>Королевские пустоши</h1>
          <p>Настройки системы, сеттинга, участников и локального состояния кампании.</p>
        </div>
        <Link className="button primary" href="/campaign/demo/play">Открыть игровой стол</Link>
      </header>

      <div className="settings-layout">
        <aside className="settings-nav">
          {([
            ['general', 'Общие'],
            ['members', 'Участники'],
            ['permissions', 'Права'],
            ['scenes', 'Сцены'],
            ['import', 'Импорт / экспорт'],
          ] as const).map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}
        </aside>

        <section className="settings-content">
          {tab === 'general' && <GeneralSettings activeId={presetId} onPreset={setPresetId} />}
          {tab === 'members' && <MembersSettings members={members} onRole={updateRole} />}
          {tab === 'permissions' && <PermissionsSettings />}
          {tab === 'scenes' && <ScenesSettings />}
          {tab === 'import' && (
            <ImportSettings
              exportJson={exportJson}
              importText={importText}
              importMessage={importMessage}
              onImportText={setImportText}
              onImport={importSnapshot}
              onReset={() => { resetDemo(); setImportMessage('Демо-состояние сброшено к исходным данным.'); }}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function GeneralSettings({ activeId, onPreset }: { activeId: CampaignPresetId; onPreset: (id: CampaignPresetId) => void }) {
  const active = campaignPresets.find((x) => x.id === activeId) ?? campaignPresets[0];
  return <>
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
          <button key={preset.id} className={`preset-card ${activeId === preset.id ? 'selected' : ''}`} onClick={() => onPreset(preset.id)}>
            <span className="preset-icon">{preset.icon}</span>
            <strong>{preset.name}</strong>
            <small>{preset.subtitle}</small>
            <span className="preset-status">{activeId === preset.id ? '✓ Выбрано' : 'Выбрать'}</span>
          </button>
        ))}
      </div>
    </div>

    <div className="settings-card">
      <span className="eyebrow">MVP</span>
      <h2>Что входит в первую версию</h2>
      <div className="check-grid">
        {['Карта и токены','Группа и Actor','Инвентарь и контейнеры','Бой','Мастерская предметов','NPC','Лут','Таблицы','Заметки','Темы и сеттинги','Undo действий','Локальное сохранение'].map((item) => <div key={item}>✓ {item}</div>)}
      </div>
    </div>
  </>;
}

function MembersSettings({ members, onRole }: { members: typeof initialMembers; onRole: (id: string, role: CampaignRole) => void }) {
  return <div className="settings-card">
    <div className="hub-section-head"><div><span className="eyebrow">УЧАСТНИКИ</span><h2>Роли кампании</h2></div><button className="button">＋ Пригласить</button></div>
    <div className="member-table">
      {members.map((member) => <div className="member-row" key={member.id}>
        <span className="member-avatar">{member.name.slice(0,1)}</span>
        <span><strong>{member.name}</strong><small>{member.character ? `Персонаж: ${member.character}` : 'Без привязанного персонажа'}</small></span>
        <select className="control" value={member.role} onChange={(event) => onRole(member.id, event.target.value as CampaignRole)} disabled={member.role === 'owner'}>
          <option value="owner">Owner</option><option value="gm">GM</option><option value="assistant-gm">Assistant GM</option><option value="player">Player</option><option value="spectator">Spectator</option>
        </select>
      </div>)}
    </div>
    <p className="settings-help">В v0.1 роли демонстрируют permission model локально. Серверное приглашение и enforcement появятся вместе с auth/backend.</p>
  </div>;
}

function PermissionsSettings() {
  const roles: CampaignRole[] = ['owner','gm','assistant-gm','player','spectator'];
  const permissions = Array.from(new Set(roles.flatMap((role) => permissionsFor(role))));
  return <div className="settings-card">
    <span className="eyebrow">PERMISSIONS</span><h2>Матрица доступа</h2>
    <div className="permission-table">
      <div className="permission-head"><b>Permission</b>{roles.map((role) => <b key={role}>{role}</b>)}</div>
      {permissions.map((permission) => <div className="permission-row" key={permission}><span>{permission}</span>{roles.map((role) => <span key={role}>{permissionsFor(role).includes(permission) ? '✓' : '—'}</span>)}</div>)}
    </div>
  </div>;
}

function ScenesSettings() {
  return <>
    <div className="settings-card">
      <div className="hub-section-head"><div><span className="eyebrow">СЦЕНЫ</span><h2>Сцены кампании</h2></div><button className="button">＋ Новая сцена</button></div>
      <div className="scene-settings-list">
        <div><span className="scene-thumb">🗺️</span><span><strong>{scene.name}</strong><small>{scene.tokens.length} токена · активная сцена</small></span><button className="button">Открыть</button></div>
        <div><span className="scene-thumb">🏰</span><span><strong>Замок</strong><small>Черновик · без токенов</small></span><button className="button">Настроить</button></div>
        <div><span className="scene-thumb">🍺</span><span><strong>Таверна</strong><small>Черновик · без токенов</small></span><button className="button">Настроить</button></div>
      </div>
    </div>
    <div className="settings-card"><span className="eyebrow">ПЛАН</span><h2>Scene model</h2><p className="settings-help">В core уже есть Scene/Token. Walls, lighting, fog polygons и assets будут добавляться отдельными слоями, не меняя Actor/Inventory/Workshop.</p></div>
  </>;
}

function ImportSettings({ exportJson, importText, importMessage, onImportText, onImport, onReset }: { exportJson: string; importText: string; importMessage: string; onImportText: (value: string) => void; onImport: () => void; onReset: () => void }) {
  return <>
    <div className="settings-card">
      <span className="eyebrow">ЭКСПОРТ</span><h2>Снимок локальной кампании</h2>
      <textarea className="export-area" readOnly value={exportJson} />
      <button className="button" onClick={() => navigator.clipboard?.writeText(exportJson)}>Копировать JSON</button>
    </div>
    <div className="settings-card">
      <span className="eyebrow">ИМПОРТ</span><h2>Восстановить снимок v0.1</h2>
      <textarea className="export-area" value={importText} onChange={(event) => onImportText(event.target.value)} placeholder="Вставьте экспорт v0.1..." />
      <div className="module-actions"><button className="button primary" onClick={onImport}>Импортировать</button><button className="button danger" onClick={onReset}>Сбросить демо</button></div>
      {importMessage && <p className="settings-help">{importMessage}</p>}
    </div>
  </>;
}
