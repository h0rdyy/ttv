begin;

create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('51000000-0000-4000-8000-000000000001', 'actor-media-gm@example.test', '{}'::jsonb),
  ('52000000-0000-4000-8000-000000000002', 'actor-media-owner@example.test', '{}'::jsonb),
  ('53000000-0000-4000-8000-000000000003', 'actor-media-other@example.test', '{}'::jsonb);

insert into public.campaigns (id, owner_id, name)
values ('d0000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'Actor Media Test');

insert into public.campaign_members (campaign_id, user_id, role)
values
  ('d0000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'owner'),
  ('d0000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000002', 'player'),
  ('d0000000-0000-4000-8000-000000000001', '53000000-0000-4000-8000-000000000003', 'player');

insert into public.actors (
  id,
  campaign_id,
  owner_user_id,
  type,
  name,
  subtitle,
  avatar,
  system_data
)
values (
  'd1000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  '52000000-0000-4000-8000-000000000002',
  'player',
  'Media Hero',
  'Персонаж игрока',
  '🧙',
  '{}'::jsonb
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

select set_config('request.jwt.claim.sub', '52000000-0000-4000-8000-000000000002', true);
select ok(
  public.can_edit_actor_media('d1000000-0000-4000-8000-000000000001'),
  'actor owner may edit own portrait and token media'
);

select lives_ok(
  $$ select public.set_actor_media_path(
       'd1000000-0000-4000-8000-000000000001',
       'avatar',
       'd0000000-0000-4000-8000-000000000001/d1000000-0000-4000-8000-000000000001/avatar/test.webp'
     ) $$,
  'actor owner may attach an avatar path under the owned actor prefix'
);

select set_config('request.jwt.claim.sub', '53000000-0000-4000-8000-000000000003', true);
select isnt(
  public.can_edit_actor_media('d1000000-0000-4000-8000-000000000001'),
  true,
  'another campaign player may not edit somebody else media'
);

select throws_ok(
  $$ select public.set_actor_token_presentation(
       'd1000000-0000-4000-8000-000000000001',
       1.2,
       0,
       0
     ) $$,
  'P0001',
  'actor access denied',
  'another player cannot update somebody else token presentation'
);

select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000001', true);
select ok(
  public.can_edit_actor_media('d1000000-0000-4000-8000-000000000001'),
  'campaign GM may edit actor media'
);

select * from finish();
rollback;
