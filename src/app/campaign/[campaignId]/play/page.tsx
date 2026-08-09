import { OnlineGameRoom } from '@/features/campaign/OnlineGameRoom';

export default async function CampaignGmPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  return <OnlineGameRoom campaignId={campaignId} mode="gm" />;
}
