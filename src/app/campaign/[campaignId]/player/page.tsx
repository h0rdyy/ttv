import { OnlineCampaignRoom } from '@/features/campaign/OnlineCampaignRoom';

export default async function CampaignPlayerPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  return <OnlineCampaignRoom campaignId={campaignId} mode="player" />;
}
