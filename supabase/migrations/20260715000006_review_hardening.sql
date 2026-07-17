-- Pacific Code — Durcissements issus de la revue de code.
-- 1. create_booking / update_booking_details vérifient que le client et
--    chaque matériel appartiennent bien à l'organisation (les SELECT étant
--    sous RLS, une ressource d'une autre organisation est invisible ; la
--    simple FK, validée en tant que propriétaire de table, ne suffit pas).
-- 2. booking_items : les politiques d'écriture imposent la cohérence
--    réservation/matériel/organisation (défense en profondeur contre un
--    appel PostgREST direct).
-- 3. activity_logs : user_id ne peut être que soi-même (journal non
--    falsifiable au nom d'un autre membre).

-- ============================================================
-- 1a. create_booking avec contrôles d'appartenance
-- ============================================================

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

  -- Le client doit appartenir à l'organisation (SELECT sous RLS).
  if not exists (
    select 1 from public.customers c
    where c.id = p_customer_id
      and c.organization_id = p_organization_id
  ) then
    raise exception 'customer not found in organization';
  end if;

  -- Chaque matériel doit appartenir à l'organisation (SELECT sous RLS).
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

-- ============================================================
-- 1b. update_booking_details avec contrôles d'appartenance
-- ============================================================

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

-- ============================================================
-- 2. booking_items : cohérence réservation/matériel/organisation
-- ============================================================

drop policy "booking_items_insert" on public.booking_items;
create policy "booking_items_insert" on public.booking_items
  for insert to authenticated
  with check (
    organization_id in (select public.user_org_ids())
    and exists (
      select 1 from public.bookings b
      where b.id = booking_items.booking_id
        and b.organization_id = booking_items.organization_id
    )
    and exists (
      select 1 from public.equipment_items e
      where e.id = booking_items.equipment_id
        and e.organization_id = booking_items.organization_id
    )
  );

drop policy "booking_items_update" on public.booking_items;
create policy "booking_items_update" on public.booking_items
  for update to authenticated
  using (organization_id in (select public.user_org_ids()))
  with check (
    organization_id in (select public.user_org_ids())
    and exists (
      select 1 from public.bookings b
      where b.id = booking_items.booking_id
        and b.organization_id = booking_items.organization_id
    )
    and exists (
      select 1 from public.equipment_items e
      where e.id = booking_items.equipment_id
        and e.organization_id = booking_items.organization_id
    )
  );

-- ============================================================
-- 3. activity_logs : on ne journalise qu'en son propre nom
-- ============================================================

drop policy "activity_logs_insert" on public.activity_logs;
create policy "activity_logs_insert" on public.activity_logs
  for insert to authenticated
  with check (
    organization_id in (select public.user_org_ids())
    and (user_id is null or user_id = (select auth.uid()))
  );
