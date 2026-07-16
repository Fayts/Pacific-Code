-- Pacific Code — Durcissement : les fonctions SECURITY DEFINER ne sont
-- exécutables que par les utilisateurs connectés (elles vérifient déjà
-- auth.uid() en interne, ceci retire en plus la surface d'appel anonyme).
-- handle_new_user n'est appelée que par le trigger : aucun rôle API n'en
-- a besoin.

revoke execute on function public.create_organization_with_owner(text, public.business_type, text) from public, anon;
revoke execute on function public.generate_booking_number(uuid) from public, anon;
revoke execute on function public.is_org_admin(uuid) from public, anon;
revoke execute on function public.is_org_member(uuid) from public, anon;
revoke execute on function public.org_peer_ids() from public, anon;
revoke execute on function public.user_org_ids() from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Fonctions SECURITY INVOKER : inutile pour un anonyme (RLS bloquerait de
-- toute façon), on réduit la surface.
revoke execute on function public.check_equipment_availability(uuid, timestamptz, timestamptz, integer, uuid) from public, anon;
revoke execute on function public.list_equipment_availability(uuid, timestamptz, timestamptz) from public, anon;
revoke execute on function public.create_booking(uuid, uuid, timestamptz, timestamptz, integer, jsonb, numeric, numeric, numeric, numeric, numeric, public.booking_status, text) from public, anon;
revoke execute on function public.update_booking_details(uuid, uuid, timestamptz, timestamptz, integer, jsonb, numeric, numeric, numeric, numeric, numeric, text) from public, anon;
