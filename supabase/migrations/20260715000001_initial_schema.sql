-- Pacific Code — Schéma initial
-- Toutes les tables métier portent un organization_id (multi-tenant).
-- L'archivage est logique (archived_at), jamais destructif.

-- ============================================================
-- Enums
-- ============================================================

create type public.business_type as enum (
  'equipment',   -- location de matériel
  'vehicles',    -- location de véhicules
  'nautical',    -- location nautique
  'events',      -- location événementielle
  'other'
);

create type public.member_role as enum ('owner', 'admin', 'member');

create type public.customer_type as enum ('individual', 'company');

-- Statut opérationnel du matériel. Les états « réservé » / « en location »
-- sont dérivés des réservations en cours, jamais stockés (pas de dérive).
create type public.equipment_status as enum (
  'available',
  'maintenance',
  'unavailable'
);

-- « en retard » est dérivé : status = 'in_progress' et end_at < now()
create type public.booking_status as enum (
  'draft',
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled'
);

create type public.payment_status as enum (
  'unpaid',
  'deposit_paid',
  'paid',
  'refunded'
);

create type public.deposit_status as enum (
  'not_required',
  'pending',
  'received',
  'returned',
  'partially_withheld',
  'withheld'
);

-- ============================================================
-- Tables
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  first_name text not null default '',
  last_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_type public.business_type not null default 'equipment',
  logo_url text,
  currency text not null default 'XPF',
  timezone text not null default 'Pacific/Tahiti',
  locale text not null default 'fr',
  date_format text not null default 'dd/MM/yyyy',
  booking_prefix text not null default 'RES',
  phone text,
  email text,
  address text,
  onboarding_completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'owner',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.equipment_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.equipment_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid references public.equipment_categories(id) on delete set null,
  name text not null,
  internal_ref text,
  description text,
  daily_price numeric(12,2) not null default 0 check (daily_price >= 0),
  deposit_amount numeric(12,2) not null default 0 check (deposit_amount >= 0),
  quantity_total integer not null default 1 check (quantity_total >= 1),
  min_rental_days integer not null default 1 check (min_rental_days >= 1),
  status public.equipment_status not null default 'available',
  usage_instructions text,
  internal_notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.equipment_images (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  equipment_id uuid not null references public.equipment_items(id) on delete cascade,
  storage_path text not null,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type public.customer_type not null default 'individual',
  first_name text not null default '',
  last_name text not null default '',
  company_name text,
  email text,
  phone text,
  address text,
  id_number text,
  internal_notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  booking_number text not null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  status public.booking_status not null default 'draft',
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_days integer not null default 1 check (duration_days >= 1),
  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  extra_fees_amount numeric(12,2) not null default 0 check (extra_fees_amount >= 0),
  total_amount numeric(12,2) not null default 0,
  deposit_amount numeric(12,2) not null default 0 check (deposit_amount >= 0),
  payment_status public.payment_status not null default 'unpaid',
  deposit_status public.deposit_status not null default 'not_required',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, booking_number),
  check (end_at > start_at)
);

create table public.booking_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  equipment_id uuid not null references public.equipment_items(id) on delete restrict,
  quantity integer not null default 1 check (quantity >= 1),
  daily_price numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_status public.booking_status,
  to_status public.booking_status not null,
  note text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  equipment_id uuid not null references public.equipment_items(id) on delete cascade,
  description text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  cost numeric(12,2),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null default '',
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Compteur de numérotation des réservations, par organisation et par année.
create table public.booking_counters (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  year integer not null,
  seq integer not null default 0,
  primary key (organization_id, year)
);

-- ============================================================
-- Index
-- ============================================================

create index idx_org_members_user on public.organization_members(user_id);
create index idx_org_members_org on public.organization_members(organization_id);
create index idx_equipment_categories_org on public.equipment_categories(organization_id);
create index idx_equipment_items_org on public.equipment_items(organization_id);
create index idx_equipment_items_category on public.equipment_items(category_id);
create index idx_equipment_images_org on public.equipment_images(organization_id);
create index idx_equipment_images_equipment on public.equipment_images(equipment_id);
create index idx_customers_org on public.customers(organization_id);
create index idx_bookings_org on public.bookings(organization_id);
create index idx_bookings_org_status on public.bookings(organization_id, status);
create index idx_bookings_org_dates on public.bookings(organization_id, start_at, end_at);
create index idx_bookings_customer on public.bookings(customer_id);
create index idx_booking_items_org on public.booking_items(organization_id);
create index idx_booking_items_booking on public.booking_items(booking_id);
create index idx_booking_items_equipment on public.booking_items(equipment_id);
create index idx_booking_status_history_org on public.booking_status_history(organization_id);
create index idx_booking_status_history_booking on public.booking_status_history(booking_id);
create index idx_maintenance_records_org on public.maintenance_records(organization_id);
create index idx_maintenance_records_equipment on public.maintenance_records(equipment_id);
create index idx_assistant_conversations_org on public.assistant_conversations(organization_id);
create index idx_assistant_conversations_user on public.assistant_conversations(user_id);
create index idx_assistant_messages_org on public.assistant_messages(organization_id);
create index idx_assistant_messages_conversation on public.assistant_messages(conversation_id);
create index idx_activity_logs_org on public.activity_logs(organization_id);
create index idx_activity_logs_org_created on public.activity_logs(organization_id, created_at desc);

-- ============================================================
-- Triggers techniques
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger trg_equipment_categories_updated_at before update on public.equipment_categories
  for each row execute function public.set_updated_at();
create trigger trg_equipment_items_updated_at before update on public.equipment_items
  for each row execute function public.set_updated_at();
create trigger trg_customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
create trigger trg_bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();
create trigger trg_assistant_conversations_updated_at before update on public.assistant_conversations
  for each row execute function public.set_updated_at();

-- Création automatique du profil à l'inscription.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
