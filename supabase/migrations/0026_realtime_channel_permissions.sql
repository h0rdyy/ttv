-- Realtime Authorization grants channel feature access when a private channel is
-- joined. Event-specific write rules on one shared channel can therefore remove
-- the player's Broadcast write capability for unrelated events such as
-- `token_move`. Keep collaborative campaign traffic on the shared channel and
-- isolate GM-only drawing writes on a dedicated channel.

-- Collaborative campaign channel: every campaign member may read/write
-- Broadcast + Presence. Used by token movement, pings, dice/state delivery and
-- presence. GM-only events must not be sent on this channel.
drop policy if exists ttv_campaign_realtime_write on realtime.messages;
create policy ttv_campaign_realtime_write
on realtime.messages for insert to authenticated
with check (
  realtime.messages.extension in ('broadcast','presence')
  and exists (
    select 1
    from public.campaign_members cm
    where cm.user_id = (select auth.uid())
      and (select realtime.topic()) = 'campaign:' || cm.campaign_id::text
  )
);

-- Dedicated map-annotation channel. Every campaign member can receive GM
-- drawings, but only a GM-capable role can publish/clear them.
drop policy if exists ttv_campaign_map_realtime_read on realtime.messages;
create policy ttv_campaign_map_realtime_read
on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and exists (
    select 1
    from public.campaign_members cm
    where cm.user_id = (select auth.uid())
      and (select realtime.topic()) = 'campaign-map:' || cm.campaign_id::text
  )
);

drop policy if exists ttv_campaign_map_realtime_write on realtime.messages;
create policy ttv_campaign_map_realtime_write
on realtime.messages for insert to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and exists (
    select 1
    from public.campaign_members gm
    where gm.user_id = (select auth.uid())
      and gm.role in ('owner', 'gm', 'assistant-gm')
      and (select realtime.topic()) = 'campaign-map:' || gm.campaign_id::text
  )
);
