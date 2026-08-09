-- TTV v0.2 online table: active scene, player-safe reads and simple GM bootstrap helpers.

alter table public.campaigns add column if not exists active_scene_id uuid references public.scenes(id) on delete set null;

create or replace function public.can_read_scene(target_scene uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.scenes s
    join public.campaigns c on c.id=s.campaign_id
    where s.id=target_scene
      and (public.is_campaign_gm(c.id) or (public.is_campaign_member(c.id) and c.active_scene_id=s.id))
  )
$$;
revoke all on function public.can_read_scene(uuid) from public,anon;
grant execute on function public.can_read_scene(uuid) to authenticated;

create or replace function public.can_read_actor(target_actor uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.actors a
    where a.id=target_actor
      and (
        public.is_campaign_gm(a.campaign_id)
        or a.owner_user_id=auth.uid()
        or exists (
          select 1 from public.scene_tokens st
          join public.scenes s on s.id=st.scene_id
          join public.campaigns c on c.id=s.campaign_id
          where st.actor_id=a.id
            and not st.hidden
            and c.active_scene_id=s.id
            and public.is_campaign_member(c.id)
        )
      )
  )
$$;
revoke all on function public.can_read_actor(uuid) from public,anon;
grant execute on function public.can_read_actor(uuid) to authenticated;

create or replace function public.can_read_inventory(target_inventory uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.inventories i
    join public.actors a on a.id=i.owner_actor_id
    where i.id=target_inventory
      and (public.is_campaign_gm(i.campaign_id) or a.owner_user_id=auth.uid())
  )
$$;
revoke all on function public.can_read_inventory(uuid) from public,anon;
grant execute on function public.can_read_inventory(uuid) to authenticated;

create or replace function public.can_read_container(target_container uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (select 1 from public.inventory_containers ic where ic.id=target_container and public.can_read_inventory(ic.inventory_id))
$$;
revoke all on function public.can_read_container(uuid) from public,anon;
grant execute on function public.can_read_container(uuid) to authenticated;

create or replace function public.can_read_item_instance(target_instance uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (select 1 from public.item_instances ii where ii.id=target_instance and public.can_read_container(ii.container_id))
$$;
revoke all on function public.can_read_item_instance(uuid) from public,anon;
grant execute on function public.can_read_item_instance(uuid) to authenticated;

create or replace function public.can_read_item_definition(target_definition uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.item_definitions d
    where d.id=target_definition
      and (public.is_campaign_gm(d.campaign_id) or exists (
        select 1 from public.item_instances ii where ii.definition_id=d.id and public.can_read_container(ii.container_id)
      ))
  )
$$;
revoke all on function public.can_read_item_definition(uuid) from public,anon;
grant execute on function public.can_read_item_definition(uuid) to authenticated;

drop policy if exists scenes_member_read on public.scenes;
create policy scenes_visible_read on public.scenes for select using (public.can_read_scene(id));

drop policy if exists actors_member_read on public.actors;
create policy actors_visible_read on public.actors for select using (public.can_read_actor(id));

drop policy if exists scene_tokens_member_read on public.scene_tokens;
create policy scene_tokens_visible_read on public.scene_tokens for select using (
  public.can_read_scene(scene_id) and (not hidden or public.is_campaign_gm(public.campaign_for_scene(scene_id)))
);

drop policy if exists inventories_member_read on public.inventories;
create policy inventories_owner_read on public.inventories for select using (public.can_read_inventory(id));

drop policy if exists containers_member_read on public.inventory_containers;
create policy containers_owner_read on public.inventory_containers for select using (public.can_read_container(id));

drop policy if exists item_instances_member_read on public.item_instances;
create policy item_instances_owner_read on public.item_instances for select using (public.can_read_item_instance(id));

drop policy if exists item_definitions_member_read on public.item_definitions;
create policy item_definitions_visible_read on public.item_definitions for select using (public.can_read_item_definition(id));

create or replace function public.create_campaign_scene(target_campaign uuid, scene_name text)
returns uuid language plpgsql security definer set search_path=public as $$
declare created_id uuid;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if nullif(btrim(scene_name),'') is null then raise exception 'scene name is required'; end if;
  insert into public.scenes(campaign_id,name) values(target_campaign,btrim(scene_name)) returning id into created_id;
  update public.campaigns set active_scene_id=coalesce(active_scene_id,created_id), updated_at=now() where id=target_campaign;
  return created_id;
end;
$$;
revoke all on function public.create_campaign_scene(uuid,text) from public,anon;
grant execute on function public.create_campaign_scene(uuid,text) to authenticated;

create or replace function public.set_active_scene(target_campaign uuid, target_scene uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if not exists(select 1 from public.scenes where id=target_scene and campaign_id=target_campaign) then raise exception 'scene not found'; end if;
  update public.campaigns set active_scene_id=target_scene, updated_at=now() where id=target_campaign;
end;
$$;
revoke all on function public.set_active_scene(uuid,uuid) from public,anon;
grant execute on function public.set_active_scene(uuid,uuid) to authenticated;

create or replace function public.create_campaign_actor(
  target_campaign uuid,
  actor_name text,
  actor_kind public.actor_type default 'player',
  target_scene uuid default null
)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor_id uuid; inventory_id uuid;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if nullif(btrim(actor_name),'') is null then raise exception 'actor name is required'; end if;
  if target_scene is not null and not exists(select 1 from public.scenes where id=target_scene and campaign_id=target_campaign) then raise exception 'scene not found'; end if;

  insert into public.actors(campaign_id,type,name,subtitle,avatar,system_data)
  values(
    target_campaign,
    actor_kind,
    btrim(actor_name),
    case when actor_kind='player' then 'Персонаж игрока' else 'Персонаж мира' end,
    case when actor_kind='player' then '🧙' else '👤' end,
    '{"hp":{"current":10,"max":10},"armor":10,"level":1}'::jsonb
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
