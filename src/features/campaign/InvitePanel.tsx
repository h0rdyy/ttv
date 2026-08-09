'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';

type InviteRow = { token: string; revoked_at: string | null; created_at: string };

export function InvitePanel({ campaignId }: { campaignId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const inviteUrl = useMemo(() => {
    if (!token || typeof window === 'undefined') return '';
    return `${window.location.origin}/join/${token}`;
  }, [token]);

  const load = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('campaign_invites')
      .select('token,revoked_at,created_at')
      .eq('campaign_id', campaignId)
      .eq('role', 'player')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      setMessage(friendlyError(error, 'Не удалось загрузить приглашение.'));
      return;
    }

    const latest = data as InviteRow | null;
    if (!latest) {
      const { data: created, error: createError } = await supabase.rpc('ensure_campaign_player_invite', { target_campaign: campaignId });
      if (createError) setMessage(friendlyError(createError, 'Не удалось создать приглашение.'));
      else { setToken(created as string); setDisabled(false); }
      return;
    }

    setToken(latest.revoked_at ? null : latest.token);
    setDisabled(Boolean(latest.revoked_at));
  };

  useEffect(() => { void load(); }, [campaignId]);

  const copy = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setMessage('Ссылка скопирована.');
  };

  const regenerate = async () => {
    setBusy(true); setMessage('');
    const supabase = createClient();
    const { data, error } = await supabase.rpc('rotate_campaign_player_invite', { target_campaign: campaignId });
    if (error) setMessage(friendlyError(error, 'Не удалось обновить ссылку.'));
    else { setToken(data as string); setDisabled(false); setMessage('Новая ссылка готова. Старая больше не работает.'); }
    setBusy(false);
  };

  const disable = async () => {
    setBusy(true); setMessage('');
    const supabase = createClient();
    const { error } = await supabase.rpc('disable_campaign_player_invite', { target_campaign: campaignId });
    if (error) setMessage(friendlyError(error, 'Не удалось отключить приглашение.'));
    else { setToken(null); setDisabled(true); setMessage('Приглашения отключены.'); }
    setBusy(false);
  };

  const enable = async () => {
    setBusy(true); setMessage('');
    const supabase = createClient();
    const { data, error } = await supabase.rpc('ensure_campaign_player_invite', { target_campaign: campaignId });
    if (error) setMessage(friendlyError(error, 'Не удалось включить приглашение.'));
    else { setToken(data as string); setDisabled(false); setMessage('Приглашение включено.'); }
    setBusy(false);
  };

  return (
    <section className="manage-card">
      <div className="manage-card-head">
        <div><span className="eyebrow">ПРИГЛАШЕНИЕ</span><h3>Ссылка для игроков</h3></div>
        <span className={`status-dot ${disabled ? 'off' : ''}`}>{disabled ? 'Отключено' : 'Включено'}</span>
      </div>

      {token ? (
        <>
          <p className="muted">Отправьте эту ссылку всем игрокам кампании.</p>
          <div className="invite-link-row"><input readOnly value={inviteUrl} /><button className="button primary" onClick={copy}>Копировать</button></div>
          <div className="manage-actions">
            <button className="button" onClick={regenerate} disabled={busy}>Создать новую ссылку</button>
            <button className="button danger-soft" onClick={disable} disabled={busy}>Отключить</button>
          </div>
        </>
      ) : (
        <div className="empty-manage">
          <p>По ссылке сейчас нельзя вступить в кампанию.</p>
          <button className="button primary" onClick={enable} disabled={busy}>Включить приглашение</button>
        </div>
      )}
      {message && <div className="auth-status">{message}</div>}
    </section>
  );
}
