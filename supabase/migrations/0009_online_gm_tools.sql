-- TTV v0.3.4: online GM workshop actions.

-- Roll tables are GM-only campaign content.
drop policy if exists roll_tables_gm_read on public.roll_tables;
create policy roll_tables_gm_read
on public.roll_tables for select to authenticated
using (public.is_campaign_gm(campaign_id));

create or replace function public.save_item_definition(
  target_campaign uuid,
  target_definition uuid,
  item_name text,
  item_description text,
  item_category text,
  item_rarity text,
  item_icon text,
  item_weight numeric,
  item_price numeric,
  item_currency text,
  item_source text,
  item_properties jsonb,
  item_effects jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  result_id uuid;
  target_system text;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if nullif(btrim(item_name), '') is null then raise exception 'item name is required'; end if;
  select system_id into target_system from public.campaigns where id = target_campaign;
  if target_system is null then raise exception 'campaign not found'; end if;

  if target_definition is null then
    insert into public.item_definitions(
      campaign_id, system_id, name, description, category, rarity, icon,
      weight, price, currency, source, properties, effects
    ) values (
      target_campaign, target_system, btrim(item_name), coalesce(item_description,''),
      coalesce(nullif(btrim(item_category),''),'Разное'), coalesce(nullif(btrim(item_rarity),''),'common'),
      coalesce(nullif(item_icon,''),'📦'), item_weight, item_price, nullif(btrim(item_currency),''),
      nullif(btrim(item_source),''), coalesce(item_properties,'{}'::jsonb), coalesce(item_effects,'[]'::jsonb)
    ) returning id into result_id;
  else
    update public.item_definitions
    set name = btrim(item_name),
        description = coalesce(item_description,''),
        category = coalesce(nullif(btrim(item_category),''),'Разное'),
        rarity = coalesce(nullif(btrim(item_rarity),''),'common'),
        icon = coalesce(nullif(item_icon,''),'📦'),
        weight = item_weight,
        price = item_price,
        currency = nullif(btrim(item_currency),''),
        source = nullif(btrim(item_source),''),
        properties = coalesce(item_properties,'{}'::jsonb),
        effects = coalesce(item_effects,'[]'::jsonb),
        updated_at = now()
    where id = target_definition and campaign_id = target_campaign
    returning id into result_id;
    if result_id is null then raise exception 'item not found'; end if;
  end if;

  return result_id;
end;
$$;
revoke all on function public.save_item_definition(uuid,uuid,text,text,text,text,text,numeric,numeric,text,text,jsonb,jsonb) from public,anon;
grant execute on function public.save_item_definition(uuid,uuid,text,text,text,text,text,numeric,numeric,text,text,jsonb,jsonb) to authenticated;

create or replace function public.duplicate_item_definition(target_campaign uuid, target_definition uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare result_id uuid;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  insert into public.item_definitions(
    campaign_id, system_id, name, description, category, rarity, icon, weight, price, currency, source, properties, effects, tags
  )
  select campaign_id, system_id, name || ' — копия', description, category, rarity, icon, weight, price, currency, source, properties, effects, tags
  from public.item_definitions
  where id = target_definition and campaign_id = target_campaign
  returning id into result_id;
  if result_id is null then raise exception 'item not found'; end if;
  return result_id;
end;
$$;
revoke all on function public.duplicate_item_definition(uuid,uuid) from public,anon;
grant execute on function public.duplicate_item_definition(uuid,uuid) to authenticated;

create or replace function public.delete_item_definition(target_campaign uuid, target_definition uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if exists(select 1 from public.item_instances where definition_id = target_definition) then
    raise exception 'item is in use';
  end if;
  delete from public.item_definitions where id = target_definition and campaign_id = target_campaign;
  if not found then raise exception 'item not found'; end if;
end;
$$;
revoke all on function public.delete_item_definition(uuid,uuid) from public,anon;
grant execute on function public.delete_item_definition(uuid,uuid) to authenticated;

create or replace function public.give_item_definition(
  target_campaign uuid,
  target_actor uuid,
  target_definition uuid,
  item_quantity integer default 1
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_inventory uuid;
  target_container uuid;
  result_id uuid;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if item_quantity < 1 then raise exception 'invalid quantity'; end if;
  if not exists(select 1 from public.actors where id=target_actor and campaign_id=target_campaign) then raise exception 'actor not found'; end if;
  if not exists(select 1 from public.item_definitions where id=target_definition and campaign_id=target_campaign) then raise exception 'item not found'; end if;

  select id into target_inventory from public.inventories where owner_actor_id=target_actor and campaign_id=target_campaign;
  select id into target_container
  from public.inventory_containers
  where inventory_id=target_inventory
  order by case when type='container' then 0 else 1 end, sort_order
  limit 1;
  if target_container is null then raise exception 'container not found'; end if;

  insert into public.item_instances(definition_id,container_id,quantity)
  values(target_definition,target_container,item_quantity)
  returning id into result_id;
  return result_id;
end;
$$;
revoke all on function public.give_item_definition(uuid,uuid,uuid,integer) from public,anon;
grant execute on function public.give_item_definition(uuid,uuid,uuid,integer) to authenticated;

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
  set name=btrim(actor_name), subtitle=coalesce(actor_subtitle,''), avatar=coalesce(actor_avatar,''),
      system_data=coalesce(actor_system_data,'{}'::jsonb), updated_at=now()
  where id=target_actor and campaign_id=target_campaign;
  if not found then raise exception 'actor not found'; end if;
end;
$$;
revoke all on function public.update_campaign_actor(uuid,uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.update_campaign_actor(uuid,uuid,text,text,text,jsonb) to authenticated;

create or replace function public.place_actor_on_scene(target_campaign uuid, target_actor uuid, target_scene uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare result_id uuid; actor_kind public.actor_type;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if not exists(select 1 from public.scenes where id=target_scene and campaign_id=target_campaign) then raise exception 'scene not found'; end if;
  select type into actor_kind from public.actors where id=target_actor and campaign_id=target_campaign;
  if actor_kind is null then raise exception 'actor not found'; end if;

  select id into result_id from public.scene_tokens where scene_id=target_scene and actor_id=target_actor limit 1;
  if result_id is null then
    insert into public.scene_tokens(scene_id,actor_id,x,y,enemy,hidden)
    values(target_scene,target_actor,50,50,actor_kind in ('npc','creature'),false)
    returning id into result_id;
  end if;
  return result_id;
end;
$$;
revoke all on function public.place_actor_on_scene(uuid,uuid,uuid) from public,anon;
grant execute on function public.place_actor_on_scene(uuid,uuid,uuid) to authenticated;

create or replace function public.delete_campaign_actor(target_campaign uuid, target_actor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  delete from public.actors where id=target_actor and campaign_id=target_campaign;
  if not found then raise exception 'actor not found'; end if;
end;
$$;
revoke all on function public.delete_campaign_actor(uuid,uuid) from public,anon;
grant execute on function public.delete_campaign_actor(uuid,uuid) to authenticated;

create or replace function public.save_roll_table(
  target_campaign uuid,
  target_table uuid,
  table_name text,
  table_die text,
  table_rows jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare result_id uuid;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if nullif(btrim(table_name),'') is null then raise exception 'table name is required'; end if;
  if target_table is null then
    insert into public.roll_tables(campaign_id,name,die,rows)
    values(target_campaign,btrim(table_name),coalesce(nullif(btrim(table_die),''),'d6'),coalesce(table_rows,'[]'::jsonb))
    returning id into result_id;
  else
    update public.roll_tables
    set name=btrim(table_name), die=coalesce(nullif(btrim(table_die),''),'d6'), rows=coalesce(table_rows,'[]'::jsonb), updated_at=now()
    where id=target_table and campaign_id=target_campaign
    returning id into result_id;
    if result_id is null then raise exception 'table not found'; end if;
  end if;
  return result_id;
end;
$$;
revoke all on function public.save_roll_table(uuid,uuid,text,text,jsonb) from public,anon;
grant execute on function public.save_roll_table(uuid,uuid,text,text,jsonb) to authenticated;

create or replace function public.delete_roll_table(target_campaign uuid, target_table uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  delete from public.roll_tables where id=target_table and campaign_id=target_campaign;
  if not found then raise exception 'table not found'; end if;
end;
$$;
revoke all on function public.delete_roll_table(uuid,uuid) from public,anon;
grant execute on function public.delete_roll_table(uuid,uuid) to authenticated;

create or replace function public.create_gm_note(target_campaign uuid, note_title text, note_body text, note_pinned boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare result_id uuid;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  insert into public.journal_notes(campaign_id,author_id,title,body,visibility,pinned)
  values(target_campaign,auth.uid(),nullif(btrim(note_title),''),coalesce(note_body,''),'gm',coalesce(note_pinned,false))
  returning id into result_id;
  return result_id;
end;
$$;
revoke all on function public.create_gm_note(uuid,text,text,boolean) from public,anon;
grant execute on function public.create_gm_note(uuid,text,text,boolean) to authenticated;

create or replace function public.update_gm_note(target_campaign uuid, target_note uuid, note_title text, note_body text, note_pinned boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  update public.journal_notes
  set title=nullif(btrim(note_title),''), body=coalesce(note_body,''), pinned=coalesce(note_pinned,false), updated_at=now()
  where id=target_note and campaign_id=target_campaign;
  if not found then raise exception 'note not found'; end if;
end;
$$;
revoke all on function public.update_gm_note(uuid,uuid,text,text,boolean) from public,anon;
grant execute on function public.update_gm_note(uuid,uuid,text,text,boolean) to authenticated;

create or replace function public.delete_gm_note(target_campaign uuid, target_note uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  delete from public.journal_notes where id=target_note and campaign_id=target_campaign;
  if not found then raise exception 'note not found'; end if;
end;
$$;
revoke all on function public.delete_gm_note(uuid,uuid) from public,anon;
grant execute on function public.delete_gm_note(uuid,uuid) to authenticated;

-- Extend the minimal room invalidation signal to GM content without exposing record bodies.
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
  elsif TG_TABLE_NAME in ('actors','scenes','inventories','item_definitions','campaign_runtime','journal_notes','roll_tables') then
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

drop trigger if exists ttv_journal_notes_realtime on public.journal_notes;
create trigger ttv_journal_notes_realtime after insert or update or delete on public.journal_notes
for each row execute function public.ttv_broadcast_campaign_state();

drop trigger if exists ttv_roll_tables_realtime on public.roll_tables;
create trigger ttv_roll_tables_realtime after insert or update or delete on public.roll_tables
for each row execute function public.ttv_broadcast_campaign_state();
