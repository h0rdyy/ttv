-- TTV v0.3.4: inventory actions used by the restored GM panel.

create or replace function public.move_item_instance(
  target_campaign uuid,
  target_instance uuid,
  target_container uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  source_campaign uuid;
  destination_campaign uuid;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;

  select i.campaign_id into source_campaign
  from public.item_instances ii
  join public.inventory_containers c on c.id=ii.container_id
  join public.inventories i on i.id=c.inventory_id
  where ii.id=target_instance;

  select i.campaign_id into destination_campaign
  from public.inventory_containers c
  join public.inventories i on i.id=c.inventory_id
  where c.id=target_container;

  if source_campaign is distinct from target_campaign or destination_campaign is distinct from target_campaign then
    raise exception 'inventory access denied';
  end if;

  update public.item_instances
  set container_id=target_container, updated_at=now()
  where id=target_instance;
  if not found then raise exception 'item not found'; end if;
end;
$$;
revoke all on function public.move_item_instance(uuid,uuid,uuid) from public,anon;
grant execute on function public.move_item_instance(uuid,uuid,uuid) to authenticated;

create or replace function public.remove_item_instance(target_campaign uuid, target_instance uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  delete from public.item_instances ii
  using public.inventory_containers c, public.inventories i
  where ii.id=target_instance
    and c.id=ii.container_id
    and i.id=c.inventory_id
    and i.campaign_id=target_campaign;
  if not found then raise exception 'item not found'; end if;
end;
$$;
revoke all on function public.remove_item_instance(uuid,uuid) from public,anon;
grant execute on function public.remove_item_instance(uuid,uuid) to authenticated;
