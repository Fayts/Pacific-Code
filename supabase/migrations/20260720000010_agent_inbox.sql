-- Agent IA commercial multicanal : connexions de canaux, boîte de
-- réception unifiée et réglages de l'agent.
-- Miroir des types TypeScript de src/lib/types/inbox.ts (mode mock) :
-- l'adapter Supabase lira/écrira ces tables sans changer l'UI.

-- ------------------------------------------------------------
-- Types
-- ------------------------------------------------------------

create type public.channel_kind as enum ('messenger', 'gmail', 'whatsapp', 'form');
create type public.channel_status as enum ('connected', 'disconnected');
create type public.conversation_status as enum (
  'new', 'auto_replied', 'replied', 'transferred', 'ignored'
);
create type public.message_direction as enum ('inbound', 'outbound');
create type public.message_author as enum ('customer', 'agent', 'user');
create type public.agent_mode as enum ('assisted', 'auto');
create type public.agent_tone as enum ('professional', 'warm', 'concise', 'premium');

-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------

-- Connexions des canaux (jetons OAuth chiffrés ajoutés au branchement réel,
-- côté serveur uniquement — jamais exposés au navigateur).
create table public.channel_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel public.channel_kind not null,
  status public.channel_status not null default 'disconnected',
  display_name text,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, channel)
);

create table public.inbox_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel public.channel_kind not null,
  customer_name text not null,
  customer_contact text,
  customer_id uuid references public.customers(id) on delete set null,
  subject text,
  status public.conversation_status not null default 'new',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.inbox_conversations(id) on delete cascade,
  direction public.message_direction not null,
  author public.message_author not null,
  body text not null check (char_length(body) <= 8000),
  created_at timestamptz not null default now()
);

-- Réglages de l'agent : une ligne par organisation.
create table public.agent_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  mode public.agent_mode not null default 'assisted',
  tone public.agent_tone not null default 'professional',
  signature text not null default '',
  practical_info text not null default '',
  permissions jsonb not null default '{
    "read_messages": true,
    "detect_requests": true,
    "check_availability": true,
    "compute_prices": true,
    "prepare_replies": true,
    "auto_reply_simple": false,
    "send_form": true
  }'::jsonb,
  activated_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Index (couvrent aussi les clés étrangères — leçon de l'audit 008)
-- ------------------------------------------------------------

create index idx_channel_connections_org on public.channel_connections (organization_id);
create index idx_inbox_conversations_org_last
  on public.inbox_conversations (organization_id, last_message_at desc);
create index idx_inbox_conversations_customer on public.inbox_conversations (customer_id);
create index idx_inbox_messages_org on public.inbox_messages (organization_id);
create index idx_inbox_messages_conversation
  on public.inbox_messages (conversation_id, created_at);

-- ------------------------------------------------------------
-- updated_at automatique
-- ------------------------------------------------------------

create trigger trg_channel_connections_updated_at before update on public.channel_connections
  for each row execute function public.set_updated_at();
create trigger trg_inbox_conversations_updated_at before update on public.inbox_conversations
  for each row execute function public.set_updated_at();
create trigger trg_agent_settings_updated_at before update on public.agent_settings
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Row Level Security : isolation par organisation, comme partout
-- ------------------------------------------------------------

alter table public.channel_connections enable row level security;
alter table public.inbox_conversations enable row level security;
alter table public.inbox_messages enable row level security;
alter table public.agent_settings enable row level security;

create policy "channel_connections_select" on public.channel_connections
  for select using (organization_id in (select public.user_org_ids()));
create policy "channel_connections_insert" on public.channel_connections
  for insert with check (organization_id in (select public.user_org_ids()));
create policy "channel_connections_update" on public.channel_connections
  for update using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));
create policy "channel_connections_delete" on public.channel_connections
  for delete using (organization_id in (select public.user_org_ids()));

create policy "inbox_conversations_select" on public.inbox_conversations
  for select using (organization_id in (select public.user_org_ids()));
create policy "inbox_conversations_insert" on public.inbox_conversations
  for insert with check (organization_id in (select public.user_org_ids()));
create policy "inbox_conversations_update" on public.inbox_conversations
  for update using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));
create policy "inbox_conversations_delete" on public.inbox_conversations
  for delete using (organization_id in (select public.user_org_ids()));

create policy "inbox_messages_select" on public.inbox_messages
  for select using (organization_id in (select public.user_org_ids()));
create policy "inbox_messages_insert" on public.inbox_messages
  for insert with check (organization_id in (select public.user_org_ids()));
create policy "inbox_messages_delete" on public.inbox_messages
  for delete using (organization_id in (select public.user_org_ids()));

create policy "agent_settings_select" on public.agent_settings
  for select using (organization_id in (select public.user_org_ids()));
create policy "agent_settings_insert" on public.agent_settings
  for insert with check (organization_id in (select public.user_org_ids()));
create policy "agent_settings_update" on public.agent_settings
  for update using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));
