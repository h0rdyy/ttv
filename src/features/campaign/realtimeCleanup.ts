export type RealtimeChannelRemover<TChannel> = {
  removeChannel: (channel: TChannel) => Promise<unknown> | unknown;
};

/**
 * One cleanup contract for every tabletop realtime surface.
 *
 * Keeping this pure makes the lifecycle rule testable without React, a browser,
 * Supabase credentials, or a real websocket connection.
 */
export async function removeRealtimeChannels<TChannel>(
  client: RealtimeChannelRemover<TChannel>,
  channels: Array<TChannel | null | undefined>,
) {
  const activeChannels = channels.filter((channel): channel is TChannel => channel != null);
  await Promise.all(activeChannels.map((channel) => Promise.resolve(client.removeChannel(channel))));
}
