-- Pacific Code — Row Level Security
-- Chaque organisation ne voit et ne modifie que ses propres données.
-- Les écritures sensibles (organizations, organization_members,
-- booking_counters) passent uniquement par des fonctions SECURITY DEFINER.

-- ============================================================
-- Activation RLS
-- ============================================================

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.equipment_categories enable row level security;
alter table public.equipment_items enable row level security;
alter table public.equipment_images enable row level security;
alter table public.customers enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_items enable row level security;
alter table public.booking_status_history enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.activity_logs enable row level security;
alter table public.booking_counters enable row level security;

-- ============================================================
-- profiles
-- ============================================================

create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or id in (select public.org_peer_ids()));

create policy "profiles_update" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ============================================================
-- organizations (création via create_organization_with_owner)
-- ============================================================

create policy "organizations_select" on public.organizations
  for select to authenticated
  using (id in (select public.user_org_ids()));

create policy "organizations_update" on public.organizations
  for update to authenticated
  using (public.is_org_admin(id))
  with check (public.is_org_admin(id));

-- ============================================================
-- organization_members (écritures via fonctions SECURITY DEFINER)
-- ============================================================

create policy "organization_members_select" on public.organization_members
  for select to authenticated
  using (organization_id in (select public.user_org_ids()));

-- ============================================================
-- booking_counters (écritures via generate_booking_number)
-- ============================================================

create policy "booking_counters_select" on public.booking_counters
  for select to authenticated
  using (organization_id in (select public.user_org_ids()));

-- ============================================================
-- Tables métier : accès complet pour les membres de l'organisation
-- ============================================================

-- equipment_categories
create policy "equipment_categories_select" on public.equipment_categories
  for select to authenticated
  using (organization_id in (select public.user_org_ids()));
create policy "equipment_categories_insert" on public.equipment_categories
  for insert to authenticated
  with check (organization_id in (select public.user_org_ids()));
create policy "equipment_categories_update" on public.equipment_categories
  for update to authenticated
  using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));
create policy "equipment_categories_delete" on public.equipment_categories
  for delete to authenticated
  using (organization_id in (select public.user_org_ids()));

-- equipment_items (pas de delete : archivage logique)
create policy "equipment_items_select" on public.equipment_items
  for select to authenticated
  using (organization_id in (select public.user_org_ids()));
create policy "equipment_items_insert" on public.equipment_items
  for insert to authenticated
  with check (organization_id in (select public.user_org_ids()));
create policy "equipment_items_update" on public.equipment_items
  for update to authenticated
  using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));

-- equipment_images
create policy "equipment_images_select" on public.equipment_images
  for select to authenticated
  using (organization_id in (select public.user_org_ids()));
create policy "equipment_images_insert" on public.equipment_images
  for insert to authenticated
  with check (organization_id in (select public.user_org_ids()));
create policy "equipment_images_update" on public.equipment_images
  for update to authenticated
  using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));
create policy "equipment_images_delete" on public.equipment_images
  for delete to authenticated
  using (organization_id in (select public.user_org_ids()));

-- customers (pas de delete : archivage logique)
create policy "customers_select" on public.customers
  for select to authenticated
  using (organization_id in (select public.user_org_ids()));
create policy "customers_insert" on public.customers
  for insert to authenticated
  with check (organization_id in (select public.user_org_ids()));
create policy "customers_update" on public.customers
  for update to authenticated
  using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));

-- bookings (pas de delete : annulation via statut)
create policy "bookings_select" on public.bookings
  for select to authenticated
  using (organization_id in (select public.user_org_ids()));
create policy "bookings_insert" on public.bookings
  for insert to authenticated
  with check (organization_id in (select public.user_org_ids()));
create policy "bookings_update" on public.bookings
  for update to authenticated
  using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));

-- booking_items
create policy "booking_items_select" on public.booking_items
  for select to authenticated
  using (organization_id in (select public.user_org_ids()));
create policy "booking_items_insert" on public.booking_items
  for insert to authenticated
  with check (organization_id in (select public.user_org_ids()));
create policy "booking_items_update" on public.booking_items
  for update to authenticated
  using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));
create policy "booking_items_delete" on public.booking_items
  for delete to authenticated
  using (organization_id in (select public.user_org_ids()));

-- booking_status_history (append-only)
create policy "booking_status_history_select" on public.booking_status_history
  for select to authenticated
  using (organization_id in (select public.user_org_ids()));
create policy "booking_status_history_insert" on public.booking_status_history
  for insert to authenticated
  with check (organization_id in (select public.user_org_ids()));

-- maintenance_records
create policy "maintenance_records_select" on public.maintenance_records
  for select to authenticated
  using (organization_id in (select public.user_org_ids()));
create policy "maintenance_records_insert" on public.maintenance_records
  for insert to authenticated
  with check (organization_id in (select public.user_org_ids()));
create policy "maintenance_records_update" on public.maintenance_records
  for update to authenticated
  using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));

-- assistant_conversations (chaque utilisateur voit ses conversations)
create policy "assistant_conversations_select" on public.assistant_conversations
  for select to authenticated
  using (
    organization_id in (select public.user_org_ids())
    and user_id = (select auth.uid())
  );
create policy "assistant_conversations_insert" on public.assistant_conversations
  for insert to authenticated
  with check (
    organization_id in (select public.user_org_ids())
    and user_id = (select auth.uid())
  );
create policy "assistant_conversations_update" on public.assistant_conversations
  for update to authenticated
  using (
    organization_id in (select public.user_org_ids())
    and user_id = (select auth.uid())
  )
  with check (
    organization_id in (select public.user_org_ids())
    and user_id = (select auth.uid())
  );
create policy "assistant_conversations_delete" on public.assistant_conversations
  for delete to authenticated
  using (
    organization_id in (select public.user_org_ids())
    and user_id = (select auth.uid())
  );

-- assistant_messages (via la conversation de l'utilisateur)
create policy "assistant_messages_select" on public.assistant_messages
  for select to authenticated
  using (
    conversation_id in (
      select id from public.assistant_conversations
      where user_id = (select auth.uid())
    )
  );
create policy "assistant_messages_insert" on public.assistant_messages
  for insert to authenticated
  with check (
    organization_id in (select public.user_org_ids())
    and conversation_id in (
      select id from public.assistant_conversations
      where user_id = (select auth.uid())
    )
  );

-- activity_logs (append-only)
create policy "activity_logs_select" on public.activity_logs
  for select to authenticated
  using (organization_id in (select public.user_org_ids()));
create policy "activity_logs_insert" on public.activity_logs
  for insert to authenticated
  with check (organization_id in (select public.user_org_ids()));

-- ============================================================
-- Storage : buckets logos et equipment-images
-- Chemin imposé : {organization_id}/{fichier} — lecture publique,
-- écriture réservée aux membres de l'organisation.
-- ============================================================

insert into storage.buckets (id, name, public)
values
  ('logos', 'logos', true),
  ('equipment-images', 'equipment-images', true)
on conflict (id) do nothing;

create policy "storage_org_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('logos', 'equipment-images')
    and array_length(storage.foldername(name), 1) >= 1
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

create policy "storage_org_update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('logos', 'equipment-images')
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id in ('logos', 'equipment-images')
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

create policy "storage_org_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('logos', 'equipment-images')
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );
