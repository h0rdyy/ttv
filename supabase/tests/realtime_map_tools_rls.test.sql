begin;

create extension if not exists pgtap with schema extensions;
select plan(4);

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

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('realtime.topic', 'campaign:c0000000-0000-4000-8000-000000000001', true);

select set_config('request.jwt.claim.sub', '42000000-0000-4000-8000-000000000002', true);
select lives_ok(
  $$ insert into realtime.messages(topic, extension, event, payload, private)
     values ('campaign:c0000000-0000-4000-8000-000000000001', 'broadcast', 'map_ping', '{}'::jsonb, true) $$,
  'campaign player may send collaborative map pings'
);

select throws_ok(
  $$ insert into realtime.messages(topic, extension, event, payload, private)
     values ('campaign:c0000000-0000-4000-8000-000000000001', 'broadcast', 'map_draw', '{}'::jsonb, true) $$,
  '42501',
  'new row violates row-level security policy for table "messages"',
  'campaign player may not send GM drawing broadcasts'
);

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$ insert into realtime.messages(topic, extension, event, payload, private)
     values ('campaign:c0000000-0000-4000-8000-000000000001', 'broadcast', 'map_draw', '{}'::jsonb, true) $$,
  'campaign GM may draw on the map'
);

select lives_ok(
  $$ insert into realtime.messages(topic, extension, event, payload, private)
     values ('campaign:c0000000-0000-4000-8000-000000000001', 'broadcast', 'map_draw_clear', '{}'::jsonb, true) $$,
  'campaign GM may clear map drawings'
);

select * from finish();
rollback;
