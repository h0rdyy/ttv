import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEMO_CAMPAIGN_NAME } from '@/config/demo';
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

  const [{ data: campaignRows, error: campaignError }, { data: memberships, error: memberError }, { data: profile }] = await Promise.all([
    supabase.from('campaigns').select('*').neq('name', DEMO_CAMPAIGN_NAME).order('created_at', { ascending: false }),
    supabase.from('campaign_members').select('campaign_id,role').eq('user_id', auth.user.id),
    supabase.from('profiles').select('display_name').eq('id', auth.user.id).maybeSingle(),
  ]);

  const roles = new Map((memberships ?? []).map((membership) => [membership.campaign_id, membership.role as Role]));
  const campaigns = ((campaignRows ?? []).map((campaign) => ({
    ...campaign,
    role: roles.get(campaign.id) ?? 'player',
  })) as CampaignRow[]);
  const loadError = campaignError || memberError ? 'Не удалось загрузить кампании.' : '';

  const metadataName = typeof auth.user.user_metadata?.display_name === 'string'
    ? auth.user.user_metadata.display_name.trim()
    : '';
  const emailName = (auth.user.email ?? '').split('@')[0];
  const nickname = (profile?.display_name || '').trim() || metadataName || emailName;

  return (
    <main className="online-hub">
      <header className="online-hub-header">
        <div><div className="brand">✥ TTV</div><small>{nickname}</small></div>
        <div className="online-hub-actions">
          <Link className="button" href="/campaign/demo/play">Демо-стол</Link>
          <form action={signOutOnlineCampaigns}><button className="button" type="submit">Выйти</button></form>
        </div>
      </header>

      <section className="online-hero">
        <span className="eyebrow">МОИ КАМПАНИИ</span>
        {campaigns.length === 0 && !loadError ? (
          <>
            <h1>Добро пожаловать, {nickname}!</h1>
            <p>Здесь появятся ваши приключения. Первую кампанию можно создать за минуту — форма справа.</p>
          </>
        ) : (
          <>
            <h1>С возвращением, {nickname}</h1>
            <p>Продолжите существующую кампанию или создайте новый мир.</p>
          </>
        )}
      </section>

      <div className="online-layout">
        <section className="online-list">
          <div className="hub-section-head"><div><span className="eyebrow">КАМПАНИИ</span><h2>Ваши приключения</h2></div></div>
          {loadError ? <div className="empty-card">{loadError}</div> : campaigns.length === 0 ? (
            <div className="newbie-guide">
              <strong>С чего начать</strong>
              <ol>
                <li><b>Придумайте название</b> и нажмите «Создать кампанию» — справа.</li>
                <li><b>Откройте стол</b> и загрузите карту в разделе «Сцена → Настройки сцены».</li>
                <li><b>Пригласите игроков</b> — ссылка-приглашение лежит в разделе «Кампания».</li>
              </ol>
              <p>Подсказка: удалённую демо-кампанию можно воссоздать — просто создайте новую форму справа.</p>
            </div>
          ) : (
            <div className="online-cards">
              {campaigns.map((campaign) => {
                const gmMode = ['owner', 'gm', 'assistant-gm'].includes(campaign.role);
                const created = new Date(campaign.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
                return (
                  <article className="online-card" key={campaign.id}>
                    <div><span className="eyebrow">{roleLabels[campaign.role]}</span><h3>{campaign.name}</h3><p>{campaign.description || 'Без описания'}</p></div>
                    <div className="online-card-meta"><span>{settingLabels[campaign.setting_id] ?? 'Авторский мир'}</span><span>с {created}</span></div>
                    <div className="online-card-actions">
                      <Link className="button primary" href={`/campaign/${campaign.id}/${gmMode ? 'play' : 'player'}`}>Открыть кампанию</Link>
                      {gmMode && <Link className="button" href={`/campaign/${campaign.id}/manage`}>Настройки</Link>}
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
