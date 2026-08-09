import { OnlineGameRoom } from '@/features/campaign/OnlineGameRoom';

export default async function CampaignPlayerPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  return <OnlineGameRoom campaignId={campaignId} mode="player" />;
}
