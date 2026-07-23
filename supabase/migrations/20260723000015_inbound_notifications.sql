-- Notifications de nouveaux messages entrants (Lot 18).
-- Le loueur reçoit un email quand un client lui écrit — envoyé via son
-- propre compte email connecté (aucune infrastructure d'envoi tierce).
-- Anti-rafale : au plus une notification par conversation par fenêtre de
-- refroidissement, réservée ATOMIQUEMENT par claim_inbound_notification
-- (l'UPDATE conditionnel garantit qu'un seul appelant concurrent gagne).

alter table public.inbox_conversations
  add column if not exists last_notified_at timestamptz;

alter table public.agent_settings
  add column if not exists notify_new_messages boolean not null default true,
  add column if not exists notify_email text;

create or replace function public.claim_inbound_notification(
  p_secret text,
  p_conversation_id uuid,
  p_cooldown_minutes integer
)
returns table (
  organization_id uuid,
  notify_email text,
  customer_name text,
  channel text,
  subject text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_name text;
  v_channel text;
  v_subject text;
  v_enabled boolean := true;
  v_email text := null;
begin
  perform public.check_ingest_secret(p_secret);

  select c.organization_id, c.customer_name, c.channel::text, c.subject
    into v_org, v_name, v_channel, v_subject
  from public.inbox_conversations c
  where c.id = p_conversation_id;
  if v_org is null then
    return;
  end if;

  -- Réglages du loueur (ligne absente = défauts : activé, adresse du compte).
  select coalesce(s.notify_new_messages, true), nullif(trim(s.notify_email), '')
    into v_enabled, v_email
  from public.agent_settings s
  where s.organization_id = v_org;
  if not found then
    v_enabled := true;
    v_email := null;
  end if;
  if not v_enabled then
    return;
  end if;

  -- Réservation atomique du droit de notifier (anti-rafale + anti-course).
  update public.inbox_conversations c
  set last_notified_at = now()
  where c.id = p_conversation_id
    and (c.last_notified_at is null
         or c.last_notified_at < now() - make_interval(mins => p_cooldown_minutes));
  if not found then
    return;
  end if;

  return query select v_org, v_email, v_name, v_channel, v_subject;
end;
$$;

revoke execute on function public.claim_inbound_notification(text, uuid, integer) from public;
grant execute on function public.claim_inbound_notification(text, uuid, integer) to anon, authenticated;
