-- Base de connaissances de l'Agent IA commercial.
--
-- Chaque entrée est une question type du loueur et LA réponse qu'il veut
-- voir partir. L'appariement est déterministe (score sur les mots-clés et
-- les mots de la question) : aucun appel à un modèle de langage, donc
-- aucun crédit consommé. L'agent ne reformule pas — il cite la réponse
-- validée par le loueur.

create table public.knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Question type, telle que le loueur la formulerait ("Vous livrez où ?").
  question text not null,
  -- Réponse envoyée telle quelle au client (jamais reformulée).
  answer text not null,
  -- Mots-clés déclencheurs : un seul suffit à faire gagner l'entrée.
  keywords text[] not null default '{}',
  -- Regroupement pour l'écran de gestion (libre : paiement, livraison…).
  category text not null default 'general',
  -- Désactivable sans être supprimée (saison, offre suspendue…).
  is_active boolean not null default true,
  -- Départage les entrées à score égal ; plus haut = prioritaire.
  priority smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- L'agent ne lit que les entrées actives d'une organisation.
create index idx_knowledge_entries_org_active
  on public.knowledge_entries (organization_id)
  where is_active;

alter table public.knowledge_entries enable row level security;

create policy "knowledge_entries_select" on public.knowledge_entries
  for select to authenticated
  using (organization_id in (select public.user_org_ids()));
create policy "knowledge_entries_insert" on public.knowledge_entries
  for insert to authenticated
  with check (organization_id in (select public.user_org_ids()));
create policy "knowledge_entries_update" on public.knowledge_entries
  for update to authenticated
  using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));
create policy "knowledge_entries_delete" on public.knowledge_entries
  for delete to authenticated
  using (organization_id in (select public.user_org_ids()));

create trigger trg_knowledge_entries_updated_at
  before update on public.knowledge_entries
  for each row execute function public.set_updated_at();
