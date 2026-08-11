-- TTV v0.5: schema-driven universal Actor Sheets.

create table if not exists public.actor_sheet_templates (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  schema jsonb not null default '{"version":1,"sections":[]}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint actor_sheet_templates_schema_object check (jsonb_typeof(schema) = 'object'),
  constraint actor_sheet_templates_sections_array check (jsonb_typeof(schema->'sections') = 'array')
);

create index if not exists actor_sheet_templates_campaign_idx on public.actor_sheet_templates(campaign_id);
create unique index if not exists actor_sheet_templates_one_default_per_campaign
  on public.actor_sheet_templates(campaign_id) where is_default;

alter table public.actor_sheet_templates enable row level security;
grant select on public.actor_sheet_templates to authenticated;
revoke insert, update, delete on public.actor_sheet_templates from authenticated;

create policy actor_sheet_templates_member_read
on public.actor_sheet_templates for select to authenticated
using (public.is_campaign_member(campaign_id));

alter table public.actors
  add column if not exists sheet_template_id uuid references public.actor_sheet_templates(id) on delete set null;
create index if not exists actors_sheet_template_idx on public.actors(sheet_template_id);

create or replace function public.save_actor_sheet_template(
  target_campaign uuid,
  target_template uuid,
  template_name text,
  template_schema jsonb,
  make_default boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  result_id uuid;
  should_default boolean;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if nullif(btrim(template_name),'') is null then raise exception 'template name is required'; end if;
  if jsonb_typeof(template_schema) <> 'object' or jsonb_typeof(template_schema->'sections') <> 'array' then
    raise exception 'invalid sheet schema';
  end if;
  if octet_length(template_schema::text) > 65536 then raise exception 'sheet schema is too large'; end if;
  if jsonb_array_length(template_schema->'sections') > 20 then raise exception 'too many sheet sections'; end if;

  should_default := coalesce(make_default,false)
    or not exists(select 1 from public.actor_sheet_templates where campaign_id=target_campaign);

  if should_default then
    update public.actor_sheet_templates set is_default=false, updated_at=now()
    where campaign_id=target_campaign and is_default;
  end if;

  if target_template is null then
    insert into public.actor_sheet_templates(campaign_id,name,schema,is_default)
    values(target_campaign,btrim(template_name),template_schema,should_default)
    returning id into result_id;
  else
    update public.actor_sheet_templates
    set name=btrim(template_name), schema=template_schema,
        is_default=case when should_default then true else is_default end,
        updated_at=now()
    where id=target_template and campaign_id=target_campaign
    returning id into result_id;
    if result_id is null then raise exception 'template not found'; end if;
  end if;

  return result_id;
end;
$$;
revoke all on function public.save_actor_sheet_template(uuid,uuid,text,jsonb,boolean) from public,anon;
grant execute on function public.save_actor_sheet_template(uuid,uuid,text,jsonb,boolean) to authenticated;

create or replace function public.delete_actor_sheet_template(target_campaign uuid, target_template uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  was_default boolean;
  next_default uuid;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  select is_default into was_default
  from public.actor_sheet_templates
  where id=target_template and campaign_id=target_campaign;
  if was_default is null then raise exception 'template not found'; end if;

  delete from public.actor_sheet_templates where id=target_template and campaign_id=target_campaign;

  if was_default then
    select id into next_default
    from public.actor_sheet_templates
    where campaign_id=target_campaign
    order by created_at
    limit 1;
    if next_default is not null then
      update public.actor_sheet_templates set is_default=true, updated_at=now() where id=next_default;
    end if;
  end if;
end;
$$;
revoke all on function public.delete_actor_sheet_template(uuid,uuid) from public,anon;
grant execute on function public.delete_actor_sheet_template(uuid,uuid) to authenticated;

create or replace function public.assign_actor_sheet_template(
  target_campaign uuid,
  target_actor uuid,
  target_template uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if not exists(select 1 from public.actors where id=target_actor and campaign_id=target_campaign) then
    raise exception 'actor not found';
  end if;
  if target_template is not null and not exists(
    select 1 from public.actor_sheet_templates where id=target_template and campaign_id=target_campaign
  ) then raise exception 'template not found'; end if;

  update public.actors
  set sheet_template_id=target_template, updated_at=now()
  where id=target_actor and campaign_id=target_campaign;
end;
$$;
revoke all on function public.assign_actor_sheet_template(uuid,uuid,uuid) from public,anon;
grant execute on function public.assign_actor_sheet_template(uuid,uuid,uuid) to authenticated;

create or replace function public.update_actor_sheet(target_actor uuid, actor_system_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_campaign uuid;
  target_owner uuid;
  next_data jsonb;
begin
  select campaign_id, owner_user_id into target_campaign, target_owner
  from public.actors where id=target_actor;
  if target_campaign is null then raise exception 'actor not found'; end if;
  if not public.is_campaign_gm(target_campaign) and target_owner is distinct from auth.uid() then
    raise exception 'actor access denied';
  end if;

  next_data := coalesce(actor_system_data,'{}'::jsonb);
  if jsonb_typeof(next_data) <> 'object' then raise exception 'invalid actor sheet data'; end if;
  if octet_length(next_data::text) > 65536 then raise exception 'actor sheet data is too large'; end if;

  update public.actors set system_data=next_data, updated_at=now() where id=target_actor;
  return next_data;
end;
$$;
revoke all on function public.update_actor_sheet(uuid,jsonb) from public,anon;
grant execute on function public.update_actor_sheet(uuid,jsonb) to authenticated;

-- New actors no longer receive game-system-specific hp/armor/level from the platform core.
create or replace function public.create_campaign_actor(
  target_campaign uuid,
  actor_name text,
  actor_kind public.actor_type default 'player',
  target_scene uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  inventory_id uuid;
  template_id uuid;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if nullif(btrim(actor_name),'') is null then raise exception 'actor name is required'; end if;
  if target_scene is not null and not exists(select 1 from public.scenes where id=target_scene and campaign_id=target_campaign) then
    raise exception 'scene not found';
  end if;

  select id into template_id
  from public.actor_sheet_templates
  where campaign_id=target_campaign and is_default
  order by created_at
  limit 1;

  insert into public.actors(campaign_id,type,name,subtitle,avatar,system_data,sheet_template_id)
  values(
    target_campaign,
    actor_kind,
    btrim(actor_name),
    case when actor_kind='player' then 'Персонаж игрока' else 'Персонаж мира' end,
    case when actor_kind='player' then '🧙' else '👤' end,
    '{}'::jsonb,
    template_id
  ) returning id into actor_id;

  insert into public.inventories(campaign_id,owner_actor_id) values(target_campaign,actor_id) returning id into inventory_id;
  insert into public.inventory_containers(inventory_id,name,type,sort_order) values
    (inventory_id,'Снаряжение','equipment',0),
    (inventory_id,'Рюкзак','container',1);

  if target_scene is not null then
    insert into public.scene_tokens(scene_id,actor_id,x,y,enemy,hidden)
    values(target_scene,actor_id,50,50,actor_kind in ('npc','creature'),false);
  end if;

  return actor_id;
end;
$$;
revoke all on function public.create_campaign_actor(uuid,text,public.actor_type,uuid) from public,anon;
grant execute on function public.create_campaign_actor(uuid,text,public.actor_type,uuid) to authenticated;

-- Actor-sheet template changes invalidate the online room just like Actor changes.
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
  elsif TG_TABLE_NAME in ('actors','scenes','inventories','item_definitions','campaign_runtime','journal_notes','roll_tables','actor_sheet_templates') then
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

drop trigger if exists ttv_actor_sheet_templates_realtime on public.actor_sheet_templates;
create trigger ttv_actor_sheet_templates_realtime
after insert or update or delete on public.actor_sheet_templates
for each row execute function public.ttv_broadcast_campaign_state();
