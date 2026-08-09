-- TTV v0.4.1: fix map upload/read policies.
--
-- The v0.4 policies referenced `name` from inside a nested scenes query.
-- PostgreSQL resolved that identifier to scenes.name instead of storage.objects.name,
-- so UUID parsing always failed for normal scene titles such as "Новая сцена".
-- Keep the object-path validation in a dedicated helper to avoid scope capture.

create or replace function public.map_object_matches_scene(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.scenes s
    where s.id = public.map_object_scene(object_name)
      and s.campaign_id = public.map_object_campaign(object_name)
  );
$$;

revoke all on function public.map_object_matches_scene(text) from public, anon;
grant execute on function public.map_object_matches_scene(text) to authenticated;

drop policy if exists campaign_maps_read on storage.objects;
create policy campaign_maps_read
on storage.objects for select to authenticated
using (
  bucket_id = 'campaign-maps'
  and public.can_read_scene(public.map_object_scene(name))
  and public.map_object_matches_scene(name)
);

drop policy if exists campaign_maps_insert on storage.objects;
create policy campaign_maps_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'campaign-maps'
  and public.is_campaign_gm(public.map_object_campaign(name))
  and public.map_object_matches_scene(name)
);

drop policy if exists campaign_maps_update on storage.objects;
create policy campaign_maps_update
on storage.objects for update to authenticated
using (
  bucket_id = 'campaign-maps'
  and public.is_campaign_gm(public.map_object_campaign(name))
)
with check (
  bucket_id = 'campaign-maps'
  and public.is_campaign_gm(public.map_object_campaign(name))
  and public.map_object_matches_scene(name)
);
