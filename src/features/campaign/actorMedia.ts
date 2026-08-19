export type ActorMedia = {
  avatarPath: string | null;
  tokenPath: string | null;
  tokenScale: number;
  tokenOffsetX: number;
  tokenOffsetY: number;
};

const DEFAULT_TOKEN_SCALE = 1;
const MIN_TOKEN_SCALE = 0.5;
const MAX_TOKEN_SCALE = 2.5;
const MIN_TOKEN_OFFSET = -50;
const MAX_TOKEN_OFFSET = 50;

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function pathValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function clampedNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export function actorMedia(systemData: Record<string, unknown> | null | undefined): ActorMedia {
  const media = objectValue(systemData?._media);
  return {
    avatarPath: pathValue(media?.avatar_path),
    tokenPath: pathValue(media?.token_path),
    tokenScale: clampedNumber(media?.token_scale, DEFAULT_TOKEN_SCALE, MIN_TOKEN_SCALE, MAX_TOKEN_SCALE),
    tokenOffsetX: clampedNumber(media?.token_offset_x, 0, MIN_TOKEN_OFFSET, MAX_TOKEN_OFFSET),
    tokenOffsetY: clampedNumber(media?.token_offset_y, 0, MIN_TOKEN_OFFSET, MAX_TOKEN_OFFSET),
  };
}

export function actorMediaUrl(
  campaignId: string,
  actorId: string,
  kind: 'avatar' | 'token',
  path: string | null,
) {
  if (!campaignId || !actorId || !path) return null;
  return `/api/campaign/${encodeURIComponent(campaignId)}/actor/${encodeURIComponent(actorId)}/media/${kind}?v=${encodeURIComponent(path)}`;
}

export function tokenVisualStyle(media: ActorMedia) {
  return {
    scale: media.tokenScale,
    offsetX: media.tokenOffsetX,
    offsetY: media.tokenOffsetY,
  };
}
