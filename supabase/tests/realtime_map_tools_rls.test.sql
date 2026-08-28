begin;

create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('41000000-0000-4000-8000-000000000001', 'map-tools-owner@example.test', '{}'::jsonb),
  ('42000000-0000-4000-8000-000000000002', 'map-tools-player@example.test', '{}'::jsonb);

insert into public.campaigns (id, owner_id, name)
values ('c0000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 'Realtime Map Tools');

insert into public.campaign_members (campaign_id, user_id, role)
values
  ('c0000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 'owner'),
  ('c0000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000002', 'player');

-- Seed one GM drawing before switching to the authenticated test role so the
-- player read policy is proven against an actual row, not an empty SELECT.
insert into realtime.messages(topic, extension, event, payload, private)
values (
  'campaign-map:c0000000-0000-4000-8000-000000000001',
  'broadcast',
  'map_draw',
  '{"seed":true}'::jsonb,
  true
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Shared campaign channel remains collaborative. This is the path used by
-- player token movement and pings.
select set_config('request.jwt.claim.sub', '42000000-0000-4000-8000-000000000002', true);
select set_config('realtime.topic', 'campaign:c0000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$ insert into realtime.messages(topic, extension, event, payload, private)
     values ('campaign:c0000000-0000-4000-8000-000000000001', 'broadcast', 'token_move', '{}'::jsonb, true) $$,
  'campaign player may send token movement broadcasts'
);

select lives_ok(
  $$ insert into realtime.messages(topic, extension, event, payload, private)
     values ('campaign:c0000000-0000-4000-8000-000000000001', 'broadcast', 'map_ping', '{}'::jsonb, true) $$,
  'campaign player may send collaborative map pings'
);

-- GM drawings use their own channel: members can receive them, players cannot
-- publish them, and GM-capable roles can.
select set_config('realtime.topic', 'campaign-map:c0000000-0000-4000-8000-000000000001', true);

select is(
  (select count(*)::integer
   from realtime.messages
   where topic = 'campaign-map:c0000000-0000-4000-8000-000000000001'
     and event = 'map_draw'
     and payload->>'seed' = 'true'),
  1,
  'campaign player may receive GM drawing broadcasts'
);

select throws_ok(
  $$ insert into realtime.messages(topic, extension, event, payload, private)
     values ('campaign-map:c0000000-0000-4000-8000-000000000001', 'broadcast', 'map_draw', '{}'::jsonb, true) $$,
  '42501',
  'new row violates row-level security policy for table "messages"',
  'campaign player may not publish GM drawing broadcasts'
);

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$ insert into realtime.messages(topic, extension, event, payload, private)
     values ('campaign-map:c0000000-0000-4000-8000-000000000001', 'broadcast', 'map_draw_clear', '{}'::jsonb, true) $$,
  'campaign GM may publish drawing broadcasts'
);

select * from finish();
rollback;
