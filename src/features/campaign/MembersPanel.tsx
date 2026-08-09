'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';

type Role = 'owner' | 'gm' | 'assistant-gm' | 'player' | 'spectator';
type Member = { user_id: string; role: Role; joined_at: string; displayName: string };
type Actor = { id: string; name: string; type: string; owner_user_id: string | null };

const roleLabels: Record<Role, string> = {
  owner: 'Владелец',
  gm: 'Мастер',
  'assistant-gm': 'Помощник мастера',
  player: 'Игрок',
  spectator: 'Наблюдатель',
};

export function MembersPanel({ campaignId, ownerId, canManageRoles, canAssignActors }: {
  campaignId: string;
  ownerId: string;
  canManageRoles: boolean;
  canAssignActors: boolean;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [actors, setActors] = useState<Actor[]>([]);
  const [message, setMessage] = useState('');
  const [busyKey, setBusyKey] = useState('');

  const load = async () => {
    const supabase = createClient();
    const [{ data: membershipRows, error: memberError }, { data: actorRows, error: actorError }] = await Promise.all([
      supabase.from('campaign_members').select('user_id,role,joined_at').eq('campaign_id', campaignId).order('joined_at'),
      supabase.from('actors').select('id,name,type,owner_user_id').eq('campaign_id', campaignId).order('name'),
    ]);

    if (memberError || actorError) {
      setMessage(friendlyError(memberError ?? actorError, 'Не удалось загрузить участников.'));
      return;
    }

    const ids = (membershipRows ?? []).map((row) => row.user_id);
    const { data: profiles, error: profileError } = ids.length
      ? await supabase.from('profiles').select('id,display_name').in('id', ids)
      : { data: [], error: null };

    if (profileError) {
      setMessage(friendlyError(profileError, 'Не удалось загрузить имена участников.'));
      return;
    }

    const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name || 'Участник']));
    setMembers((membershipRows ?? []).map((row) => ({
      ...row,
      role: row.role as Role,
      displayName: names.get(row.user_id) ?? 'Участник',
    })));
    setActors((actorRows ?? []) as Actor[]);
  };

  useEffect(() => { void load(); }, [campaignId]);

  const changeRole = async (member: Member, role: Exclude<Role, 'owner'>) => {
    setBusyKey(`role:${member.user_id}`); setMessage('');
    const supabase = createClient();
    const { error } = await supabase.rpc('set_campaign_member_role', {
      target_campaign: campaignId,
      target_user: member.user_id,
      target_role: role,
    });
    if (error) setMessage(friendlyError(error, 'Не удалось изменить роль.'));
    else await load();
    setBusyKey('');
  };

  const removeMember = async (member: Member) => {
    if (!window.confirm(`Исключить ${member.displayName} из кампании?`)) return;
    setBusyKey(`remove:${member.user_id}`); setMessage('');
    const supabase = createClient();
    const { error } = await supabase.rpc('remove_campaign_member', {
      target_campaign: campaignId,
      target_user: member.user_id,
    });
    if (error) setMessage(friendlyError(error, 'Не удалось исключить участника.'));
    else await load();
    setBusyKey('');
  };

  const assignActor = async (actorId: string, userId: string | null) => {
    setBusyKey(`actor:${actorId}`); setMessage('');
    const supabase = createClient();
    const { error } = await supabase.rpc('assign_actor_to_member', {
      target_campaign: campaignId,
      target_actor: actorId,
      target_user: userId,
    });
    if (error) setMessage(friendlyError(error, 'Не удалось назначить персонажа.'));
    else await load();
    setBusyKey('');
  };

  return (
    <section className="manage-card">
      <div className="manage-card-head"><div><span className="eyebrow">ГРУППА</span><h3>Участники</h3></div><span className="member-count">{members.length}</span></div>
      <div className="member-list">
        {members.map((member) => (
          <div className="member-row" key={member.user_id}>
            <div className="member-main"><strong>{member.displayName}</strong><small>{roleLabels[member.role]}</small></div>
            {member.user_id === ownerId ? <span className="member-role-fixed">Владелец</span> : canManageRoles ? (
              <div className="member-controls">
                <select value={member.role} disabled={busyKey === `role:${member.user_id}`} onChange={(e) => changeRole(member, e.target.value as Exclude<Role, 'owner'>)}>
                  <option value="player">Игрок</option>
                  <option value="spectator">Наблюдатель</option>
                  <option value="assistant-gm">Помощник мастера</option>
                  <option value="gm">Мастер</option>
                </select>
                <button className="icon-danger" title="Исключить" onClick={() => removeMember(member)} disabled={Boolean(busyKey)}>×</button>
              </div>
            ) : <span className="member-role-fixed">{roleLabels[member.role]}</span>}
          </div>
        ))}
      </div>

      {canAssignActors && (
        <div className="actor-assignments">
          <div className="subhead"><strong>Персонажи</strong><span>Кто кем управляет</span></div>
          {actors.length === 0 ? <p className="muted compact">Персонажей пока нет. Создадим их в следующем игровом блоке.</p> : actors.map((actor) => (
            <label className="actor-assignment" key={actor.id}>
              <span><b>{actor.name}</b><small>{actor.type}</small></span>
              <select value={actor.owner_user_id ?? ''} disabled={busyKey === `actor:${actor.id}`} onChange={(e) => assignActor(actor.id, e.target.value || null)}>
                <option value="">Не назначен</option>
                {members.filter((member) => member.role !== 'spectator').map((member) => <option key={member.user_id} value={member.user_id}>{member.displayName}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}
      {message && <div className="auth-status">{message}</div>}
    </section>
  );
}
