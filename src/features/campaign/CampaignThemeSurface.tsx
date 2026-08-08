'use client';

import type { CSSProperties, ReactNode } from 'react';
import { getCampaignPreset } from '@/config/campaignPresets';
import { useCampaignStore } from '@/store/useCampaignStore';

export function CampaignThemeSurface({ children }: { children: ReactNode }) {
  const presetId = useCampaignStore((state) => state.presetId);
  const preset = getCampaignPreset(presetId);
  const style = preset.cssVars as CSSProperties;

  return <div className="theme-surface" style={style}>{children}</div>;
}
