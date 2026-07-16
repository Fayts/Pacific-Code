-- Pacific Code — Fonctions métier
-- Toutes les fonctions sensibles vérifient l'appartenance à l'organisation.

-- ============================================================
-- Helpers multi-tenant
-- ============================================================

-- Organisations dont l'utilisateur courant est membre.
-- SECURITY DEFINER pour éviter la récursion RLS sur organization_members.
create or replace function public.user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.organization_members
  where user_id = auth.uid();
$$;

create or replace function public.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = p_organization_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = p_organization_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- Utilisateurs appartenant aux mêmes organisations (pour afficher les noms
-- dans l'historique des réservations, etc.).
create or replace function public.org_peer_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct m2.user_id
  from public.organization_members m1
  join public.organization_members m2
    on m2.organization_id = m1.organization_id
  where m1.user_id = auth.uid();
$$;

-- ============================================================
-- Création d'une organisation avec son propriétaire (onboarding)
-- ============================================================

create or replace function public.create_organization_with_owner(
  p_name text,
  p_business_type public.business_type default 'equipment',
  p_booking_prefix text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_prefix text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'organization name is required';
  end if;

  v_prefix := upper(coalesce(nullif(trim(p_booking_prefix), ''), 'RES'));
  if v_prefix !~ '^[A-Z0-9]{2,6}$' then
    v_prefix := 'RES';
  end if;

  insert into public.organizations (name, business_type, booking_prefix, created_by)
  values (trim(p_name), p_business_type, v_prefix, auth.uid())
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, auth.uid(), 'owner');

  return v_org_id;
end;
$$;

-- ============================================================
-- Numérotation des réservations : PREFIX-ANNÉE-0001
-- ============================================================

create or replace function public.generate_booking_number(p_organization_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from now())::integer;
  v_seq integer;
  v_prefix text;
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'not a member of this organization';
  end if;

  select booking_prefix into v_prefix
  from public.organizations
  where id = p_organization_id;

  insert into public.booking_counters (organization_id, year, seq)
  values (p_organization_id, v_year, 1)
  on conflict (organization_id, year)
  do update set seq = public.booking_counters.seq + 1
  returning seq into v_seq;

  return v_prefix || '-' || v_year || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- ============================================================
-- Disponibilité d'un matériel sur une période
-- ============================================================
-- Retourne la quantité disponible et la liste des conflits, avec la raison
-- si le matériel n'est pas réservable. Les statuts bloquants sont
-- 'pending', 'confirmed' et 'in_progress' (un brouillon ne bloque pas).

create or replace function public.check_equipment_availability(
  p_equipment_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_quantity integer default 1,
  p_exclude_booking_id uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_item public.equipment_items%rowtype;
  v_booked integer := 0;
  v_available integer;
  v_conflicts jsonb := '[]'::jsonb;
begin
  if p_end_at <= p_start_at then
    return jsonb_build_object(
      'available', false,
      'reason', 'invalid_period',
      'available_quantity', 0,
      'total_quantity', 0,
      'conflicts', '[]'::jsonb
    );
  end if;

  select * into v_item from public.equipment_items where id = p_equipment_id;
  if not found then
    return jsonb_build_object(
      'available', false,
      'reason', 'not_found',
      'available_quantity', 0,
      'total_quantity', 0,
      'conflicts', '[]'::jsonb
    );
  end if;

  if v_item.archived_at is not null or v_item.status = 'unavailable' then
    return jsonb_build_object(
      'available', false,
      'reason', 'unavailable',
      'available_quantity', 0,
      'total_quantity', v_item.quantity_total,
      'conflicts', '[]'::jsonb
    );
  end if;

  if v_item.status = 'maintenance' then
    return jsonb_build_object(
      'available', false,
      'reason', 'maintenance',
      'available_quantity', 0,
      'total_quantity', v_item.quantity_total,
      'conflicts', '[]'::jsonb
    );
  end if;

  select coalesce(sum(bi.quantity), 0)
  into v_booked
  from public.booking_items bi
  join public.bookings b on b.id = bi.booking_id
  where bi.equipment_id = p_equipment_id
    and b.status in ('pending', 'confirmed', 'in_progress')
    and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
    and b.start_at < p_end_at
    and b.end_at > p_start_at;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'booking_id', b.id,
      'booking_number', b.booking_number,
      'status', b.status,
      'start_at', b.start_at,
      'end_at', b.end_at,
      'quantity', bi.quantity,
      'customer_name', trim(c.first_name || ' ' || c.last_name)
    ) order by b.start_at),
    '[]'::jsonb
  )
  into v_conflicts
  from public.booking_items bi
  join public.bookings b on b.id = bi.booking_id
  join public.customers c on c.id = b.customer_id
  where bi.equipment_id = p_equipment_id
    and b.status in ('pending', 'confirmed', 'in_progress')
    and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
    and b.start_at < p_end_at
    and b.end_at > p_start_at;

  v_available := v_item.quantity_total - v_booked;

  return jsonb_build_object(
    'available', v_available >= p_quantity,
    'reason', case when v_available >= p_quantity then null else 'conflict' end,
    'available_quantity', greatest(v_available, 0),
    'total_quantity', v_item.quantity_total,
    'conflicts', v_conflicts
  );
end;
$$;

-- ============================================================
-- Disponibilité de tout le parc sur une période (assistant, sélecteur)
-- ============================================================

create or replace function public.list_equipment_availability(
  p_organization_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz
)
returns table (
  equipment_id uuid,
  name text,
  status public.equipment_status,
  quantity_total integer,
  quantity_booked integer,
  quantity_available integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    e.id as equipment_id,
    e.name,
    e.status,
    e.quantity_total,
    coalesce(booked.qty, 0)::integer as quantity_booked,
    case
      when e.status <> 'available' then 0
      else greatest(e.quantity_total - coalesce(booked.qty, 0), 0)::integer
    end as quantity_available
  from public.equipment_items e
  left join lateral (
    select sum(bi.quantity) as qty
    from public.booking_items bi
    join public.bookings b on b.id = bi.booking_id
    where bi.equipment_id = e.id
      and b.status in ('pending', 'confirmed', 'in_progress')
      and b.start_at < p_end_at
      and b.end_at > p_start_at
  ) booked on true
  where e.organization_id = p_organization_id
    and e.archived_at is null
  order by e.name;
$$;
