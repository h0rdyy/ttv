-- TTV: let any signed-in user step into the shared demo campaign.
-- Anonymous visitors are signed in as the demo account itself (proxy.ts);
-- logged-in users keep their own identity and become a GM member of the
-- shared tavern so the demo links open the demo table for them too.

create or replace function public.join_demo_campaign()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  demo_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  select id into demo_id
  from public.campaigns
  where name = 'Демо: таверна у дороги'
  limit 1;

  if demo_id is null then return null; end if;

  insert into public.campaign_members(campaign_id, user_id, role)
  values(demo_id, auth.uid(), 'gm')
  on conflict (campaign_id, user_id) do nothing;

  return demo_id;
end;
$$;
revoke all on function public.join_demo_campaign() from public, anon;
grant execute on function public.join_demo_campaign() to authenticated;
