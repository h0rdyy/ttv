import { JoinCampaign } from '@/features/campaign/JoinCampaign';

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <JoinCampaign token={token} />;
}
