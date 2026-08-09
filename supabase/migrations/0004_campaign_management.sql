-- TTV v0.2 campaign management + reusable invites + migration parity.

-- Public Data API needs table/function grants; RLS remains the actual row-level gate.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.profiles,
  public.campaigns,
  public.campaign_members,
  public.actors,
  public.scenes,
  public.scene_tokens,
  public.item_definitions,
  public.inventories,
  public.inventory_containers,
  public.item_instances,
  public.journal_notes,
  public.books,
  public.book_pages,
  public.roll_tables,
  public.campaign_invites
  to authenticated;

grant execute on function public.is_campaign_member(uuid) to authenticated;
grant execute on function public.is_campaign_gm(uuid) to authenticated;
grant execute on function public.campaign_for_scene(uuid) to authenticated;
grant execute on function public.campaign_for_inventory(uuid) to authenticated;
grant execute on function public.campaign_for_container(uuid) to authenticated;
grant execute on function public.campaign_for_book(uuid) to authenticated;

-- A campaign uses one reusable player invite at a time.
alter table public.campaign_invites add column if not exists revoked_at timestamptz;
alter table public.campaign_invites alter column max_uses drop not null;
alter table public.campaign_invites alter column max_uses drop default;

-- v0.2 was previously creating one-use links. Retire them before switching models.
update public.campaign_invites
set revoked_at = coalesce(revoked_at, now())
where role = 'player' and revoked_at is null;

create unique index if not exists campaign_invites_one_active_player
on public.campaign_invites(campaign_id)
where role = 'player' and revoked_at is null;

create or replace function public.is_campaign_owner(target_campaign uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.campaigns c
    where c.id = target_campaign and c.owner_id = auth.uid()
  );
$$;
revoke all on function public.is_campaign_owner(uuid) from public, anon;
grant execute on function public.is_campaign_owner(uuid) to authenticated;

create or replace function public.shares_campaign_with(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.campaign_members mine
    join public.campaign_members theirs on theirs.campaign_id = mine.campaign_id
    where mine.user_id = auth.uid() and theirs.user_id = target_user
  );
$$;
revoke all on function public.shares_campaign_with(uuid) from public, anon;
grant execute on function public.shares_campaign_with(uuid) to authenticated;

drop policy if exists profiles_campaign_member_read on public.profiles;
create policy profiles_campaign_member_read
on public.profiles for select
using (id = (select auth.uid()) or public.shares_campaign_with(id));

-- Remove the overly broad all-actions GM policy. Membership changes go through safe RPCs.
drop policy if exists campaign_members_gm_write on public.campaign_members;

create or replace function public.ensure_campaign_player_invite(target_campaign uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare invite_token text;
begin
  if not public.is_campaign_gm(target_campaign) then
    raise exception 'campaign access denied';
  end if;

  select token into invite_token
  from public.campaign_invites
  where campaign_id = target_campaign
    and role = 'player'
    and revoked_at is null
    and (expires_at is null or expires_at > now())
    and (max_uses is null or use_count < max_uses)
  order by created_at desc
  limit 1;

  if invite_token is null then
    insert into public.campaign_invites(campaign_id, created_by, role, max_uses)
    values(target_campaign, auth.uid(), 'player', null)
    returning token into invite_token;
  end if;

  return invite_token;
end;
$$;
revoke all on function public.ensure_campaign_player_invite(uuid) from public, anon;
grant execute on function public.ensure_campaign_player_invite(uuid) to authenticated;

create or replace function public.rotate_campaign_player_invite(target_campaign uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare invite_token text;
begin
  if not public.is_campaign_gm(target_campaign) then
    raise exception 'campaign access denied';
  end if;

  update public.campaign_invites
  set revoked_at = now()
  where campaign_id = target_campaign and role = 'player' and revoked_at is null;

  insert into public.campaign_invites(campaign_id, created_by, role, max_uses)
  values(target_campaign, auth.uid(), 'player', null)
  returning token into invite_token;

  return invite_token;
end;
$$;
revoke all on function public.rotate_campaign_player_invite(uuid) from public, anon;
grant execute on function public.rotate_campaign_player_invite(uuid) to authenticated;

create or replace function public.disable_campaign_player_invite(target_campaign uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_campaign_gm(target_campaign) then
    raise exception 'campaign access denied';
  end if;

  update public.campaign_invites
  set revoked_at = now()
  where campaign_id = target_campaign and role = 'player' and revoked_at is null;
end;
$$;
revoke all on function public.disable_campaign_player_invite(uuid) from public, anon;
grant execute on function public.disable_campaign_player_invite(uuid) to authenticated;

create or replace function public.accept_campaign_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.campaign_invites;
  inserted_count integer := 0;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  select * into invite
  from public.campaign_invites
  where token = invite_token
  for update;

  if invite.id is null then raise exception 'invite not found'; end if;
  if invite.revoked_at is not null then raise exception 'invite disabled'; end if;
  if invite.expires_at is not null and invite.expires_at < now() then raise exception 'invite expired'; end if;
  if invite.max_uses is not null and invite.use_count >= invite.max_uses then raise exception 'invite exhausted'; end if;

  insert into public.campaign_members(campaign_id, user_id, role)
  values(invite.campaign_id, auth.uid(), invite.role)
  on conflict(campaign_id, user_id) do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count > 0 then
    update public.campaign_invites set use_count = use_count + 1 where id = invite.id;
  end if;

  return invite.campaign_id;
end;
$$;
revoke all on function public.accept_campaign_invite(text) from public, anon;
grant execute on function public.accept_campaign_invite(text) to authenticated;

create or replace function public.set_campaign_member_role(
  target_campaign uuid,
  target_user uuid,
  target_role public.campaign_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare owner_user uuid;
begin
  select owner_id into owner_user from public.campaigns where id = target_campaign;
  if owner_user is null or owner_user <> auth.uid() then raise exception 'owner access required'; end if;
  if target_user = owner_user then raise exception 'owner role cannot be changed'; end if;
  if target_role = 'owner' then raise exception 'owner role cannot be assigned'; end if;

  update public.campaign_members
  set role = target_role
  where campaign_id = target_campaign and user_id = target_user;

  if not found then raise exception 'member not found'; end if;
end;
$$;
revoke all on function public.set_campaign_member_role(uuid,uuid,public.campaign_role) from public, anon;
grant execute on function public.set_campaign_member_role(uuid,uuid,public.campaign_role) to authenticated;

create or replace function public.remove_campaign_member(target_campaign uuid, target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare owner_user uuid;
begin
  select owner_id into owner_user from public.campaigns where id = target_campaign;
  if owner_user is null or owner_user <> auth.uid() then raise exception 'owner access required'; end if;
  if target_user = owner_user then raise exception 'owner cannot be removed'; end if;

  update public.actors
  set owner_user_id = null
  where campaign_id = target_campaign and owner_user_id = target_user;

  delete from public.campaign_members
  where campaign_id = target_campaign and user_id = target_user;
end;
$$;
revoke all on function public.remove_campaign_member(uuid,uuid) from public, anon;
grant execute on function public.remove_campaign_member(uuid,uuid) to authenticated;

create or replace function public.assign_actor_to_member(
  target_campaign uuid,
  target_actor uuid,
  target_user uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if not exists(select 1 from public.actors where id = target_actor and campaign_id = target_campaign) then
    raise exception 'actor not found';
  end if;
  if target_user is not null and not exists(
    select 1 from public.campaign_members where campaign_id = target_campaign and user_id = target_user
  ) then
    raise exception 'member not found';
  end if;

  update public.actors set owner_user_id = target_user where id = target_actor and campaign_id = target_campaign;
end;
$$;
revoke all on function public.assign_actor_to_member(uuid,uuid,uuid) from public, anon;
grant execute on function public.assign_actor_to_member(uuid,uuid,uuid) to authenticated;

create or replace function public.delete_campaign(target_campaign uuid, expected_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare campaign_name text;
begin
  select name into campaign_name
  from public.campaigns
  where id = target_campaign and owner_id = auth.uid();

  if campaign_name is null then raise exception 'owner access required'; end if;
  if btrim(coalesce(expected_name,'')) <> campaign_name then raise exception 'campaign name does not match'; end if;

  delete from public.campaigns where id = target_campaign;
end;
$$;
revoke all on function public.delete_campaign(uuid,text) from public, anon;
grant execute on function public.delete_campaign(uuid,text) to authenticated;
