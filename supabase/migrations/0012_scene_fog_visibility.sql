-- TTV v0.4 hardening: fog affects player data visibility, not only rendering.

create or replace function public.is_scene_point_revealed(
  target_scene uuid,
  target_x double precision,
  target_y double precision
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  scene_fog boolean;
  scene_reveals jsonb;
  reveal jsonb;
  rx double precision;
  ry double precision;
  rw double precision;
  rh double precision;
begin
  select s.fog_enabled, coalesce(s.fog_reveals,'[]'::jsonb)
  into scene_fog, scene_reveals
  from public.scenes s
  where s.id=target_scene;

  if scene_fog is null then return false; end if;
  if not scene_fog then return true; end if;

  for reveal in select value from jsonb_array_elements(scene_reveals)
  loop
    begin
      if jsonb_typeof(reveal) <> 'object' then continue; end if;
      rx := (reveal->>'x')::double precision;
      ry := (reveal->>'y')::double precision;
      rw := (reveal->>'width')::double precision;
      rh := (reveal->>'height')::double precision;
    exception when others then
      continue;
    end;

    if rw > 0 and rh > 0
      and target_x >= rx and target_x <= rx + rw
      and target_y >= ry and target_y <= ry + rh
    then
      return true;
    end if;
  end loop;

  return false;
end;
$$;
revoke all on function public.is_scene_point_revealed(uuid,double precision,double precision) from public,anon;
grant execute on function public.is_scene_point_revealed(uuid,double precision,double precision) to authenticated;

create or replace function public.set_scene_fog_reveals(target_campaign uuid, target_scene uuid, reveals jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  reveal jsonb;
  rx double precision;
  ry double precision;
  rw double precision;
  rh double precision;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if jsonb_typeof(coalesce(reveals,'[]'::jsonb)) <> 'array' then raise exception 'invalid fog data'; end if;
  if jsonb_array_length(coalesce(reveals,'[]'::jsonb)) > 250 then raise exception 'too many fog regions'; end if;

  for reveal in select value from jsonb_array_elements(coalesce(reveals,'[]'::jsonb))
  loop
    begin
      if jsonb_typeof(reveal) <> 'object' then raise exception 'invalid fog region'; end if;
      if jsonb_typeof(reveal->'x') <> 'number' or jsonb_typeof(reveal->'y') <> 'number'
        or jsonb_typeof(reveal->'width') <> 'number' or jsonb_typeof(reveal->'height') <> 'number'
      then raise exception 'invalid fog region'; end if;
      rx := (reveal->>'x')::double precision;
      ry := (reveal->>'y')::double precision;
      rw := (reveal->>'width')::double precision;
      rh := (reveal->>'height')::double precision;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'invalid fog region';
    end;

    if rx < 0 or ry < 0 or rw <= 0 or rh <= 0 or rx > 100 or ry > 100
      or rw > 100 or rh > 100 or rx + rw > 100.001 or ry + rh > 100.001
    then raise exception 'invalid fog region'; end if;
  end loop;

  update public.scenes
  set fog_reveals=coalesce(reveals,'[]'::jsonb), updated_at=now()
  where id=target_scene and campaign_id=target_campaign;
  if not found then raise exception 'scene not found'; end if;
end;
$$;
revoke all on function public.set_scene_fog_reveals(uuid,uuid,jsonb) from public,anon;
grant execute on function public.set_scene_fog_reveals(uuid,uuid,jsonb) to authenticated;

create or replace function public.can_read_actor(target_actor uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1
    from public.actors a
    where a.id=target_actor
      and (
        public.is_campaign_gm(a.campaign_id)
        or a.owner_user_id=auth.uid()
        or exists (
          select 1
          from public.scene_tokens st
          join public.scenes s on s.id=st.scene_id
          join public.campaigns c on c.id=s.campaign_id
          where st.actor_id=a.id
            and not st.hidden
            and c.active_scene_id=s.id
            and public.is_campaign_member(c.id)
            and public.is_scene_point_revealed(st.scene_id,st.x,st.y)
        )
      )
  )
$$;
revoke all on function public.can_read_actor(uuid) from public,anon;
grant execute on function public.can_read_actor(uuid) to authenticated;

drop policy if exists scene_tokens_visible_read on public.scene_tokens;
create policy scene_tokens_visible_read
on public.scene_tokens for select to authenticated
using (
  public.can_read_scene(scene_id)
  and (
    public.is_campaign_gm(public.campaign_for_scene(scene_id))
    or exists (
      select 1 from public.actors a
      where a.id=actor_id and a.owner_user_id=auth.uid()
    )
    or (
      not hidden
      and public.is_scene_point_revealed(scene_id,x,y)
    )
  )
);
