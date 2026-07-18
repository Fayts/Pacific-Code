-- Index couvrant sur la FK created_by d'import_sessions (même logique que
-- la migration advisor_fixes : les suppressions dans auth.users ne doivent
-- pas déclencher de scan séquentiel).

create index idx_import_sessions_created_by
  on public.import_sessions (created_by);
