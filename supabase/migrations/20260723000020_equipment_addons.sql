-- Accessoires payants proposés avec un matériel (Lot 20).
-- Un accessoire EST une fiche matériel (prix, forfait/jour, stock, photo) :
-- cette table ne porte que le LIEN « ce matériel propose ces accessoires ».
-- Facturation, totaux et lignes de réservation réutilisent l'existant.

create table public.equipment_addons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  equipment_id uuid not null references public.equipment_items(id) on delete cascade,
  addon_id uuid not null references public.equipment_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (equipment_id, addon_id),
  check (equipment_id <> addon_id)
);

create index idx_equipment_addons_org on public.equipment_addons (organization_id);
create index idx_equipment_addons_equipment on public.equipment_addons (equipment_id);
create index idx_equipment_addons_addon on public.equipment_addons (addon_id);

alter table public.equipment_addons enable row level security;

create policy "equipment_addons_select" on public.equipment_addons
  for select using (organization_id in (select public.user_org_ids()));
create policy "equipment_addons_insert" on public.equipment_addons
  for insert with check (organization_id in (select public.user_org_ids()));
create policy "equipment_addons_delete" on public.equipment_addons
  for delete using (organization_id in (select public.user_org_ids()));

-- L'agent automatique voit les accessoires de chaque bien : le bloc
-- equipment de agent_auto_context gagne un champ addons (recréation à
-- l'identique sinon).
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
        'description', left(coalesce(e.description, ''), 1500),
        'addons', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', a.id, 'name', a.name,
            'daily_price', a.daily_price, 'pricing_mode', a.pricing_mode,
            'quantity_total', a.quantity_total, 'status', a.status::text
          ) order by a.name)
          from public.equipment_addons l
          join public.equipment_items a on a.id = l.addon_id
          where l.equipment_id = e.id and a.archived_at is null
        ), '[]'::jsonb)
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
