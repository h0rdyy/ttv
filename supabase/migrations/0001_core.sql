-- TTV v0.2 data foundation
-- Generic campaign schema: no D&D/Warhammer-specific columns in core.

create extension if not exists pgcrypto;

create type public.campaign_role as enum ('owner', 'gm', 'assistant-gm', 'player', 'spectator');
create type public.actor_type as enum ('player', 'npc', 'creature', 'vehicle', 'companion', 'summon');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  system_id text not null default 'generic-fantasy',
  setting_id text not null default 'medieval-fantasy',
  theme_id text not null default 'dark-fantasy',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaign_members (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.campaign_role not null default 'player',
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create table public.actors (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete set null,
  type public.actor_type not null,
  name text not null,
  subtitle text not null default '',
  avatar text not null default '',
  system_data jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scenes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  background_url text,
  grid_enabled boolean not null default true,
  fog_enabled boolean not null default false,
  system_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scene_tokens (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes(id) on delete cascade,
  actor_id uuid not null references public.actors(id) on delete cascade,
  x double precision not null default 50,
  y double precision not null default 50,
  size double precision not null default 1,
  rotation double precision not null default 0,
  enemy boolean not null default false,
  hidden boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.item_definitions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  system_id text not null,
  name text not null,
  description text not null default '',
  category text not null default 'Разное',
  rarity text not null default 'common',
  icon text not null default '📦',
  weight numeric,
  price numeric,
  currency text,
  source text,
  properties jsonb not null default '{}'::jsonb,
  effects jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventories (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  owner_actor_id uuid not null unique references public.actors(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.inventory_containers (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventories(id) on delete cascade,
  name text not null,
  type text not null check (type in ('equipment', 'container')),
  capacity integer,
  sort_order integer not null default 0
);

create table public.item_instances (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null references public.item_definitions(id) on delete restrict,
  container_id uuid not null references public.inventory_containers(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  custom_name text,
  equipped boolean not null default false,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.journal_notes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text,
  body text not null default '',
  visibility text not null default 'gm' check (visibility in ('gm', 'players', 'public')),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  title text not null,
  description text,
  kind text not null default 'lore' check (kind in ('lore', 'chronicle', 'gm-notes', 'custom')),
  visibility text not null default 'gm' check (visibility in ('gm', 'players', 'public')),
  cover_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.book_pages (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  parent_page_id uuid references public.book_pages(id) on delete cascade,
  title text not null,
  page_type text not null default 'page',
  content jsonb not null default '{"blocks":[]}'::jsonb,
  visibility text not null default 'gm' check (visibility in ('gm', 'players', 'public')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roll_tables (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  die text not null default 'd6',
  rows jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index campaign_members_user_idx on public.campaign_members(user_id);
create index actors_campaign_idx on public.actors(campaign_id);
create index scenes_campaign_idx on public.scenes(campaign_id);
create index scene_tokens_scene_idx on public.scene_tokens(scene_id);
create index item_definitions_campaign_idx on public.item_definitions(campaign_id);
create index books_campaign_idx on public.books(campaign_id);
create index journal_notes_campaign_idx on public.journal_notes(campaign_id);

-- Membership helpers keep RLS policies readable.
create or replace function public.is_campaign_member(target_campaign uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.campaign_members cm
    where cm.campaign_id = target_campaign and cm.user_id = auth.uid()
  );
$$;

create or replace function public.is_campaign_gm(target_campaign uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.campaign_members cm
    where cm.campaign_id = target_campaign
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'gm', 'assistant-gm')
  );
$$;

-- Match the production safety net: any table created later in the exposed
-- public schema gets RLS enabled immediately. Existing tables below are still
-- enabled explicitly so this migration remains readable and self-contained.
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name = 'public' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    end if;
  end loop;
end;
$$;

drop event trigger if exists ensure_rls;
create event trigger ensure_rls
on ddl_command_end
when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
execute procedure public.rls_auto_enable();

alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.actors enable row level security;
alter table public.scenes enable row level security;
alter table public.scene_tokens enable row level security;
alter table public.item_definitions enable row level security;
alter table public.inventories enable row level security;
alter table public.inventory_containers enable row level security;
alter table public.item_instances enable row level security;
alter table public.journal_notes enable row level security;
alter table public.books enable row level security;
alter table public.book_pages enable row level security;
alter table public.roll_tables enable row level security;

create policy profiles_self_read on public.profiles for select using (id = auth.uid());
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy campaigns_member_read on public.campaigns for select using (public.is_campaign_member(id) or owner_id = auth.uid());
create policy campaigns_owner_insert on public.campaigns for insert with check (owner_id = auth.uid());
create policy campaigns_gm_update on public.campaigns for update using (public.is_campaign_gm(id) or owner_id = auth.uid());

create policy campaign_members_member_read on public.campaign_members for select using (public.is_campaign_member(campaign_id) or user_id = auth.uid());
create policy campaign_members_gm_write on public.campaign_members for all using (public.is_campaign_gm(campaign_id)) with check (public.is_campaign_gm(campaign_id));

create policy actors_member_read on public.actors for select using (public.is_campaign_member(campaign_id));
create policy actors_gm_write on public.actors for all using (public.is_campaign_gm(campaign_id)) with check (public.is_campaign_gm(campaign_id));
create policy actors_player_update_own on public.actors for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy scenes_member_read on public.scenes for select using (public.is_campaign_member(campaign_id));
create policy scenes_gm_write on public.scenes for all using (public.is_campaign_gm(campaign_id)) with check (public.is_campaign_gm(campaign_id));

create policy item_definitions_member_read on public.item_definitions for select using (public.is_campaign_member(campaign_id));
create policy item_definitions_gm_write on public.item_definitions for all using (public.is_campaign_gm(campaign_id)) with check (public.is_campaign_gm(campaign_id));

create policy journal_member_read on public.journal_notes for select using (
  public.is_campaign_member(campaign_id)
  and (visibility <> 'gm' or public.is_campaign_gm(campaign_id) or author_id = auth.uid())
);
create policy journal_author_insert on public.journal_notes for insert with check (author_id = auth.uid() and public.is_campaign_member(campaign_id));
create policy journal_author_update on public.journal_notes for update using (author_id = auth.uid() or public.is_campaign_gm(campaign_id));

create policy books_member_read on public.books for select using (
  public.is_campaign_member(campaign_id)
  and (visibility <> 'gm' or public.is_campaign_gm(campaign_id))
);
create policy books_gm_write on public.books for all using (public.is_campaign_gm(campaign_id)) with check (public.is_campaign_gm(campaign_id));

-- Child-table policies are completed in the Supabase adapter milestone once queries are finalized.
-- Until then, these tables remain inaccessible through the public Data API by default RLS behavior.
