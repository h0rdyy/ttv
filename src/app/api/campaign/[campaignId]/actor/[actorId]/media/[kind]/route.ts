import { createClient } from '@/lib/supabase/server';
import { actorMedia } from '@/features/campaign/actorMedia';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string; actorId: string; kind: string }> },
) {
  const { campaignId, actorId, kind } = await params;
  if (kind !== 'avatar' && kind !== 'token') return new Response(null, { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response(null, { status: 401 });

  const { data: actor } = await supabase
    .from('actors')
    .select('id,campaign_id,system_data')
    .eq('id', actorId)
    .eq('campaign_id', campaignId)
    .maybeSingle();

  if (!actor) return new Response(null, { status: 404 });
  const media = actorMedia(actor.system_data as Record<string, unknown> | null);
  const path = kind === 'avatar' ? media.avatarPath : media.tokenPath;
  if (!path) return new Response(null, { status: 404 });

  const expectedPrefix = `${campaignId}/${actorId}/${kind}/`;
  if (!path.startsWith(expectedPrefix)) return new Response(null, { status: 404 });

  const { data: image, error } = await supabase.storage
    .from('campaign-actor-media')
    .download(path);

  if (error || !image) return new Response(null, { status: 404 });

  return new Response(image, {
    status: 200,
    headers: {
      'Content-Type': image.type || 'application/octet-stream',
      'Content-Length': String(image.size),
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
