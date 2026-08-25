-- TTV v0.6: initiative, combat actions, conditions and timed effects.

alter table public.campaign_runtime
  add column if not exists combat_initiative jsonb not null default '{}'::jsonb,
  add column if not exists combat_effects jsonb not null default '[]'::jsonb,
  add column if not exists combat_control text not null default 'automatic';

alter table public.campaign_runtime
  drop constraint if exists campaign_runtime_combat_initiative_object,
  add constraint campaign_runtime_combat_initiative_object
    check (jsonb_typeof(combat_initiative) = 'object'),
  drop constraint if exists campaign_runtime_combat_effects_array,
  add constraint campaign_runtime_combat_effects_array
    check (jsonb_typeof(combat_effects) = 'array'),
  drop constraint if exists campaign_runtime_combat_control_valid,
  add constraint campaign_runtime_combat_control_valid
    check (combat_control in ('automatic', 'manual'));

create or replace function public.start_campaign_combat_v06(
  target_campaign uuid,
  initiative_mode text default 'automatic',
  manual_initiative jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_scene uuid;
  normalized_mode text;
  order_ids uuid[];
  initiative_values jsonb;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  normalized_mode := case when initiative_mode = 'manual' then 'manual' else 'automatic' end;
  if jsonb_typeof(coalesce(manual_initiative, '{}'::jsonb)) <> 'object' then raise exception 'invalid initiative data'; end if;

  select active_scene_id into target_scene from public.campaigns where id = target_campaign;
  if target_scene is null then raise exception 'active scene not found'; end if;

  with participants as (
    select distinct on (st.actor_id)
      st.actor_id,
      st.enemy,
      a.name,
      case
        when jsonb_typeof(a.system_data->'initiative') = 'number'
          then greatest(-1000, least(1000, (a.system_data->>'initiative')::numeric))::integer
        when jsonb_typeof(a.system_data#>'{initiative,value}') = 'number'
          then greatest(-1000, least(1000, (a.system_data#>>'{initiative,value}')::numeric))::integer
        else 0
      end as initiative_modifier
    from public.scene_tokens st
    join public.actors a on a.id = st.actor_id
    where st.scene_id = target_scene and not st.hidden
    order by st.actor_id, st.id
  ), scored as (
    select
      actor_id,
      enemy,
      name,
      case
        when normalized_mode = 'manual'
          and coalesce(manual_initiative->>actor_id::text, '') ~ '^-?[0-9]+$'
          then greatest(-1000, least(1000, (manual_initiative->>actor_id::text)::integer))
        when normalized_mode = 'manual' then 0
        else floor(random() * 20 + 1)::integer + initiative_modifier
      end as initiative
    from participants
  )
  select
    coalesce(array_agg(actor_id order by initiative desc, enemy, name, actor_id), '{}'),
    coalesce(jsonb_object_agg(actor_id::text, initiative), '{}'::jsonb)
  into order_ids, initiative_values
  from scored;

  if cardinality(order_ids) = 0 then raise exception 'combat has no participants'; end if;

  insert into public.campaign_runtime(
    campaign_id, combat_active, combat_round, combat_turn, combat_order,
    combat_initiative, combat_effects, combat_control, updated_at
  )
  values(
    target_campaign, true, 1, 0, order_ids,
    initiative_values, '[]'::jsonb, normalized_mode, now()
  )
  on conflict(campaign_id) do update set
    combat_active = true,
    combat_round = 1,
    combat_turn = 0,
    combat_order = excluded.combat_order,
    combat_initiative = excluded.combat_initiative,
    combat_effects = '[]'::jsonb,
    combat_control = excluded.combat_control,
    updated_at = now();
end;
$$;
revoke all on function public.start_campaign_combat_v06(uuid,text,jsonb) from public,anon;
grant execute on function public.start_campaign_combat_v06(uuid,text,jsonb) to authenticated;

-- Keep the old one-argument contract usable by an older client during rollout.
create or replace function public.start_campaign_combat(target_campaign uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.start_campaign_combat_v06(target_campaign, 'automatic', '{}'::jsonb);
end;
$$;

create or replace function public.set_campaign_combat_initiative(
  target_campaign uuid,
  target_actor uuid,
  initiative_value integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_initiative jsonb;
  next_order uuid[];
  current_actor uuid;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if initiative_value < -1000 or initiative_value > 1000 then raise exception 'invalid initiative'; end if;
  if not exists (
    select 1 from public.campaign_runtime r
    where r.campaign_id = target_campaign and r.combat_active and target_actor = any(r.combat_order)
  ) then raise exception 'combat participant not found'; end if;

  select
    jsonb_set(combat_initiative, array[target_actor::text], to_jsonb(initiative_value), true),
    combat_order[combat_turn + 1]
  into next_initiative, current_actor
  from public.campaign_runtime
  where campaign_id = target_campaign
  for update;

  select array_agg(entry.actor_id order by coalesce((next_initiative->>entry.actor_id::text)::integer, 0) desc, actor.name, entry.ordinality)
  into next_order
  from unnest((select combat_order from public.campaign_runtime where campaign_id = target_campaign)) with ordinality as entry(actor_id, ordinality)
  join public.actors actor on actor.id = entry.actor_id;

  update public.campaign_runtime
  set combat_initiative = next_initiative,
      combat_order = coalesce(next_order, '{}'),
      combat_turn = greatest(coalesce(array_position(next_order, current_actor), 1) - 1, 0),
      updated_at = now()
  where campaign_id = target_campaign;
end;
$$;
revoke all on function public.set_campaign_combat_initiative(uuid,uuid,integer) from public,anon;
grant execute on function public.set_campaign_combat_initiative(uuid,uuid,integer) to authenticated;

create or replace function public.set_campaign_combat_turn(target_campaign uuid, target_actor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare target_index integer;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  select array_position(combat_order, target_actor) into target_index
  from public.campaign_runtime
  where campaign_id = target_campaign and combat_active
  for update;
  if target_index is null then raise exception 'combat participant not found'; end if;
  update public.campaign_runtime
  set combat_turn = target_index - 1, updated_at = now()
  where campaign_id = target_campaign;
end;
$$;
revoke all on function public.set_campaign_combat_turn(uuid,uuid) from public,anon;
grant execute on function public.set_campaign_combat_turn(uuid,uuid) to authenticated;

create or replace function public.set_campaign_combat_control(target_campaign uuid, control_mode text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if control_mode not in ('automatic', 'manual') then raise exception 'invalid combat control'; end if;
  update public.campaign_runtime
  set combat_control = control_mode, updated_at = now()
  where campaign_id = target_campaign and combat_active;
  if not found then raise exception 'combat is not active'; end if;
end;
$$;
revoke all on function public.set_campaign_combat_control(uuid,text) from public,anon;
grant execute on function public.set_campaign_combat_control(uuid,text) to authenticated;

create or replace function public.apply_campaign_combat_health(
  target_campaign uuid,
  target_actor uuid,
  health_delta integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if health_delta < -100000 or health_delta > 100000 or health_delta = 0 then raise exception 'invalid health change'; end if;
  if not exists (
    select 1 from public.campaign_runtime r
    where r.campaign_id = target_campaign and r.combat_active and target_actor = any(r.combat_order)
  ) then raise exception 'combat participant not found'; end if;
  return public.adjust_actor_hp(target_actor, health_delta);
end;
$$;
revoke all on function public.apply_campaign_combat_health(uuid,uuid,integer) from public,anon;
grant execute on function public.apply_campaign_combat_health(uuid,uuid,integer) to authenticated;

create or replace function public.add_campaign_combat_effect(
  target_campaign uuid,
  target_actor uuid,
  effect_name text,
  effect_kind text default 'effect',
  effect_duration integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare effect_id uuid := gen_random_uuid();
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if nullif(btrim(effect_name), '') is null or char_length(btrim(effect_name)) > 80 then raise exception 'invalid effect name'; end if;
  if effect_kind not in ('effect', 'condition') then raise exception 'invalid effect kind'; end if;
  if effect_duration is not null and (effect_duration < 1 or effect_duration > 999) then raise exception 'invalid effect duration'; end if;
  if not exists (
    select 1 from public.campaign_runtime r
    where r.campaign_id = target_campaign and r.combat_active and target_actor = any(r.combat_order)
  ) then raise exception 'combat participant not found'; end if;

  update public.campaign_runtime
  set combat_effects = combat_effects || jsonb_build_array(jsonb_build_object(
        'id', effect_id::text,
        'actorId', target_actor::text,
        'name', btrim(effect_name),
        'kind', effect_kind,
        'remainingRounds', effect_duration
      )),
      updated_at = now()
  where campaign_id = target_campaign;
  return effect_id;
end;
$$;
revoke all on function public.add_campaign_combat_effect(uuid,uuid,text,text,integer) from public,anon;
grant execute on function public.add_campaign_combat_effect(uuid,uuid,text,text,integer) to authenticated;

create or replace function public.remove_campaign_combat_effect(target_campaign uuid, target_effect uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare previous_count integer;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  select jsonb_array_length(combat_effects) into previous_count
  from public.campaign_runtime where campaign_id = target_campaign for update;
  update public.campaign_runtime
  set combat_effects = coalesce((
        select jsonb_agg(effect)
        from jsonb_array_elements(combat_effects) effect
        where effect->>'id' <> target_effect::text
      ), '[]'::jsonb),
      updated_at = now()
  where campaign_id = target_campaign;
  if previous_count is null or previous_count = jsonb_array_length((select combat_effects from public.campaign_runtime where campaign_id = target_campaign)) then
    raise exception 'combat effect not found';
  end if;
end;
$$;
revoke all on function public.remove_campaign_combat_effect(uuid,uuid) from public,anon;
grant execute on function public.remove_campaign_combat_effect(uuid,uuid) to authenticated;

create or replace function public.next_campaign_combat_turn(target_campaign uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  runtime public.campaign_runtime;
  next_turn integer;
  next_round integer;
  next_effects jsonb;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  select * into runtime from public.campaign_runtime where campaign_id = target_campaign for update;
  if runtime.campaign_id is null or not runtime.combat_active or cardinality(runtime.combat_order) = 0 then raise exception 'combat is not active'; end if;

  next_turn := runtime.combat_turn + 1;
  next_round := runtime.combat_round;
  next_effects := runtime.combat_effects;
  if next_turn >= cardinality(runtime.combat_order) then
    next_turn := 0;
    next_round := next_round + 1;
    if runtime.combat_control = 'automatic' then
      select coalesce(jsonb_agg(
        case
          when nullif(effect->>'remainingRounds', '') is null then effect
          else jsonb_set(effect, '{remainingRounds}', to_jsonb((effect->>'remainingRounds')::integer - 1))
        end
      ), '[]'::jsonb)
      into next_effects
      from jsonb_array_elements(runtime.combat_effects) effect
      where nullif(effect->>'remainingRounds', '') is null or (effect->>'remainingRounds')::integer > 1;
    end if;
  end if;

  update public.campaign_runtime
  set combat_turn = next_turn,
      combat_round = next_round,
      combat_effects = next_effects,
      updated_at = now()
  where campaign_id = target_campaign;
end;
$$;

create or replace function public.stop_campaign_combat(target_campaign uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  insert into public.campaign_runtime(
    campaign_id, combat_active, combat_round, combat_turn, combat_order,
    combat_initiative, combat_effects, combat_control, updated_at
  )
  values(target_campaign, false, 1, 0, '{}', '{}'::jsonb, '[]'::jsonb, 'automatic', now())
  on conflict(campaign_id) do update set
    combat_active = false,
    combat_round = 1,
    combat_turn = 0,
    combat_order = '{}',
    combat_initiative = '{}'::jsonb,
    combat_effects = '[]'::jsonb,
    combat_control = 'automatic',
    updated_at = now();
end;
$$;
