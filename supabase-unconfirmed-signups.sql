-- ================================================================
-- MONEXITY — Limpieza de registros no confirmados
-- Aplicada en Monexi como list_stale_unconfirmed_users.
--
-- El registro crea usuario, perfil, aceptación legal (y el negocio si se
-- completa el onboarding) antes de confirmar el correo. Esta función lista las
-- cuentas que nunca confirmaron el correo ni iniciaron sesión pasado el plazo
-- (7 días, UNCONFIRMED_SIGNUP_RETENTION_DAYS). La eliminación la hace
-- /api/cron/purge-unconfirmed-signups con la API de Auth: la cascada borra
-- profiles, memberships, user_legal_acceptances y companies (owner_user_id).
-- Solo lectura; solo service_role.
-- ================================================================

CREATE OR REPLACE FUNCTION public.list_stale_unconfirmed_users(
  p_older_than interval DEFAULT interval '7 days',
  p_limit integer DEFAULT 100
) RETURNS TABLE (user_id uuid, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public, pg_temp
AS $$
  SELECT u.id, u.created_at
  FROM auth.users u
  WHERE u.email_confirmed_at IS NULL
    AND u.phone_confirmed_at IS NULL
    AND u.last_sign_in_at IS NULL
    AND coalesce(u.is_sso_user, false) = false
    AND u.created_at < now() - greatest(p_older_than, interval '1 day')
  ORDER BY u.created_at
  LIMIT least(greatest(coalesce(p_limit, 100), 1), 500);
$$;

REVOKE ALL ON FUNCTION public.list_stale_unconfirmed_users(interval, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_stale_unconfirmed_users(interval, integer) TO service_role;
