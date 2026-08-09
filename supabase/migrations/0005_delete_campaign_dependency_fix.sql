-- Item definitions are referenced with ON DELETE RESTRICT, so clear owned instances before deleting a campaign.
create or replace function public.delete_campaign(target_campaign uuid, expected_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare campaign_name text;
begin
  select name into campaign_name
  from public.campaigns
  where id = target_campaign and owner_id = auth.uid();

  if campaign_name is null then raise exception 'owner access required'; end if;
  if btrim(coalesce(expected_name,'')) <> campaign_name then raise exception 'campaign name does not match'; end if;

  delete from public.item_instances ii
  using public.inventory_containers ic, public.inventories inv
  where ii.container_id = ic.id
    and ic.inventory_id = inv.id
    and inv.campaign_id = target_campaign;

  delete from public.campaigns where id = target_campaign;
end;
$$;
revoke all on function public.delete_campaign(uuid,text) from public, anon;
grant execute on function public.delete_campaign(uuid,text) to authenticated;
