import { OnlineCampaignHub } from '@/features/campaign/OnlineCampaignHub';

export default async function OnlineCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;
  return <OnlineCampaignHub error={error} notice={notice} />;
}
