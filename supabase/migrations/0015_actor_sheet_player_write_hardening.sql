-- TTV v0.5 hardening: players may only change keys declared by their assigned sheet template.

create or replace function public.update_actor_sheet(target_actor uuid, actor_system_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_campaign uuid;
  target_owner uuid;
  target_template uuid;
  current_data jsonb;
  next_data jsonb;
  template_schema jsonb;
  allowed_keys text[];
  key_name text;
begin
  select campaign_id, owner_user_id, sheet_template_id, system_data
  into target_campaign, target_owner, target_template, current_data
  from public.actors
  where id=target_actor;

  if target_campaign is null then raise exception 'actor not found'; end if;

  next_data := coalesce(actor_system_data,'{}'::jsonb);
  if jsonb_typeof(next_data) <> 'object' then raise exception 'invalid actor sheet data'; end if;
  if octet_length(next_data::text) > 65536 then raise exception 'actor sheet data is too large'; end if;

  if public.is_campaign_gm(target_campaign) then
    update public.actors set system_data=next_data, updated_at=now() where id=target_actor;
    return next_data;
  end if;

  if target_owner is distinct from auth.uid() then raise exception 'actor access denied'; end if;
  if target_template is null then raise exception 'actor has no sheet template'; end if;

  select schema into template_schema
  from public.actor_sheet_templates
  where id=target_template and campaign_id=target_campaign;
  if template_schema is null then raise exception 'sheet template not found'; end if;

  select coalesce(array_agg(distinct field->>'key') filter (where nullif(field->>'key','') is not null), '{}')
  into allowed_keys
  from jsonb_array_elements(coalesce(template_schema->'sections','[]'::jsonb)) section,
       jsonb_array_elements(coalesce(section->'fields','[]'::jsonb)) field;

  current_data := coalesce(current_data,'{}'::jsonb);
  foreach key_name in array allowed_keys loop
    if next_data ? key_name then
      current_data := jsonb_set(current_data, array[key_name], next_data->key_name, true);
    end if;
  end loop;

  if octet_length(current_data::text) > 65536 then raise exception 'actor sheet data is too large'; end if;

  update public.actors set system_data=current_data, updated_at=now() where id=target_actor;
  return current_data;
end;
$$;

revoke all on function public.update_actor_sheet(uuid,jsonb) from public,anon;
grant execute on function public.update_actor_sheet(uuid,jsonb) to authenticated;
