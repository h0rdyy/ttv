'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === 'string' ? value : '/campaigns/online';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/campaigns/online';
}

function text(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : '';
}

function authUrl(mode: 'login' | 'register', next: string, key: 'error' | 'notice', value: string) {
  const params = new URLSearchParams({ next, [key]: value });
  return `/${mode}?${params.toString()}`;
}

function errorCode(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'invalid-credentials';
  if (lower.includes('already registered') || lower.includes('user already registered')) return 'already-registered';
  if (lower.includes('email')) return 'email';
  if (lower.includes('password')) return 'password';
  return 'unknown';
}

async function requestOrigin() {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get('x-forwarded-host');
  const host = forwardedHost ?? requestHeaders.get('host');
  const forwardedProto = requestHeaders.get('x-forwarded-proto');
  const protocol = forwardedProto ?? (host?.startsWith('localhost') || host?.startsWith('127.0.0.1') ? 'http' : 'https');
  return host ? `${protocol}://${host}` : 'http://localhost:3000';
}

export async function login(formData: FormData) {
  const email = text(formData.get('email')).toLowerCase();
  const password = text(formData.get('password'));
  const next = safeNext(formData.get('next'));

  if (!email || !password) redirect(authUrl('login', next, 'error', 'required'));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(authUrl('login', next, 'error', errorCode(error.message)));

  revalidatePath('/', 'layout');
  redirect(next);
}

export async function register(formData: FormData) {
  const displayName = text(formData.get('displayName'));
  const email = text(formData.get('email')).toLowerCase();
  const password = text(formData.get('password'));
  const next = safeNext(formData.get('next'));

  if (!displayName || !email || !password) redirect(authUrl('register', next, 'error', 'required'));
  if (password.length < 8) redirect(authUrl('register', next, 'error', 'password'));

  const supabase = await createClient();
  const origin = await requestOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) redirect(authUrl('register', next, 'error', errorCode(error.message)));

  if (!data.session) {
    redirect(authUrl('register', next, 'notice', 'check-email'));
  }

  revalidatePath('/', 'layout');
  redirect(next);
}
