-- Map pings are collaborative, but drawing and clearing map annotations are GM tools.
-- Enforce that distinction at the private Realtime channel boundary rather than
-- trusting the client UI to hide the draw button from players.

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
  and (
    realtime.messages.extension <> 'broadcast'
    or realtime.messages.event not in ('map_draw', 'map_draw_clear')
    or exists (
      select 1
      from public.campaign_members gm
      where gm.user_id = (select auth.uid())
        and gm.role in ('owner', 'gm', 'assistant-gm')
        and (select realtime.topic()) = 'campaign:' || gm.campaign_id::text
    )
  )
);
