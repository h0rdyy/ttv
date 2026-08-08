import { localCampaignRepository } from './localCampaignRepository';
import type { CampaignRepository, RepositoryMode } from './campaignRepository';

export function getRepositoryMode(): RepositoryMode {
  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return hasSupabase ? 'supabase' : 'local';
}

export function getCampaignRepository(): CampaignRepository {
  // v0.2 starts with the local adapter. The Supabase adapter will implement the same
  // contract, so UI/features do not need to know where campaign data is stored.
  return localCampaignRepository;
}

export type { CampaignRepository, RepositoryMode } from './campaignRepository';
