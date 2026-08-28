'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';
import {
  combatEffectsForActor,
  combatInitiative,
  combatParticipants,
  type CombatControl,
  type CombatEffectKind,
  type CombatRuntime,
} from './combat';

export type GmSidebarTab = 'session' | 'characters' | 'content' | 'notes' | 'party';

type Actor = {
  id: string;
  campaign_id: string;
  owner_user_id: string | null;
  type: string;
  name: string;
  subtitle: string;
  avatar: string;
  system_data: Record<string, any>;
};
type Inventory = { id: string; owner_actor_id: string };
type Container = { id: string; inventory_id: string; name: string; type: string; capacity: number | null; sort_order: number };
type ItemInstance = { id: string; definition_id: string; container_id: string; quantity: number; custom_name: string | null; equipped: boolean; state: Record<string, any> };
type ItemDefinition = { id: string; name: string; category: string; icon: string; weight: number | null };
type Note = { id: string; title: string | null; body: string; pinned: boolean; created_at: string; updated_at: string };
type HealthValue = { current: number; max: number };
type OptimisticHealth = HealthValue & { actorId: string };

type Props = {
  campaignId: string;
  tab: GmSidebarTab;
  onTab: (tab: GmSidebarTab) => void;
  actors: Actor[];
  selectedActorId: string;
  onSelectActor: (id: string) => void;
  inventories: Inventory[];
  containers: Container[];
  instances: ItemInstance[];
  items: ItemDefinition[];
  runtime: CombatRuntime;
  notes: Note[];
  busy: boolean;
  onCreateHero: () => void;
  onHp: (actor: Actor, delta: number) => void;
  onOpenWorkshop: () => void;
  onChanged: () => void;
  onMessage: (message: string) => void;
};

type InspectorView = 'sheet' | 'inventory' | 'token';

const libraryTabs: [Exclude<GmSidebarTab, 'party'>, string, string][] = [
  ['characters', 'ПЕРСОНАЖИ', '♟'],
  ['content', 'КОНТЕНТ', '◆'],
  ['notes', 'ЗАМЕТКИ', '✎'],
  ['session', 'СЕССИЯ', '⚔'],
];

const actorLibraryGroups = [
  ['party', 'ГРУППА'],
  ['npc', 'NPC'],
] as const;

export function OnlineGmSidebar(props: Props) {
  const visibleTab = props.tab === 'party' ? 'characters' : props.tab;
  const [libraryOpen, setLibraryOpen] = useState(true);

  const selectLibrary = (tab: Exclude<GmSidebarTab, 'party'>) => {
    if (visibleTab === tab) {
      setLibraryOpen((value) => !value);
      return;
    }
    props.onTab(tab);
    setLibraryOpen(true);
  };

  return (
    <>
      <aside className={`gm-library ${libraryOpen ? 'expanded' : 'collapsed'}`} data-wheel-isolation="true">
        <nav className="gm-library-rail" aria-label="Библиотека мастера">
          <div className="gm-library-mark" title="Библиотека мастера">✥</div>
          {libraryTabs.map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              className={visibleTab === id ? 'active' : ''}
              title={label}
              aria-label={label}
              aria-pressed={visibleTab === id && libraryOpen}
              onClick={() => selectLibrary(id)}
            >
              <span aria-hidden="true">{icon}</span>
              <small>{label.slice(0, 4)}</small>
            </button>
          ))}
          <button className="gm-library-collapse" type="button" title={libraryOpen ? 'Свернуть библиотеку' : 'Развернуть библиотеку'} onClick={() => setLibraryOpen((value) => !value)}>
            {libraryOpen ? '‹' : '›'}
          </button>
        </nav>

        {libraryOpen && (
          <div className="gm-library-drawer">
            {visibleTab === 'characters' && <CharacterLibrary {...props} />}
            {visibleTab === 'content' && <ContentLibrary {...props} />}
            {visibleTab === 'notes' && <NotesPanel {...props} />}
            {visibleTab === 'session' && <SessionLibrary {...props} />}
          </div>
        )}
      </aside>

      <aside className="gm-inspector" data-wheel-isolation="true">
        <ActorInspector {...props} />
      </aside>
    </>
  );
}

function CharacterLibrary({ campaignId, actors, selectedActorId, onSelectActor, busy, onCreateHero, onChanged, onMessage }: Props) {
  const [search, setSearch] = useState('');
  const [creatingNpc, setCreatingNpc] = useState(false);
  const query = search.trim().toLocaleLowerCase('ru');
  const filtered = actors.filter((actor) => !query || `${actor.name} ${actor.subtitle}`.toLocaleLowerCase('ru').includes(query));
  const heroes = filtered.filter((actor) => actor.type === 'player');
  const npcs = filtered.filter((actor) => actor.type !== 'player');

  const createNpc = async () => {
    setCreatingNpc(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('create_campaign_actor', {
      target_campaign: campaignId,
      actor_name: 'Новый NPC',
      actor_kind: 'npc',
      target_scene: null,
    });
    if (error) onMessage(friendlyError(error, 'Не удалось создать NPC.'));
    else {
      if (typeof data === 'string') onSelectActor(data);
      onMessage('NPC создан. Его характеристики редактируются через единый лист персонажа.');
      onChanged();
    }
    setCreatingNpc(false);
  };

  const actorRow = (actor: Actor) => {
    const health = actorHealth(actor.system_data);
    return (
      <button key={actor.id} className={`gm-library-actor ${selectedActorId === actor.id ? 'selected' : ''}`} onClick={() => onSelectActor(actor.id)}>
        <span className="gm-library-avatar">{actor.avatar || (actor.type === 'player' ? '🧙' : '👤')}</span>
        <span><strong>{actor.name}</strong><small>{actor.subtitle || (actor.type === 'player' ? 'Персонаж игрока' : 'Персонаж мира')}</small></span>
        <em>{health?.current ?? '—'}</em>
      </button>
    );
  };

  return (
    <>
      <header className="gm-library-header">
        <div><span>БИБЛИОТЕКА</span><h2>Персонажи</h2></div>
        <button className="button" disabled={busy} onClick={onCreateHero}>＋ Герой</button>
      </header>
      <input className="control full gm-library-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск персонажа…" />

      <section className="gm-library-section">
        <div className="gm-library-section-title"><strong>{actorLibraryGroups[0][1]}</strong><span>{heroes.length}</span></div>
        <div className="gm-library-list">{heroes.map(actorRow)}</div>
        {!heroes.length && <div className="online-small-empty">Героев не найдено.</div>}
      </section>

      <section className="gm-library-section">
        <div className="gm-library-section-title"><strong>{actorLibraryGroups[1][1]}</strong><span>{npcs.length}</span></div>
        <div className="gm-library-list">{npcs.map(actorRow)}</div>
        {!npcs.length && <div className="online-small-empty">NPC не найдены.</div>}
        <button className="button full gm-library-secondary" disabled={busy || creatingNpc} onClick={() => void createNpc()}>{creatingNpc ? 'Создание…' : '＋ Создать NPC'}</button>
        <div className="gm-library-hint">NPC используют тот же лист персонажа, что и герои.</div>
      </section>
    </>
  );
}

function ContentLibrary({ items, instances, onOpenWorkshop }: Props) {
  const issuedItems = instances.reduce((total, instance) => total + Math.max(0, instance.quantity || 0), 0);
  const categories = new Set(items.map((item) => item.category)).size;

  return (
    <>
      <header className="gm-library-header"><div><span>БИБЛИОТЕКА</span><h2>Контент</h2></div></header>
      <p className="muted">Предметы, лут и таблицы собраны отдельно от управления персонажами.</p>
      <div className="gm-library-stats">
        <div><span>Предметы</span><strong>{items.length}</strong></div>
        <div><span>Выдано</span><strong>{issuedItems}</strong></div>
        <div><span>Категории</span><strong>{categories}</strong></div>
      </div>
      <button className="button primary full" onClick={onOpenWorkshop}>⚒ Открыть мастерскую</button>
      <div className="gm-library-hint">Предметы · Лут · Таблицы</div>
    </>
  );
}

function SessionLibrary({ campaignId, runtime, actors, selectedActorId, onSelectActor, busy, onChanged, onMessage }: Props) {
  const order = combatParticipants(runtime, actors);
  const current = runtime.combat_active ? order[runtime.combat_turn] ?? null : null;
  const heroes = actors.filter((actor) => actor.type === 'player').length;
  const npcs = actors.length - heroes;
  const [setupControl, setSetupControl] = useState<CombatControl>('automatic');
  const [manualInitiative, setManualInitiative] = useState<Record<string, number>>({});
  const [combatBusy, setCombatBusy] = useState(false);
  const [healthAmount, setHealthAmount] = useState(1);
  const [effectName, setEffectName] = useState('');
  const [effectKind, setEffectKind] = useState<CombatEffectKind>('condition');
  const [effectDuration, setEffectDuration] = useState('');
  const [confirmStop, setConfirmStop] = useState(false);
  const target = actors.find((actor) => actor.id === selectedActorId) ?? current;

  const callCombatRpc = async (rpc: string, args: Record<string, unknown>, fallback: string) => {
    setCombatBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc(rpc, args);
    if (error) onMessage(friendlyError(error, fallback));
    else onChanged();
    setCombatBusy(false);
    return !error;
  };

  const startCombat = async () => {
    const ok = await callCombatRpc('start_campaign_combat_v06', {
      target_campaign: campaignId,
      initiative_mode: setupControl,
      manual_initiative: manualInitiative,
    }, 'Не удалось начать бой. Проверьте, что на активной сцене есть видимые фишки.');
    if (ok) onMessage(setupControl === 'automatic' ? 'Бой начат. Инициатива определена автоматически.' : 'Бой начат с ручной инициативой.');
  };

  const setInitiative = async (actorId: string, value: number) => {
    if (!Number.isFinite(value)) return;
    await callCombatRpc('set_campaign_combat_initiative', {
      target_campaign: campaignId,
      target_actor: actorId,
      initiative_value: Math.max(-1000, Math.min(1000, Math.trunc(value))),
    }, 'Не удалось изменить инициативу.');
  };

  const setTurn = async (actorId: string) => {
    await callCombatRpc('set_campaign_combat_turn', { target_campaign: campaignId, target_actor: actorId }, 'Не удалось передать ход.');
  };

  const setControl = async (control: CombatControl) => {
    if (control === runtime.combat_control) return;
    await callCombatRpc('set_campaign_combat_control', { target_campaign: campaignId, control_mode: control }, 'Не удалось изменить управление эффектами.');
  };

  const applyHealth = async (direction: 'damage' | 'heal') => {
    if (!target) {
      onMessage('Выберите участника боя.');
      return;
    }
    const amount = Math.max(1, Math.min(100000, Math.trunc(healthAmount || 1)));
    const ok = await callCombatRpc('apply_campaign_combat_health', {
      target_campaign: campaignId,
      target_actor: target.id,
      health_delta: direction === 'damage' ? -amount : amount,
    }, direction === 'damage' ? 'Не удалось нанести урон.' : 'Не удалось восстановить здоровье.');
    if (ok) onMessage(direction === 'damage' ? `${target.name} получает ${amount} урона.` : `${target.name} восстанавливает ${amount} здоровья.`);
  };

  const addEffect = async (event: FormEvent) => {
    event.preventDefault();
    if (!target || !effectName.trim()) {
      onMessage(target ? 'Введите название состояния или эффекта.' : 'Выберите участника боя.');
      return;
    }
    const duration = effectDuration.trim() ? Math.max(1, Math.min(999, Number.parseInt(effectDuration, 10) || 1)) : null;
    const ok = await callCombatRpc('add_campaign_combat_effect', {
      target_campaign: campaignId,
      target_actor: target.id,
      effect_name: effectName.trim(),
      effect_kind: effectKind,
      effect_duration: duration,
    }, 'Не удалось добавить эффект.');
    if (ok) {
      setEffectName('');
      setEffectDuration('');
    }
  };

  const removeEffect = async (effectId: string) => {
    await callCombatRpc('remove_campaign_combat_effect', { target_campaign: campaignId, target_effect: effectId }, 'Не удалось снять эффект.');
  };

  const nextTurn = async () => {
    await callCombatRpc('next_campaign_combat_turn', { target_campaign: campaignId }, 'Не удалось перейти к следующему ходу.');
  };

  const stopCombat = async () => {
    const ok = await callCombatRpc('stop_campaign_combat', { target_campaign: campaignId }, 'Не удалось закончить бой.');
    if (ok) {
      setConfirmStop(false);
      onMessage('Бой завершён.');
    }
  };

  return (
    <>
      <header className="gm-library-header"><div><span>ИГРОВОЙ СТОЛ</span><h2>Сессия</h2></div></header>
      <div className="gm-library-stats">
        <div><span>Герои</span><strong>{heroes}</strong></div>
        <div><span>NPC</span><strong>{npcs}</strong></div>
        <div><span>Раунд</span><strong>{runtime.combat_active ? runtime.combat_round : '—'}</strong></div>
      </div>

      <section className="gm-library-section">
        <div className="gm-library-section-title"><strong>БОЙ</strong><span>{runtime.combat_active ? 'ИДЁТ' : 'ПАУЗА'}</span></div>
        {!runtime.combat_active ? (
          <div className="combat-v06-setup">
            <div className="combat-v06-toggle" role="group" aria-label="Способ определения инициативы">
              <button type="button" className={setupControl === 'automatic' ? 'active' : ''} onClick={() => setSetupControl('automatic')}>Автоматически</button>
              <button type="button" className={setupControl === 'manual' ? 'active' : ''} onClick={() => setSetupControl('manual')}>Вручную</button>
            </div>
            <p className="muted">В бой попадут видимые фишки активной сцены.</p>
            {setupControl === 'manual' && (
              <div className="combat-v06-manual-list">
                {actors.map((actor) => (
                  <label key={actor.id}><span>{actor.name}</span><input type="number" min={-1000} max={1000} value={manualInitiative[actor.id] ?? 0} onChange={(event) => setManualInitiative((value) => ({ ...value, [actor.id]: Number(event.target.value) }))} /></label>
                ))}
              </div>
            )}
            <button className="button primary full" disabled={busy || combatBusy} onClick={() => void startCombat()}>{combatBusy ? 'Начинаем…' : '⚔ Начать бой'}</button>
          </div>
        ) : (
          <>
            <div className="gm-combat-focus"><span>Сейчас ходит · инициатива {current ? combatInitiative(runtime, current.id) : '—'}</span><strong>{current?.name ?? '—'}</strong></div>
            <div className="combat-v06-toggle compact" role="group" aria-label="Управление длительностью эффектов">
              <button type="button" className={runtime.combat_control === 'automatic' ? 'active' : ''} disabled={combatBusy} onClick={() => void setControl('automatic')}>Автоэффекты</button>
              <button type="button" className={runtime.combat_control === 'manual' ? 'active' : ''} disabled={combatBusy} onClick={() => void setControl('manual')}>Вручную</button>
            </div>
            <div className="gm-combat-order combat-v06-order">
              {order.map((actor, index) => {
                const health = actorHealth(actor.system_data);
                const effects = combatEffectsForActor(runtime, actor.id);
                return (
                  <div key={actor.id} className={`${index === runtime.combat_turn ? 'active' : ''} ${actor.id === target?.id ? 'selected' : ''}`}>
                    <button type="button" className="combat-v06-turn" disabled={combatBusy} onClick={() => { onSelectActor(actor.id); void setTurn(actor.id); }} title="Сделать текущим ходом">{index + 1}</button>
                    <button type="button" className="combat-v06-actor" onClick={() => onSelectActor(actor.id)}><strong>{actor.name}</strong><small>{health?.current ?? '—'} HP{effects.length ? ` · ${effects.length} эфф.` : ''}</small></button>
                    <input aria-label={`Инициатива ${actor.name}`} type="number" min={-1000} max={1000} defaultValue={combatInitiative(runtime, actor.id)} key={`${actor.id}-${combatInitiative(runtime, actor.id)}`} disabled={combatBusy} onBlur={(event) => { const value = Number(event.target.value); if (value !== combatInitiative(runtime, actor.id)) void setInitiative(actor.id, value); }} />
                  </div>
                );
              })}
            </div>

            <section className="combat-v06-actions">
              <div className="gm-library-section-title"><strong>ДЕЙСТВИЕ</strong><span>{target?.name ?? 'Выберите участника'}</span></div>
              <label className="combat-v06-amount"><span>Значение</span><input type="number" min={1} max={100000} value={healthAmount} onChange={(event) => setHealthAmount(Number(event.target.value))} /></label>
              <div className="combat-v06-action-row">
                <button type="button" className="button danger" disabled={combatBusy || !target} onClick={() => void applyHealth('damage')}>Урон</button>
                <button type="button" className="button" disabled={combatBusy || !target} onClick={() => void applyHealth('heal')}>Лечение</button>
              </div>
            </section>

            <form className="combat-v06-effects" onSubmit={(event) => void addEffect(event)}>
              <div className="gm-library-section-title"><strong>СОСТОЯНИЯ И ЭФФЕКТЫ</strong></div>
              <input className="control full" value={effectName} onChange={(event) => setEffectName(event.target.value)} maxLength={80} placeholder="Например: Оглушён" aria-label="Название эффекта" />
              <div className="combat-v06-effect-fields">
                <div className="combat-v06-toggle compact" role="group" aria-label="Тип эффекта">
                  <button type="button" className={effectKind === 'condition' ? 'active' : ''} onClick={() => setEffectKind('condition')}>Состояние</button>
                  <button type="button" className={effectKind === 'effect' ? 'active' : ''} onClick={() => setEffectKind('effect')}>Эффект</button>
                </div>
                <input type="number" min={1} max={999} value={effectDuration} onChange={(event) => setEffectDuration(event.target.value)} placeholder="∞" aria-label="Раундов, пусто — без срока" />
              </div>
              <button className="button full" disabled={combatBusy || !target || !effectName.trim()}>Добавить</button>
              <div className="combat-v06-effect-list">
                {runtime.combat_effects.map((effect) => {
                  const actor = actors.find((value) => value.id === effect.actorId);
                  return (
                    <div key={effect.id} className={effect.kind}>
                      <span><strong>{effect.name}</strong><small>{actor?.name ?? 'Участник удалён'} · {effect.remainingRounds == null ? 'без срока' : `${effect.remainingRounds} раунд.`}</small></span>
                      <button type="button" disabled={combatBusy} onClick={() => void removeEffect(effect.id)} aria-label={`Снять ${effect.name}`}>×</button>
                    </div>
                  );
                })}
                {!runtime.combat_effects.length && <div className="online-small-empty">Активных состояний пока нет.</div>}
              </div>
            </form>

            <button className="button primary full" disabled={busy || combatBusy} onClick={() => void nextTurn()}>{combatBusy ? 'Обновляем…' : 'Следующий ход →'}</button>
            {!confirmStop ? (
              <button className="button full" disabled={busy || combatBusy} onClick={() => setConfirmStop(true)}>Закончить бой</button>
            ) : (
              <div className="combat-v06-stop" role="alertdialog" aria-label="Закончить бой?">
                <strong>Закончить бой?</strong>
                <p>Очередь, инициатива и боевые эффекты будут очищены.</p>
                <div><button type="button" className="button" disabled={combatBusy} onClick={() => setConfirmStop(false)}>Отмена</button><button type="button" className="button danger" disabled={combatBusy} onClick={() => void stopCombat()}>Закончить бой</button></div>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}

function ActorInspector(props: Props) {
  const {
    campaignId,
    actors,
    selectedActorId,
    onSelectActor,
    inventories,
    containers,
    instances,
    items,
    runtime,
    onOpenWorkshop,
    onChanged,
    onMessage,
  } = props;
  const [view, setView] = useState<InspectorView>('sheet');
  const [deleting, setDeleting] = useState(false);
  const [dragged, setDragged] = useState<string | null>(null);
  const [optimisticHealth, setOptimisticHealth] = useState<OptimisticHealth | null>(null);
  const optimisticHealthRef = useRef<OptimisticHealth | null>(null);
  const hpQueueRef = useRef<Promise<void>>(Promise.resolve());
  const hpSequenceRef = useRef(0);
  const actor = actors.find((value) => value.id === selectedActorId) ?? null;
  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const inventory = inventories.find((value) => value.owner_actor_id === actor?.id);
  const actorContainers = inventory ? containers.filter((value) => value.inventory_id === inventory.id) : [];
  const serverHealth = actor ? actorHealth(actor.system_data) : null;
  const visibleHealth = optimisticHealth?.actorId === actor?.id ? optimisticHealth : serverHealth;

  useEffect(() => {
    optimisticHealthRef.current = optimisticHealth;
  }, [optimisticHealth]);

  useEffect(() => {
    if (!actor) {
      optimisticHealthRef.current = null;
      setOptimisticHealth(null);
      return;
    }
    const optimistic = optimisticHealthRef.current;
    if (optimistic && optimistic.actorId !== actor.id) {
      optimisticHealthRef.current = null;
      setOptimisticHealth(null);
      return;
    }
    if (optimistic && serverHealth && optimistic.actorId === actor.id && optimistic.current === serverHealth.current && optimistic.max === serverHealth.max) {
      optimisticHealthRef.current = null;
      setOptimisticHealth(null);
    }
  }, [actor?.id, serverHealth?.current, serverHealth?.max]);

  const changeQuickHp = (delta: number) => {
    if (!actor) return;
    const currentHealth = optimisticHealthRef.current?.actorId === actor.id
      ? optimisticHealthRef.current
      : actorHealth(actor.system_data);
    if (!currentHealth || currentHealth.max <= 0) {
      onMessage('Для персонажа не задан ресурс здоровья.');
      return;
    }

    const nextCurrent = Math.max(0, Math.min(currentHealth.max, currentHealth.current + delta));
    const effectiveDelta = nextCurrent - currentHealth.current;
    if (effectiveDelta === 0) return;

    const optimistic: OptimisticHealth = { actorId: actor.id, current: nextCurrent, max: currentHealth.max };
    optimisticHealthRef.current = optimistic;
    setOptimisticHealth(optimistic);
    const sequence = ++hpSequenceRef.current;
    const actorId = actor.id;

    // Serialize quick-HP mutations so rapid clicks preserve their order, while the
    // visible number updates immediately instead of waiting for a network roundtrip.
    hpQueueRef.current = hpQueueRef.current.then(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('adjust_actor_hp', { target_actor: actorId, hp_delta: effectiveDelta });
      if (error) {
        if (sequence === hpSequenceRef.current && optimisticHealthRef.current?.actorId === actorId) {
          optimisticHealthRef.current = null;
          setOptimisticHealth(null);
        }
        onMessage(friendlyError(error, 'Не удалось изменить здоровье.'));
        onChanged();
        return;
      }

      if (sequence === hpSequenceRef.current && data && typeof data === 'object') {
        const saved = actorHealth(data as Record<string, any>);
        if (saved) {
          const confirmed: OptimisticHealth = { actorId, ...saved };
          optimisticHealthRef.current = confirmed;
          setOptimisticHealth(confirmed);
        }
        onChanged();
      }
    }).catch(() => {
      if (sequence === hpSequenceRef.current && optimisticHealthRef.current?.actorId === actorId) {
        optimisticHealthRef.current = null;
        setOptimisticHealth(null);
      }
      onMessage('Не удалось изменить здоровье.');
      onChanged();
    });
  };

  const deleteHero = async () => {
    if (!actor || actor.type !== 'player' || !window.confirm(`Удалить героя «${actor.name}» из кампании? Вместе с ним удалятся его фишки, лист и инвентарь. Игрок останется участником кампании.`)) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('delete_campaign_actor', { target_campaign: campaignId, target_actor: actor.id });
    if (error) onMessage(friendlyError(error, 'Не удалось удалить героя.'));
    else {
      onSelectActor('');
      onMessage(`Герой «${actor.name}» удалён.`);
      onChanged();
    }
    setDeleting(false);
  };

  const moveItem = async (containerId: string) => {
    if (!dragged) return;
    const supabase = createClient();
    const { error } = await supabase.rpc('move_item_instance', { target_campaign: campaignId, target_instance: dragged, target_container: containerId });
    if (error) onMessage(friendlyError(error, 'Не удалось переместить предмет.'));
    else onChanged();
    setDragged(null);
  };

  const removeItem = async (instanceId: string) => {
    const supabase = createClient();
    const { error } = await supabase.rpc('remove_item_instance', { target_campaign: campaignId, target_instance: instanceId });
    if (error) onMessage(friendlyError(error, 'Не удалось убрать предмет.'));
    else onChanged();
  };

  if (!actor) {
    const heroes = actors.filter((value) => value.type === 'player').length;
    return (
      <div className="gm-inspector-empty">
        <span className="gm-inspector-sigil">✥</span>
        <h2>Ничего не выбрано</h2>
        <p>Выберите фишку на карте или персонажа в библиотеке — здесь появятся его лист, инвентарь и настройки.</p>
        <div className="gm-library-stats">
          <div><span>Герои</span><strong>{heroes}</strong></div>
          <div><span>NPC</span><strong>{actors.length - heroes}</strong></div>
          <div><span>Бой</span><strong>{runtime.combat_active ? `Раунд ${runtime.combat_round}` : 'Нет'}</strong></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="gm-inspector-head">
        <div className="gm-inspector-avatar">{actor.avatar || (actor.type === 'player' ? '🧙' : '👤')}</div>
        <div><span>{actor.type === 'player' ? 'ПЕРСОНАЖ ИГРОКА' : 'NPC'}</span><h2>{actor.name}</h2><p>{actor.subtitle || (actor.type === 'player' ? 'Персонаж игрока' : 'Персонаж мира')}</p></div>
        <button className="close-button" title="Снять выбор" onClick={() => onSelectActor('')}>×</button>
      </header>

      <nav className="gm-inspector-tabs" aria-label="Выбранный персонаж">
        <button className={view === 'sheet' ? 'active' : ''} onClick={() => setView('sheet')}>Лист</button>
        <button className={view === 'inventory' ? 'active' : ''} onClick={() => setView('inventory')}>Инвентарь</button>
        <button className={view === 'token' ? 'active' : ''} onClick={() => setView('token')}>Фишка</button>
      </nav>

      <div className="gm-inspector-body">
        {view === 'sheet' && (
          <>
            <section className="gm-inspector-card">
              <div className="gm-inspector-card-title"><strong>Быстрые параметры</strong><span>Контекст персонажа</span></div>
              {visibleHealth ? (
                <div className="gm-hp-control">
                  <div><span>Здоровье</span><strong>{visibleHealth.current} / {visibleHealth.max}</strong></div>
                  <div className="gm-hp-actions">
                    <button onClick={() => changeQuickHp(-5)}>−5</button>
                    <button onClick={() => changeQuickHp(-1)}>−1</button>
                    <button onClick={() => changeQuickHp(1)}>＋1</button>
                    <button onClick={() => changeQuickHp(5)}>＋5</button>
                  </div>
                </div>
              ) : <div className="online-small-empty">Для персонажа не задан ресурс здоровья.</div>}
              <div className="gm-quick-stats">
                <div><span>Броня</span><strong>{actor.system_data?.armor ?? actor.system_data?.ac ?? '—'}</strong></div>
                <div><span>Тип</span><strong>{actor.type === 'player' ? 'Герой' : 'NPC'}</strong></div>
              </div>
            </section>

            <div className="gm-inspector-note">Герои и NPC используют один Actor Sheet. Полный лист открывается кнопкой «Лист» в нижней панели; выбор персонажа уже синхронизирован с ней.</div>
            {actor.type === 'player' && <button className="button danger full" disabled={deleting} onClick={() => void deleteHero()}>{deleting ? 'Удаление…' : 'Удалить героя'}</button>}
          </>
        )}

        {view === 'inventory' && (
          <>
            {!actorContainers.length && <div className="online-small-empty">У персонажа пока нет контейнеров инвентаря.</div>}
            {actorContainers.map((container) => {
              const rows = instances.filter((row) => row.container_id === container.id);
              return (
                <section className="inventory-container" key={container.id} onDragOver={(event) => event.preventDefault()} onDrop={() => void moveItem(container.id)}>
                  <header><strong>{container.name}</strong><span>{rows.length}</span></header>
                  <div className="inventory-slot-list">
                    {rows.map((instance) => {
                      const item = itemMap.get(instance.definition_id);
                      return (
                        <div className="inventory-row" draggable key={instance.id} onDragStart={() => setDragged(instance.id)} onDragEnd={() => setDragged(null)}>
                          <span className="inventory-icon">{item?.icon ?? '📦'}</span>
                          <span><strong>{instance.custom_name || item?.name || 'Предмет'}</strong><small>{item?.category ?? ''}{item?.weight != null ? ` · ${item.weight}` : ''}</small></span>
                          <b>×{instance.quantity}</b>
                          <button className="close-button tiny" title="Убрать" onClick={() => void removeItem(instance.id)}>×</button>
                        </div>
                      );
                    })}
                    {!rows.length && <div className="empty-drop">Перетащите предмет сюда</div>}
                  </div>
                </section>
              );
            })}
            <button className="button full" onClick={onOpenWorkshop}>⚒ Предметы и лут</button>
          </>
        )}

        {view === 'token' && (
          <section className="gm-inspector-card">
            <div className="gm-inspector-card-title"><strong>Фишка на сцене</strong><span>Контекст карты</span></div>
            <p className="muted">Размер, видимость, изображение и удаление фишки пока остаются в «Сцена → Настройки сцены». Этот раздел уже зарезервирован под перенос этих действий сюда следующим шагом.</p>
          </section>
        )}
      </div>
    </>
  );
}

function NotesPanel({ campaignId, notes, onChanged, onMessage }: Props) {
  const [selectedId, setSelectedId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [editing, setEditing] = useState(false);

  const openNew = () => {
    setSelectedId('');
    setTitle('');
    setBody('');
    setPinned(false);
    setEditing(true);
  };

  const openEdit = (note: Note) => {
    setSelectedId(note.id);
    setTitle(note.title ?? '');
    setBody(note.body);
    setPinned(note.pinned);
    setEditing(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const supabase = createClient();
    const result = selectedId
      ? await supabase.rpc('update_gm_note', { target_campaign: campaignId, target_note: selectedId, note_title: title, note_body: body, note_pinned: pinned })
      : await supabase.rpc('create_gm_note', { target_campaign: campaignId, note_title: title, note_body: body, note_pinned: pinned });
    if (result.error) onMessage(friendlyError(result.error, 'Не удалось сохранить заметку.'));
    else {
      setEditing(false);
      onChanged();
    }
  };

  const remove = async (note: Note) => {
    if (!window.confirm('Удалить заметку?')) return;
    const supabase = createClient();
    const { error } = await supabase.rpc('delete_gm_note', { target_campaign: campaignId, target_note: note.id });
    if (error) onMessage(friendlyError(error, 'Не удалось удалить заметку.'));
    else {
      setSelectedId('');
      setEditing(false);
      onChanged();
    }
  };

  if (editing) {
    return (
      <form className="gm-notes-editor" onSubmit={save}>
        <header className="gm-library-header"><div><span>ЗАМЕТКИ</span><h2>{selectedId ? 'Редактирование' : 'Новая заметка'}</h2></div></header>
        <input className="control full" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Заголовок" />
        <textarea className="control notes-area" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Текст заметки..." />
        <label><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} /> Закрепить</label>
        <button className="button primary full">Сохранить</button>
        <button type="button" className="button full" onClick={() => setEditing(false)}>Отмена</button>
      </form>
    );
  }

  return (
    <>
      <header className="gm-library-header"><div><span>БИБЛИОТЕКА</span><h2>Заметки</h2></div><button className="button" onClick={openNew}>＋</button></header>
      <div className="gm-note-list">
        {notes.map((note) => (
          <article className="note-card" key={note.id}>
            <strong>{note.pinned ? '📌 ' : ''}{note.title || 'Без названия'}</strong>
            <p>{note.body || 'Пустая заметка'}</p>
            <div><button className="button" onClick={() => openEdit(note)}>Править</button> <button className="button danger" onClick={() => void remove(note)}>Удалить</button></div>
          </article>
        ))}
      </div>
      {!notes.length && <div className="online-small-empty">Заметок пока нет.</div>}
    </>
  );
}

function actorHealth(data: Record<string, any> | null | undefined): HealthValue | null {
  const resource = objectResource(data?.hit_points) ?? objectResource(data?.hp);
  if (!resource) return null;
  const current = Number(resource.current);
  const max = Number(resource.max);
  if (!Number.isFinite(current) || !Number.isFinite(max)) return null;
  return { current, max };
}

function objectResource(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
