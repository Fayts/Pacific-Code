-- Réponse automatique serveur (Lot 19) : l'agent répond seul aux demandes
-- simples dès l'ingestion d'un message, app fermée ou pas. Trois fonctions
-- definer gardées par le secret d'ingestion (modèle des canaux) :
-- 1. agent_auto_context : éligibilité + tout le contexte en un appel
--    (réglages, catalogue, conversation) — l'anti-rafale de 2 min est
--    vérifié ici, AVANT de dépenser des tokens.
-- 2. check_equipment_availability_secret : disponibilité réelle (outil IA).
-- 3. record_agent_reply : trace la réponse envoyée (statut auto_replied).

create or replace function public.agent_auto_context(
  p_secret text,
  p_conversation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv record;
  v_settings record;
  v_result jsonb;
begin
  perform public.check_ingest_secret(p_secret);

  select c.id, c.organization_id, c.channel::text as channel,
         c.customer_name, c.customer_contact, c.subject
    into v_conv
  from public.inbox_conversations c
  where c.id = p_conversation_id;
  if v_conv.id is null then
    return jsonb_build_object('eligible', false, 'reason', 'conversation inconnue');
  end if;

  -- Canaux avec transport réel uniquement.
  if v_conv.channel not in ('messenger', 'gmail', 'outlook') then
    return jsonb_build_object('eligible', false, 'reason', 'canal sans envoi réel');
  end if;

  select s.mode::text as mode, s.tone::text as tone, s.signature,
         s.practical_info, s.permissions
    into v_settings
  from public.agent_settings s
  where s.organization_id = v_conv.organization_id;
  if v_settings.mode is null or v_settings.mode <> 'auto' then
    return jsonb_build_object('eligible', false, 'reason', 'mode assisté');
  end if;
  if coalesce(v_settings.permissions ->> 'auto_reply_simple', 'false') <> 'true' then
    return jsonb_build_object('eligible', false, 'reason', 'permission décochée');
  end if;

  -- Anti-rafale : pas deux réponses automatiques en moins de 2 minutes.
  if exists (
    select 1 from public.inbox_messages m
    where m.conversation_id = p_conversation_id
      and m.direction = 'outbound'
      and m.author = 'agent'
      and m.created_at > now() - interval '2 minutes'
  ) then
    return jsonb_build_object('eligible', false, 'reason', 'anti-rafale 2 min');
  end if;

  select jsonb_build_object(
    'eligible', true,
    'organization_id', v_conv.organization_id,
    'channel', v_conv.channel,
    'customer_name', v_conv.customer_name,
    'customer_contact', v_conv.customer_contact,
    'subject', v_conv.subject,
    'organization', (
      select jsonb_build_object(
        'name', o.name, 'currency', o.currency, 'timezone', o.timezone,
        'phone', o.phone, 'email', o.email, 'address', o.address
      )
      from public.organizations o where o.id = v_conv.organization_id
    ),
    'settings', jsonb_build_object(
      'tone', v_settings.tone,
      'signature', v_settings.signature,
      'practical_info', v_settings.practical_info
    ),
    'equipment', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'name', e.name,
        'category', (select ec.name from public.equipment_categories ec
                     where ec.id = e.category_id),
        'daily_price', e.daily_price, 'pricing_mode', e.pricing_mode,
        'deposit_amount', e.deposit_amount, 'quantity_total', e.quantity_total,
        'min_rental_days', e.min_rental_days, 'status', e.status::text,
        'description', left(coalesce(e.description, ''), 300)
      ) order by e.name)
      from public.equipment_items e
      where e.organization_id = v_conv.organization_id
        and e.archived_at is null
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'direction', m.direction, 'author', m.author,
        'body', left(m.body, 2000), 'created_at', m.created_at
      ) order by m.created_at)
      from (
        select * from public.inbox_messages
        where conversation_id = p_conversation_id
        order by created_at desc
        limit 12
      ) m
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.agent_auto_context(text, uuid) from public;
grant execute on function public.agent_auto_context(text, uuid) to anon, authenticated;

-- Disponibilité réelle pour l'outil de l'agent serveur (le definer
-- contourne la RLS ; l'accès est gardé par le secret + l'appartenance du
-- matériel à l'organisation est vérifiée).
create or replace function public.check_equipment_availability_secret(
  p_secret text,
  p_organization_id uuid,
  p_equipment_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.check_ingest_secret(p_secret);
  if not exists (
    select 1 from public.equipment_items e
    where e.id = p_equipment_id and e.organization_id = p_organization_id
  ) then
    return jsonb_build_object('available', false, 'reason', 'not_found');
  end if;
  return public.check_equipment_availability(
    p_equipment_id, p_start_at, p_end_at, p_quantity, null
  );
end;
$$;

revoke execute on function public.check_equipment_availability_secret(text, uuid, uuid, timestamptz, timestamptz, integer) from public;
grant execute on function public.check_equipment_availability_secret(text, uuid, uuid, timestamptz, timestamptz, integer) to anon, authenticated;

-- Trace de la réponse automatique envoyée.
create or replace function public.record_agent_reply(
  p_secret text,
  p_conversation_id uuid,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  perform public.check_ingest_secret(p_secret);
  select organization_id into v_org
  from public.inbox_conversations where id = p_conversation_id;
  if v_org is null then
    return;
  end if;
  insert into public.inbox_messages (
    organization_id, conversation_id, direction, author, body
  )
  values (v_org, p_conversation_id, 'outbound', 'agent', left(p_body, 8000));
  update public.inbox_conversations
  set status = 'auto_replied', last_message_at = now()
  where id = p_conversation_id;
end;
$$;

revoke execute on function public.record_agent_reply(text, uuid, text) from public;
grant execute on function public.record_agent_reply(text, uuid, text) to anon, authenticated;
