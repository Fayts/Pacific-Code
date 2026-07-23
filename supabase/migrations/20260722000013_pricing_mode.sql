-- Tarification par jour ou au forfait.
-- 'daily' : prix × quantité × jours ; 'flat' (forfait, ex. prestation de
-- nettoyage) : prix × quantité, quelle que soit la durée.
-- booking_items garde un instantané du mode : l'historique reste juste même
-- si la fiche matériel change plus tard.
-- Les deux RPC sont recréées à l'identique (définitions relues via
-- pg_get_functiondef) avec pour seule modification l'insertion du mode.

alter table public.equipment_items
  add column if not exists pricing_mode text not null default 'daily'
  constraint equipment_items_pricing_mode_check
  check (pricing_mode in ('daily', 'flat'));

alter table public.booking_items
  add column if not exists pricing_mode text not null default 'daily'
  constraint booking_items_pricing_mode_check
  check (pricing_mode in ('daily', 'flat'));

CREATE OR REPLACE FUNCTION public.create_booking(p_organization_id uuid, p_customer_id uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone, p_duration_days integer, p_items jsonb, p_subtotal numeric, p_discount_amount numeric, p_extra_fees_amount numeric, p_total_amount numeric, p_deposit_amount numeric, p_status booking_status DEFAULT 'draft'::booking_status, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_booking_id uuid;
  v_number text;
  v_item record;
  v_avail jsonb;
begin
  if p_status not in ('draft', 'pending', 'confirmed') then
    raise exception 'invalid initial booking status: %', p_status;
  end if;
  if p_end_at <= p_start_at then
    raise exception 'invalid booking period';
  end if;
  if jsonb_array_length(p_items) < 1 then
    raise exception 'booking requires at least one item';
  end if;

  if not exists (
    select 1 from public.customers c
    where c.id = p_customer_id
      and c.organization_id = p_organization_id
  ) then
    raise exception 'customer not found in organization';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) e
    left join public.equipment_items eq
      on eq.id = (e ->> 'equipment_id')::uuid
     and eq.organization_id = p_organization_id
    where eq.id is null
  ) then
    raise exception 'equipment not found in organization';
  end if;

  for v_item in
    select (e ->> 'equipment_id')::uuid as equipment_id
    from jsonb_array_elements(p_items) e
    order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_item.equipment_id::text, 42));
  end loop;

  if p_status in ('pending', 'confirmed') then
    for v_item in
      select
        (e ->> 'equipment_id')::uuid as equipment_id,
        (e ->> 'quantity')::integer as quantity
      from jsonb_array_elements(p_items) e
    loop
      v_avail := public.check_equipment_availability(
        v_item.equipment_id, p_start_at, p_end_at, v_item.quantity, null
      );
      if not (v_avail ->> 'available')::boolean then
        raise exception 'EQUIPMENT_UNAVAILABLE:%:%',
          v_item.equipment_id, coalesce(v_avail ->> 'reason', 'conflict');
      end if;
    end loop;
  end if;

  v_number := public.generate_booking_number(p_organization_id);

  insert into public.bookings (
    organization_id, booking_number, customer_id, status,
    start_at, end_at, duration_days,
    subtotal, discount_amount, extra_fees_amount, total_amount, deposit_amount,
    notes, created_by, confirmed_at
  )
  values (
    p_organization_id, v_number, p_customer_id, p_status,
    p_start_at, p_end_at, p_duration_days,
    p_subtotal, p_discount_amount, p_extra_fees_amount, p_total_amount, p_deposit_amount,
    nullif(p_notes, ''), auth.uid(),
    case when p_status = 'confirmed' then now() else null end
  )
  returning id into v_booking_id;

  insert into public.booking_items (
    organization_id, booking_id, equipment_id, quantity, daily_price, line_total, pricing_mode
  )
  select
    p_organization_id,
    v_booking_id,
    (e ->> 'equipment_id')::uuid,
    (e ->> 'quantity')::integer,
    (e ->> 'daily_price')::numeric,
    (e ->> 'line_total')::numeric,
    case when e ->> 'pricing_mode' = 'flat' then 'flat' else 'daily' end
  from jsonb_array_elements(p_items) e;

  insert into public.booking_status_history (
    organization_id, booking_id, from_status, to_status, changed_by
  )
  values (p_organization_id, v_booking_id, null, p_status, auth.uid());

  return v_booking_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_booking_details(p_booking_id uuid, p_customer_id uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone, p_duration_days integer, p_items jsonb, p_subtotal numeric, p_discount_amount numeric, p_extra_fees_amount numeric, p_total_amount numeric, p_deposit_amount numeric, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_booking public.bookings%rowtype;
  v_item record;
  v_avail jsonb;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'booking not found';
  end if;
  if v_booking.status not in ('draft', 'pending', 'confirmed') then
    raise exception 'booking can no longer be edited (status: %)', v_booking.status;
  end if;
  if p_end_at <= p_start_at then
    raise exception 'invalid booking period';
  end if;
  if jsonb_array_length(p_items) < 1 then
    raise exception 'booking requires at least one item';
  end if;

  if not exists (
    select 1 from public.customers c
    where c.id = p_customer_id
      and c.organization_id = v_booking.organization_id
  ) then
    raise exception 'customer not found in organization';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) e
    left join public.equipment_items eq
      on eq.id = (e ->> 'equipment_id')::uuid
     and eq.organization_id = v_booking.organization_id
    where eq.id is null
  ) then
    raise exception 'equipment not found in organization';
  end if;

  for v_item in
    select (e ->> 'equipment_id')::uuid as equipment_id
    from jsonb_array_elements(p_items) e
    order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_item.equipment_id::text, 42));
  end loop;

  if v_booking.status in ('pending', 'confirmed') then
    for v_item in
      select
        (e ->> 'equipment_id')::uuid as equipment_id,
        (e ->> 'quantity')::integer as quantity
      from jsonb_array_elements(p_items) e
    loop
      v_avail := public.check_equipment_availability(
        v_item.equipment_id, p_start_at, p_end_at, v_item.quantity, p_booking_id
      );
      if not (v_avail ->> 'available')::boolean then
        raise exception 'EQUIPMENT_UNAVAILABLE:%:%',
          v_item.equipment_id, coalesce(v_avail ->> 'reason', 'conflict');
      end if;
    end loop;
  end if;

  update public.bookings
  set customer_id = p_customer_id,
      start_at = p_start_at,
      end_at = p_end_at,
      duration_days = p_duration_days,
      subtotal = p_subtotal,
      discount_amount = p_discount_amount,
      extra_fees_amount = p_extra_fees_amount,
      total_amount = p_total_amount,
      deposit_amount = p_deposit_amount,
      notes = nullif(p_notes, '')
  where id = p_booking_id;

  delete from public.booking_items where booking_id = p_booking_id;

  insert into public.booking_items (
    organization_id, booking_id, equipment_id, quantity, daily_price, line_total, pricing_mode
  )
  select
    v_booking.organization_id,
    p_booking_id,
    (e ->> 'equipment_id')::uuid,
    (e ->> 'quantity')::integer,
    (e ->> 'daily_price')::numeric,
    (e ->> 'line_total')::numeric,
    case when e ->> 'pricing_mode' = 'flat' then 'flat' else 'daily' end
  from jsonb_array_elements(p_items) e;
end;
$function$;
