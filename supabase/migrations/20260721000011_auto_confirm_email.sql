-- Confirmation d'email AUTOMATIQUE (choix assumé pour le pilote) :
-- chaque nouveau compte est confirmé à la création, la connexion
-- fonctionne immédiatement sans cliquer le lien reçu par email.
--
-- Pour réactiver la confirmation réelle (lancement public) :
--   drop trigger if exists trg_auto_confirm_email on auth.users;
--   drop function if exists public.auto_confirm_email();

create or replace function public.auto_confirm_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  return new;
end;
$$;

revoke execute on function public.auto_confirm_email() from public, anon, authenticated;

create trigger trg_auto_confirm_email
  before insert on auth.users
  for each row execute function public.auto_confirm_email();
