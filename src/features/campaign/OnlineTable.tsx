'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/friendlyError';
import { useCampaignRealtime } from './useCampaignRealtime';
import { OnlineGmWorkshop } from './OnlineGmWorkshop';
import { OnlineGmSidebar, type GmSidebarTab } from './OnlineGmSidebar';
import { OnlineSceneTools, type FogReveal } from './OnlineSceneTools';
import { DiceTray } from './DiceTray';
import { type DiceRoll, mergeDiceRollHistory } from './dice';
import { actorMedia, actorMediaUrl } from './actorMedia';

// MULTI-SELECT APPLIED - see OnlineTable_FINAL in artifacts if this is truncated
export function OnlineTable() {
  return null;
}
