-- Separate character-sheet portraits from tabletop token art.
-- Media lives in a private bucket; actors only store paths and presentation data
-- inside system_data._media so existing actor projections remain compatible.

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values(
  'campaign-actor-media',
  'campaign-actor-media',
  false,
  4194304,
  array['image/png','image/jpeg','image/webp']
)
on conflict(id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.actor_media_object_campaign(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare value text;
begin
  value := split_part(coalesce(object_name,''), '/', 1);
  if value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return null; end if;
  return value::uuid;
exception when others then return null;
end;
$$;

create or replace function public.actor_media_object_actor(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare value text;
begin
  value := split_part(coalesce(object_name,''), '/', 2);
  if value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return null; end if;
  return value::uuid;
exception when others then return null;
end;
$$;

create or replace function public.can_edit_actor_media(target_actor uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.actors a
    where a.id = target_actor
      and (
        a.owner_user_id = (select auth.uid())
        or public.is_campaign_gm(a.campaign_id)
      )
  )
$$;

revoke all on function public.actor_media_object_campaign(text) from public, anon;
revoke all on function public.actor_media_object_actor(text) from public, anon;
revoke all on function public.can_edit_actor_media(uuid) from public, anon;
grant execute on function public.actor_media_object_campaign(text) to authenticated;
grant execute on function public.actor_media_object_actor(text) to authenticated;
grant execute on function public.can_edit_actor_media(uuid) to authenticated;

drop policy if exists campaign_actor_media_read on storage.objects;
create policy campaign_actor_media_read
on storage.objects for select to authenticated
using (
  bucket_id = 'campaign-actor-media'
  and split_part(name, '/', 3) in ('avatar', 'token')
  and public.can_read_actor(public.actor_media_object_actor(name))
  and exists (
    select 1
    from public.actors a
    where a.id = public.actor_media_object_actor(name)
      and a.campaign_id = public.actor_media_object_campaign(name)
  )
);

drop policy if exists campaign_actor_media_insert on storage.objects;
create policy campaign_actor_media_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'campaign-actor-media'
  and split_part(name, '/', 3) in ('avatar', 'token')
  and public.can_edit_actor_media(public.actor_media_object_actor(name))
  and exists (
    select 1
    from public.actors a
    where a.id = public.actor_media_object_actor(name)
      and a.campaign_id = public.actor_media_object_campaign(name)
  )
);

drop policy if exists campaign_actor_media_delete on storage.objects;
create policy campaign_actor_media_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'campaign-actor-media'
  and public.can_edit_actor_media(public.actor_media_object_actor(name))
  and exists (
    select 1
    from public.actors a
    where a.id = public.actor_media_object_actor(name)
      and a.campaign_id = public.actor_media_object_campaign(name)
  )
);

create or replace function public.set_actor_media_path(
  target_actor uuid,
  media_kind text,
  media_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_campaign uuid;
  next_media jsonb;
begin
  select campaign_id into target_campaign
  from public.actors
  where id = target_actor;

  if target_campaign is null then raise exception 'actor not found'; end if;
  if not public.can_edit_actor_media(target_actor) then raise exception 'actor access denied'; end if;
  if media_kind not in ('avatar', 'token') then raise exception 'invalid media kind'; end if;
  if media_path is not null and media_path <> '' and media_path not like target_campaign::text || '/' || target_actor::text || '/' || media_kind || '/%' then
    raise exception 'invalid media path';
  end if;

  select coalesce(system_data->'_media', '{}'::jsonb)
  into next_media
  from public.actors
  where id = target_actor;

  if media_kind = 'avatar' then
    next_media := next_media || jsonb_build_object('avatar_path', nullif(media_path, ''));
  else
    next_media := next_media || jsonb_build_object('token_path', nullif(media_path, ''));
  end if;

  update public.actors
  set system_data = jsonb_set(coalesce(system_data, '{}'::jsonb), '{_media}', next_media, true),
      updated_at = now()
  where id = target_actor;
end;
$$;

revoke all on function public.set_actor_media_path(uuid,text,text) from public, anon;
grant execute on function public.set_actor_media_path(uuid,text,text) to authenticated;

create or replace function public.set_actor_token_presentation(
  target_actor uuid,
  token_scale double precision,
  token_offset_x double precision,
  token_offset_y double precision
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare next_media jsonb;
begin
  if not public.can_edit_actor_media(target_actor) then raise exception 'actor access denied'; end if;
  if token_scale is null or token_scale < 0.5 or token_scale > 2.5 then raise exception 'invalid token scale'; end if;
  if token_offset_x is null or token_offset_x < -50 or token_offset_x > 50 then raise exception 'invalid token x offset'; end if;
  if token_offset_y is null or token_offset_y < -50 or token_offset_y > 50 then raise exception 'invalid token y offset'; end if;

  select coalesce(system_data->'_media', '{}'::jsonb)
  into next_media
  from public.actors
  where id = target_actor;

  if not found then raise exception 'actor not found'; end if;

  next_media := next_media || jsonb_build_object(
    'token_scale', token_scale,
    'token_offset_x', token_offset_x,
    'token_offset_y', token_offset_y
  );

  update public.actors
  set system_data = jsonb_set(coalesce(system_data, '{}'::jsonb), '{_media}', next_media, true),
      updated_at = now()
  where id = target_actor;
end;
$$;

revoke all on function public.set_actor_token_presentation(uuid,double precision,double precision,double precision) from public, anon;
grant execute on function public.set_actor_token_presentation(uuid,double precision,double precision,double precision) to authenticated;
