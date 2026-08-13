-- TTV v0.5.1: server-authoritative, ephemeral realtime dice rolls.
-- Roll history stays in browser memory; this migration creates no history table.

drop policy if exists ttv_campaign_gm_realtime_read on realtime.messages;
create policy ttv_campaign_gm_realtime_read
on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and exists (
    select 1
    from public.campaign_members as member
    where member.user_id = (select auth.uid())
      and member.role in ('owner', 'gm', 'assistant-gm')
      and (select realtime.topic()) = 'campaign-gm:' || member.campaign_id::text
  )
);

create or replace function public.broadcast_dice_roll(
  target_campaign uuid,
  roll_sides integer[],
  roll_modifier integer default 0,
  roll_visibility text default 'public'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  sender_id uuid := (select auth.uid());
  sender_name text;
  safe_modifier integer := coalesce(roll_modifier, 0);
  safe_visibility text := coalesce(roll_visibility, 'public');
  die_sides integer;
  die_value integer;
  roll_values integer[] := '{}';
  roll_total integer := safe_modifier;
  created_at timestamptz := clock_timestamp();
  payload jsonb;
begin
  if sender_id is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1
    from public.campaign_members as member
    where member.campaign_id = target_campaign
      and member.user_id = sender_id
  ) then
    raise exception 'campaign access denied';
  end if;
  if coalesce(cardinality(roll_sides), 0) < 1 or cardinality(roll_sides) > 20 then
    raise exception 'dice count must be between 1 and 20';
  end if;
  if exists (
    select 1
    from unnest(roll_sides) as side(value)
    where side.value not in (4, 6, 8, 10, 12, 20, 100)
  ) then
    raise exception 'unsupported die';
  end if;
  if safe_modifier < -100 or safe_modifier > 100 then
    raise exception 'dice modifier is out of range';
  end if;
  if safe_visibility not in ('public', 'gm') then
    raise exception 'invalid dice visibility';
  end if;

  select left(coalesce(nullif(btrim(profile.display_name), ''), 'Игрок'), 80)
  into sender_name
  from public.profiles as profile
  where profile.id = sender_id;
  sender_name := coalesce(sender_name, 'Игрок');

  foreach die_sides in array roll_sides loop
    die_value := floor(random() * die_sides)::integer + 1;
    roll_values := array_append(roll_values, die_value);
    roll_total := roll_total + die_value;
  end loop;

  payload := jsonb_build_object(
    'id', gen_random_uuid(),
    'senderUserId', sender_id,
    'displayName', sender_name,
    'sides', roll_sides,
    'values', roll_values,
    'modifier', safe_modifier,
    'total', roll_total,
    'visibility', safe_visibility,
    'createdAt', created_at
  );

  perform realtime.send(
    payload,
    'dice_roll',
    case
      when safe_visibility = 'gm' then 'campaign-gm:' || target_campaign::text
      else 'campaign:' || target_campaign::text
    end,
    true
  );

  return payload;
end;
$function$;

revoke all on function public.broadcast_dice_roll(uuid, integer[], integer, text) from public, anon, authenticated;
grant execute on function public.broadcast_dice_roll(uuid, integer[], integer, text) to authenticated;
