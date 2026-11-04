-- ================================================================
-- MONEXITY — Aceptación de Términos de uso y Política de privacidad
-- Estado desplegado en Monexi (mnwzltvkwfxlpxuwshfo), incluida la migración
-- legal_acceptances_allow_user_cascade_and_checks.
-- Registro auditable (append-only) asociado a auth.users.id.
-- No modifica profiles, companies, memberships ni políticas existentes.
-- Usuarios existentes no requieren backfill: el dashboard les pide aceptar
-- las versiones vigentes en su próximo acceso (app/dashboard/layout.tsx).
-- Idempotente. RLS activo.
-- ================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_legal_acceptances (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version   text        NOT NULL,
  privacy_version text        NOT NULL,
  -- Momento en que el usuario aceptó (firmado por el servidor en el registro)
  accepted_at     timestamptz NOT NULL DEFAULT now(),
  -- Momento en que se persistió
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  -- Una aceptación por usuario y par de versiones: reintentos no duplican.
  -- Al publicar nuevas versiones se registra una fila nueva (historial completo).
  CONSTRAINT user_legal_acceptances_unique_version
    UNIQUE (user_id, terms_version, privacy_version)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_legal_acceptances'::regclass AND conname = 'user_legal_acceptances_terms_version_check') THEN
    ALTER TABLE public.user_legal_acceptances
      ADD CONSTRAINT user_legal_acceptances_terms_version_check CHECK (length(btrim(terms_version)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_legal_acceptances'::regclass AND conname = 'user_legal_acceptances_privacy_version_check') THEN
    ALTER TABLE public.user_legal_acceptances
      ADD CONSTRAINT user_legal_acceptances_privacy_version_check CHECK (length(btrim(privacy_version)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_legal_acceptances'::regclass AND conname = 'user_legal_acceptances_accepted_before_recorded_check') THEN
    ALTER TABLE public.user_legal_acceptances
      ADD CONSTRAINT user_legal_acceptances_accepted_before_recorded_check CHECK (accepted_at <= recorded_at + interval '5 minutes');
  END IF;
END $$;

COMMENT ON TABLE public.user_legal_acceptances IS
  'Aceptación auditable de Términos de uso y Política de privacidad. Solo inserción server-side.';

ALTER TABLE public.user_legal_acceptances ENABLE ROW LEVEL SECURITY;

-- Lectura: cada usuario solo ve sus propias aceptaciones
DROP POLICY IF EXISTS user_legal_acceptances_select_own ON public.user_legal_acceptances;
CREATE POLICY user_legal_acceptances_select_own
  ON public.user_legal_acceptances
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Sin políticas de INSERT/UPDATE/DELETE: el cliente no puede escribir.
-- Supabase otorga por defecto todos los privilegios a tablas nuevas: se revocan
-- todos y se conceden solo los mínimos. service_role no recibe UPDATE ni DELETE:
-- el upsert del servidor usa ON CONFLICT DO NOTHING.
REVOKE ALL ON public.user_legal_acceptances FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.user_legal_acceptances TO authenticated;
GRANT SELECT, INSERT ON public.user_legal_acceptances TO service_role;

-- Append-only: una aceptación registrada no se modifica (incluido service_role).
-- El trigger cubre solo UPDATE: el DELETE ya está vetado por privilegios y el único
-- borrado posible es el ON DELETE CASCADE al eliminar el usuario de auth.users
-- (rollback del onboarding y eliminación de cuenta), que corre con privilegios
-- del dueño de la tabla y no debe bloquearse.
CREATE OR REPLACE FUNCTION public.prevent_legal_acceptance_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
begin
  raise exception 'Legal acceptances are immutable.';
end;
$$;

CREATE OR REPLACE TRIGGER user_legal_acceptances_immutable
  BEFORE UPDATE ON public.user_legal_acceptances
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_legal_acceptance_mutation();

REVOKE ALL ON FUNCTION public.prevent_legal_acceptance_mutation() FROM PUBLIC, anon, authenticated;

COMMIT;

-- Verificación:
-- SELECT relrowsecurity FROM pg_class WHERE oid = 'public.user_legal_acceptances'::regclass;
--
-- SELECT policyname, cmd, roles, qual FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'user_legal_acceptances';
--
-- Privilegios esperados: authenticated = SELECT; service_role = INSERT, SELECT;
-- PUBLIC/anon sin privilegios; nadie con UPDATE, DELETE ni TRUNCATE.
-- SELECT grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public' AND table_name = 'user_legal_acceptances'
-- GROUP BY grantee ORDER BY grantee;
--
-- Trigger esperado: BEFORE UPDATE (no DELETE).
-- SELECT pg_get_triggerdef(oid) FROM pg_trigger
-- WHERE tgrelid = 'public.user_legal_acceptances'::regclass AND NOT tgisinternal;
