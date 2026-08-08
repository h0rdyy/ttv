'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type CampaignRow = {
  id: string;
  name: string;
  description: string | null;
  system_id: string;
  setting_id: string;
  theme_id: string;
  owner_id: string;
  created_at: string;
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

    const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
    if (error) setMessage(error.message);
    else setCampaigns((data ?? []) as CampaignRow[]);
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
    if (error) setMessage(error.message);
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
        <div className="online-hub-actions"><Link className="button" href="/campaigns">Локальное демо</Link><button className="button" onClick={signOut}>Выйти</button></div>
      </header>

      <section className="online-hero">
        <span className="eyebrow">SUPABASE ONLINE</span>
        <h1>Твои кампании</h1>
        <p>Эти кампании уже хранятся в PostgreSQL и фильтруются серверными RLS-политиками.</p>
      </section>

      <div className="online-layout">
        <section className="online-list">
          <div className="hub-section-head"><div><span className="eyebrow">КАМПАНИИ</span><h2>Доступные тебе</h2></div></div>
          {loading ? <div className="empty-card">Загрузка…</div> : campaigns.length === 0 ? <div className="empty-card">Пока нет серверных кампаний. Создай первую справа.</div> : (
            <div className="online-cards">
              {campaigns.map((campaign) => (
                <article className="online-card" key={campaign.id}>
                  <div><span className="eyebrow">{campaign.setting_id}</span><h3>{campaign.name}</h3><p>{campaign.description || 'Без описания'}</p></div>
                  <div className="online-card-meta"><span>{campaign.system_id}</span><span>{campaign.theme_id}</span></div>
                  <div className="online-card-actions">
                    <Link className="button" href={`/campaign/${campaign.id}/player`}>Игрок</Link>
                    <Link className="button primary" href={`/campaign/${campaign.id}/play`}>Открыть как GM</Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="create-campaign-card">
          <span className="eyebrow">НОВАЯ КАМПАНИЯ</span>
          <h2>Создать мир</h2>
          <form onSubmit={createCampaign} className="auth-form">
            <label>Название<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: Пепельная корона" /></label>
            <label>Описание<textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Коротко о кампании" /></label>
            <button className="button primary full" disabled={busy}>{busy ? 'Создаём…' : '＋ Создать кампанию'}</button>
          </form>
          <small>Пока новая кампания использует generic-fantasy preset. Выбор системы и сеттинга подключим следующим шагом.</small>
          {message && <div className="auth-status">{message}</div>}
        </aside>
      </div>
    </main>
  );
}
