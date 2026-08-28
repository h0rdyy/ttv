-- TTV immersion lab: flexible Actor Sheets use `hit_points`, while older actors
-- and controls may still use `hp`. Prefer the sheet key when it exists and keep
-- the GM quick HP controls race-safe without persisting duplicate resources.

create or replace function public.adjust_actor_hp(target_actor uuid, hp_delta integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_campaign uuid;
  current_data jsonb;
  health_key text;
  current_hp integer;
  max_hp integer;
  next_hp integer;
begin
  select campaign_id, coalesce(system_data, '{}'::jsonb)
  into target_campaign, current_data
  from public.actors
  where id = target_actor
  for update;

  if target_campaign is null then raise exception 'actor not found'; end if;
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;

  if jsonb_typeof(current_data->'hit_points') = 'object' then
    health_key := 'hit_points';
  elsif jsonb_typeof(current_data->'hp') = 'object' then
    health_key := 'hp';
  else
    raise exception 'actor has no health resource';
  end if;

  current_hp := case
    when coalesce(current_data->health_key->>'current', '') ~ '^-?[0-9]+$'
      then (current_data->health_key->>'current')::integer
    else 0
  end;
  max_hp := case
    when coalesce(current_data->health_key->>'max', '') ~ '^[0-9]+$'
      then (current_data->health_key->>'max')::integer
    else 0
  end;

  if max_hp <= 0 then raise exception 'actor has no health resource'; end if;

  next_hp := greatest(0, least(max_hp, current_hp + hp_delta));
  current_data := jsonb_set(current_data, array[health_key, 'current'], to_jsonb(next_hp), true);

  update public.actors
  set system_data = current_data, updated_at = now()
  where id = target_actor;

  return current_data;
end;
$$;

revoke all on function public.adjust_actor_hp(uuid,integer) from public, anon;
grant execute on function public.adjust_actor_hp(uuid,integer) to authenticated;
