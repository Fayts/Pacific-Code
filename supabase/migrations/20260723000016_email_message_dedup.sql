-- Déduplication des emails ingérés. Le filtre « after: » de Gmail est flou
-- à la frontière du point de reprise : deux relèves qui se chevauchent
-- (cron + manuelle, ou latence d'indexation Gmail) pouvaient ingérer deux
-- fois le même message — constaté en production le 23/07/2026.
-- Chaque message entrant porte désormais l'identifiant du fournisseur
-- (id Gmail / id Graph), unique par organisation : le doublon est ignoré.

alter table public.inbox_messages
  add column if not exists provider_message_id text;

create unique index if not exists idx_inbox_messages_provider_unique
  on public.inbox_messages (organization_id, provider_message_id)
  where provider_message_id is not null;

-- Fonction recréée depuis sa définition en base (migration 013), avec pour
-- seuls ajouts : le paramètre p_provider_message_id, l'insertion en
-- ON CONFLICT DO NOTHING, et un retour NULL quand le message est un
-- doublon (l'appelant ne notifie alors pas).
drop function if exists public.ingest_email_message(text, uuid, text, text, text, text, text, text, text);

create function public.ingest_email_message(
  p_secret text,
  p_organization_id uuid,
  p_provider text,
  p_thread_id text,
  p_from_name text,
  p_from_email text,
  p_subject text,
  p_body text,
  p_reply_to_message_id text,
  p_provider_message_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv uuid;
  v_msg uuid;
  v_name text := coalesce(nullif(trim(p_from_name), ''), p_from_email);
begin
  perform public.check_ingest_secret(p_secret);

  -- Doublon déjà ingéré : ne rien toucher (ni statut, ni notification).
  if p_provider_message_id is not null and exists (
    select 1 from public.inbox_messages m
    where m.organization_id = p_organization_id
      and m.provider_message_id = p_provider_message_id
  ) then
    return null;
  end if;

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
    organization_id, conversation_id, direction, author, body,
    provider_message_id
  )
  values (
    p_organization_id, v_conv, 'inbound', 'customer', left(p_body, 8000),
    p_provider_message_id
  )
  on conflict (organization_id, provider_message_id) where provider_message_id is not null
  do nothing
  returning id into v_msg;

  -- Course perdue entre la vérification et l'insertion : doublon, ne rien
  -- signaler.
  if v_msg is null then
    return null;
  end if;

  update public.inbox_conversations
  set last_message_at = now()
  where id = v_conv;

  return v_conv;
end;
$$;
