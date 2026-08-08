import Link from 'next/link';
import { DmDashboard } from '@/features/dm/DmDashboard';
import { CampaignThemeSurface } from '@/features/campaign/CampaignThemeSurface';

export default function CampaignPlayPage() {
  return (
    <CampaignThemeSurface>
      <div className="gm-view-wrap">
        <DmDashboard />
        <Link className="player-preview-fab" href="/campaign/demo/player">👁 Игрок</Link>
      </div>
    </CampaignThemeSurface>
  );
}
