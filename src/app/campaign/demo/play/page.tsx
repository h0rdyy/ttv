import { DmDashboard } from '@/features/dm/DmDashboard';
import { CampaignThemeSurface } from '@/features/campaign/CampaignThemeSurface';

export default function CampaignPlayPage() {
  return (
    <CampaignThemeSurface>
      <DmDashboard />
    </CampaignThemeSurface>
  );
}
