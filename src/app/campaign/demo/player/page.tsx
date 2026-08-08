import { CampaignThemeSurface } from '@/features/campaign/CampaignThemeSurface';
import { PlayerView } from '@/features/player/PlayerView';

export default function CampaignPlayerPage() {
  return (
    <CampaignThemeSurface>
      <PlayerView />
    </CampaignThemeSurface>
  );
}
