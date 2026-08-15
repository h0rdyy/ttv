-- Token movement already has a dedicated realtime `token_move` broadcast and is
-- updated optimistically on the sender. Avoid broadcasting a generic
-- `state_changed` for x/y-only scene_token updates, because that causes every
-- client to run an expensive full Next.js router.refresh() after each move.

create or replace function public.ttv_broadcast_campaign_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb;
  target_campaign uuid;
  relation_id uuid;
begin
  if TG_TABLE_NAME = 'scene_tokens' and TG_OP = 'UPDATE' then
    if (to_jsonb(NEW) - array['x', 'y', 'updated_at']) = (to_jsonb(OLD) - array['x', 'y', 'updated_at']) then
      return NEW;
    end if;
  end if;

  row_data := case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;

  if TG_TABLE_NAME = 'campaigns' then
    target_campaign := (row_data->>'id')::uuid;
  elsif TG_TABLE_NAME in ('actors','scenes','inventories','item_definitions','campaign_runtime') then
    target_campaign := (row_data->>'campaign_id')::uuid;
  elsif TG_TABLE_NAME = 'scene_tokens' then
    relation_id := (row_data->>'scene_id')::uuid;
    select s.campaign_id into target_campaign from public.scenes s where s.id = relation_id;
  elsif TG_TABLE_NAME = 'inventory_containers' then
    relation_id := (row_data->>'inventory_id')::uuid;
    select i.campaign_id into target_campaign from public.inventories i where i.id = relation_id;
  elsif TG_TABLE_NAME = 'item_instances' then
    relation_id := (row_data->>'container_id')::uuid;
    select i.campaign_id into target_campaign
    from public.inventory_containers c
    join public.inventories i on i.id = c.inventory_id
    where c.id = relation_id;
  end if;

  if target_campaign is not null then
    perform realtime.send(
      jsonb_build_object('scope', TG_TABLE_NAME, 'op', TG_OP),
      'state_changed',
      'campaign:' || target_campaign::text,
      true
    );
  end if;

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

revoke all on function public.ttv_broadcast_campaign_state() from public, anon, authenticated;
