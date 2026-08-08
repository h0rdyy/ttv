create table public.campaign_invites (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  role public.campaign_role not null default 'player',
  expires_at timestamptz,
  max_uses integer not null default 1 check (max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  created_at timestamptz not null default now()
);
create index campaign_invites_campaign_idx on public.campaign_invites(campaign_id);
create index campaign_invites_token_idx on public.campaign_invites(token);
alter table public.campaign_invites enable row level security;
create policy campaign_invites_gm_read on public.campaign_invites for select using (public.is_campaign_gm(campaign_id));
create policy campaign_invites_gm_insert on public.campaign_invites for insert with check (public.is_campaign_gm(campaign_id) and created_by=(select auth.uid()));
create policy campaign_invites_gm_delete on public.campaign_invites for delete using (public.is_campaign_gm(campaign_id));

create or replace function public.accept_campaign_invite(invite_token text)
returns uuid language plpgsql security definer set search_path=public as $$
declare invite public.campaign_invites;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into invite from public.campaign_invites where token=invite_token for update;
  if invite.id is null then raise exception 'invite not found'; end if;
  if invite.expires_at is not null and invite.expires_at < now() then raise exception 'invite expired'; end if;
  if invite.use_count >= invite.max_uses then raise exception 'invite exhausted'; end if;
  insert into public.campaign_members(campaign_id,user_id,role)
  values(invite.campaign_id,auth.uid(),invite.role)
  on conflict(campaign_id,user_id) do nothing;
  update public.campaign_invites set use_count=use_count+1 where id=invite.id;
  return invite.campaign_id;
end;
$$;
revoke all on function public.accept_campaign_invite(text) from public,anon;
grant execute on function public.accept_campaign_invite(text) to authenticated;
