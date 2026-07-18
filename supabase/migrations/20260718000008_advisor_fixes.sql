-- Corrections issues des advisors Supabase (audit du 18/07/2026).
-- 1. Index couvrants sur les clés étrangères d'audit (created_by / user_id /
--    changed_by) : sans index, chaque suppression dans auth.users force un
--    scan séquentiel de ces tables.
-- 2. purge_stale_import_sessions est une tâche de maintenance (pg_cron) :
--    aucun rôle applicatif ne doit pouvoir la déclencher via PostgREST.

create index idx_activity_logs_user
  on public.activity_logs (user_id);
create index idx_booking_status_history_changed_by
  on public.booking_status_history (changed_by);
create index idx_bookings_created_by
  on public.bookings (created_by);
create index idx_customers_created_by
  on public.customers (created_by);
create index idx_equipment_items_created_by
  on public.equipment_items (created_by);
create index idx_maintenance_records_created_by
  on public.maintenance_records (created_by);
create index idx_organizations_created_by
  on public.organizations (created_by);

revoke execute on function public.purge_stale_import_sessions()
  from public, anon, authenticated;
