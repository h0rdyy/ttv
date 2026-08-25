import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnlineTableV05 } from './OnlineTableV05';
import { normalizeCombatControl, normalizeCombatEffects, normalizeCombatInitiative, type CombatRuntime } from './combat';

const SCENE_SELECT = 'id,campaign_id,name,background_url,background_path,grid_enabled,fog_enabled,grid_size,grid_offset_x,grid_offset_y,grid_snap,fog_reveals,measurement_unit,measurement_units_per_map_width,created_at';
const LEGACY_SCENE_SELECT = 'id,campaign_id,name,background_url,background_path,grid_enabled,fog_enabled,grid_size,grid_offset_x,grid_offset_y,grid_snap,fog_reveals,created_at';

type SceneRow = {
  id: string;
  campaign_id: string;
  name: string;
  background_url: string | null;
  background_path: string | null;
  grid_enabled: boolean;
  fog_enabled: boolean;
  grid_size: number;
  grid_offset_x: number;
  grid_offset_y: number;
  grid_snap: boolean;
  fog_reveals: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  measurement_unit: string | null;
  measurement_units_per_map_width: number | null;
  measurement_supported: boolean;
  created_at: string;
};

type RawSceneRow = Omit<SceneRow, 'measurement_supported'>;
type LegacySceneRow = Omit<RawSceneRow, 'measurement_unit' | 'measurement_units_per_map_width'>;

export async function OnlineGameRoom({ campaignId, mode }: { campaignId: string; mode: 'gm' | 'player' }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  const [{ data: campaign }, { data: membership }, runtimeResult] = await Promise.all([
    supabase.from('campaigns').select('id,name,description,owner_id,active_scene_id').eq('id', campaignId).maybeSingle(),
    supabase.from('campaign_members').select('role').eq('campaign_id', campaignId).eq('user_id', auth.user.id).maybeSingle(),
    supabase.from('campaign_runtime').select('campaign_id,combat_active,combat_round,combat_turn,combat_order,combat_initiative,combat_effects,combat_control,updated_at').eq('campaign_id', campaignId).maybeSingle(),
  ]);

  if (!campaign || !membership) redirect('/campaigns/online');

  const gmAllowed = ['owner', 'gm', 'assistant-gm'].includes(membership.role);
  if (mode === 'gm' && !gmAllowed) redirect(`/campaign/${campaignId}/player`);

  // Keep the table available during a rolling deploy before migration 0029 lands.
  let rawRuntime = runtimeResult.data as Record<string, unknown> | null;
  if (runtimeResult.error) {
    const legacyRuntime = await supabase
      .from('campaign_runtime')
      .select('campaign_id,combat_active,combat_round,combat_turn,combat_order,updated_at')
      .eq('campaign_id', campaignId)
      .maybeSingle();
    rawRuntime = legacyRuntime.data as Record<string, unknown> | null;
  }

  const runtime: CombatRuntime = {
    campaign_id: typeof rawRuntime?.campaign_id === 'string' ? rawRuntime.campaign_id : campaignId,
    combat_active: rawRuntime?.combat_active === true,
    combat_round: Number.isInteger(rawRuntime?.combat_round) ? Number(rawRuntime?.combat_round) : 1,
    combat_turn: Number.isInteger(rawRuntime?.combat_turn) ? Number(rawRuntime?.combat_turn) : 0,
    combat_order: Array.isArray(rawRuntime?.combat_order) ? rawRuntime.combat_order.filter((id): id is string => typeof id === 'string') : [],
    combat_initiative: normalizeCombatInitiative(rawRuntime?.combat_initiative),
    combat_effects: normalizeCombatEffects(rawRuntime?.combat_effects),
    combat_control: normalizeCombatControl(rawRuntime?.combat_control),
    updated_at: typeof rawRuntime?.updated_at === 'string' ? rawRuntime.updated_at : new Date(0).toISOString(),
  };

  const [sceneResult, actorResult, inventoryResult, definitionResult, sheetTemplateResult] = await Promise.all([
    supabase.from('scenes').select(SCENE_SELECT).eq('campaign_id', campaignId).order('created_at'),
    supabase.from('actors').select('id,campaign_id,owner_user_id,type,name,subtitle,avatar,system_data,sheet_template_id').eq('campaign_id', campaignId).order('created_at'),
    supabase.from('inventories').select('id,campaign_id,owner_actor_id').eq('campaign_id', campaignId),
    supabase.from('item_definitions').select('id,name,description,category,rarity,icon,weight,price,currency,source,properties,effects').eq('campaign_id', campaignId).order('created_at'),
    supabase.from('actor_sheet_templates').select('id,campaign_id,name,schema,is_default,created_at,updated_at').eq('campaign_id', campaignId).order('created_at'),
  ]);

  // During a rolling deploy the app may reach a database that has not received
  // migration 0023 yet. Retry the old projection instead of taking the whole VTT
  // down. The client can keep legacy 5-ft/grid movement until measurement support
  // becomes available, but calibration controls stay disabled in that state.
  let measurementSupported = !sceneResult.error;
  let rawSceneRows = (sceneResult.data ?? []) as unknown as RawSceneRow[];
  if (sceneResult.error) {
    const legacyScenes = await supabase.from('scenes').select(LEGACY_SCENE_SELECT).eq('campaign_id', campaignId).order('created_at');
    if (!legacyScenes.error) {
      measurementSupported = false;
      rawSceneRows = ((legacyScenes.data ?? []) as unknown as LegacySceneRow[]).map((scene) => ({
        ...scene,
        measurement_unit: 'ft',
        measurement_units_per_map_width: null,
      }));
    } else {
      rawSceneRows = [];
    }
  }

  const sceneRows: SceneRow[] = rawSceneRows.map((scene) => {
    const normalized: SceneRow = { ...scene, measurement_supported: measurementSupported };
    if (!scene.background_path) return normalized;
    const version = encodeURIComponent(scene.background_path);
    return {
      ...normalized,
      background_url: `/api/campaign/${campaignId}/scene/${scene.id}/map?v=${version}`,
    };
  });

  const actors = actorResult.data ?? [];
  const inventories = inventoryResult.data ?? [];
  const definitions = definitionResult.data ?? [];
  const sheetTemplates = sheetTemplateResult.data ?? [];
  const activeScene = sceneRows.find((scene) => scene.id === campaign.active_scene_id) ?? sceneRows[0] ?? null;
  const inventoryRows = inventories;
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

  const [{ data: notes }, { data: rollTables }] = gmAllowed
    ? await Promise.all([
        supabase.from('journal_notes').select('id,title,body,pinned,created_at,updated_at').eq('campaign_id', campaignId).eq('visibility', 'gm').order('pinned', { ascending: false }).order('updated_at', { ascending: false }),
        supabase.from('roll_tables').select('id,name,die,rows').eq('campaign_id', campaignId).order('created_at'),
      ])
    : [{ data: [] }, { data: [] }];

  const displayName =
    (typeof auth.user.user_metadata?.display_name === 'string' && auth.user.user_metadata.display_name.trim())
      ? auth.user.user_metadata.display_name.trim()
      : auth.user.email?.split('@')[0] || 'Игрок';

  return (
    <OnlineTableV05
      campaign={campaign}
      role={membership.role}
      mode={mode}
      currentUserId={auth.user.id}
      displayName={displayName}
      initialScenes={sceneRows}
      initialActors={actors}
      initialTokens={tokens ?? []}
      initialInventories={inventoryRows}
      initialContainers={containerRows}
      initialItemInstances={instances ?? []}
      initialItemDefinitions={definitions}
      initialSheetTemplates={sheetTemplates}
      initialNotes={notes ?? []}
      initialRollTables={rollTables ?? []}
      initialRuntime={runtime}
    />
  );
}
