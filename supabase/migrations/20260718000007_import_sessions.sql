-- Sessions d'import (« Créer mon entreprise rapidement »).
-- PRÉPARÉE pour le branchement Supabase Cloud : le runtime actuel (mode
-- mock) persiste les brouillons dans le navigateur ; cette table prendra
-- le relais avec le provider Supabase, sans changement d'interface.

create type public.import_source as enum
  ('file', 'text', 'assistant', 'express', 'website', 'manual');

create type public.import_status as enum
  ('draft', 'processing', 'ready_for_review', 'importing', 'completed', 'failed');

create table public.import_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  source public.import_source not null,
  status public.import_status not null default 'draft',
  -- Entrée d'origine (texte collé, nom de fichier, URL) — jamais de données clients.
  raw_input text not null default '',
  parsed_business jsonb not null default '{}'::jsonb,
  parsed_items jsonb not null default '[]'::jsonb,
  extra_categories jsonb not null default '[]'::jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index import_sessions_org_idx
  on public.import_sessions (organization_id, updated_at desc);

alter table public.import_sessions enable row level security;

-- Isolation stricte par entreprise (mêmes fonctions que le reste du schéma).
create policy "import_sessions_select" on public.import_sessions
  for select using (public.is_org_member(organization_id));
create policy "import_sessions_insert" on public.import_sessions
  for insert with check (public.is_org_member(organization_id));
create policy "import_sessions_update" on public.import_sessions
  for update using (public.is_org_member(organization_id));
create policy "import_sessions_delete" on public.import_sessions
  for delete using (public.is_org_member(organization_id));

-- Politique de rétention : les brouillons abandonnés sont purgés après 30
-- jours (à exécuter par tâche planifiée pg_cron ou équivalent).
create or replace function public.purge_stale_import_sessions()
returns integer
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.import_sessions
    where status in ('draft', 'ready_for_review', 'failed')
      and updated_at < now() - interval '30 days'
    returning id
  )
  select count(*)::integer from deleted;
$$;
