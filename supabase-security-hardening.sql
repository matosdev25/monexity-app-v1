-- ================================================================
-- MONEXITY — Endurecimiento de seguridad (fase 1: RPC de pagos y companies)
-- Ejecutar en Supabase SQL Editor DESPUÉS de:
--   supabase-payments.sql, supabase-paguelofacil.sql, supabase-discount-codes.sql
-- Idempotente: puede re-ejecutarse. No borra datos ni desactiva RLS.
--
-- 1. RPC administrativas solo para service_role.
-- 2. RPC de creación de intents: rechaza sesión nula; sin acceso anon.
-- 3. expire_stale_intents: bloqueo SKIP LOCKED válido y transaccional.
-- 4. companies: clientes normales solo pueden escribir columnas del negocio;
--    suscripción, trial, bloqueo y propiedad quedan solo para service_role.
-- ================================================================

BEGIN;

-- ── 1. RPC administrativas: solo service_role ────────────────────
-- Omitir GRANT no basta: PUBLIC (y en Supabase anon/authenticated por
-- default privileges) reciben EXECUTE automáticamente.

REVOKE EXECUTE ON FUNCTION public.activate_subscription_from_intent(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.activate_subscription_from_intent(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.increment_discount_code_usage(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.increment_discount_code_usage(uuid) TO service_role;

-- ── 2. RPC de creación de intents ────────────────────────────────
-- NOTA: create_payment_intent fue reemplazada por supabase-billing-phase0.sql
-- (persiste period_start/period_end). No re-ejecutar esta definición después.

CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_company_id    uuid,
  p_user_id       uuid,
  p_plan_id       text,
  p_billing_cycle text,
  p_expires_at    timestamptz
) RETURNS TABLE (
  intent_id    uuid,
  exact_amount numeric,
  slot_id      uuid,
  is_existing  boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intent_id  uuid;
  v_amount     numeric;
  v_slot_id    uuid;
BEGIN
  -- Verificar que el caller es el usuario declarado (sin sesión = rechazado)
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- Verificar membresía
  IF NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = p_user_id AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- Buscar intento activo existente (idempotencia)
  SELECT pi.id, pi.exact_amount, pi.slot_id
  INTO v_intent_id, v_amount, v_slot_id
  FROM payment_intents pi
  WHERE pi.company_id = p_company_id
    AND pi.plan_id = p_plan_id
    AND pi.billing_cycle = p_billing_cycle
    AND pi.status IN ('pending', 'claimed', 'awaiting_verification')
    AND pi.expires_at > NOW()
  ORDER BY pi.created_at DESC
  LIMIT 1;

  IF v_intent_id IS NOT NULL THEN
    RETURN QUERY SELECT v_intent_id, v_amount, v_slot_id, true;
    RETURN;
  END IF;

  -- Reservar slot (atómico — SKIP LOCKED evita colisiones en concurrencia)
  SELECT s.id, s.exact_amount
  INTO v_slot_id, v_amount
  FROM payment_amount_slots s
  WHERE s.plan_id = p_plan_id
    AND s.billing_cycle = p_billing_cycle
    AND s.reserved_by IS NULL
  ORDER BY s.offset_index
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_slot_id IS NULL THEN
    RAISE EXCEPTION 'NO_SLOTS_AVAILABLE';
  END IF;

  INSERT INTO payment_intents (
    company_id, user_id, plan_id, billing_cycle,
    slot_id, exact_amount, expires_at
  ) VALUES (
    p_company_id, p_user_id, p_plan_id, p_billing_cycle,
    v_slot_id, v_amount, p_expires_at
  )
  RETURNING id INTO v_intent_id;

  UPDATE payment_amount_slots SET
    reserved_by     = v_intent_id,
    reserved_at     = NOW(),
    slot_expires_at = p_expires_at + INTERVAL '2 hours'
  WHERE id = v_slot_id;

  INSERT INTO payment_audit_logs (intent_id, action, to_status, actor_type)
  VALUES (v_intent_id, 'created', 'pending', 'user');

  RETURN QUERY SELECT v_intent_id, v_amount, v_slot_id, false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_payment_intent(uuid, uuid, text, text, timestamptz) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_payment_intent(uuid, uuid, text, text, timestamptz) TO authenticated, service_role;

-- Firma desplegada en producción: 6 parámetros (payment_intents aún no tiene
-- intent_type). La versión de 7 parámetros vive en supabase-paguelofacil.sql,
-- que borra esta y ya incluye el mismo endurecimiento.
CREATE OR REPLACE FUNCTION public.create_paguelofacil_payment_intent(
  p_company_id    uuid,
  p_user_id       uuid,
  p_plan_id       text,
  p_billing_cycle text,
  p_exact_amount  numeric,
  p_expires_at    timestamptz
) RETURNS TABLE (
  intent_id   uuid,
  is_existing boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intent_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = p_user_id AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT pi.id
  INTO v_intent_id
  FROM payment_intents pi
  WHERE pi.company_id = p_company_id
    AND pi.plan_id = p_plan_id
    AND pi.billing_cycle = p_billing_cycle
    AND pi.exact_amount = p_exact_amount
    AND pi.provider = 'paguelofacil'
    AND pi.status IN ('pending', 'claimed', 'awaiting_verification')
    AND pi.expires_at > NOW()
  ORDER BY pi.created_at DESC
  LIMIT 1;

  IF v_intent_id IS NOT NULL THEN
    RETURN QUERY SELECT v_intent_id, true;
    RETURN;
  END IF;

  INSERT INTO payment_intents (
    company_id, user_id, plan_id, billing_cycle,
    exact_amount, provider, expires_at
  ) VALUES (
    p_company_id, p_user_id, p_plan_id, p_billing_cycle,
    p_exact_amount, 'paguelofacil', p_expires_at
  )
  RETURNING id INTO v_intent_id;

  INSERT INTO payment_audit_logs (intent_id, action, to_status, actor_type)
  VALUES (v_intent_id, 'created', 'pending', 'user');

  RETURN QUERY SELECT v_intent_id, false;
END;
$$;

-- Sin usos y sin intent_type (no distingue upgrade de renovación): inaccesible
-- para todos. Aplicado como payments_a1_disable_untyped_pf_intent_rpc
-- (ver supabase-payments-a1-a2.sql). El checkout real crea intents en
-- app/api/payments/create con intent_type.
REVOKE ALL ON FUNCTION public.create_paguelofacil_payment_intent(uuid, uuid, text, text, numeric, timestamptz) FROM PUBLIC, anon, authenticated, service_role;

-- ── 3. Expiración transaccional de intents ───────────────────────
-- Bloquea solo filas libres (SKIP LOCKED) sin agregados en el SELECT bloqueante,
-- expira, libera únicamente slots reservados por ese mismo intent y audita
-- el estado anterior real. Un fallo revierte todo.

CREATE OR REPLACE FUNCTION public.expire_stale_intents()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH locked AS (
    SELECT pi.id, pi.status AS old_status, pi.slot_id
    FROM payment_intents pi
    WHERE pi.status IN ('pending', 'claimed', 'awaiting_verification')
      AND pi.expires_at < NOW()
    FOR UPDATE SKIP LOCKED
  ),
  expired AS (
    UPDATE payment_intents pi
    SET status = 'expired', updated_at = NOW()
    FROM locked l
    WHERE pi.id = l.id
    RETURNING pi.id, l.old_status, l.slot_id
  ),
  released AS (
    UPDATE payment_amount_slots s
    SET reserved_by = NULL, reserved_at = NULL, slot_expires_at = NULL
    FROM expired e
    WHERE s.id = e.slot_id
      AND s.reserved_by = e.id
    RETURNING s.id
  ),
  audited AS (
    INSERT INTO payment_audit_logs (intent_id, action, from_status, to_status, actor_type)
    SELECT e.id, 'expired', e.old_status, 'expired', 'system'
    FROM expired e
    RETURNING id
  )
  SELECT count(*)::integer INTO v_count FROM expired;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_stale_intents() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.expire_stale_intents() TO service_role;

-- ── 4. companies: privilegios de escritura por columna ───────────
-- RLS sigue activo y decide QUÉ filas; los privilegios por columna deciden
-- QUÉ campos. Revocar a nivel tabla también elimina grants residuales por
-- columna. Las escrituras de suscripción/trial/bloqueo pasan por service_role
-- (createAdminClient) o por RPC SECURITY DEFINER.
-- Columnas nuevas futuras quedan NO editables hasta concederlas aquí.

-- Clientes: solo SELECT (filtrado por RLS) y UPDATE por columna (abajo).
-- DELETE/TRUNCATE/TRIGGER/REFERENCES nunca: TRUNCATE no pasa por RLS.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.companies FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_cols text;
BEGIN
  SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
  INTO v_cols
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'companies'
    AND c.column_name IN (
      'name',
      'contact_footer',
      'logo_url',
      'needs_inventory',
      'next_invoice_number',
      'invoice_ruc',
      'invoice_dv',
      'invoice_address',
      'invoice_email',
      'invoice_phone'
    );

  IF v_cols IS NOT NULL THEN
    EXECUTE format('GRANT UPDATE (%s) ON public.companies TO authenticated', v_cols);
  END IF;
END $$;

-- Protegidas (solo service_role): id, created_at, owner_user_id,
-- subscription_status, subscription_plan, subscription_billing_cycle,
-- trial_starts_at, trial_ends_at, current_period_starts_at,
-- current_period_ends_at, is_blocked, blocked_reason,
-- scheduled_subscription_plan, scheduled_subscription_billing_cycle,
-- scheduled_subscription_change_at, subscription_cancel_at_period_end,
-- subscription_cancelled_at. INSERT/upsert de companies: solo service_role.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO service_role;

COMMIT;

-- ── Verificación (ejecutar aparte, solo lectura) ─────────────────
-- Debe devolver false para anon/authenticated y true para service_role:
--
-- SELECT r.rolname, p.proname,
--        has_function_privilege(r.rolname, p.oid, 'EXECUTE') AS can_execute
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
-- CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(rolname)
-- WHERE p.proname IN (
--   'activate_subscription_from_intent', 'expire_stale_intents',
--   'increment_discount_code_usage', 'create_payment_intent',
--   'create_paguelofacil_payment_intent'
-- )
-- ORDER BY p.proname, r.rolname;
--
-- Columnas editables por authenticated en companies:
--
-- SELECT column_name, privilege_type
-- FROM information_schema.column_privileges
-- WHERE table_schema = 'public' AND table_name = 'companies'
--   AND grantee = 'authenticated' AND privilege_type IN ('INSERT', 'UPDATE')
-- ORDER BY column_name;
