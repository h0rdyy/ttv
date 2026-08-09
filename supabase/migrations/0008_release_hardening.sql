-- TTV v0.3.3 release hardening.
-- Current Player View controls one assigned actor, so keep that invariant in the database.

create unique index if not exists actors_one_assignment_per_user
on public.actors(campaign_id, owner_user_id)
where owner_user_id is not null;

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

  if target_user is not null then
    update public.actors
    set owner_user_id = null, updated_at = now()
    where campaign_id = target_campaign
      and owner_user_id = target_user
      and id <> target_actor;
  end if;

  update public.actors
  set owner_user_id = target_user, updated_at = now()
  where id = target_actor and campaign_id = target_campaign;
end;
$$;

revoke all on function public.assign_actor_to_member(uuid,uuid,uuid) from public, anon;
grant execute on function public.assign_actor_to_member(uuid,uuid,uuid) to authenticated;
