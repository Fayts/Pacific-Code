-- ============================================================
-- Pacific Code — Données de DÉMONSTRATION « Pacific Rent&Clean »
-- ============================================================
-- Crée un compte de démonstration complet :
--   email : demo@pacific-rentclean.pf   mot de passe : demo1234
-- Entreprise, catégories, matériels, clients et réservations réalistes
-- (dates relatives à l'exécution : en cours, en retard, à venir, terminée).
-- À exécuter avec les droits service (SQL Editor Supabase ou MCP).

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_org_id uuid := gen_random_uuid();
  v_year int := extract(year from now())::int;
  v_cat_injecteur uuid := gen_random_uuid();
  v_cat_pack uuid := gen_random_uuid();
  v_cat_hp uuid := gen_random_uuid();
  v_puzzi10 uuid := gen_random_uuid();
  v_puzzi8 uuid := gen_random_uuid();
  v_pack uuid := gen_random_uuid();
  v_karcher_k5 uuid := gen_random_uuid();
  v_jean uuid := gen_random_uuid();
  v_moana uuid := gen_random_uuid();
  v_hotel uuid := gen_random_uuid();
  v_b1 uuid := gen_random_uuid();
  v_b2 uuid := gen_random_uuid();
  v_b3 uuid := gen_random_uuid();
  v_b4 uuid := gen_random_uuid();
  v_b5 uuid := gen_random_uuid();
begin
  -- Idempotence : ne rien faire si le compte démo existe déjà.
  if exists (select 1 from auth.users where email = 'demo@pacific-rentclean.pf') then
    raise notice 'Seed déjà appliqué (demo@pacific-rentclean.pf existe).';
    return;
  end if;

  -- ----------------------------------------------------------
  -- Utilisateur de démonstration (email confirmé)
  -- ----------------------------------------------------------
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user_id,
    'authenticated', 'authenticated',
    'demo@pacific-rentclean.pf',
    crypt('demo1234', gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object(
      'first_name', 'Teiki',
      'last_name', 'Démonstration',
      'company_name', 'Pacific Rent&Clean',
      'business_type', 'equipment'
    ),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_user_id, v_user_id::text,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', 'demo@pacific-rentclean.pf',
      'email_verified', true,
      'phone_verified', false
    ),
    'email', now(), now(), now()
  );

  -- ----------------------------------------------------------
  -- Entreprise
  -- ----------------------------------------------------------
  insert into public.organizations (
    id, name, business_type, currency, timezone, locale, date_format,
    booking_prefix, phone, email, address, onboarding_completed_at, created_by
  ) values (
    v_org_id, 'Pacific Rent&Clean', 'equipment', 'XPF', 'Pacific/Tahiti',
    'fr', 'dd/MM/yyyy', 'PRC', '+689 87 12 34 56',
    'contact@pacific-rentclean.pf',
    'Papeete, Tahiti — Polynésie française',
    now(), v_user_id
  );

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, v_user_id, 'owner');

  -- ----------------------------------------------------------
  -- Catalogue (données de démonstration)
  -- ----------------------------------------------------------
  insert into public.equipment_categories (id, organization_id, name, description) values
    (v_cat_injecteur, v_org_id, 'Injecteur-extracteur', 'Nettoyage en profondeur des textiles : canapés, sièges auto, moquettes'),
    (v_cat_pack, v_org_id, 'Pack nettoyage', 'Ensembles matériel + accessoires prêts à l''emploi'),
    (v_cat_hp, v_org_id, 'Nettoyeur haute pression', 'Terrasses, façades, véhicules');

  insert into public.equipment_items (
    id, organization_id, category_id, name, internal_ref, description,
    daily_price, deposit_amount, quantity_total, min_rental_days, status,
    usage_instructions, internal_notes, created_by
  ) values
    (v_puzzi10, v_org_id, v_cat_injecteur, 'Kärcher Puzzi 10/1', 'PZ10-01',
     'Injecteur-extracteur professionnel. Idéal canapés, matelas, moquettes et sièges de voiture. Livré avec suceur main et suceur sol.',
     7990, 50000, 2, 1, 'available',
     'Remplir le réservoir d''eau propre avec le détergent fourni (1 dose pour 4 L). Vider et rincer le bac de récupération après usage.',
     'Données de démonstration — 2 exemplaires en stock.', v_user_id),
    (v_puzzi8, v_org_id, v_cat_injecteur, 'Kärcher Puzzi 8/1', 'PZ8-01',
     'Injecteur-extracteur compact, parfait pour l''intérieur des véhicules et les petites surfaces textiles.',
     6990, 40000, 1, 1, 'available',
     'Utiliser uniquement le détergent RM 760 fourni. Ne pas aspirer de liquides autres que l''eau de nettoyage.',
     'Données de démonstration.', v_user_id),
    (v_pack, v_org_id, v_cat_pack, 'Pack Auto-Home', 'PACK-AH',
     'Pack complet : injecteur-extracteur + aspirateur eau et poussière + accessoires (brosses, suceurs, rallonge, détergents). Pour nettoyer voiture et maison le même week-end.',
     9990, 60000, 1, 1, 'available',
     'Vérifier le contenu du pack à la remise et au retour (liste fournie dans la mallette).',
     'Données de démonstration — pack le plus demandé.', v_user_id),
    (v_karcher_k5, v_org_id, v_cat_hp, 'Kärcher K5 Premium', 'K5-01',
     'Nettoyeur haute pression 145 bars avec nettoyeur de terrasse T-Racer.',
     5990, 30000, 1, 1, 'maintenance',
     'Purger l''eau après chaque utilisation. Ne jamais utiliser d''eau de mer.',
     'Données de démonstration — joint haute pression à remplacer.', v_user_id);

  insert into public.maintenance_records (organization_id, equipment_id, description, started_at, created_by)
  values (v_org_id, v_karcher_k5, 'Remplacement du joint haute pression + révision générale', now() - interval '2 days', v_user_id);

  -- ----------------------------------------------------------
  -- Clients (données de démonstration)
  -- ----------------------------------------------------------
  insert into public.customers (
    id, organization_id, type, first_name, last_name, company_name,
    email, phone, address, internal_notes, created_by
  ) values
    (v_jean, v_org_id, 'individual', 'Jean', 'Dupont', null,
     'jean.dupont@mail.pf', '+689 87 11 22 33', 'Punaauia, Tahiti',
     'Client régulier — données de démonstration.', v_user_id),
    (v_moana, v_org_id, 'individual', 'Moana', 'Tehani', null,
     'moana.tehani@mail.pf', '+689 87 44 55 66', 'Faaa, Tahiti',
     'Données de démonstration.', v_user_id),
    (v_hotel, v_org_id, 'company', 'Hina', 'Teva', 'Hôtel Tiare Lodge',
     'reception@tiarelodge.pf', '+689 40 50 60 70', 'Moorea',
     'Compte professionnel — facturation fin de mois. Données de démonstration.', v_user_id);

  -- ----------------------------------------------------------
  -- Réservations (dates relatives à maintenant)
  -- ----------------------------------------------------------

  -- B1 : terminée la semaine dernière (Jean, Puzzi 10/1, 2 jours)
  insert into public.bookings (
    id, organization_id, booking_number, customer_id, status,
    start_at, end_at, duration_days, subtotal, discount_amount,
    extra_fees_amount, total_amount, deposit_amount,
    payment_status, deposit_status, notes, created_by,
    confirmed_at, started_at, completed_at
  ) values (
    v_b1, v_org_id, 'PRC-' || v_year || '-0001', v_jean, 'completed',
    now() - interval '9 days' + interval '8 hours',
    now() - interval '7 days' + interval '17 hours',
    3, 23970, 0, 0, 23970, 50000,
    'paid', 'returned', 'Nettoyage canapé + moquettes. RAS au retour.', v_user_id,
    now() - interval '12 days', now() - interval '9 days', now() - interval '7 days'
  );
  insert into public.booking_items (organization_id, booking_id, equipment_id, quantity, daily_price, line_total)
  values (v_org_id, v_b1, v_puzzi10, 1, 7990, 23970);

  -- B2 : en cours (Hôtel Tiare Lodge, Pack Auto-Home, retour demain)
  insert into public.bookings (
    id, organization_id, booking_number, customer_id, status,
    start_at, end_at, duration_days, subtotal, discount_amount,
    extra_fees_amount, total_amount, deposit_amount,
    payment_status, deposit_status, notes, created_by,
    confirmed_at, started_at
  ) values (
    v_b2, v_org_id, 'PRC-' || v_year || '-0002', v_hotel, 'in_progress',
    now() - interval '1 day', now() + interval '1 day',
    2, 19980, 1980, 0, 18000, 60000,
    'deposit_paid', 'received', 'Remise commerciale fidélité. Livraison au ponton 9 h.', v_user_id,
    now() - interval '3 days', now() - interval '1 day'
  );
  insert into public.booking_items (organization_id, booking_id, equipment_id, quantity, daily_price, line_total)
  values (v_org_id, v_b2, v_pack, 1, 9990, 19980);

  -- B3 : confirmée, départ dans 2 jours (Moana, Puzzi 10/1, 2 jours)
  insert into public.bookings (
    id, organization_id, booking_number, customer_id, status,
    start_at, end_at, duration_days, subtotal, discount_amount,
    extra_fees_amount, total_amount, deposit_amount,
    payment_status, deposit_status, notes, created_by, confirmed_at
  ) values (
    v_b3, v_org_id, 'PRC-' || v_year || '-0003', v_moana, 'confirmed',
    now() + interval '2 days' + interval '8 hours',
    now() + interval '4 days' + interval '17 hours',
    3, 23970, 0, 0, 23970, 50000,
    'unpaid', 'pending', 'Sièges auto + canapé d''angle.', v_user_id, now()
  );
  insert into public.booking_items (organization_id, booking_id, equipment_id, quantity, daily_price, line_total)
  values (v_org_id, v_b3, v_puzzi10, 1, 7990, 23970);

  -- B4 : à confirmer, départ dans 5 jours (Jean, Puzzi 8/1, 1 jour)
  insert into public.bookings (
    id, organization_id, booking_number, customer_id, status,
    start_at, end_at, duration_days, subtotal, discount_amount,
    extra_fees_amount, total_amount, deposit_amount,
    payment_status, deposit_status, notes, created_by
  ) values (
    v_b4, v_org_id, 'PRC-' || v_year || '-0004', v_jean, 'pending',
    now() + interval '5 days' + interval '8 hours',
    now() + interval '5 days' + interval '18 hours',
    1, 6990, 0, 0, 6990, 40000,
    'unpaid', 'not_required', 'Demande reçue par téléphone — à confirmer.', v_user_id
  );
  insert into public.booking_items (organization_id, booking_id, equipment_id, quantity, daily_price, line_total)
  values (v_org_id, v_b4, v_puzzi8, 1, 6990, 6990);

  -- B5 : EN RETARD (Moana, Puzzi 10/1 — retour prévu hier, non rendu)
  insert into public.bookings (
    id, organization_id, booking_number, customer_id, status,
    start_at, end_at, duration_days, subtotal, discount_amount,
    extra_fees_amount, total_amount, deposit_amount,
    payment_status, deposit_status, notes, created_by,
    confirmed_at, started_at
  ) values (
    v_b5, v_org_id, 'PRC-' || v_year || '-0005', v_moana, 'in_progress',
    now() - interval '3 days', now() - interval '1 day',
    2, 15980, 0, 0, 15980, 50000,
    'paid', 'received', 'Client injoignable depuis hier — relancer.', v_user_id,
    now() - interval '4 days', now() - interval '3 days'
  );
  insert into public.booking_items (organization_id, booking_id, equipment_id, quantity, daily_price, line_total)
  values (v_org_id, v_b5, v_puzzi10, 1, 7990, 15980);

  -- Historique de statuts (chronologie des fiches réservation)
  insert into public.booking_status_history (organization_id, booking_id, from_status, to_status, changed_by, created_at) values
    (v_org_id, v_b1, null, 'confirmed', v_user_id, now() - interval '12 days'),
    (v_org_id, v_b1, 'confirmed', 'in_progress', v_user_id, now() - interval '9 days'),
    (v_org_id, v_b1, 'in_progress', 'completed', v_user_id, now() - interval '7 days'),
    (v_org_id, v_b2, null, 'confirmed', v_user_id, now() - interval '3 days'),
    (v_org_id, v_b2, 'confirmed', 'in_progress', v_user_id, now() - interval '1 day'),
    (v_org_id, v_b3, null, 'confirmed', v_user_id, now()),
    (v_org_id, v_b4, null, 'pending', v_user_id, now()),
    (v_org_id, v_b5, null, 'confirmed', v_user_id, now() - interval '4 days'),
    (v_org_id, v_b5, 'confirmed', 'in_progress', v_user_id, now() - interval '3 days');

  -- Compteur de numérotation aligné sur les 5 réservations créées.
  insert into public.booking_counters (organization_id, year, seq)
  values (v_org_id, v_year, 5);

  insert into public.activity_logs (organization_id, user_id, action, entity_type, entity_id, metadata)
  values (v_org_id, v_user_id, 'seed.applied', 'organization', v_org_id,
          '{"note": "Données de démonstration Pacific Rent&Clean"}'::jsonb);

  raise notice 'Seed Pacific Rent&Clean appliqué. Connexion : demo@pacific-rentclean.pf / demo1234';
end $$;
