import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { InvitePanel } from './InvitePanel';
import { MembersPanel } from './MembersPanel';
import { DeleteCampaignPanel } from './DeleteCampaignPanel';

const settingLabels: Record<string, string> = {
  'medieval-fantasy': 'Средневековое фэнтези',
};
const themeLabels: Record<string, string> = {
  'dark-fantasy': 'Тёмное фэнтези',
};

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
  const isOwner = membership.role === 'owner';
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

      <section className="campaign-room-hero">
        <span className="eyebrow">{mode === 'gm' ? 'КАМПАНИЯ' : 'ПРИКЛЮЧЕНИЕ'}</span>
        <h1>{campaign.name}</h1>
        <p>{campaign.description || 'Описание пока не добавлено.'}</p>
        <div className="friendly-tags">
          <span>{settingLabels[campaign.setting_id] ?? 'Авторский мир'}</span>
          <span>{themeLabels[campaign.theme_id] ?? 'Своя атмосфера'}</span>
        </div>
      </section>

      {mode === 'gm' ? (
        <div className="campaign-manage-grid">
          <div className="manage-stack">
            <MembersPanel campaignId={campaignId} ownerId={campaign.owner_id} canManageRoles={isOwner} canAssignActors={gmAllowed} />
            <InvitePanel campaignId={campaignId} />
          </div>
          <div className="manage-stack">
            <section className="manage-card play-card">
              <span className="eyebrow">ИГРОВОЙ СТОЛ</span>
              <h3>Продолжить кампанию</h3>
              <p className="muted">Персонажи, карта и инвентарь будут открываться здесь одной игровой комнатой.</p>
              <button className="button primary" disabled>Открыть стол</button>
            </section>
            {isOwner && <DeleteCampaignPanel campaignId={campaignId} campaignName={campaign.name} />}
          </div>
        </div>
      ) : (
        <section className="player-wait-card">
          <h2>Вы в кампании</h2>
          <p>Когда мастер подготовит персонажа и сцену, игровой стол откроется здесь.</p>
          <Link className="button" href="/campaigns/online">Мои кампании</Link>
        </section>
      )}
    </main>
  );
}
