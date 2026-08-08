import type { CampaignPresetId } from '@/config/campaignPresets';
import type { Actor, Inventory, ItemDefinition, RollTable, SceneToken } from '@/domain/types';
import { useCampaignStore } from '@/store/useCampaignStore';
import { useRollTableStore } from '@/store/useRollTableStore';

export interface CampaignSnapshotV1 {
  version: 1;
  campaign: {
    id: string;
    name: string;
    presetId: CampaignPresetId;
  };
  library: ItemDefinition[];
  inventories: Inventory[];
  notes: string[];
  combat: {
    round: number;
    turn: number;
  };
  map?: {
    grid: boolean;
    fog: boolean;
    tokenPositions: Record<string, { x: number; y: number }>;
  };
  customActors?: Actor[];
  customTokens?: SceneToken[];
  rollTables?: RollTable[];
}

const allowedPresets: CampaignPresetId[] = ['medieval-fantasy', 'grimdark', 'sci-fi'];

export function parseCampaignSnapshot(text: string): CampaignSnapshotV1 {
  const value = JSON.parse(text) as Partial<CampaignSnapshotV1>;

  if (value.version !== 1) throw new Error('Unsupported snapshot version');
  if (!value.campaign || !allowedPresets.includes(value.campaign.presetId as CampaignPresetId)) throw new Error('Invalid campaign preset');
  if (!Array.isArray(value.library)) throw new Error('Invalid item library');
  if (!Array.isArray(value.inventories)) throw new Error('Invalid inventories');
  if (!Array.isArray(value.notes) || !value.notes.every((note) => typeof note === 'string')) throw new Error('Invalid notes');
  if (!value.combat || typeof value.combat.round !== 'number' || typeof value.combat.turn !== 'number') throw new Error('Invalid combat state');
  if (value.customActors && !Array.isArray(value.customActors)) throw new Error('Invalid custom actors');
  if (value.customTokens && !Array.isArray(value.customTokens)) throw new Error('Invalid custom tokens');
  if (value.rollTables && !Array.isArray(value.rollTables)) throw new Error('Invalid roll tables');

  return value as CampaignSnapshotV1;
}

export function applyCampaignSnapshot(snapshot: CampaignSnapshotV1) {
  useCampaignStore.setState((state) => ({
    presetId: snapshot.campaign.presetId,
    itemDefinitions: snapshot.library,
    inventories: snapshot.inventories,
    notes: snapshot.notes,
    combatRound: Math.max(1, snapshot.combat.round),
    combatTurn: Math.max(0, snapshot.combat.turn),
    mapGrid: snapshot.map?.grid ?? state.mapGrid,
    mapFog: snapshot.map?.fog ?? state.mapFog,
    tokenPositions: snapshot.map?.tokenPositions ?? state.tokenPositions,
    customActors: snapshot.customActors ?? state.customActors,
    customTokens: snapshot.customTokens ?? state.customTokens,
    builderOpen: false,
    workshopOpen: false,
    lastAction: { label: 'Импортирован снимок кампании v0.1' },
  }));

  if (snapshot.rollTables) useRollTableStore.getState().replaceAll(snapshot.rollTables);
}
