-- TTV v0.4: scene maps, grid configuration, fog regions and token presentation.

alter table public.scenes add column if not exists background_path text;
alter table public.scenes add column if not exists grid_size integer not null default 64;
alter table public.scenes add column if not exists grid_offset_x double precision not null default 0;
alter table public.scenes add column if not exists grid_offset_y double precision not null default 0;
alter table public.scenes add column if not exists grid_snap boolean not null default true;
alter table public.scenes add column if not exists fog_reveals jsonb not null default '[]'::jsonb;

alter table public.scenes drop constraint if exists scenes_grid_size_check;
alter table public.scenes add constraint scenes_grid_size_check check (grid_size between 16 and 256);
alter table public.scenes drop constraint if exists scenes_fog_reveals_array_check;
alter table public.scenes add constraint scenes_fog_reveals_array_check check (jsonb_typeof(fog_reveals) = 'array');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('campaign-maps','campaign-maps',false,6291456,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.map_object_campaign(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare value text;
begin
  value := split_part(coalesce(object_name,''),'/',1);
  if value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return null; end if;
  return value::uuid;
exception when others then return null;
end;
$$;

create or replace function public.map_object_scene(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare value text;
begin
  value := split_part(coalesce(object_name,''),'/',2);
  if value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return null; end if;
  return value::uuid;
exception when others then return null;
end;
$$;

revoke all on function public.map_object_campaign(text) from public,anon;
revoke all on function public.map_object_scene(text) from public,anon;
grant execute on function public.map_object_campaign(text) to authenticated;
grant execute on function public.map_object_scene(text) to authenticated;

drop policy if exists campaign_maps_read on storage.objects;
create policy campaign_maps_read
on storage.objects for select to authenticated
using (
  bucket_id='campaign-maps'
  and public.can_read_scene(public.map_object_scene(name))
  and exists(
    select 1 from public.scenes s
    where s.id=public.map_object_scene(name)
      and s.campaign_id=public.map_object_campaign(name)
  )
);

drop policy if exists campaign_maps_insert on storage.objects;
create policy campaign_maps_insert
on storage.objects for insert to authenticated
with check (
  bucket_id='campaign-maps'
  and public.is_campaign_gm(public.map_object_campaign(name))
  and exists(
    select 1 from public.scenes s
    where s.id=public.map_object_scene(name)
      and s.campaign_id=public.map_object_campaign(name)
  )
);

drop policy if exists campaign_maps_update on storage.objects;
create policy campaign_maps_update
on storage.objects for update to authenticated
using (
  bucket_id='campaign-maps'
  and public.is_campaign_gm(public.map_object_campaign(name))
)
with check (
  bucket_id='campaign-maps'
  and public.is_campaign_gm(public.map_object_campaign(name))
  and exists(
    select 1 from public.scenes s
    where s.id=public.map_object_scene(name)
      and s.campaign_id=public.map_object_campaign(name)
  )
);

drop policy if exists campaign_maps_delete on storage.objects;
create policy campaign_maps_delete
on storage.objects for delete to authenticated
using (
  bucket_id='campaign-maps'
  and public.is_campaign_gm(public.map_object_campaign(name))
);

create or replace function public.update_campaign_scene(
  target_campaign uuid,
  target_scene uuid,
  scene_name text default null,
  scene_grid_enabled boolean default null,
  scene_fog_enabled boolean default null,
  scene_grid_size integer default null,
  scene_grid_offset_x double precision default null,
  scene_grid_offset_y double precision default null,
  scene_grid_snap boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if scene_grid_size is not null and (scene_grid_size < 16 or scene_grid_size > 256) then raise exception 'invalid grid size'; end if;

  update public.scenes
  set name=case when scene_name is null then name else coalesce(nullif(btrim(scene_name),''),name) end,
      grid_enabled=coalesce(scene_grid_enabled,grid_enabled),
      fog_enabled=coalesce(scene_fog_enabled,fog_enabled),
      grid_size=coalesce(scene_grid_size,grid_size),
      grid_offset_x=coalesce(scene_grid_offset_x,grid_offset_x),
      grid_offset_y=coalesce(scene_grid_offset_y,grid_offset_y),
      grid_snap=coalesce(scene_grid_snap,grid_snap),
      updated_at=now()
  where id=target_scene and campaign_id=target_campaign;
  if not found then raise exception 'scene not found'; end if;
end;
$$;
revoke all on function public.update_campaign_scene(uuid,uuid,text,boolean,boolean,integer,double precision,double precision,boolean) from public,anon;
grant execute on function public.update_campaign_scene(uuid,uuid,text,boolean,boolean,integer,double precision,double precision,boolean) to authenticated;

create or replace function public.set_scene_map_path(target_campaign uuid, target_scene uuid, map_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if not exists(select 1 from public.scenes where id=target_scene and campaign_id=target_campaign) then raise exception 'scene not found'; end if;
  if map_path is not null and map_path <> '' and map_path not like target_campaign::text || '/' || target_scene::text || '/%' then
    raise exception 'invalid map path';
  end if;
  update public.scenes
  set background_path=nullif(map_path,''), background_url=null, updated_at=now()
  where id=target_scene and campaign_id=target_campaign;
end;
$$;
revoke all on function public.set_scene_map_path(uuid,uuid,text) from public,anon;
grant execute on function public.set_scene_map_path(uuid,uuid,text) to authenticated;

create or replace function public.set_scene_fog_reveals(target_campaign uuid, target_scene uuid, reveals jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if jsonb_typeof(coalesce(reveals,'[]'::jsonb)) <> 'array' then raise exception 'invalid fog data'; end if;
  update public.scenes
  set fog_reveals=coalesce(reveals,'[]'::jsonb), updated_at=now()
  where id=target_scene and campaign_id=target_campaign;
  if not found then raise exception 'scene not found'; end if;
end;
$$;
revoke all on function public.set_scene_fog_reveals(uuid,uuid,jsonb) from public,anon;
grant execute on function public.set_scene_fog_reveals(uuid,uuid,jsonb) to authenticated;

create or replace function public.delete_campaign_scene(target_campaign uuid, target_scene uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare next_scene uuid;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if not exists(select 1 from public.scenes where id=target_scene and campaign_id=target_campaign) then raise exception 'scene not found'; end if;

  select id into next_scene
  from public.scenes
  where campaign_id=target_campaign and id<>target_scene
  order by created_at
  limit 1;

  update public.campaigns
  set active_scene_id=case when active_scene_id=target_scene then next_scene else active_scene_id end,
      updated_at=now()
  where id=target_campaign;

  delete from public.scenes where id=target_scene and campaign_id=target_campaign;
end;
$$;
revoke all on function public.delete_campaign_scene(uuid,uuid) from public,anon;
grant execute on function public.delete_campaign_scene(uuid,uuid) to authenticated;

create or replace function public.update_scene_token(
  target_campaign uuid,
  target_token uuid,
  token_hidden boolean default null,
  token_size double precision default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if token_size is not null and (token_size < 0.25 or token_size > 4) then raise exception 'invalid token size'; end if;
  update public.scene_tokens st
  set hidden=coalesce(token_hidden,st.hidden),
      size=coalesce(token_size,st.size),
      updated_at=now()
  from public.scenes s
  where st.id=target_token and s.id=st.scene_id and s.campaign_id=target_campaign;
  if not found then raise exception 'token not found'; end if;
end;
$$;
revoke all on function public.update_scene_token(uuid,uuid,boolean,double precision) from public,anon;
grant execute on function public.update_scene_token(uuid,uuid,boolean,double precision) to authenticated;

create or replace function public.remove_scene_token(target_campaign uuid, target_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  delete from public.scene_tokens st
  using public.scenes s
  where st.id=target_token and s.id=st.scene_id and s.campaign_id=target_campaign;
  if not found then raise exception 'token not found'; end if;
end;
$$;
revoke all on function public.remove_scene_token(uuid,uuid) from public,anon;
grant execute on function public.remove_scene_token(uuid,uuid) to authenticated;
