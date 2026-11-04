-- ================================================================
-- MONEXITY — Pagos A1 (intent_type) y A2 (retorno de PagueloFácil)
-- Aplicado en Monexi (mnwzltvkwfxlpxuwshfo) como migración
-- payments_a1_a2_intent_type_and_pf_confirmation.
-- Idempotente. Solo aditivo: no borra datos ni desactiva RLS.
--
-- A1: intent_type persistido; activate_subscription_from_intent distingue
--     renovación (extiende período) de plan_upgrade (solo cambia plan).
--     Toma de supabase-paguelofacil.sql solo las columnas que esa RPC usa.
--     Intents previos: pagados se conservan; abiertos se clasifican por
--     evidencia al final de este archivo (ambiguos -> manual_review).
-- A2: confirm_paguelofacil_payment confirma de forma atómica e idempotente.
--     El vínculo transacción↔intent se verifica antes en el servidor con la
--     API autenticada del proveedor (urlString = URL de retorno del intent).
-- Las nuevas columnas de companies no se conceden a authenticated (C2).
-- ================================================================

BEGIN;

-- A1: tipo de intent
ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS intent_type text NOT NULL DEFAULT 'subscription_payment';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payment_intents'::regclass
      AND conname = 'payment_intents_intent_type_check'
  ) THEN
    ALTER TABLE public.payment_intents
      ADD CONSTRAINT payment_intents_intent_type_check
      CHECK (intent_type IN ('subscription_payment', 'plan_upgrade'));
  END IF;
END $$;

-- Columnas que la RPC versionada de activación escribe (supabase-paguelofacil.sql)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS scheduled_subscription_plan text,
  ADD COLUMN IF NOT EXISTS scheduled_subscription_billing_cycle text
    CHECK (scheduled_subscription_billing_cycle IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS scheduled_subscription_change_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_cancelled_at timestamptz;

-- A1: renovación extiende período; plan_upgrade solo cambia plan y conserva fechas
-- NOTA: esta versión fue reemplazada por supabase-billing-phase0.sql
-- (período exacto del intent, bloqueo intent → empresa, descuento en transacción).
-- No re-ejecutar esta sección después de la Fase 0.
CREATE OR REPLACE FUNCTION public.activate_subscription_from_intent(
  p_intent_id   uuid,
  p_admin_email text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intent       payment_intents%ROWTYPE;
  v_old_status   text;
  v_current_end  timestamptz;
  v_period_start timestamptz;
  v_period_end   timestamptz;
BEGIN
  SELECT * INTO v_intent
  FROM payment_intents WHERE id = p_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'INTENT_NOT_FOUND'; END IF;
  IF v_intent.status = 'paid' THEN RETURN; END IF;

  IF v_intent.status NOT IN ('pending', 'claimed', 'awaiting_verification', 'manual_review') THEN
    RAISE EXCEPTION 'INVALID_STATUS: %', v_intent.status;
  END IF;

  v_old_status := v_intent.status;

  UPDATE payment_intents SET
    status              = 'paid',
    verified_at         = NOW(),
    verified_by_email   = p_admin_email,
    updated_at          = NOW()
  WHERE id = p_intent_id;

  IF v_intent.intent_type = 'plan_upgrade' THEN
    UPDATE companies SET
      subscription_plan                      = v_intent.plan_id,
      scheduled_subscription_plan            = NULL,
      scheduled_subscription_billing_cycle   = NULL,
      scheduled_subscription_change_at       = NULL
    WHERE id = v_intent.company_id;
  ELSE
    SELECT current_period_ends_at INTO v_current_end
    FROM companies WHERE id = v_intent.company_id;

    IF v_current_end IS NOT NULL AND v_current_end > NOW() THEN
      v_period_start := v_current_end;
    ELSE
      v_period_start := NOW();
    END IF;

    IF v_intent.billing_cycle = 'annual' THEN
      v_period_end := v_period_start + INTERVAL '365 days';
    ELSE
      v_period_end := v_period_start + INTERVAL '30 days';
    END IF;

    UPDATE companies SET
      subscription_status                    = 'active',
      subscription_plan                      = v_intent.plan_id,
      subscription_billing_cycle             = v_intent.billing_cycle,
      current_period_starts_at               = v_period_start,
      current_period_ends_at                 = v_period_end,
      scheduled_subscription_plan            = NULL,
      scheduled_subscription_billing_cycle   = NULL,
      scheduled_subscription_change_at       = NULL,
      subscription_cancel_at_period_end      = false,
      subscription_cancelled_at              = NULL
    WHERE id = v_intent.company_id;
  END IF;

  UPDATE payment_amount_slots SET
    reserved_by = NULL, reserved_at = NULL, slot_expires_at = NULL
  WHERE id = v_intent.slot_id;

  INSERT INTO payment_audit_logs (intent_id, action, from_status, to_status, actor_type, metadata)
  VALUES
    (p_intent_id, 'verified', v_old_status, 'paid', 'admin',
      jsonb_build_object('admin_email', p_admin_email)),
    (p_intent_id, 'subscription_activated', NULL, 'active', 'admin',
      jsonb_build_object(
        'intent_type', v_intent.intent_type,
        'period_start', v_period_start,
        'period_end', v_period_end
      ));
END;
$$;

REVOKE ALL ON FUNCTION public.activate_subscription_from_intent(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_subscription_from_intent(uuid, text) TO service_role;

-- A2: confirmación atómica e idempotente del retorno de PagueloFácil.
-- NOTA: reemplazada por la versión vigente en supabase-billing-phase0.sql
-- (libera descuento si no se aprueba; período cubierto → 'needs_review').
-- El servidor verifica antes el vínculo transacción↔intent con la API del proveedor.
CREATE OR REPLACE FUNCTION public.confirm_paguelofacil_payment(
  p_intent_id      uuid,
  p_transaction_id text,
  p_raw_response   jsonb,
  p_approved       boolean
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_intent public.payment_intents%ROWTYPE;
BEGIN
  IF p_intent_id IS NULL OR coalesce(btrim(p_transaction_id), '') = '' THEN
    RETURN 'invalid';
  END IF;

  -- Serializa retornos concurrentes del mismo intent
  SELECT * INTO v_intent
  FROM public.payment_intents
  WHERE id = p_intent_id
  FOR UPDATE;

  IF NOT FOUND OR v_intent.provider <> 'paguelofacil' THEN
    RETURN 'not_found';
  END IF;

  -- Idempotente: un intent pagado nunca retrocede
  IF v_intent.status = 'paid' THEN
    RETURN CASE
      WHEN v_intent.provider_transaction_id = p_transaction_id THEN 'already_paid'
      ELSE 'paid_other_transaction'
    END;
  END IF;

  IF v_intent.status NOT IN ('pending', 'claimed', 'awaiting_verification') THEN
    RETURN 'invalid_status';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payment_intents o
    WHERE o.provider = 'paguelofacil'
      AND o.provider_transaction_id = p_transaction_id
      AND o.id <> p_intent_id
  ) THEN
    RETURN 'transaction_used';
  END IF;

  IF NOT coalesce(p_approved, false) THEN
    UPDATE public.payment_intents
    SET status = 'failed',
        raw_response = coalesce(p_raw_response, raw_response),
        updated_at = NOW()
    WHERE id = p_intent_id;

    INSERT INTO public.payment_audit_logs (intent_id, action, from_status, to_status, actor_type, metadata)
    VALUES (p_intent_id, 'provider_not_approved', v_intent.status, 'failed', 'system',
            jsonb_build_object('provider_transaction_id', p_transaction_id));

    RETURN 'not_approved';
  END IF;

  -- provider_reference (código del checkout) se conserva
  UPDATE public.payment_intents
  SET provider_transaction_id = p_transaction_id,
      raw_response = coalesce(p_raw_response, raw_response),
      updated_at = NOW()
  WHERE id = p_intent_id;

  PERFORM public.activate_subscription_from_intent(p_intent_id, 'paguelofacil-return');

  RETURN 'activated';
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_paguelofacil_payment(uuid, text, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_paguelofacil_payment(uuid, text, jsonb, boolean) TO service_role;

COMMIT;

-- ── A1: RPC desplegada sin intent_type ───────────────────────────
-- Aplicado como payments_a1_disable_untyped_pf_intent_rpc.
-- create_paguelofacil_payment_intent (6 parámetros) crea intents sin tipo y
-- reutiliza existentes sin filtrar por tipo. Sin usos ni dependencias; su DROP
-- requiere aprobación manual, así que queda sin EXECUTE para nadie.
-- Entradas habilitadas restantes: app/api/payments/create (con intent_type),
-- Yappy manual y create_payment_intent (solo precio completo = renovación).

REVOKE ALL ON FUNCTION public.create_paguelofacil_payment_intent(uuid, uuid, text, text, numeric, timestamptz) FROM PUBLIC, anon, authenticated, service_role;

-- ── A1: intents abiertos creados antes de intent_type ────────────
-- Aplicado como payments_a1_classify_legacy_intents (afectó 0 filas: el único
-- intent abierto era $8.99 = precio completo de Control mensual).
-- Evidencia: un pago normal cobra el precio completo del plan/ciclo menos su
-- descuento; un upgrade cobra la diferencia (5/6/11 mensual, 50/60/110 anual),
-- que nunca coincide con un precio completo. Si el monto no coincide, el tipo
-- es ambiguo: pasa a manual_review y el retorno no lo activa automáticamente.
-- Precios según lib/plans/plans.ts. El historial pagado no se toca.
-- Corte: hora de la migración payments_a1_a2_intent_type_and_pf_confirmation.

WITH prices(plan_id, billing_cycle, price) AS (
  VALUES ('emprende','monthly',3.99::numeric), ('emprende','annual',39.99),
         ('control','monthly',8.99), ('control','annual',89.99),
         ('equipo','monthly',14.99), ('equipo','annual',149.99)
), ambiguous AS (
  SELECT pi.id, pi.status
  FROM public.payment_intents pi
  LEFT JOIN prices p ON p.plan_id = pi.plan_id AND p.billing_cycle = pi.billing_cycle
  WHERE pi.provider = 'paguelofacil'
    AND pi.status IN ('pending', 'claimed', 'awaiting_verification')
    AND pi.created_at < '2026-10-24 18:11:24+00'
    AND (p.price IS NULL OR round(p.price - coalesce(pi.discount_amount, 0), 2) <> pi.exact_amount)
), flagged AS (
  UPDATE public.payment_intents pi SET status = 'manual_review', updated_at = now()
  FROM ambiguous a WHERE pi.id = a.id
  RETURNING pi.id, a.status AS old_status
)
INSERT INTO public.payment_audit_logs (intent_id, action, from_status, to_status, actor_type, metadata)
SELECT id, 'legacy_intent_type_ambiguous', old_status, 'manual_review', 'system',
       jsonb_build_object('reason', 'monto no coincide con precio completo; posible upgrade previo a intent_type')
FROM flagged;
