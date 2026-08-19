import { describe, expect, it, vi } from 'vitest';
import { removeRealtimeChannels } from '../../src/features/campaign/realtimeCleanup';

describe('realtime cleanup', () => {
  it('removes every active channel exactly once and ignores empty slots', async () => {
    const campaignChannel = { topic: 'campaign:test' };
    const gmChannel = { topic: 'campaign-gm:test' };
    const removeChannel = vi.fn(async () => 'ok');

    await removeRealtimeChannels(
      { removeChannel },
      [campaignChannel, null, gmChannel, undefined],
    );

    expect(removeChannel).toHaveBeenCalledTimes(2);
    expect(removeChannel).toHaveBeenNthCalledWith(1, campaignChannel);
    expect(removeChannel).toHaveBeenNthCalledWith(2, gmChannel);
  });

  it('waits for asynchronous removals to settle before resolving', async () => {
    const finished: string[] = [];
    const removeChannel = vi.fn(async (channel: { topic: string }) => {
      await Promise.resolve();
      finished.push(channel.topic);
    });

    await removeRealtimeChannels(
      { removeChannel },
      [{ topic: 'one' }, { topic: 'two' }],
    );

    expect(finished).toEqual(['one', 'two']);
  });
});
