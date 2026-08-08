import type { CampaignPresetId } from '@/config/campaignPresets';
import type { Inventory, ItemDefinition } from '@/domain/types';
import { useCampaignStore } from '@/store/useCampaignStore';

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

  return value as CampaignSnapshotV1;
}

export function applyCampaignSnapshot(snapshot: CampaignSnapshotV1) {
  useCampaignStore.setState({
    presetId: snapshot.campaign.presetId,
    itemDefinitions: snapshot.library,
    inventories: snapshot.inventories,
    notes: snapshot.notes,
    combatRound: Math.max(1, snapshot.combat.round),
    combatTurn: Math.max(0, snapshot.combat.turn),
    builderOpen: false,
    workshopOpen: false,
    lastAction: { label: 'Импортирован снимок кампании v0.1' },
  });
}
