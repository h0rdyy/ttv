-- TTV v0.3 realtime multiplayer foundation.

create table if not exists public.campaign_runtime (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  combat_active boolean not null default false,
  combat_round integer not null default 1 check (combat_round > 0),
  combat_turn integer not null default 0 check (combat_turn >= 0),
  combat_order uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.campaign_runtime enable row level security;
grant select on public.campaign_runtime to authenticated;
revoke insert, update, delete on public.campaign_runtime from authenticated;

create policy campaign_runtime_member_read
on public.campaign_runtime for select to authenticated
using (public.is_campaign_member(campaign_id));

create policy campaign_runtime_gm_write
on public.campaign_runtime for all to authenticated
using (public.is_campaign_gm(campaign_id))
with check (public.is_campaign_gm(campaign_id));

insert into public.campaign_runtime(campaign_id)
select id from public.campaigns
on conflict (campaign_id) do nothing;

drop policy if exists ttv_campaign_realtime_read on realtime.messages;
create policy ttv_campaign_realtime_read
on realtime.messages for select to authenticated
using (
  realtime.messages.extension in ('broadcast','presence')
  and exists (
    select 1
    from public.campaign_members cm
    where cm.user_id = (select auth.uid())
      and (select realtime.topic()) = 'campaign:' || cm.campaign_id::text
  )
);

drop policy if exists ttv_campaign_realtime_write on realtime.messages;
create policy ttv_campaign_realtime_write
on realtime.messages for insert to authenticated
with check (
  realtime.messages.extension in ('broadcast','presence')
  and exists (
    select 1
    from public.campaign_members cm
    where cm.user_id = (select auth.uid())
      and (select realtime.topic()) = 'campaign:' || cm.campaign_id::text
  )
);

create or replace function public.ttv_broadcast_campaign_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb;
  target_campaign uuid;
  relation_id uuid;
begin
  row_data := case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;

  if TG_TABLE_NAME = 'campaigns' then
    target_campaign := (row_data->>'id')::uuid;
  elsif TG_TABLE_NAME in ('actors','scenes','inventories','item_definitions','campaign_runtime') then
    target_campaign := (row_data->>'campaign_id')::uuid;
  elsif TG_TABLE_NAME = 'scene_tokens' then
    relation_id := (row_data->>'scene_id')::uuid;
    select s.campaign_id into target_campaign from public.scenes s where s.id = relation_id;
  elsif TG_TABLE_NAME = 'inventory_containers' then
    relation_id := (row_data->>'inventory_id')::uuid;
    select i.campaign_id into target_campaign from public.inventories i where i.id = relation_id;
  elsif TG_TABLE_NAME = 'item_instances' then
    relation_id := (row_data->>'container_id')::uuid;
    select i.campaign_id into target_campaign
    from public.inventory_containers c
    join public.inventories i on i.id = c.inventory_id
    where c.id = relation_id;
  end if;

  if target_campaign is not null then
    perform realtime.send(
      jsonb_build_object('scope', TG_TABLE_NAME, 'op', TG_OP),
      'state_changed',
      'campaign:' || target_campaign::text,
      true
    );
  end if;

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;
revoke all on function public.ttv_broadcast_campaign_state() from public, anon, authenticated;

drop trigger if exists ttv_campaigns_realtime on public.campaigns;
create trigger ttv_campaigns_realtime after update on public.campaigns for each row execute function public.ttv_broadcast_campaign_state();
drop trigger if exists ttv_actors_realtime on public.actors;
create trigger ttv_actors_realtime after insert or update or delete on public.actors for each row execute function public.ttv_broadcast_campaign_state();
drop trigger if exists ttv_scenes_realtime on public.scenes;
create trigger ttv_scenes_realtime after insert or update or delete on public.scenes for each row execute function public.ttv_broadcast_campaign_state();
drop trigger if exists ttv_scene_tokens_realtime on public.scene_tokens;
create trigger ttv_scene_tokens_realtime after insert or update or delete on public.scene_tokens for each row execute function public.ttv_broadcast_campaign_state();
drop trigger if exists ttv_inventories_realtime on public.inventories;
create trigger ttv_inventories_realtime after insert or update or delete on public.inventories for each row execute function public.ttv_broadcast_campaign_state();
drop trigger if exists ttv_containers_realtime on public.inventory_containers;
create trigger ttv_containers_realtime after insert or update or delete on public.inventory_containers for each row execute function public.ttv_broadcast_campaign_state();
drop trigger if exists ttv_item_definitions_realtime on public.item_definitions;
create trigger ttv_item_definitions_realtime after insert or update or delete on public.item_definitions for each row execute function public.ttv_broadcast_campaign_state();
drop trigger if exists ttv_item_instances_realtime on public.item_instances;
create trigger ttv_item_instances_realtime after insert or update or delete on public.item_instances for each row execute function public.ttv_broadcast_campaign_state();
drop trigger if exists ttv_runtime_realtime on public.campaign_runtime;
create trigger ttv_runtime_realtime after insert or update on public.campaign_runtime for each row execute function public.ttv_broadcast_campaign_state();

revoke insert, update, delete on public.actors from authenticated;
revoke insert, update, delete on public.scenes from authenticated;
revoke insert, update, delete on public.scene_tokens from authenticated;
revoke insert, update, delete on public.inventories from authenticated;
revoke insert, update, delete on public.inventory_containers from authenticated;
revoke insert, update, delete on public.item_definitions from authenticated;
revoke insert, update, delete on public.item_instances from authenticated;

create or replace function public.move_scene_token(target_token uuid, new_x double precision, new_y double precision)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_campaign uuid;
  target_owner uuid;
begin
  select s.campaign_id, a.owner_user_id
  into target_campaign, target_owner
  from public.scene_tokens st
  join public.scenes s on s.id = st.scene_id
  join public.actors a on a.id = st.actor_id
  where st.id = target_token;

  if target_campaign is null then raise exception 'token not found'; end if;
  if not public.is_campaign_gm(target_campaign) and target_owner is distinct from auth.uid() then
    raise exception 'token access denied';
  end if;

  update public.scene_tokens
  set x = greatest(0, least(100, new_x)),
      y = greatest(0, least(100, new_y)),
      updated_at = now()
  where id = target_token;
end;
$$;
revoke all on function public.move_scene_token(uuid,double precision,double precision) from public,anon;
grant execute on function public.move_scene_token(uuid,double precision,double precision) to authenticated;

create or replace function public.adjust_actor_hp(target_actor uuid, hp_delta integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_campaign uuid;
  current_hp integer;
  max_hp integer;
  next_hp integer;
  next_data jsonb;
begin
  select campaign_id,
         coalesce((system_data->'hp'->>'current')::integer, 0),
         coalesce((system_data->'hp'->>'max')::integer, 0),
         system_data
  into target_campaign, current_hp, max_hp, next_data
  from public.actors where id = target_actor;

  if target_campaign is null then raise exception 'actor not found'; end if;
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if max_hp <= 0 then raise exception 'actor has no health resource'; end if;

  next_hp := greatest(0, least(max_hp, current_hp + hp_delta));
  next_data := jsonb_set(next_data, '{hp,current}', to_jsonb(next_hp), true);
  update public.actors set system_data = next_data, updated_at = now() where id = target_actor;
  return next_data;
end;
$$;
revoke all on function public.adjust_actor_hp(uuid,integer) from public,anon;
grant execute on function public.adjust_actor_hp(uuid,integer) to authenticated;

create or replace function public.give_simple_item(target_campaign uuid, target_actor uuid, item_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_inventory uuid;
  target_container uuid;
  definition_id uuid;
  instance_id uuid;
  target_system text;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if nullif(btrim(item_name),'') is null then raise exception 'item name is required'; end if;
  if not exists(select 1 from public.actors where id=target_actor and campaign_id=target_campaign) then raise exception 'actor not found'; end if;

  select i.id into target_inventory from public.inventories i where i.owner_actor_id=target_actor;
  if target_inventory is null then raise exception 'inventory not found'; end if;
  select c.id into target_container from public.inventory_containers c where c.inventory_id=target_inventory order by case when c.type='container' then 0 else 1 end, c.sort_order limit 1;
  if target_container is null then raise exception 'container not found'; end if;

  select system_id into target_system from public.campaigns where id=target_campaign;
  select d.id into definition_id from public.item_definitions d where d.campaign_id=target_campaign and lower(d.name)=lower(btrim(item_name)) order by d.created_at limit 1;
  if definition_id is null then
    insert into public.item_definitions(campaign_id,system_id,name,category,icon)
    values(target_campaign,target_system,btrim(item_name),'Разное','📦') returning id into definition_id;
  end if;

  insert into public.item_instances(definition_id,container_id,quantity)
  values(definition_id,target_container,1) returning id into instance_id;
  return instance_id;
end;
$$;
revoke all on function public.give_simple_item(uuid,uuid,text) from public,anon;
grant execute on function public.give_simple_item(uuid,uuid,text) to authenticated;

create or replace function public.start_campaign_combat(target_campaign uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_scene uuid;
  order_ids uuid[];
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  select active_scene_id into target_scene from public.campaigns where id=target_campaign;
  if target_scene is null then raise exception 'active scene not found'; end if;

  select coalesce(array_agg(st.actor_id order by st.enemy, a.name), '{}')
  into order_ids
  from public.scene_tokens st
  join public.actors a on a.id=st.actor_id
  where st.scene_id=target_scene and not st.hidden;

  if cardinality(order_ids)=0 then raise exception 'combat has no participants'; end if;

  insert into public.campaign_runtime(campaign_id,combat_active,combat_round,combat_turn,combat_order,updated_at)
  values(target_campaign,true,1,0,order_ids,now())
  on conflict(campaign_id) do update set combat_active=true,combat_round=1,combat_turn=0,combat_order=excluded.combat_order,updated_at=now();
end;
$$;
revoke all on function public.start_campaign_combat(uuid) from public,anon;
grant execute on function public.start_campaign_combat(uuid) to authenticated;

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
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  select * into runtime from public.campaign_runtime where campaign_id=target_campaign for update;
  if runtime.campaign_id is null or not runtime.combat_active or cardinality(runtime.combat_order)=0 then raise exception 'combat is not active'; end if;

  next_turn := runtime.combat_turn + 1;
  next_round := runtime.combat_round;
  if next_turn >= cardinality(runtime.combat_order) then
    next_turn := 0;
    next_round := next_round + 1;
  end if;

  update public.campaign_runtime set combat_turn=next_turn,combat_round=next_round,updated_at=now() where campaign_id=target_campaign;
end;
$$;
revoke all on function public.next_campaign_combat_turn(uuid) from public,anon;
grant execute on function public.next_campaign_combat_turn(uuid) to authenticated;

create or replace function public.stop_campaign_combat(target_campaign uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  insert into public.campaign_runtime(campaign_id,combat_active,combat_round,combat_turn,combat_order,updated_at)
  values(target_campaign,false,1,0,'{}',now())
  on conflict(campaign_id) do update set combat_active=false,combat_round=1,combat_turn=0,combat_order='{}',updated_at=now();
end;
$$;
revoke all on function public.stop_campaign_combat(uuid) from public,anon;
grant execute on function public.stop_campaign_combat(uuid) to authenticated;
