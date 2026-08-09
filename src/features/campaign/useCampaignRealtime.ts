'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

type PresenceUser = {
  userId: string;
  name: string;
  mode: 'gm' | 'player';
};

type TokenMovePayload = {
  tokenId: string;
  x: number;
  y: number;
  senderUserId: string;
};

type Options = {
  campaignId: string;
  currentUserId: string;
  displayName: string;
  mode: 'gm' | 'player';
  onStateChanged: (scope?: string) => void;
  onRemoteTokenMove: (payload: TokenMovePayload) => void;
};

export function useCampaignRealtime({
  campaignId,
  currentUserId,
  displayName,
  mode,
  onStateChanged,
  onRemoteTokenMove,
}: Options) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);
  const [status, setStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    const supabase = createClient();
    let disposed = false;
    subscribedRef.current = false;
    const channel = supabase.channel(`campaign:${campaignId}`, {
      config: {
        private: true,
        presence: { key: currentUserId },
        broadcast: { self: false },
      },
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'state_changed' }, ({ payload }) => {
        onStateChanged(typeof payload?.scope === 'string' ? payload.scope : undefined);
      })
      .on('broadcast', { event: 'token_move' }, ({ payload }) => {
        const move = payload as Partial<TokenMovePayload>;
        if (
          typeof move.tokenId === 'string' &&
          typeof move.x === 'number' &&
          typeof move.y === 'number' &&
          typeof move.senderUserId === 'string' &&
          move.senderUserId !== currentUserId
        ) {
          onRemoteTokenMove(move as TokenMovePayload);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const unique = new Map<string, PresenceUser>();
        Object.values(state).flat().forEach((entry) => {
          const row = entry as unknown as Record<string, unknown>;
          const userId = typeof row.user_id === 'string' ? row.user_id : '';
          if (!userId) return;
          unique.set(userId, {
            userId,
            name: typeof row.name === 'string' && row.name ? row.name : 'Игрок',
            mode: row.mode === 'gm' ? 'gm' : 'player',
          });
        });
        setOnlineUsers([...unique.values()]);
      });

    void (async () => {
      try {
        await supabase.realtime.setAuth();
        if (disposed) return;
        channel.subscribe(async (nextStatus) => {
          if (disposed) return;
          if (nextStatus === 'SUBSCRIBED') {
            subscribedRef.current = true;
            setStatus('online');
            await channel.track({
              user_id: currentUserId,
              name: displayName,
              mode,
              online_at: new Date().toISOString(),
            });
          } else if (nextStatus === 'CHANNEL_ERROR' || nextStatus === 'TIMED_OUT' || nextStatus === 'CLOSED') {
            subscribedRef.current = false;
            setStatus('offline');
          }
        });
      } catch {
        if (!disposed) {
          subscribedRef.current = false;
          setStatus('offline');
        }
      }
    })();

    return () => {
      disposed = true;
      subscribedRef.current = false;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [campaignId, currentUserId, displayName, mode, onRemoteTokenMove, onStateChanged]);

  const broadcastTokenMove = useCallback((tokenId: string, x: number, y: number) => {
    const channel = channelRef.current;
    if (!channel || !subscribedRef.current) return;

    void channel.send({
      type: 'broadcast',
      event: 'token_move',
      payload: { tokenId, x, y, senderUserId: currentUserId },
    }).then((result) => {
      if (result !== 'ok') setStatus('offline');
    }).catch(() => setStatus('offline'));
  }, [currentUserId]);

  return { status, onlineUsers, broadcastTokenMove };
}
