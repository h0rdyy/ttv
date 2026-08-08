'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Invite = { id: string; token: string; role: string; use_count: number; max_uses: number; created_at: string };

export function InvitePanel({ campaignId }: { campaignId: string }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const supabase = createClient();
    const { data, error } = await supabase.from('campaign_invites').select('id,token,role,use_count,max_uses,created_at').eq('campaign_id', campaignId).order('created_at', { ascending: false });
    if (error) setMessage(error.message);
    else setInvites((data ?? []) as Invite[]);
  };

  useEffect(() => { void load(); }, [campaignId]);

  const createInvite = async () => {
    setBusy(true); setMessage('');
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setMessage('Нужно войти.'); setBusy(false); return; }
    const { data, error } = await supabase.from('campaign_invites').insert({ campaign_id: campaignId, created_by: auth.user.id, role: 'player', max_uses: 1 }).select('token').single();
    if (error) setMessage(error.message);
    else if (data?.token) {
      const link = `${window.location.origin}/join/${data.token}`;
      await navigator.clipboard.writeText(link).catch(() => undefined);
      setMessage('Ссылка создана и скопирована.');
      await load();
    }
    setBusy(false);
  };

  const copy = async (token: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/join/${token}`);
    setMessage('Ссылка скопирована.');
  };

  return (
    <section className="invite-panel">
      <div className="invite-panel-head"><div><span className="eyebrow">ИГРОКИ</span><h3>Приглашения</h3></div><button className="button primary" onClick={createInvite} disabled={busy}>{busy ? 'Создаём…' : '＋ Ссылка игроку'}</button></div>
      {invites.length === 0 ? <p className="muted">Активных ссылок ещё нет.</p> : <div className="invite-list">{invites.map((invite) => <div key={invite.id}><span>Игрок · {invite.use_count}/{invite.max_uses}</span><button className="button" onClick={() => copy(invite.token)}>Копировать</button></div>)}</div>}
      {message && <div className="auth-status">{message}</div>}
    </section>
  );
}
