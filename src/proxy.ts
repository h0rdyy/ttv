import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';
import { DEMO_CAMPAIGN_NAME } from '@/config/demo';

function createProxyClient(request: NextRequest, buildResponse: () => NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  let response = buildResponse();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headersToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = buildResponse();
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headersToSet).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  return { supabase, getResponse: () => response };
}

const DEMO_ROUTES: Record<string, 'gm' | 'player'> = {
  '/campaign/demo/play': 'gm',
  '/campaign/demo/player': 'player',
};

/**
 * The public demo links lead into the real table. Visitors without a session
 * are signed in with the shared demo account (its campaign is provisioned by
 * seed_demo_campaign), so the table is playable without registration.
 */
async function handleDemoRoute(request: NextRequest, mode: 'gm' | 'player'): Promise<NextResponse> {
  const client = createProxyClient(request, () => NextResponse.next({ request }));
  const fallback = NextResponse.redirect(new URL('/login?next=%2Fcampaigns%2Fonline', request.url));
  if (!client) return fallback;
  const { supabase, getResponse } = client;

  // Cookies written by the client (sign-in session) live on its internal
  // response; any response we actually return must carry them over.
  const withSessionCookies = (target: NextResponse) => {
    for (const cookie of getResponse().cookies.getAll()) target.cookies.set(cookie);
    return target;
  };

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    const email = process.env.DEMO_USER_EMAIL;
    const password = process.env.DEMO_USER_PASSWORD;
    if (!email || !password) return fallback;
    // The demo must never show a login wall: retry the invisible sign-in once
    // before giving up, transient network hiccups were observed in dev.
    let signedIn = false;
    for (let attempt = 0; attempt < 2 && !signedIn; attempt++) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) signedIn = true;
      else console.error(`[demo] sign-in attempt ${attempt + 1} failed:`, error.message);
    }
    if (!signedIn) return fallback;
  } else if (auth.user.email !== process.env.DEMO_USER_EMAIL) {
    // A signed-in user keeps their own identity and joins the shared tavern
    // as a GM, so the demo links never fall back to their own campaigns.
    await supabase.rpc('join_demo_campaign');
  }

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('name', DEMO_CAMPAIGN_NAME)
    .limit(1)
    .maybeSingle();

  if (!campaign) {
    const { data: session } = await supabase.auth.getUser();
    const { data: membership } = await supabase
      .from('campaign_members')
      .select('campaign_id,role')
      .eq('user_id', session?.user?.id ?? '')
      .limit(1)
      .maybeSingle();
    if (!membership) return withSessionCookies(NextResponse.redirect(new URL('/campaigns/online', request.url)));
    const gm = ['owner', 'gm', 'assistant-gm'].includes(membership.role);
    const path = mode === 'gm' && !gm ? 'player' : mode === 'gm' ? 'play' : 'player';
    return withSessionCookies(NextResponse.redirect(new URL(`/campaign/${membership.campaign_id}/${path}`, request.url)));
  }

  return withSessionCookies(NextResponse.redirect(new URL(`/campaign/${campaign.id}/${mode === 'gm' ? 'play' : 'player'}`, request.url)));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const demoMode = DEMO_ROUTES[pathname];
  if (demoMode) return handleDemoRoute(request, demoMode);
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
