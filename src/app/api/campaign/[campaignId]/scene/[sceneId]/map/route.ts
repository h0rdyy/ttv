import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string; sceneId: string }> },
) {
  const { campaignId, sceneId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) return new Response(null, { status: 401 });

  const { data: scene } = await supabase
    .from('scenes')
    .select('id,campaign_id,background_path')
    .eq('id', sceneId)
    .eq('campaign_id', campaignId)
    .maybeSingle();

  if (!scene?.background_path) return new Response(null, { status: 404 });

  const { data: image, error } = await supabase.storage
    .from('campaign-maps')
    .download(scene.background_path);

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
