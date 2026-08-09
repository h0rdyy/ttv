import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnlineTable } from './OnlineTable';

export async function OnlineGameRoom({ campaignId, mode }: { campaignId: string; mode: 'gm' | 'player' }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  const [{ data: campaign }, { data: membership }, { data: runtime }] = await Promise.all([
    supabase.from('campaigns').select('id,name,description,owner_id,active_scene_id').eq('id', campaignId).maybeSingle(),
    supabase.from('campaign_members').select('role').eq('campaign_id', campaignId).eq('user_id', auth.user.id).maybeSingle(),
    supabase.from('campaign_runtime').select('campaign_id,combat_active,combat_round,combat_turn,combat_order,updated_at').eq('campaign_id', campaignId).maybeSingle(),
  ]);

  if (!campaign || !membership) redirect('/campaigns/online');

  const gmAllowed = ['owner', 'gm', 'assistant-gm'].includes(membership.role);
  if (mode === 'gm' && !gmAllowed) redirect(`/campaign/${campaignId}/player`);

  const [{ data: scenes }, { data: actors }, { data: inventories }, { data: definitions }] = await Promise.all([
    supabase.from('scenes').select('id,campaign_id,name,background_url,grid_enabled,fog_enabled,created_at').eq('campaign_id', campaignId).order('created_at'),
    supabase.from('actors').select('id,campaign_id,owner_user_id,type,name,subtitle,avatar,system_data').eq('campaign_id', campaignId).order('created_at'),
    supabase.from('inventories').select('id,campaign_id,owner_actor_id').eq('campaign_id', campaignId),
    supabase.from('item_definitions').select('id,name,description,category,rarity,icon,weight').eq('campaign_id', campaignId),
  ]);

  const sceneRows = scenes ?? [];
  const activeScene = sceneRows.find((scene) => scene.id === campaign.active_scene_id) ?? sceneRows[0] ?? null;
  const inventoryRows = inventories ?? [];
  const inventoryIds = inventoryRows.map((inventory) => inventory.id);

  const [{ data: tokens }, { data: containers }] = await Promise.all([
    activeScene
      ? supabase.from('scene_tokens').select('id,scene_id,actor_id,x,y,size,rotation,enemy,hidden').eq('scene_id', activeScene.id)
      : Promise.resolve({ data: [] }),
    inventoryIds.length
      ? supabase.from('inventory_containers').select('id,inventory_id,name,type,capacity,sort_order').in('inventory_id', inventoryIds).order('sort_order')
      : Promise.resolve({ data: [] }),
  ]);

  const containerRows = containers ?? [];
  const containerIds = containerRows.map((container) => container.id);
  const { data: instances } = containerIds.length
    ? await supabase.from('item_instances').select('id,definition_id,container_id,quantity,custom_name,equipped,state').in('container_id', containerIds)
    : { data: [] };

  const displayName =
    (typeof auth.user.user_metadata?.display_name === 'string' && auth.user.user_metadata.display_name.trim())
      ? auth.user.user_metadata.display_name.trim()
      : auth.user.email?.split('@')[0] || 'Игрок';

  return (
    <OnlineTable
      campaign={campaign}
      role={membership.role}
      mode={mode}
      currentUserId={auth.user.id}
      displayName={displayName}
      initialScenes={sceneRows}
      initialActors={actors ?? []}
      initialTokens={tokens ?? []}
      initialInventories={inventoryRows}
      initialContainers={containerRows}
      initialItemInstances={instances ?? []}
      initialItemDefinitions={definitions ?? []}
      initialRuntime={runtime ?? {
        campaign_id: campaignId,
        combat_active: false,
        combat_round: 1,
        combat_turn: 0,
        combat_order: [],
        updated_at: new Date(0).toISOString(),
      }}
    />
  );
}
