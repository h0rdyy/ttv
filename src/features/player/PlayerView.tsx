'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { actors, campaign, scene } from '@/data/demo';
import { getCampaignPreset } from '@/config/campaignPresets';
import { useCampaignStore } from '@/store/useCampaignStore';

const playerTabs = [
  ['character', 'ПЕРСОНАЖ'],
  ['inventory', 'ИНВЕНТАРЬ'],
  ['combat', 'БОЙ'],
  ['journal', 'ЖУРНАЛ'],
] as const;

type PlayerTab = typeof playerTabs[number][0];

const combatOrder = ['alvis', 'goblin', 'sulka', 'orc'];

export function PlayerView() {
  const {
    presetId,
    selectedActorId,
    mapGrid,
    mapFog,
    tokenPositions,
    customActors,
    customTokens,
    inventories,
    itemDefinitions,
    combatRound,
    combatTurn,
    setActor,
    moveToken,
  } = useCampaignStore();

  const [tab, setTab] = useState<PlayerTab>('character');
  const [draggingOwnToken, setDraggingOwnToken] = useState<string | null>(null);
  const [lastRoll, setLastRoll] = useState<number | null>(null);

  const allActors = useMemo(() => [...actors, ...customActors], [customActors]);
  const playerActors = useMemo(() => actors.filter((actor) => actor.type === 'player'), []);
  const player = playerActors.find((actor) => actor.id === selectedActorId) ?? playerActors[0];
  const preset = getCampaignPreset(presetId);
  const inventory = inventories.find((value) => value.ownerActorId === player.id);

  const visibleTokens = useMemo(
    () => [...scene.tokens, ...customTokens].filter((token) => !token.hidden),
    [customTokens],
  );

  const totalWeight = useMemo(() => {
    if (!inventory) return 0;
    return inventory.containers.flatMap((container) => container.items).reduce((sum, instance) => {
      const definition = itemDefinitions.find((item) => item.id === instance.definitionId);
      return sum + (definition?.weight ?? 0) * instance.quantity;
    }, 0);
  }, [inventory, itemDefinitions]);

  const moveDraggingToken = (event: React.PointerEvent<HTMLElement>) => {
    if (!draggingOwnToken) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    moveToken(draggingOwnToken, x, y);
  };

  const hp = player.systemData.hp;
  const hpPercent = hp ? Math.max(0, Math.min(100, (hp.current / hp.max) * 100)) : 100;

  return (
    <div className="player-shell">
      <header className="player-topbar">
        <div className="player-brand">✦ TTV</div>
        <div className="player-campaign">
          <strong>{campaign.name}</strong>
          <small>{preset.icon} {preset.name}</small>
        </div>
        <div className="player-top-spacer" />
        <div className="player-mode-switch">
          <Link href="/campaign/demo/play">Мастер</Link>
          <span className="active">Игрок</span>
        </div>
        <select className="control player-character-switch" value={player.id} onChange={(event) => setActor(event.target.value)} title="Тестовый выбор персонажа">
          {playerActors.map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}
        </select>
        <Link className="button" href="/campaigns">Выйти</Link>
      </header>

      <main className="player-workspace">
        <section
          className={`player-map map-stage ${mapGrid ? '' : 'grid-off'} ${draggingOwnToken ? 'token-dragging' : ''}`}
          onPointerMove={moveDraggingToken}
          onPointerUp={() => setDraggingOwnToken(null)}
          onPointerCancel={() => setDraggingOwnToken(null)}
          onPointerLeave={() => setDraggingOwnToken(null)}
        >
          <div className="map-river" />
          <div className="map-ruin" />
          <div className="map-location location-a">Старая башня</div>
          <div className="map-location location-b">Лесная дорога</div>
          {mapFog && <div className="player-fog-hint" />}

          {visibleTokens.map((token) => {
            const actor = allActors.find((value) => value.id === token.actorId);
            if (!actor) return null;
            const tokenHp = actor.systemData.hp;
            const tokenHpPct = tokenHp ? Math.max(0, Math.min(100, (tokenHp.current / tokenHp.max) * 100)) : 100;
            const position = tokenPositions[token.id] ?? { x: token.x, y: token.y };
            const isOwn = token.actorId === player.id;

            return (
              <button
                key={token.id}
                className={`token ${token.enemy ? 'enemy' : ''} ${isOwn ? 'selected player-own-token' : ''}`}
                style={{ left: `${position.x}%`, top: `${position.y}%` }}
                onPointerDown={(event) => {
                  if (!isOwn) return;
                  event.preventDefault();
                  setDraggingOwnToken(token.id);
                }}
                title={isOwn ? 'Ваш токен — можно перемещать' : actor.name}
              >
                <span className="token-avatar">{actor.avatar}</span>
                <span className="token-name">{actor.name}</span>
                <span className="token-hp"><i style={{ width: `${tokenHpPct}%` }} /></span>
              </button>
            );
          })}

          <div className="scene-chip">СЦЕНА · {scene.name}</div>
          <div className="player-map-help">Перетаскивайте только своего персонажа</div>
        </section>

        <aside className="player-sidebar">
          <section className="player-identity-card">
            <div className="player-large-avatar">{player.avatar}</div>
            <div className="player-identity-main">
              <strong>{player.name}</strong>
              <small>{player.subtitle}</small>
              <div className="player-hp-row"><span>♥ {hp?.current ?? '—'} / {hp?.max ?? '—'}</span><div className="meter"><i style={{ width: `${hpPercent}%` }} /></div></div>
            </div>
            <div className="player-armor">КД<br/><b>{player.systemData.armor ?? '—'}</b></div>
          </section>

          <nav className="player-tabs">
            {playerTabs.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}
          </nav>

          <div className="player-panel-scroll">
            {tab === 'character' && <CharacterPanel player={player} lastRoll={lastRoll} onRoll={() => setLastRoll(Math.floor(Math.random() * 20) + 1)} />}
            {tab === 'inventory' && <PlayerInventory inventoryId={inventory?.id} totalWeight={totalWeight} />}
            {tab === 'combat' && <PlayerCombat playerId={player.id} round={combatRound} turn={combatTurn} />}
            {tab === 'journal' && <PlayerJournal />}
          </div>
        </aside>
      </main>
    </div>
  );
}

function CharacterPanel({ player, lastRoll, onRoll }: { player: (typeof actors)[number]; lastRoll: number | null; onRoll: () => void }) {
  const primitiveStats = Object.entries(player.systemData).filter(([key, value]) => !['hp', 'armor', 'level'].includes(key) && ['string', 'number', 'boolean'].includes(typeof value));

  return (
    <div className="player-panel-section">
      <div className="player-section-head"><h2>Персонаж</h2><span>Ур. {player.systemData.level ?? '—'}</span></div>
      <div className="player-stat-grid">
        <div><span>Здоровье</span><b>{player.systemData.hp?.current ?? '—'} / {player.systemData.hp?.max ?? '—'}</b></div>
        <div><span>Защита</span><b>{player.systemData.armor ?? '—'}</b></div>
        <div><span>Уровень</span><b>{player.systemData.level ?? '—'}</b></div>
        {primitiveStats.map(([key, value]) => <div key={key}><span>{key}</span><b>{String(value)}</b></div>)}
      </div>

      <div className="player-action-card">
        <div><strong>Быстрый бросок</strong><small>Пока локальный d20. В v0.3 станет realtime-событием кампании.</small></div>
        <button className="button primary" onClick={onRoll}>🎲 d20</button>
      </div>
      {lastRoll !== null && <div className={`player-roll-result ${lastRoll === 20 ? 'critical' : ''}`}><span>Последний бросок</span><b>{lastRoll}</b></div>}

      <div className="player-tip-card">
        <strong>Что видит игрок</strong>
        <p>Только свой лист, доступные объекты сцены и разрешённые данные кампании. Мастерская, GM-заметки и скрытые токены здесь отсутствуют.</p>
      </div>
    </div>
  );
}

function PlayerInventory({ inventoryId, totalWeight }: { inventoryId?: string; totalWeight: number }) {
  const { inventories, itemDefinitions } = useCampaignStore();
  const inventory = inventories.find((value) => value.id === inventoryId);

  if (!inventory) return <div className="player-empty"><span>🎒</span><h3>Инвентарь пуст</h3><p>ДМ ещё не назначил вашему персонажу инвентарь.</p></div>;

  return (
    <div className="player-panel-section">
      <div className="player-section-head"><h2>Инвентарь</h2><span>{totalWeight.toFixed(1)} фн</span></div>
      {inventory.containers.map((container) => (
        <section className="player-inventory-group" key={container.id}>
          <header><strong>{container.name}</strong><span>{container.items.length}{container.capacity ? ` / ${container.capacity}` : ''}</span></header>
          {container.items.length ? container.items.map((instance) => {
            const item = itemDefinitions.find((value) => value.id === instance.definitionId);
            if (!item) return null;
            return (
              <div className="player-item-row" key={instance.id}>
                <span className="player-item-icon">{item.icon}</span>
                <span><strong>{instance.customName || item.name}</strong><small>{item.category} · {item.weight ?? 0} фн</small></span>
                <b>×{instance.quantity}</b>
                {instance.equipped && <em>Надето</em>}
              </div>
            );
          }) : <div className="player-container-empty">Пусто</div>}
        </section>
      ))}
    </div>
  );
}

function PlayerCombat({ playerId, round, turn }: { playerId: string; round: number; turn: number }) {
  const participants = combatOrder.map((id, index) => ({ actor: actors.find((value) => value.id === id), initiative: [18, 16, 14, 11][index] })).filter((value) => value.actor);
  const current = participants[turn] ?? participants[0];

  return (
    <div className="player-panel-section">
      <div className="player-section-head"><h2>Бой</h2><span>Раунд {round}</span></div>
      <div className="player-combat-list">
        {participants.map(({ actor, initiative }, index) => actor && (
          <div key={actor.id} className={`${turn === index ? 'current' : ''} ${actor.id === playerId ? 'self' : ''}`}>
            <b>{index + 1}</b><span>{actor.name}{actor.id === playerId ? ' · Вы' : ''}</span><strong>{initiative}</strong>{turn === index && <em>ХОД</em>}
          </div>
        ))}
      </div>
      <div className="player-turn-card">
        <small>Сейчас ходит</small>
        <strong>{current?.actor?.name ?? '—'}</strong>
        <span>{current?.actor?.subtitle ?? ''}</span>
      </div>
    </div>
  );
}

function PlayerJournal() {
  return (
    <div className="player-panel-section">
      <div className="player-section-head"><h2>Журнал</h2><span>Открыто ДМом</span></div>
      <article className="player-journal-entry">
        <span>📜</span><div><strong>Королевские пустоши</strong><p>Группа направляется к старой башне. Местные жители предупреждали о разбойниках на лесной дороге.</p></div>
      </article>
      <article className="player-journal-entry">
        <span>👤</span><div><strong>Торговец Брин</strong><p>Знакомый торговец из Вальдена. Обещал заплатить за сведения о пропавшем караване.</p></div>
      </article>
      <article className="player-journal-entry locked-preview">
        <span>📖</span><div><strong>Codex появится здесь</strong><p>В следующих этапах сюда подключатся книги кампании и страницы лора, которые ДМ открыл именно этому игроку.</p></div>
      </article>
    </div>
  );
}
