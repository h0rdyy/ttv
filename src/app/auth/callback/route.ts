import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const requestedNext = url.searchParams.get('next') || '/campaigns/online';
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/campaigns/online';

  if (!code) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', next);
    loginUrl.searchParams.set('error', 'confirm-failed');
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', next);
    loginUrl.searchParams.set('error', 'confirm-failed');
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
