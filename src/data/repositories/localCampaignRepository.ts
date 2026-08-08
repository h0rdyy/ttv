import { actors, campaign, inventories, items, scene } from '@/data/demo';
import { useRollTableStore } from '@/store/useRollTableStore';
import type { CampaignRepository } from './campaignRepository';

export const localCampaignRepository: CampaignRepository = {
  async getCampaign(campaignId) {
    return campaign.id === campaignId ? campaign : null;
  },
  async listActors(campaignId) {
    return actors.filter((actor) => actor.campaignId === campaignId);
  },
  async listItems() {
    return items;
  },
  async listInventories() {
    return inventories;
  },
  async getScene(sceneId) {
    return scene.id === sceneId ? scene : null;
  },
  async listRollTables() {
    return useRollTableStore.getState().tables;
  },
};
