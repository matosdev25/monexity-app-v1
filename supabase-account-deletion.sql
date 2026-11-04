-- ================================================================
-- MONEXITY — Eliminación de cuenta y datos
--
-- PARTE A (aplicada en Monexi como account_deletion_requests_and_retention):
--   * account_deletion_requests: trazabilidad y reintentos (solo service_role).
--   * billing_retained_charges: registro mínimo de cobros PAGADOS a Monexity de
--     empresas eliminadas (sin company_id, user_id ni payloads). Es SEUDÓNIMO, no
--     anónimo: provider_transaction_id permite rastrear el cobro en el proveedor.
--     Plazo de conservación: 7 años desde paid_at (o retained_at); ver PARTES D y E.
--   * account_deletion_author_fks_ready(): diagnóstico de solo lectura.
--
-- PARTE B (aplicada en Monexi como account_deletion_author_set_null):
--   Las FK de autoría de sales/expenses borraban en cascada y otras bloqueaban:
--   eliminar a un vendedor/admin destruía ventas y gastos de la empresa de otro.
--   Ahora son ON DELETE SET NULL (anonimización de autoría). Si la parte B no
--   estuviera aplicada, la app bloquea la eliminación de cuentas con autoría
--   en empresas ajenas (account_deletion_author_fks_ready()).
-- ================================================================

-- ── PARTE A ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL,
  status            text        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'failed', 'completed')),
  owned_company_ids uuid[]      NOT NULL DEFAULT '{}',
  step              text,
  error             text,
  requested_at      timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz
);

CREATE INDEX IF NOT EXISTS account_deletion_requests_user_idx
  ON public.account_deletion_requests (user_id, requested_at DESC);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletion_requests FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.account_deletion_requests TO service_role;

CREATE TABLE IF NOT EXISTS public.billing_retained_charges (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_intent_id        uuid        NOT NULL UNIQUE,
  provider                text        NOT NULL,
  provider_transaction_id text,
  plan_id                 text,
  billing_cycle           text,
  amount                  numeric(10,2) NOT NULL,
  currency                text        NOT NULL DEFAULT 'USD',
  paid_at                 timestamptz,
  period_start            timestamptz,
  period_end              timestamptz,
  reason                  text        NOT NULL DEFAULT 'account_deletion',
  retained_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_retained_charges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_retained_charges FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.billing_retained_charges TO service_role;

CREATE OR REPLACE FUNCTION public.account_deletion_author_fks_ready()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
      AND (c.conrelid::regclass::text, a.attname) IN (
        ('sales', 'created_by'),
        ('expenses', 'created_by'),
        ('period_closure_exports', 'generated_by')
      )
      AND c.confdeltype <> 'n'
  );
$$;

REVOKE ALL ON FUNCTION public.account_deletion_author_fks_ready() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_deletion_author_fks_ready() TO service_role;

-- ── PARTE B ──────────────────────────────────────────────────────
-- Ejecutar como migración account_deletion_author_set_null.
-- No borra datos: solo cambia qué ocurre con la autoría al eliminar un usuario.

BEGIN;

ALTER TABLE public.sales    ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.expenses ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.period_closure_exports ALTER COLUMN generated_by DROP NOT NULL;

DO $$
DECLARE
  v_ref record;
BEGIN
  FOR v_ref IN
    SELECT c.conname, c.conrelid::regclass::text AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
      AND c.confdeltype <> 'n'
      AND (c.conrelid::regclass::text, a.attname) IN (
        ('sales', 'created_by'),
        ('expenses', 'created_by'),
        ('period_closure_exports', 'generated_by'),
        ('period_closures', 'closed_by'),
        ('period_closures', 'reopened_by'),
        ('period_closure_issues', 'ignored_by'),
        ('period_closure_issues', 'resolved_by'),
        ('quotes', 'created_by')
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_ref.tbl, v_ref.conname);
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE SET NULL',
      v_ref.tbl, v_ref.conname, v_ref.col
    );
  END LOOP;
END $$;

COMMIT;

-- Verificación (debe devolver true tras la parte B):
-- SELECT public.account_deletion_author_fks_ready();

-- ── PARTE C (aplicada en Monexi como account_deletion_release_storage_ownership) ─
-- Archivos subidos por el usuario en negocios ajenos pertenecen a esos negocios:
-- no se borran, solo se anula owner/owner_id (las políticas de company-assets
-- dependen de memberships, no de owner). Supabase Auth no elimina usuarios que
-- aún sean dueños de objetos de Storage.

CREATE OR REPLACE FUNCTION public.release_user_storage_ownership(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = storage, public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario requerido.' USING ERRCODE = '22023';
  END IF;

  UPDATE storage.objects
  SET owner = NULL,
      owner_id = NULL
  WHERE owner = p_user_id
     OR owner_id = p_user_id::text;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.count_user_storage_objects(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = storage, public, pg_temp
AS $$
  SELECT count(*)::integer
  FROM storage.objects
  WHERE owner = p_user_id
     OR owner_id = p_user_id::text;
$$;

REVOKE ALL ON FUNCTION public.release_user_storage_ownership(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.count_user_storage_objects(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_user_storage_ownership(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.count_user_storage_objects(uuid) TO service_role;

-- ── PARTE D (aplicada en Monexi como account_deletion_privacy_retention) ─────
-- * Al completar, la app anonimiza TODAS las solicitudes del usuario:
--   user_id, owned_company_ids, error y step quedan vacíos (solo estado y fechas).
-- * billing_retained_charges.retain_until: fecha de depuración (la fija la PARTE E).
--   /api/cron/expire-intents llama purge_expired_billing_retained_charges().
-- * La app libera payment_amount_slots (reserved_by no tiene FK) y descuentos
--   reservados antes de borrar la empresa. Abajo, limpieza única de huérfanos.

ALTER TABLE public.account_deletion_requests ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.billing_retained_charges ADD COLUMN IF NOT EXISTS retain_until timestamptz;
COMMENT ON COLUMN public.billing_retained_charges.retain_until IS
  'Fecha de depuración. NULL mientras el plazo de conservación contable/fiscal no esté definido por asesoría profesional.';
COMMENT ON COLUMN public.billing_retained_charges.provider_transaction_id IS
  'Referencia del proveedor para conciliación contable. Seudónimo, no anónimo: permite rastrear el cobro en el proveedor.';

CREATE OR REPLACE FUNCTION public.purge_expired_billing_retained_charges()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.billing_retained_charges
  WHERE retain_until IS NOT NULL
    AND retain_until <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_billing_retained_charges() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_billing_retained_charges() TO service_role;

UPDATE public.payment_amount_slots s
SET reserved_by = NULL, reserved_at = NULL, slot_expires_at = NULL
WHERE s.reserved_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.payment_intents pi WHERE pi.id = s.reserved_by);

-- ── PARTE E (aplicada en Monexi como billing_retained_charges_retain_7_years) ─
-- Plazo de conservación: retain_until = coalesce(paid_at, retained_at) + 7 años.
-- El trigger lo impone en cada inserción (ignora cualquier valor enviado).

CREATE OR REPLACE FUNCTION public.set_billing_retained_charge_retain_until()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.retain_until := coalesce(NEW.paid_at, NEW.retained_at, now()) + interval '7 years';
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_billing_retained_charge_retain_until() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER billing_retained_charges_set_retain_until
  BEFORE INSERT ON public.billing_retained_charges
  FOR EACH ROW EXECUTE FUNCTION public.set_billing_retained_charge_retain_until();

UPDATE public.billing_retained_charges
SET retain_until = coalesce(paid_at, retained_at) + interval '7 years'
WHERE retain_until IS DISTINCT FROM coalesce(paid_at, retained_at) + interval '7 years';

COMMENT ON COLUMN public.billing_retained_charges.retain_until IS
  'Fecha de depuración: coalesce(paid_at, retained_at) + 7 años. La fija el trigger billing_retained_charges_set_retain_until en cada inserción.';
