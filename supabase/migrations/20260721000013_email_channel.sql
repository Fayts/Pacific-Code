-- Canal e-mail réel (Gmail + Outlook) : comptes connectés (jetons OAuth),
-- correspondance fil e-mail ↔ conversation, ingestion des messages relevés.
--
-- Même modèle de sécurité que Messenger (migration 012) :
-- - email_accounts et email_threads ont la RLS activée SANS politique :
--   inaccessibles via l'API — seules les fonctions SECURITY DEFINER
--   ci-dessous y accèdent.
-- - La relève (polling) et l'envoi passent par des fonctions gardées par
--   le secret d'ingestion (app_secrets.webhook_ingest + env serveur).
-- - Les jetons OAuth ne transitent JAMAIS par le navigateur.

-- Nouveau canal dans l'énum (utilisable dès la transaction suivante).
alter type public.channel_kind add value if not exists 'outlook';

create table public.email_accounts (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('gmail', 'outlook')),
  address text not null,
  refresh_token text not null,
  access_token text not null,
  token_expires_at timestamptz not null,
  -- Point de reprise de la relève : gmail = secondes epoch, outlook = ISO.
  cursor text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, provider)
);
alter table public.email_accounts enable row level security;
create trigger trg_email_accounts_updated_at before update on public.email_accounts
  for each row execute function public.set_updated_at();

-- Fil e-mail (thread Gmail / conversation Outlook) ↔ conversation inbox.
create table public.email_threads (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('gmail', 'outlook')),
  thread_id text not null,
  conversation_id uuid not null references public.inbox_conversations(id) on delete cascade,
  subject text,
  -- Gmail : Message-ID internet du dernier entrant (In-Reply-To) ;
  -- Outlook : identifiant Graph du dernier entrant (POST …/reply).
  reply_to_message_id text,
  from_email text not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, provider, thread_id)
);
create index idx_email_threads_conversation on public.email_threads (conversation_id);
alter table public.email_threads enable row level security;

-- Enregistre le compte e-mail connecté d'une organisation (jeton UTILISATEUR :
-- auth.uid() fiable, appartenance vérifiée).
create or replace function public.store_email_account(
  p_organization_id uuid,
  p_provider text,
  p_address text,
  p_refresh_token text,
  p_access_token text,
  p_expires_at timestamptz,
  p_cursor text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'not a member of this organization';
  end if;
  insert into public.email_accounts (
    organization_id, provider, address, refresh_token, access_token,
    token_expires_at, cursor
  )
  values (
    p_organization_id, p_provider, p_address, p_refresh_token,
    p_access_token, p_expires_at, p_cursor
  )
  on conflict (organization_id, provider) do update
    set address = excluded.address,
        refresh_token = excluded.refresh_token,
        access_token = excluded.access_token,
        token_expires_at = excluded.token_expires_at,
        cursor = excluded.cursor;
end;
$$;
revoke execute on function public.store_email_account(uuid, text, text, text, text, timestamptz, text) from public, anon;

-- Déconnexion : retire le compte (et ses jetons) de l'organisation.
create or replace function public.delete_email_account(
  p_organization_id uuid,
  p_provider text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'not a member of this organization';
  end if;
  delete from public.email_accounts
  where organization_id = p_organization_id and provider = p_provider;
end;
$$;
revoke execute on function public.delete_email_account(uuid, text) from public, anon;

-- Tous les comptes à relever (route de polling, gardée par le secret).
create or replace function public.list_email_accounts(p_secret text)
returns table (
  organization_id uuid,
  provider text,
  address text,
  refresh_token text,
  access_token text,
  token_expires_at timestamptz,
  cursor text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.check_ingest_secret(p_secret);
  return query
    select a.organization_id, a.provider, a.address, a.refresh_token,
           a.access_token, a.token_expires_at, a.cursor
    from public.email_accounts a;
end;
$$;

-- Compte d'une organisation (route d'envoi, gardée par le secret).
create or replace function public.get_email_account_for_org(
  p_secret text,
  p_organization_id uuid,
  p_provider text
)
returns table (
  address text,
  refresh_token text,
  access_token text,
  token_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.check_ingest_secret(p_secret);
  return query
    select a.address, a.refresh_token, a.access_token, a.token_expires_at
    from public.email_accounts a
    where a.organization_id = p_organization_id and a.provider = p_provider;
end;
$$;

-- Jetons rafraîchis + point de reprise (p_refresh_token null = inchangé).
create or replace function public.update_email_account_tokens(
  p_secret text,
  p_organization_id uuid,
  p_provider text,
  p_access_token text,
  p_expires_at timestamptz,
  p_refresh_token text,
  p_cursor text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.check_ingest_secret(p_secret);
  update public.email_accounts
  set access_token = coalesce(p_access_token, access_token),
      token_expires_at = coalesce(p_expires_at, token_expires_at),
      refresh_token = coalesce(p_refresh_token, refresh_token),
      cursor = coalesce(p_cursor, cursor)
  where organization_id = p_organization_id and provider = p_provider;
end;
$$;

-- Fil e-mail d'une conversation (route d'envoi, gardée par le secret).
create or replace function public.get_email_thread(
  p_secret text,
  p_conversation_id uuid
)
returns table (
  provider text,
  thread_id text,
  subject text,
  reply_to_message_id text,
  from_email text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.check_ingest_secret(p_secret);
  return query
    select t.provider, t.thread_id, t.subject, t.reply_to_message_id,
           t.from_email
    from public.email_threads t
    where t.conversation_id = p_conversation_id;
end;
$$;

-- Ingestion d'un e-mail entrant (relève authentifiée par le secret).
-- Retrouve ou crée la conversation du fil, met à jour la cible de réponse.
create or replace function public.ingest_email_message(
  p_secret text,
  p_organization_id uuid,
  p_provider text,
  p_thread_id text,
  p_from_name text,
  p_from_email text,
  p_subject text,
  p_body text,
  p_reply_to_message_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv uuid;
  v_name text := coalesce(nullif(trim(p_from_name), ''), p_from_email);
begin
  perform public.check_ingest_secret(p_secret);

  select conversation_id into v_conv
  from public.email_threads
  where organization_id = p_organization_id
    and provider = p_provider
    and thread_id = p_thread_id;

  if v_conv is null then
    insert into public.inbox_conversations (
      organization_id, channel, customer_name, customer_contact,
      subject, status
    )
    values (
      p_organization_id, p_provider::public.channel_kind, v_name,
      'email:' || p_from_email, nullif(trim(p_subject), ''), 'new'
    )
    returning id into v_conv;

    insert into public.email_threads (
      organization_id, provider, thread_id, conversation_id, subject,
      reply_to_message_id, from_email
    )
    values (
      p_organization_id, p_provider, p_thread_id, v_conv,
      nullif(trim(p_subject), ''), p_reply_to_message_id, p_from_email
    );
  else
    update public.inbox_conversations
    set status = 'new', customer_name = v_name
    where id = v_conv;

    update public.email_threads
    set reply_to_message_id = coalesce(p_reply_to_message_id, reply_to_message_id),
        from_email = p_from_email
    where organization_id = p_organization_id
      and provider = p_provider
      and thread_id = p_thread_id;
  end if;

  insert into public.inbox_messages (
    organization_id, conversation_id, direction, author, body
  )
  values (p_organization_id, v_conv, 'inbound', 'customer', left(p_body, 8000));

  update public.inbox_conversations
  set last_message_at = now()
  where id = v_conv;

  return v_conv;
end;
$$;
