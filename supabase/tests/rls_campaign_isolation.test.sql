begin;

create extension if not exists pgtap with schema extensions;
select plan(5);

-- Fixed fixtures: deterministic and isolated by the transaction rollback.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-4000-8000-000000000001', 'rls-owner-a@example.test', '{}'::jsonb),
  ('20000000-0000-4000-8000-000000000002', 'rls-owner-b@example.test', '{}'::jsonb),
  ('30000000-0000-4000-8000-000000000003', 'rls-outsider@example.test', '{}'::jsonb);

insert into public.campaigns (id, owner_id, name)
values
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'RLS Campaign A'),
  ('b0000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'RLS Campaign B');

insert into public.campaign_members (campaign_id, user_id, role)
values
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'owner'),
  ('b0000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'owner');

insert into public.campaign_runtime (campaign_id)
values
  ('a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000002');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.campaigns'::regclass),
  'campaigns has RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.campaign_runtime'::regclass),
  'campaign_runtime has RLS enabled'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  $$ select count(*)::bigint from public.campaign_runtime $$,
  array[1::bigint],
  'member sees runtime only for campaigns they belong to'
);

select results_eq(
  $$ select campaign_id::text from public.campaign_runtime $$,
  array['a0000000-0000-4000-8000-000000000001'::text],
  'member cannot read another campaign runtime row'
);

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000003', true);

select results_eq(
  $$ select count(*)::bigint from public.campaign_runtime $$,
  array[0::bigint],
  'authenticated outsider sees no campaign runtime rows'
);

select * from finish();
rollback;
