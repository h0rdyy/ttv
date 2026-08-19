-- Fix actor media Storage RLS path validation.
-- The original policies referenced `name` inside an EXISTS over public.actors;
-- Postgres resolved that identifier to actors.name instead of storage.objects.name.
-- Keep path parsing in a dedicated SECURITY DEFINER helper so the outer object path
-- is passed explicitly and cannot be shadowed by a nested relation column.

create or replace function public.actor_media_object_matches_actor(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.actors a
    where a.id = public.actor_media_object_actor(object_name)
      and a.campaign_id = public.actor_media_object_campaign(object_name)
  )
$$;

revoke all on function public.actor_media_object_matches_actor(text) from public, anon;
grant execute on function public.actor_media_object_matches_actor(text) to authenticated;

drop policy if exists campaign_actor_media_read on storage.objects;
create policy campaign_actor_media_read
on storage.objects for select to authenticated
using (
  bucket_id = 'campaign-actor-media'
  and split_part(name, '/', 3) in ('avatar', 'token')
  and public.can_read_actor(public.actor_media_object_actor(name))
  and public.actor_media_object_matches_actor(name)
);

drop policy if exists campaign_actor_media_insert on storage.objects;
create policy campaign_actor_media_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'campaign-actor-media'
  and split_part(name, '/', 3) in ('avatar', 'token')
  and public.can_edit_actor_media(public.actor_media_object_actor(name))
  and public.actor_media_object_matches_actor(name)
);

drop policy if exists campaign_actor_media_delete on storage.objects;
create policy campaign_actor_media_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'campaign-actor-media'
  and public.can_edit_actor_media(public.actor_media_object_actor(name))
  and public.actor_media_object_matches_actor(name)
);
