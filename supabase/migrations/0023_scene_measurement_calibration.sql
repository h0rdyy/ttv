-- TTV immersion lab: scene measurement is independent from the visual grid.
-- `measurement_units_per_map_width` stores how many scene units span the full
-- map width. Token coordinates are percentage-based, so this scale survives
-- viewport resize, zoom and later grid-size adjustments.
-- CI regression coverage lives in tests/immersion-lab.test.mjs.

alter table public.scenes
  add column if not exists measurement_unit text not null default 'ft',
  add column if not exists measurement_units_per_map_width double precision;

alter table public.scenes drop constraint if exists scenes_measurement_unit_check;
alter table public.scenes add constraint scenes_measurement_unit_check
  check (char_length(measurement_unit) between 1 and 12);

alter table public.scenes drop constraint if exists scenes_measurement_scale_check;
alter table public.scenes add constraint scenes_measurement_scale_check
  check (measurement_units_per_map_width is null or (measurement_units_per_map_width > 0 and measurement_units_per_map_width <= 1000000000));

create or replace function public.set_scene_measurement(
  target_campaign uuid,
  target_scene uuid,
  scene_measurement_unit text,
  scene_units_per_map_width double precision
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_unit text;
begin
  if not public.is_campaign_gm(target_campaign) then
    raise exception 'campaign access denied';
  end if;

  normalized_unit := nullif(btrim(coalesce(scene_measurement_unit, '')), '');
  if normalized_unit is null or char_length(normalized_unit) > 12 then
    raise exception 'invalid measurement unit';
  end if;
  if scene_units_per_map_width is null
     or scene_units_per_map_width <= 0
     or scene_units_per_map_width > 1000000000 then
    raise exception 'invalid measurement scale';
  end if;

  update public.scenes
  set measurement_unit = normalized_unit,
      measurement_units_per_map_width = scene_units_per_map_width,
      updated_at = now()
  where id = target_scene and campaign_id = target_campaign;

  if not found then raise exception 'scene not found'; end if;
end;
$$;

revoke all on function public.set_scene_measurement(uuid,uuid,text,double precision) from public, anon;
grant execute on function public.set_scene_measurement(uuid,uuid,text,double precision) to authenticated;
