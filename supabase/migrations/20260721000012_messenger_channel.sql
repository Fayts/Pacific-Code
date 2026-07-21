-- Canal Messenger réel : coffre à secrets applicatif, pages Facebook
-- connectées (jetons de page) et ingestion des messages entrants.
--
-- Sécurité :
-- - app_secrets et messenger_pages ont la RLS activée SANS politique :
--   inaccessibles via l'API — seules les fonctions SECURITY DEFINER
--   ci-dessous y accèdent.
-- - Le webhook Meta est authentifié DEUX fois : signature HMAC vérifiée
--   par la route serveur (App Secret), puis secret d'ingestion vérifié
--   en base (inséré hors dépôt, valeur dans app_secrets + env serveur).
-- - Les jetons de page ne transitent JAMAIS par le navigateur.

create table public.app_secrets (
  name text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;

create table public.messenger_pages (
  page_id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  page_name text not null,
  access_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_messenger_pages_org on public.messenger_pages (organization_id);
alter table public.messenger_pages enable row level security;
create trigger trg_messenger_pages_updated_at before update on public.messenger_pages
  for each row execute function public.set_updated_at();

-- Vérification interne du secret d'ingestion.
create or replace function public.check_ingest_secret(p_secret text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is null or not exists (
    select 1 from public.app_secrets s
    where s.name = 'webhook_ingest' and s.value = p_secret
  ) then
    raise exception 'unauthorized';
  end if;
end;
$$;
revoke execute on function public.check_ingest_secret(text) from public, anon, authenticated;

-- Enregistre (ou met à jour) la page connectée d'une organisation.
-- Appelée par la route d'échange OAuth avec le JETON UTILISATEUR :
-- auth.uid() est fiable et l'appartenance est vérifiée.
create or replace function public.store_messenger_page(
  p_organization_id uuid,
  p_page_id text,
  p_page_name text,
  p_access_token text
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
  insert into public.messenger_pages (page_id, organization_id, page_name, access_token)
  values (p_page_id, p_organization_id, p_page_name, p_access_token)
  on conflict (page_id) do update
    set organization_id = excluded.organization_id,
        page_name = excluded.page_name,
        access_token = excluded.access_token;
end;
$$;
revoke execute on function public.store_messenger_page(uuid, text, text, text) from public, anon;

-- Jeton de page par organisation (route d'envoi, gardée par le secret).
create or replace function public.get_messenger_page_for_org(
  p_secret text,
  p_organization_id uuid
)
returns table (page_id text, page_name text, access_token text)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.check_ingest_secret(p_secret);
  return query
    select m.page_id, m.page_name, m.access_token
    from public.messenger_pages m
    where m.organization_id = p_organization_id
    limit 1;
end;
$$;

-- Déconnexion : retire la page (et son jeton) de l'organisation.
create or replace function public.delete_messenger_page(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'not a member of this organization';
  end if;
  delete from public.messenger_pages where organization_id = p_organization_id;
end;
$$;
revoke execute on function public.delete_messenger_page(uuid) from public, anon;

-- Page connectée par identifiant de Page (webhook : nom de l'expéditeur).
create or replace function public.get_messenger_page_by_id(
  p_secret text,
  p_page_id text
)
returns table (organization_id uuid, page_name text, access_token text)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.check_ingest_secret(p_secret);
  return query
    select m.organization_id, m.page_name, m.access_token
    from public.messenger_pages m
    where m.page_id = p_page_id;
end;
$$;

-- Ingestion d'un message Messenger entrant (webhook signé Meta).
-- Retrouve ou crée la conversation du contact (customer_contact = psid:…)
-- puis ajoute le message ; la conversation repasse en « nouveau ».
create or replace function public.ingest_messenger_message(
  p_secret text,
  p_page_id text,
  p_sender_psid text,
  p_sender_name text,
  p_text text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_conv uuid;
  v_contact text := 'psid:' || p_sender_psid;
begin
  perform public.check_ingest_secret(p_secret);

  select organization_id into v_org
  from public.messenger_pages
  where page_id = p_page_id;
  if v_org is null then
    return null; -- page inconnue : événement ignoré
  end if;

  select id into v_conv
  from public.inbox_conversations
  where organization_id = v_org
    and channel = 'messenger'
    and customer_contact = v_contact
  order by last_message_at desc
  limit 1;

  if v_conv is null then
    insert into public.inbox_conversations (
      organization_id, channel, customer_name, customer_contact, status
    )
    values (
      v_org, 'messenger',
      coalesce(nullif(trim(p_sender_name), ''), 'Client Messenger'),
      v_contact, 'new'
    )
    returning id into v_conv;
  else
    update public.inbox_conversations
    set status = 'new',
        customer_name = coalesce(nullif(trim(p_sender_name), ''), customer_name)
    where id = v_conv;
  end if;

  insert into public.inbox_messages (
    organization_id, conversation_id, direction, author, body
  )
  values (v_org, v_conv, 'inbound', 'customer', left(p_text, 8000));

  update public.inbox_conversations
  set last_message_at = now()
  where id = v_conv;

  return v_conv;
end;
$$;
