-- NPCs and heroes share one Actor Sheet. The legacy campaign-actor RPC remains
-- for backwards-compatible identity edits, but it must never replace system_data.
-- Game statistics are written only through update_actor_sheet / dedicated runtime RPCs.

create or replace function public.update_campaign_actor(
  target_campaign uuid,
  target_actor uuid,
  actor_name text,
  actor_subtitle text,
  actor_avatar text,
  actor_system_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if nullif(btrim(actor_name),'') is null then raise exception 'actor name is required'; end if;

  update public.actors
  set name=btrim(actor_name),
      subtitle=coalesce(actor_subtitle,''),
      avatar=coalesce(actor_avatar,''),
      updated_at=now()
  where id=target_actor and campaign_id=target_campaign;

  if not found then raise exception 'actor not found'; end if;
end;
$$;

revoke all on function public.update_campaign_actor(uuid,uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.update_campaign_actor(uuid,uuid,text,text,text,jsonb) to authenticated;

comment on function public.update_campaign_actor(uuid,uuid,text,text,text,jsonb) is
  'Legacy identity-only actor update. actor_system_data is intentionally ignored; use update_actor_sheet for sheet fields.';
