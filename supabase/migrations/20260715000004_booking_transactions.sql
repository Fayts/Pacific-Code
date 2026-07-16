-- Pacific Code — Création et modification de réservation atomiques.
-- Les vérifications de disponibilité et les insertions se font dans la même
-- transaction, sérialisées par verrou consultatif par matériel : deux
-- créations simultanées ne peuvent pas produire de double réservation.
-- SECURITY INVOKER : la RLS s'applique normalement (isolation multi-tenant).

create or replace function public.create_booking(
  p_organization_id uuid,
  p_customer_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_duration_days integer,
  p_items jsonb,
  p_subtotal numeric,
  p_discount_amount numeric,
  p_extra_fees_amount numeric,
  p_total_amount numeric,
  p_deposit_amount numeric,
  p_status public.booking_status default 'draft',
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
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

  -- Sérialise les créations concurrentes portant sur les mêmes matériels.
  for v_item in
    select (e ->> 'equipment_id')::uuid as equipment_id
    from jsonb_array_elements(p_items) e
    order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_item.equipment_id::text, 42));
  end loop;

  -- Un brouillon ne bloque pas le planning : pas de contrôle bloquant.
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
    organization_id, booking_id, equipment_id, quantity, daily_price, line_total
  )
  select
    p_organization_id,
    v_booking_id,
    (e ->> 'equipment_id')::uuid,
    (e ->> 'quantity')::integer,
    (e ->> 'daily_price')::numeric,
    (e ->> 'line_total')::numeric
  from jsonb_array_elements(p_items) e;

  insert into public.booking_status_history (
    organization_id, booking_id, from_status, to_status, changed_by
  )
  values (p_organization_id, v_booking_id, null, p_status, auth.uid());

  return v_booking_id;
end;
$$;

-- Modification des éléments/dates/montants d'une réservation existante,
-- avec revérification de disponibilité (en excluant la réservation elle-même).

create or replace function public.update_booking_details(
  p_booking_id uuid,
  p_customer_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_duration_days integer,
  p_items jsonb,
  p_subtotal numeric,
  p_discount_amount numeric,
  p_extra_fees_amount numeric,
  p_total_amount numeric,
  p_deposit_amount numeric,
  p_notes text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
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
    organization_id, booking_id, equipment_id, quantity, daily_price, line_total
  )
  select
    v_booking.organization_id,
    p_booking_id,
    (e ->> 'equipment_id')::uuid,
    (e ->> 'quantity')::integer,
    (e ->> 'daily_price')::numeric,
    (e ->> 'line_total')::numeric
  from jsonb_array_elements(p_items) e;
end;
$$;
