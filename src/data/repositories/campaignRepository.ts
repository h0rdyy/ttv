import type { Actor, Campaign, Inventory, ItemDefinition, RollTable, Scene } from '@/domain/types';

export interface CampaignRepository {
  getCampaign(campaignId: string): Promise<Campaign | null>;
  listActors(campaignId: string): Promise<Actor[]>;
  listItems(campaignId: string): Promise<ItemDefinition[]>;
  listInventories(campaignId: string): Promise<Inventory[]>;
  getScene(sceneId: string): Promise<Scene | null>;
  listRollTables(campaignId: string): Promise<RollTable[]>;
}

export type RepositoryMode = 'local' | 'supabase';
