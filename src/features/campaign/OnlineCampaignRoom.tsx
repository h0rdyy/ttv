import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function OnlineCampaignRoom({ campaignId, mode }: { campaignId: string; mode: 'gm' | 'player' }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  const [{ data: campaign }, { data: membership }] = await Promise.all([
    supabase.from('campaigns').select('*').eq('id', campaignId).maybeSingle(),
    supabase.from('campaign_members').select('role').eq('campaign_id', campaignId).eq('user_id', auth.user.id).maybeSingle(),
  ]);

  if (!campaign || !membership) redirect('/campaigns/online');

  const gmAllowed = ['owner', 'gm', 'assistant-gm'].includes(membership.role);
  if (mode === 'gm' && !gmAllowed) redirect(`/campaign/${campaignId}/player`);

  return (
    <main className="online-room">
      <header className="online-hub-header">
        <div><div className="brand">✥ TTV</div><small>{campaign.name}</small></div>
        <div className="online-hub-actions">
          {gmAllowed && <Link className={`button ${mode === 'gm' ? 'primary' : ''}`} href={`/campaign/${campaignId}/play`}>Мастер</Link>}
          <Link className={`button ${mode === 'player' ? 'primary' : ''}`} href={`/campaign/${campaignId}/player`}>Игрок</Link>
          <Link className="button" href="/campaigns/online">К кампаниям</Link>
        </div>
      </header>
      <section className="online-room-card">
        <span className="eyebrow">СЕРВЕРНАЯ КАМПАНИЯ · {membership.role}</span>
        <h1>{campaign.name}</h1>
        <p>{campaign.description || 'Описание пока не добавлено.'}</p>
        <div className="online-card-meta"><span>{campaign.system_id}</span><span>{campaign.setting_id}</span><span>{campaign.theme_id}</span></div>
        <div className="room-status-grid">
          <div><b>Auth</b><span>✓ реальный пользователь</span></div>
          <div><b>PostgreSQL</b><span>✓ кампания на сервере</span></div>
          <div><b>RLS</b><span>✓ роль проверена БД</span></div>
          <div><b>Gameplay sync</b><span>следующий блок v0.2</span></div>
        </div>
        <p className="room-note">Этот экран специально не подменяет серверные данные локальным demo-state. Следующим блоком подключаем Actors / Scenes / Inventory этой кампании к игровому UI, после чего здесь появится сам стол.</p>
      </section>
    </main>
  );
}
