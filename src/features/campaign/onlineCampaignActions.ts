'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function text(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function createOnlineCampaign(formData: FormData) {
  const name = text(formData.get('name'));
  const description = text(formData.get('description'));

  if (!name) redirect('/campaigns/online?error=required');

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  const { error } = await supabase.rpc('create_campaign', {
    campaign_name: name,
    campaign_description: description || null,
    campaign_system_id: 'generic-fantasy',
    campaign_setting_id: 'medieval-fantasy',
    campaign_theme_id: 'dark-fantasy',
  });

  if (error) redirect('/campaigns/online?error=create-failed');

  revalidatePath('/campaigns/online');
  redirect('/campaigns/online?notice=created');
}

export async function signOutOnlineCampaigns() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
