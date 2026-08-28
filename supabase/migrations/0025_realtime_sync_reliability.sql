-- Realtime delivery must have a persisted-state fallback.
--
-- Live token dragging still uses the lightweight `token_move` client broadcast,
-- but the final persisted scene_tokens UPDATE must also emit one `state_changed`
-- event. If a client broadcast is dropped during reconnect/auth churn, every
-- subscribed campaign client will therefore converge to the database state.
--
-- Migration 0022 also narrowed the direct campaign_id table list and
-- accidentally stopped journal_notes, roll_tables and actor_sheet_templates
-- from resolving their campaign even though their realtime triggers remained.
-- Restore those scopes here.

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
  row_data := case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;

  if TG_TABLE_NAME = 'campaigns' then
    target_campaign := (row_data->>'id')::uuid;
  elsif TG_TABLE_NAME in (
    'actors',
    'scenes',
    'inventories',
    'item_definitions',
    'campaign_runtime',
    'journal_notes',
    'roll_tables',
    'actor_sheet_templates'
  ) then
    target_campaign := (row_data->>'campaign_id')::uuid;
  elsif TG_TABLE_NAME = 'scene_tokens' then
    relation_id := (row_data->>'scene_id')::uuid;
    select s.campaign_id into target_campaign
    from public.scenes s
    where s.id = relation_id;
  elsif TG_TABLE_NAME = 'inventory_containers' then
    relation_id := (row_data->>'inventory_id')::uuid;
    select i.campaign_id into target_campaign
    from public.inventories i
    where i.id = relation_id;
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
