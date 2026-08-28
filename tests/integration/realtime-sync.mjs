import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.API_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  throw new Error('Realtime integration test requires SUPABASE_URL/API_URL, ANON_KEY and SERVICE_ROLE_KEY.');
}

const clientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

const admin = createClient(url, serviceRoleKey, clientOptions);
const gm = createClient(url, anonKey, clientOptions);
const player = createClient(url, anonKey, clientOptions);

const suffix = crypto.randomUUID().slice(0, 8);
const password = `Ttv-Realtime-${suffix}-A1!`;
const gmEmail = `realtime-gm-${suffix}@example.test`;
const playerEmail = `realtime-player-${suffix}@example.test`;
const campaignName = `Realtime Integration ${suffix}`;

let gmUserId = null;
let playerUserId = null;
let campaignId = null;
let gmChannel = null;
let playerChannel = null;
let gmMapChannel = null;
let playerMapChannel = null;

function check(result, context) {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  return result.data;
}

function waitFor(label, predicate, timeoutMs = 6000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      const value = predicate();
      if (value) {
        resolve(value);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        reject(new Error(`Timed out waiting for ${label}.`));
        return;
      }
      setTimeout(poll, 25);
    };
    poll();
  });
}

function subscribe(channel, label, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} did not subscribe in time.`)), timeoutMs);
    channel.subscribe((status, error) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer);
        resolve();
        return;
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        clearTimeout(timer);
        reject(new Error(`${label} subscription failed with ${status}${error ? `: ${error.message}` : ''}.`));
      }
    });
  });
}

async function signIn(client, email) {
  const data = check(await client.auth.signInWithPassword({ email, password }), `sign in ${email}`);
  assert.ok(data.session?.access_token, `Missing access token for ${email}`);
  await client.realtime.setAuth(data.session.access_token);
  return data.session;
}

async function cleanup() {
  await Promise.allSettled([
    gmChannel ? gm.removeChannel(gmChannel) : Promise.resolve(),
    playerChannel ? player.removeChannel(playerChannel) : Promise.resolve(),
    gmMapChannel ? gm.removeChannel(gmMapChannel) : Promise.resolve(),
    playerMapChannel ? player.removeChannel(playerMapChannel) : Promise.resolve(),
  ]);

  if (campaignId) {
    await gm.rpc('delete_campaign', {
      target_campaign: campaignId,
      expected_name: campaignName,
    });
  }
  if (playerUserId) await admin.auth.admin.deleteUser(playerUserId);
  if (gmUserId) await admin.auth.admin.deleteUser(gmUserId);
}

async function main() {
  try {
    const gmUser = check(await admin.auth.admin.createUser({
      email: gmEmail,
      password,
      email_confirm: true,
      user_metadata: { display_name: 'Realtime GM' },
    }), 'create GM user').user;
    const playerUser = check(await admin.auth.admin.createUser({
      email: playerEmail,
      password,
      email_confirm: true,
      user_metadata: { display_name: 'Realtime Player' },
    }), 'create player user').user;

    assert.ok(gmUser?.id && playerUser?.id, 'Failed to create realtime test users.');
    gmUserId = gmUser.id;
    playerUserId = playerUser.id;

    await signIn(gm, gmEmail);
    await signIn(player, playerEmail);

    const campaign = check(await gm.rpc('create_campaign', {
      campaign_name: campaignName,
      campaign_description: 'ephemeral CI campaign',
    }), 'create campaign');
    campaignId = campaign?.id ?? campaign?.[0]?.id ?? null;
    assert.ok(campaignId, 'create_campaign did not return an id.');

    const inviteToken = check(await gm.rpc('ensure_campaign_player_invite', {
      target_campaign: campaignId,
    }), 'create player invite');
    assert.equal(typeof inviteToken, 'string');

    const acceptedCampaignId = check(await player.rpc('accept_campaign_invite', {
      invite_token: inviteToken,
    }), 'accept player invite');
    assert.equal(acceptedCampaignId, campaignId);

    const sceneId = check(await gm.rpc('create_campaign_scene', {
      target_campaign: campaignId,
      scene_name: 'Realtime Test Scene',
    }), 'create scene');
    assert.equal(typeof sceneId, 'string');

    const actorId = check(await gm.rpc('create_campaign_actor', {
      target_campaign: campaignId,
      actor_name: 'Realtime Hero',
      actor_kind: 'player',
      target_scene: sceneId,
    }), 'create actor');
    assert.equal(typeof actorId, 'string');

    check(await gm.rpc('assign_actor_to_member', {
      target_campaign: campaignId,
      target_actor: actorId,
      target_user: playerUserId,
    }), 'assign actor to player');

    const token = check(await gm
      .from('scene_tokens')
      .select('id,x,y')
      .eq('scene_id', sceneId)
      .eq('actor_id', actorId)
      .single(), 'load token');
    assert.ok(token?.id, 'Realtime test token is missing.');

    const gmTokenMoves = [];
    const playerTokenMoves = [];
    const gmStateChanges = [];
    const playerStateChanges = [];
    const playerDraws = [];
    const topic = `campaign:${campaignId}`;
    const mapTopic = `campaign-map:${campaignId}`;

    gmChannel = gm.channel(topic, {
      config: { private: true, broadcast: { self: false } },
    })
      .on('broadcast', { event: 'token_move' }, ({ payload }) => gmTokenMoves.push(payload))
      .on('broadcast', { event: 'state_changed' }, ({ payload }) => gmStateChanges.push(payload));

    playerChannel = player.channel(topic, {
      config: { private: true, broadcast: { self: false } },
    })
      .on('broadcast', { event: 'token_move' }, ({ payload }) => playerTokenMoves.push(payload))
      .on('broadcast', { event: 'state_changed' }, ({ payload }) => playerStateChanges.push(payload));

    gmMapChannel = gm.channel(mapTopic, {
      config: { private: true, broadcast: { self: false } },
    });

    playerMapChannel = player.channel(mapTopic, {
      config: { private: true, broadcast: { self: false } },
    })
      .on('broadcast', { event: 'map_draw' }, ({ payload }) => playerDraws.push(payload));

    await Promise.all([
      subscribe(gmChannel, 'GM campaign channel'),
      subscribe(playerChannel, 'player campaign channel'),
      subscribe(gmMapChannel, 'GM map channel'),
      subscribe(playerMapChannel, 'player map channel'),
    ]);

    const gmMove = {
      tokenId: token.id,
      x: 61.25,
      y: 42.5,
      senderUserId: gmUserId,
    };
    assert.equal(await gmChannel.send({ type: 'broadcast', event: 'token_move', payload: gmMove }), 'ok');
    const deliveredToPlayer = await waitFor('GM token_move on player socket', () =>
      playerTokenMoves.find((payload) => payload?.tokenId === token.id && payload?.senderUserId === gmUserId));
    assert.equal(deliveredToPlayer.x, gmMove.x);
    assert.equal(deliveredToPlayer.y, gmMove.y);

    const playerMove = {
      tokenId: token.id,
      x: 58.75,
      y: 47.25,
      senderUserId: playerUserId,
    };
    assert.equal(await playerChannel.send({ type: 'broadcast', event: 'token_move', payload: playerMove }), 'ok');
    const deliveredToGm = await waitFor('player token_move on GM socket', () =>
      gmTokenMoves.find((payload) => payload?.tokenId === token.id && payload?.senderUserId === playerUserId));
    assert.equal(deliveredToGm.x, playerMove.x);
    assert.equal(deliveredToGm.y, playerMove.y);

    const draw = {
      id: crypto.randomUUID(),
      sceneId,
      senderUserId: gmUserId,
      tone: 'accent',
      points: [{ x: 10, y: 10 }, { x: 15, y: 14 }],
    };
    assert.equal(await gmMapChannel.send({ type: 'broadcast', event: 'map_draw', payload: draw }), 'ok');
    const deliveredDraw = await waitFor('GM map_draw on player socket', () =>
      playerDraws.find((payload) => payload?.id === draw.id && payload?.senderUserId === gmUserId));
    assert.equal(deliveredDraw.sceneId, sceneId);

    gmStateChanges.length = 0;
    playerStateChanges.length = 0;

    check(await player.rpc('move_scene_token', {
      target_token: token.id,
      new_x: 57.5,
      new_y: 46.25,
    }), 'persist player token move');

    await waitFor('persisted scene_tokens UPDATE fallback on GM socket', () =>
      gmStateChanges.find((payload) => payload?.scope === 'scene_tokens' && payload?.op === 'UPDATE'));

    const persisted = check(await gm
      .from('scene_tokens')
      .select('x,y')
      .eq('id', token.id)
      .single(), 'read persisted token position');
    assert.equal(persisted.x, 57.5);
    assert.equal(persisted.y, 46.25);

    console.log('Realtime integration passed: GM↔player movement, protected drawing delivery and persisted-state fallback are healthy.');
  } finally {
    await cleanup();
  }
}

await main();
