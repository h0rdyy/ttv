-- TTV: shared demo campaign ("Демо: таверна у дороги").
-- The demo lives on a dedicated technical account, not on any real user's
-- account. seed_demo_campaign() provisions (or restores) the tavern demo for
-- that account; the middleware signs anonymous demo visitors in with its
-- credentials, so no registration is required to try the table.
--
-- Usage (provision/reset the shared demo):
--   select public.seed_demo_campaign('<demo-account-user-id>');

create or replace function public.seed_demo_campaign(target_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign_id uuid;
  scene_id uuid;
  template_id uuid;
  actor_id uuid;
  inventory_id uuid;
  demo record;
begin
  if target_user is null then raise exception 'user is required'; end if;

  -- Restoring over an existing demo: drop the previous tavern first.
  delete from public.campaigns
  where owner_id = target_user
    and name = 'Демо: таверна у дороги';

  if exists (select 1 from public.campaigns where owner_id = target_user) then
    raise exception 'user already owns other campaigns';
  end if;

  insert into public.campaigns(owner_id, name, description, system_id, setting_id, theme_id)
  values(
    target_user,
    'Демо: таверна у дороги',
    'Небольшой демо-ваншот: любопытная история на один вечер, чтобы освоить стол.',
    'generic-fantasy',
    'medieval-fantasy',
    'dark-fantasy'
  )
  returning id into campaign_id;

  insert into public.campaign_members(campaign_id, user_id, role)
  values(campaign_id, target_user, 'owner');

  insert into public.actor_sheet_templates(campaign_id, name, schema, is_default)
  values(campaign_id, 'Классический лист', public.classic_fantasy_sheet_schema(), true)
  returning id into template_id;

  insert into public.scenes(campaign_id, name, grid_enabled, fog_enabled)
  values(campaign_id, 'Таверна «Ржавый дракон»', true, false)
  returning id into scene_id;

  update public.campaigns set active_scene_id = scene_id, updated_at = now() where id = campaign_id;

  for demo in
    select * from (values
      ('Марта', 'player'::public.actor_type, '🧙', 'Персонаж игрока', 12, 38.0, 55.0),
      ('Тобин', 'player'::public.actor_type, '🧙', 'Персонаж игрока', 10, 46.0, 62.0),
      ('Гуннар, трактирщик', 'npc'::public.actor_type, '👨‍🍳', 'Персонаж мира', 8, 60.0, 42.0),
      ('Эльда, травница', 'npc'::public.actor_type, '🌿', 'Персонаж мира', 9, 70.0, 58.0)
    ) as t(name, kind, avatar, subtitle, hp, x, y)
  loop
    insert into public.actors(campaign_id, type, name, subtitle, avatar, system_data, sheet_template_id)
    values(
      campaign_id,
      demo.kind,
      demo.name,
      demo.subtitle,
      demo.avatar,
      jsonb_build_object(
        'hp', jsonb_build_object('current', demo.hp, 'max', demo.hp),
        'armor', 10,
        'level', 1
      ),
      template_id
    ) returning id into actor_id;

    insert into public.inventories(campaign_id, owner_actor_id)
    values(campaign_id, actor_id) returning id into inventory_id;

    insert into public.inventory_containers(inventory_id, name, type, sort_order) values
      (inventory_id, 'Снаряжение', 'equipment', 0),
      (inventory_id, 'Рюкзак', 'container', 1);

    insert into public.scene_tokens(scene_id, actor_id, x, y, enemy, hidden)
    values(scene_id, actor_id, demo.x, demo.y, demo.kind in ('npc', 'creature'), false);
  end loop;

  return campaign_id;
end;
$$;
revoke all on function public.seed_demo_campaign(uuid) from public, anon, authenticated;
