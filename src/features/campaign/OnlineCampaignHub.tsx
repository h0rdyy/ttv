import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createOnlineCampaign, signOutOnlineCampaigns } from './onlineCampaignActions';

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
const errorLabels: Record<string, string> = {
  required: 'Введите название кампании.',
  'create-failed': 'Не удалось создать кампанию. Попробуйте ещё раз.',
};

export async function OnlineCampaignHub({ error, notice }: { error?: string; notice?: string }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  const [{ data: campaignRows, error: campaignError }, { data: memberships, error: memberError }] = await Promise.all([
    supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
    supabase.from('campaign_members').select('campaign_id,role').eq('user_id', auth.user.id),
  ]);

  const roles = new Map((memberships ?? []).map((membership) => [membership.campaign_id, membership.role as Role]));
  const campaigns = ((campaignRows ?? []).map((campaign) => ({
    ...campaign,
    role: roles.get(campaign.id) ?? 'player',
  })) as CampaignRow[]);
  const loadError = campaignError || memberError ? 'Не удалось загрузить кампании.' : '';

  return (
    <main className="online-hub">
      <header className="online-hub-header">
        <div><div className="brand">✥ TTV</div><small>{auth.user.email}</small></div>
        <form action={signOutOnlineCampaigns}><button className="button" type="submit">Выйти</button></form>
      </header>

      <section className="online-hero">
        <span className="eyebrow">МОИ КАМПАНИИ</span>
        <h1>Куда отправимся сегодня?</h1>
        <p>Продолжите существующую кампанию или создайте новый мир.</p>
      </section>

      <div className="online-layout">
        <section className="online-list">
          <div className="hub-section-head"><div><span className="eyebrow">КАМПАНИИ</span><h2>Ваши приключения</h2></div></div>
          {loadError ? <div className="empty-card">{loadError}</div> : campaigns.length === 0 ? (
            <div className="empty-card">Кампаний пока нет. Создайте первую справа.</div>
          ) : (
            <div className="online-cards">
              {campaigns.map((campaign) => {
                const gmMode = ['owner', 'gm', 'assistant-gm'].includes(campaign.role);
                return (
                  <article className="online-card" key={campaign.id}>
                    <div><span className="eyebrow">{roleLabels[campaign.role]}</span><h3>{campaign.name}</h3><p>{campaign.description || 'Без описания'}</p></div>
                    <div className="online-card-meta"><span>{settingLabels[campaign.setting_id] ?? 'Авторский мир'}</span></div>
                    <div className="online-card-actions">
                      <Link className="button primary" href={`/campaign/${campaign.id}/${gmMode ? 'play' : 'player'}`}>Открыть кампанию</Link>
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
          <form action={createOnlineCampaign} className="auth-form">
            <label htmlFor="campaign-name">
              Название
              <input id="campaign-name" name="name" required placeholder="Например: Пепельная корона" />
            </label>
            <label htmlFor="campaign-description">
              Описание
              <textarea id="campaign-description" name="description" placeholder="Пара слов о будущем приключении" />
            </label>
            <button className="button primary full" type="submit">＋ Создать кампанию</button>
          </form>
          {error && <div className="auth-status">{errorLabels[error] ?? 'Не удалось выполнить действие.'}</div>}
          {notice === 'created' && <div className="auth-status">Кампания создана.</div>}
        </aside>
      </div>
    </main>
  );
}
