-- Transition de statut de réservation ATOMIQUE (fin de la course lecture →
-- vérification → écriture côté client) + quotas IA mensuels par organisation.

-- 1. change_booking_status : la ligne est verrouillée FOR UPDATE, la machine
-- à états et la disponibilité sont revérifiées dans la MÊME transaction,
-- sous les mêmes verrous consultatifs que create_booking.
-- SECURITY INVOKER : la RLS s'applique (isolation multi-tenant).
create or replace function public.change_booking_status(
  p_booking_id uuid,
  p_to public.booking_status,
  p_note text default null
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
  v_now timestamptz := now();
  v_allowed boolean;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;
  if not found then
    raise exception 'booking not found';
  end if;
  if v_booking.status = p_to then
    return; -- déjà dans l'état demandé : idempotent
  end if;

  v_allowed := case v_booking.status
    when 'draft' then p_to in ('pending', 'confirmed', 'cancelled')
    when 'pending' then p_to in ('confirmed', 'cancelled')
    when 'confirmed' then p_to in ('in_progress', 'cancelled')
    when 'in_progress' then p_to = 'completed'
    else false
  end;
  if not v_allowed then
    raise exception 'INVALID_TRANSITION:%:%', v_booking.status, p_to;
  end if;

  -- Passage d'un statut non bloquant à un statut bloquant : disponibilité
  -- revérifiée sous verrous consultatifs par matériel (ordre stable).
  if v_booking.status not in ('pending', 'confirmed', 'in_progress')
     and p_to in ('pending', 'confirmed', 'in_progress') then
    for v_item in
      select equipment_id
      from public.booking_items
      where booking_id = p_booking_id
      order by equipment_id
    loop
      perform pg_advisory_xact_lock(
        hashtextextended(v_item.equipment_id::text, 42)
      );
    end loop;
    for v_item in
      select equipment_id, quantity
      from public.booking_items
      where booking_id = p_booking_id
    loop
      v_avail := public.check_equipment_availability(
        v_item.equipment_id, v_booking.start_at, v_booking.end_at,
        v_item.quantity, p_booking_id
      );
      if not (v_avail ->> 'available')::boolean then
        raise exception 'EQUIPMENT_UNAVAILABLE:%:%',
          v_item.equipment_id, coalesce(v_avail ->> 'reason', 'conflict');
      end if;
    end loop;
  end if;

  update public.bookings
  set status = p_to,
      confirmed_at = case when p_to = 'confirmed' then v_now else confirmed_at end,
      started_at   = case when p_to = 'in_progress' then v_now else started_at end,
      completed_at = case when p_to = 'completed' then v_now else completed_at end,
      cancelled_at = case when p_to = 'cancelled' then v_now else cancelled_at end
  where id = p_booking_id;

  insert into public.booking_status_history (
    organization_id, booking_id, from_status, to_status, note, changed_by
  )
  values (
    v_booking.organization_id, p_booking_id, v_booking.status, p_to,
    nullif(p_note, ''), auth.uid()
  );
end;
$$;

-- 2. Consommation IA mensuelle par organisation.
-- Lecture ouverte aux membres (transparence) ; écritures uniquement via les
-- fonctions gardées par le secret serveur.
create table public.ai_usage (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  month text not null, -- 'YYYY-MM'
  requests integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (organization_id, month)
);
alter table public.ai_usage enable row level security;
create policy "ai_usage_select" on public.ai_usage
  for select using (organization_id in (select public.user_org_ids()));
create trigger trg_ai_usage_updated_at before update on public.ai_usage
  for each row execute function public.set_updated_at();

-- Réserve UNE requête IA si le plafond mensuel n'est pas atteint.
-- Renvoie le compteur après réservation, ou -1 si le plafond est atteint.
create or replace function public.consume_ai_quota(
  p_secret text,
  p_organization_id uuid,
  p_limit integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requests integer;
begin
  perform public.check_ingest_secret(p_secret);
  if p_limit <= 0 then
    return -1;
  end if;
  insert into public.ai_usage (organization_id, month, requests)
  values (p_organization_id, to_char(now(), 'YYYY-MM'), 1)
  on conflict (organization_id, month) do update
    set requests = ai_usage.requests + 1
    where ai_usage.requests < p_limit
  returning requests into v_requests;
  return coalesce(v_requests, -1);
end;
$$;

-- Ajoute les tokens réellement consommés après la réponse du modèle.
create or replace function public.record_ai_tokens(
  p_secret text,
  p_organization_id uuid,
  p_input_tokens bigint,
  p_output_tokens bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.check_ingest_secret(p_secret);
  update public.ai_usage
  set input_tokens = input_tokens + greatest(p_input_tokens, 0),
      output_tokens = output_tokens + greatest(p_output_tokens, 0)
  where organization_id = p_organization_id
    and month = to_char(now(), 'YYYY-MM');
end;
$$;
