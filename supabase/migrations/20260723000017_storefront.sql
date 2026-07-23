-- Vitrine publique par organisation (Lot A) : adresse propre (slug),
-- personnalisation, photos du matériel (Supabase Storage) et lecture
-- publique CONTRÔLÉE du catalogue via une fonction dédiée — la RLS des
-- tables reste fermée aux anonymes.

-- 1. Organisations : slug public + personnalisation de la vitrine.
alter table public.organizations
  add column if not exists slug text,
  add column if not exists storefront_welcome text,
  add column if not exists storefront_visible boolean not null default true;

create unique index if not exists idx_organizations_slug
  on public.organizations (slug);

-- Slug lisible dérivé du nom (« Pacific Rent&Clean » → pacific-rent-clean),
-- suffixe numérique en cas de collision.
create or replace function public.generate_org_slug(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_slug text;
  v_n integer := 1;
begin
  v_base := lower(regexp_replace(
    translate(p_name,
      'àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ&''',
      'aaaeeeeiioouuucAAAEEEEIIOOUUUC-e'),
    '[^a-zA-Z0-9]+', '-', 'g'));
  v_base := trim(both '-' from v_base);
  if v_base = '' then v_base := 'loueur'; end if;
  v_slug := v_base;
  while exists (select 1 from public.organizations where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  return v_slug;
end;
$$;

-- Slug automatique à la création d'une organisation.
create or replace function public.set_org_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := public.generate_org_slug(new.name);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_organizations_slug on public.organizations;
create trigger trg_organizations_slug before insert on public.organizations
  for each row execute function public.set_org_slug();

-- Slugs des organisations existantes.
update public.organizations
set slug = public.generate_org_slug(name)
where slug is null;

-- 2. Photo du matériel.
alter table public.equipment_items
  add column if not exists photo_url text;

-- 3. Lecture publique de la vitrine : fonction dédiée (champs sûrs
-- uniquement, matériel actif non archivé, vitrine visible). Appelable par
-- les anonymes — c'est la SEULE porte publique vers le catalogue.
create or replace function public.get_public_storefront(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_org record;
  v_result jsonb;
begin
  select id, name, business_type, logo_url, phone, email, address,
         currency, storefront_welcome
  into v_org
  from public.organizations
  where slug = p_slug and storefront_visible;
  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'organization', jsonb_build_object(
      'name', v_org.name,
      'businessType', v_org.business_type,
      'logoUrl', v_org.logo_url,
      'phone', v_org.phone,
      'email', v_org.email,
      'address', v_org.address,
      'currency', v_org.currency,
      'welcome', v_org.storefront_welcome
    ),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name)
                       order by c.name)
      from public.equipment_categories c
      where c.organization_id = v_org.id
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'name', e.name,
        'description', e.description,
        'categoryId', e.category_id,
        'dailyPrice', e.daily_price,
        'pricingMode', e.pricing_mode,
        'deposit', e.deposit_amount,
        'photoUrl', e.photo_url,
        'minRentalDays', e.min_rental_days
      ) order by e.name)
      from public.equipment_items e
      where e.organization_id = v_org.id
        and e.archived_at is null
        and e.status = 'available'
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;
grant execute on function public.get_public_storefront(text) to anon, authenticated;

-- 4. Stockage des photos : bucket public en lecture, écriture réservée aux
-- membres de l'organisation (le chemin commence par l'id de leur org).
insert into storage.buckets (id, name, public)
values ('equipment-photos', 'equipment-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "equipment_photos_read" on storage.objects;
create policy "equipment_photos_read" on storage.objects
  for select using (bucket_id = 'equipment-photos');

drop policy if exists "equipment_photos_insert" on storage.objects;
create policy "equipment_photos_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'equipment-photos'
    and (storage.foldername(name))[1] in (
      select m.organization_id::text
      from public.organization_members m
      where m.user_id = auth.uid()
    )
  );

drop policy if exists "equipment_photos_update" on storage.objects;
create policy "equipment_photos_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'equipment-photos'
    and (storage.foldername(name))[1] in (
      select m.organization_id::text
      from public.organization_members m
      where m.user_id = auth.uid()
    )
  );

drop policy if exists "equipment_photos_delete" on storage.objects;
create policy "equipment_photos_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'equipment-photos'
    and (storage.foldername(name))[1] in (
      select m.organization_id::text
      from public.organization_members m
      where m.user_id = auth.uid()
    )
  );
