begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

select has_column('public', 'campaign_runtime', 'combat_initiative', 'runtime stores initiative');
select has_column('public', 'campaign_runtime', 'combat_effects', 'runtime stores effects');
select has_column('public', 'campaign_runtime', 'combat_control', 'runtime stores control mode');
select has_function('public', 'start_campaign_combat_v06', array['uuid','text','jsonb'], 'v0.6 combat start RPC exists');
select has_function('public', 'set_campaign_combat_initiative', array['uuid','uuid','integer'], 'initiative edit RPC exists');
select has_function('public', 'apply_campaign_combat_health', array['uuid','uuid','integer'], 'combat health RPC exists');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('61000000-0000-4000-8000-000000000001', 'combat-owner@example.test', '{}'::jsonb),
  ('62000000-0000-4000-8000-000000000002', 'combat-player@example.test', '{}'::jsonb);

insert into public.campaigns (id, owner_id, name)
values ('c6000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 'Combat v0.6');

insert into public.campaign_members (campaign_id, user_id, role)
values
  ('c6000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 'owner'),
  ('c6000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000002', 'player');

insert into public.scenes (id, campaign_id, name)
values ('c6100000-0000-4000-8000-000000000001', 'c6000000-0000-4000-8000-000000000001', 'Arena');

update public.campaigns
set active_scene_id = 'c6100000-0000-4000-8000-000000000001'
where id = 'c6000000-0000-4000-8000-000000000001';

insert into public.actors (id, campaign_id, type, name, system_data)
values
  ('c6200000-0000-4000-8000-000000000001', 'c6000000-0000-4000-8000-000000000001', 'player', 'Hero', '{"hp":{"current":10,"max":10}}'::jsonb),
  ('c6200000-0000-4000-8000-000000000002', 'c6000000-0000-4000-8000-000000000001', 'npc', 'Enemy', '{"hp":{"current":8,"max":8}}'::jsonb);

insert into public.scene_tokens (scene_id, actor_id, x, y)
values
  ('c6100000-0000-4000-8000-000000000001', 'c6200000-0000-4000-8000-000000000001', 30, 50),
  ('c6100000-0000-4000-8000-000000000001', 'c6200000-0000-4000-8000-000000000002', 70, 50);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$ select public.start_campaign_combat_v06(
       'c6000000-0000-4000-8000-000000000001',
       'manual',
       '{"c6200000-0000-4000-8000-000000000001":19,"c6200000-0000-4000-8000-000000000002":11}'::jsonb
     ) $$,
  'GM starts combat with manual initiative'
);

select results_eq(
  $$ select combat_order[1]::text from public.campaign_runtime where campaign_id = 'c6000000-0000-4000-8000-000000000001' $$,
  array['c6200000-0000-4000-8000-000000000001'::text],
  'manual initiative sorts the combat order'
);

select lives_ok(
  $$ select public.add_campaign_combat_effect(
       'c6000000-0000-4000-8000-000000000001',
       'c6200000-0000-4000-8000-000000000001',
       'Stunned', 'condition', 1
     ) $$,
  'GM adds a timed condition'
);

select lives_ok(
  $$ select public.apply_campaign_combat_health(
       'c6000000-0000-4000-8000-000000000001',
       'c6200000-0000-4000-8000-000000000001',
       -3
     ) $$,
  'GM applies combat damage'
);

select results_eq(
  $$ select (system_data->'hp'->>'current')::integer from public.actors where id = 'c6200000-0000-4000-8000-000000000001' $$,
  array[7],
  'combat damage uses bounded actor health'
);

select set_config('request.jwt.claim.sub', '62000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$ select public.apply_campaign_combat_health(
       'c6000000-0000-4000-8000-000000000001',
       'c6200000-0000-4000-8000-000000000001',
       -1
     ) $$,
  'P0001',
  'campaign access denied',
  'player cannot apply combat damage'
);

select * from finish();
rollback;
