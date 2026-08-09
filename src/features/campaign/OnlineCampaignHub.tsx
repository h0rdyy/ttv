'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';

type Role = 'owner' | 'gm' | 'assistant-gm' | 'player' | 'spectator';
type CampaignRow = {
  id: string;
  name: string;
  description: string | null;
  system_id: string;
  setting_id: string;
  theme_id: string;
  owner_id: string;
  created_at: string;
  role: Role;
};

const settingLabels: Record<string, string> = { 'medieval-fantasy': 'Средневековое фэнтези' };
const roleLabels: Record<Role, string> = {
  owner: 'Владелец', gm: 'Мастер', 'assistant-gm': 'Помощник мастера', player: 'Игрок', spectator: 'Наблюдатель',
};

export function OnlineCampaignHub() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState<string | null>(null);

  const load = async () => {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.replace('/login');
      return;
    }
    setEmail(auth.user.email ?? null);

    const [{ data: campaignRows, error: campaignError }, { data: memberships, error: memberError }] = await Promise.all([
      supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('campaign_members').select('campaign_id,role').eq('user_id', auth.user.id),
    ]);

    if (campaignError || memberError) {
      setMessage(friendlyError(campaignError ?? memberError, 'Не удалось загрузить кампании.'));
    } else {
      const roles = new Map((memberships ?? []).map((membership) => [membership.campaign_id, membership.role as Role]));
      setCampaigns((campaignRows ?? []).map((campaign) => ({ ...campaign, role: roles.get(campaign.id) ?? 'player' })) as CampaignRow[]);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const createCampaign = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setMessage('');
    const supabase = createClient();
    const { error } = await supabase.rpc('create_campaign', {
      campaign_name: name.trim(),
      campaign_description: description.trim() || null,
      campaign_system_id: 'generic-fantasy',
      campaign_setting_id: 'medieval-fantasy',
      campaign_theme_id: 'dark-fantasy',
    });
    if (error) setMessage(friendlyError(error, 'Не удалось создать кампанию.'));
    else {
      setName('');
      setDescription('');
      await load();
    }
    setBusy(false);
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  return (
    <main className="online-hub">
      <header className="online-hub-header">
        <div><div className="brand">✥ TTV</div><small>{email}</small></div>
        <button className="button" onClick={signOut}>Выйти</button>
      </header>

      <section className="online-hero">
        <span className="eyebrow">МОИ КАМПАНИИ</span>
        <h1>Куда отправимся сегодня?</h1>
        <p>Продолжите существующую кампанию или создайте новый мир.</p>
      </section>

      <div className="online-layout">
        <section className="online-list">
          <div className="hub-section-head"><div><span className="eyebrow">КАМПАНИИ</span><h2>Ваши приключения</h2></div></div>
          {loading ? <div className="empty-card">Загрузка…</div> : campaigns.length === 0 ? <div className="empty-card">Кампаний пока нет. Создайте первую справа.</div> : (
            <div className="online-cards">
              {campaigns.map((campaign) => {
                const gmMode = ['owner', 'gm', 'assistant-gm'].includes(campaign.role);
                return (
                  <article className="online-card" key={campaign.id}>
                    <div><span className="eyebrow">{roleLabels[campaign.role]}</span><h3>{campaign.name}</h3><p>{campaign.description || 'Без описания'}</p></div>
                    <div className="online-card-meta"><span>{settingLabels[campaign.setting_id] ?? 'Авторский мир'}</span></div>
                    <div className="online-card-actions">
                      <button className="button primary" onClick={() => router.push(`/campaign/${campaign.id}/${gmMode ? 'play' : 'player'}`)}>Открыть кампанию</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="create-campaign-card">
          <span className="eyebrow">НОВАЯ КАМПАНИЯ</span>
          <h2>Создать мир</h2>
          <form onSubmit={createCampaign} className="auth-form">
            <label>Название<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: Пепельная корона" /></label>
            <label>Описание<textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Пара слов о будущем приключении" /></label>
            <button className="button primary full" disabled={busy}>{busy ? 'Создаём…' : '＋ Создать кампанию'}</button>
          </form>
          {message && <div className="auth-status">{message}</div>}
        </aside>
      </div>
    </main>
  );
}
