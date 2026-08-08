-- Allow a newly-created campaign owner to add their own owner membership
-- before is_campaign_gm() can become true for that campaign.
create policy campaign_members_owner_bootstrap_insert
on public.campaign_members
for insert
with check (
  user_id = auth.uid()
  and role = 'owner'
  and exists (
    select 1 from public.campaigns c
    where c.id = campaign_id and c.owner_id = auth.uid()
  )
);
