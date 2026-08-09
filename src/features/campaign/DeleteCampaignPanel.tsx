'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';

export function DeleteCampaignPanel({ campaignId, campaignName }: { campaignId: string; campaignName: string }) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (value !== campaignName) {
      setMessage('Введите название кампании точно как показано выше.');
      return;
    }
    if (!window.confirm('Удалить кампанию без возможности восстановления?')) return;

    setBusy(true); setMessage('');
    const supabase = createClient();
    const { error } = await supabase.rpc('delete_campaign', { target_campaign: campaignId, expected_name: value });
    if (error) {
      setMessage(friendlyError(error, 'Не удалось удалить кампанию.'));
      setBusy(false);
      return;
    }

    router.replace('/campaigns/online');
    router.refresh();
  };

  return (
    <section className="manage-card danger-card">
      <div className="manage-card-head"><div><span className="eyebrow">ОПАСНАЯ ЗОНА</span><h3>Удалить кампанию</h3></div></div>
      <p className="muted">Будут удалены карта, персонажи, предметы, книги и остальные данные этой кампании.</p>
      <label className="delete-confirm-label">Введите <b>{campaignName}</b><input value={value} onChange={(e) => setValue(e.target.value)} placeholder={campaignName} /></label>
      <button className="button danger" onClick={remove} disabled={busy || value !== campaignName}>{busy ? 'Удаляем…' : 'Удалить кампанию'}</button>
      {message && <div className="auth-status">{message}</div>}
    </section>
  );
}
