'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';

export function JoinCampaign({ token }: { token: string }) {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const join = async () => {
    setBusy(true); setStatus('');
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push(`/login?next=/join/${token}`);
      return;
    }
    const { data, error } = await supabase.rpc('accept_campaign_invite', { invite_token: token });
    if (error) { setStatus(friendlyError(error, 'Не удалось вступить в кампанию.')); setBusy(false); return; }
    if (data) router.replace(`/campaign/${data}/player`);
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link href="/campaigns/online" className="brand">✥ TTV</Link>
        <span className="eyebrow">ПРИГЛАШЕНИЕ</span>
        <h1>Вступить в кампанию</h1>
        <p>Примите приглашение, чтобы присоединиться к группе.</p>
        <button className="button primary full" onClick={join} disabled={busy}>{busy ? 'Вступаем…' : 'Присоединиться'}</button>
        {status && <div className="auth-status">{status}</div>}
      </section>
    </main>
  );
}
