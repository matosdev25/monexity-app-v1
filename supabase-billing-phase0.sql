-- ================================================================
-- MONEXITY — Billing Fase 0 (independiente del proveedor)
-- Aplicado en Monexi (mnwzltvkwfxlpxuwshfo) como migraciones:
--   billing_phase0_exact_period_atomic_admin_discount
--   billing_phase0_discount_only_when_credited
--   billing_phase0_period_compat_open_intents
--   billing_phase0_discount_respects_max_uses
--   billing_phase0_discount_reservation_and_covered_review
--   billing_phase0_pf_review_idempotent
--   billing_phase0_full_period_overlap_check
-- Reemplaza activate_subscription_from_intent y confirm_paguelofacil_payment
-- de supabase-payments-a1-a2.sql, expire_stale_intents y create_payment_intent
-- de supabase-security-hardening.sql.
-- Aditivo: no borra datos ni desactiva RLS.
--
-- VERSIÓN VIGENTE: la sección final "Reserva de descuento y período cubierto"
-- reemplaza las definiciones anteriores de este archivo de
-- activate_subscription_from_intent y admin_resolve_payment_intent.
--
-- 1. payment_intents.period_start / period_end: período a acreditar,
--    calculado y guardado al crear el intent (app). La activación ya no
--    calcula 30/365 días por su cuenta.
-- 2. activate_subscription_from_intent: bloquea intent → empresa → código,
--    acredita exactamente el período guardado y nunca retrocede fechas.
--    Solo acredita un período que empieza al terminar el vigente o después;
--    cualquier solapamiento del período completo deja el pago registrado en
--    manual_review, sin acreditar (conciliación explícita), nunca "aprobado".
-- 3. Descuento: se reserva ANTES del cobro (reserve_intent_discount) y se libera
--    si el cobro se rechaza, no se aprueba o vence. La activación nunca aborta
--    por el descuento después de un pago capturado.
-- 4. admin_resolve_payment_intent: approve/reject atómico e idempotente; un
--    reject nunca sobrescribe un paid; período cubierto → 'period_already_covered'.
-- 5. confirm_paguelofacil_payment: período cubierto → 'needs_review'
--    (idempotente en reintentos con la misma transacción).
-- ================================================================

BEGIN;

ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS period_start timestamptz,
  ADD COLUMN IF NOT EXISTS period_end   timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payment_intents'::regclass
      AND conname = 'payment_intents_period_range_check'
  ) THEN
    ALTER TABLE public.payment_intents
      ADD CONSTRAINT payment_intents_period_range_check
      CHECK (period_start IS NULL OR period_end IS NULL OR period_end > period_start);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.activate_subscription_from_intent(
  p_intent_id   uuid,
  p_admin_email text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_intent      public.payment_intents%ROWTYPE;
  v_company     public.companies%ROWTYPE;
  v_old_status  text;
  v_credited    boolean := false;
BEGIN
  -- Orden de bloqueo: intent → empresa (igual que confirm_paguelofacil_payment)
  SELECT * INTO v_intent
  FROM public.payment_intents WHERE id = p_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'INTENT_NOT_FOUND'; END IF;
  IF v_intent.status = 'paid' THEN RETURN; END IF;

  IF v_intent.status NOT IN ('pending', 'claimed', 'awaiting_verification', 'manual_review') THEN
    RAISE EXCEPTION 'INVALID_STATUS: %', v_intent.status;
  END IF;

  SELECT * INTO v_company
  FROM public.companies WHERE id = v_intent.company_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'COMPANY_NOT_FOUND'; END IF;

  IF v_intent.intent_type <> 'plan_upgrade'
     AND (v_intent.period_start IS NULL OR v_intent.period_end IS NULL) THEN
    RAISE EXCEPTION 'PERIOD_NOT_SET';
  END IF;

  v_old_status := v_intent.status;

  UPDATE public.payment_intents SET
    status            = 'paid',
    verified_at       = NOW(),
    verified_by_email = p_admin_email,
    updated_at        = NOW()
  WHERE id = p_intent_id;

  IF v_intent.intent_type = 'plan_upgrade' THEN
    -- Sin cambios respecto al comportamiento vigente: solo cambia el plan.
    UPDATE public.companies SET
      subscription_plan                    = v_intent.plan_id,
      scheduled_subscription_plan          = NULL,
      scheduled_subscription_billing_cycle = NULL,
      scheduled_subscription_change_at     = NULL
    WHERE id = v_intent.company_id;
    v_credited := true;
  ELSIF v_company.current_period_ends_at IS NULL
        OR v_intent.period_end > v_company.current_period_ends_at THEN
    -- Acredita exactamente el período guardado en el intent.
    UPDATE public.companies SET
      subscription_status                  = 'active',
      subscription_plan                    = v_intent.plan_id,
      subscription_billing_cycle           = v_intent.billing_cycle,
      current_period_starts_at             = v_intent.period_start,
      current_period_ends_at               = v_intent.period_end,
      scheduled_subscription_plan          = NULL,
      scheduled_subscription_billing_cycle = NULL,
      scheduled_subscription_change_at     = NULL,
      subscription_cancel_at_period_end    = false,
      subscription_cancelled_at            = NULL
    WHERE id = v_intent.company_id;
    v_credited := true;
  END IF;

  -- Descuento: una sola vez (la activación es idempotente), en esta transacción
  -- y solo si el cobro acreditó. El incremento es condicional al límite: con
  -- concurrencia, el segundo UPDATE espera el bloqueo de la fila del código y
  -- reevalúa la condición; si ya no queda uso disponible, se aborta toda la
  -- activación (intent, empresa y auditoría se revierten).
  IF v_credited AND v_intent.discount_code_id IS NOT NULL THEN
    UPDATE public.discount_codes
    SET used_count = used_count + 1
    WHERE id = v_intent.discount_code_id
      AND (max_uses IS NULL OR used_count < max_uses);

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DISCOUNT_EXHAUSTED';
    END IF;
  END IF;

  UPDATE public.payment_amount_slots SET
    reserved_by = NULL, reserved_at = NULL, slot_expires_at = NULL
  WHERE id = v_intent.slot_id;

  INSERT INTO public.payment_audit_logs (intent_id, action, from_status, to_status, actor_type, metadata)
  VALUES
    (p_intent_id, 'verified', v_old_status, 'paid', 'admin',
      jsonb_build_object('admin_email', p_admin_email)),
    (p_intent_id,
      CASE WHEN v_credited THEN 'subscription_activated' ELSE 'period_already_covered' END,
      NULL, CASE WHEN v_credited THEN 'active' ELSE NULL END, 'admin',
      jsonb_build_object(
        'intent_type', v_intent.intent_type,
        'period_start', v_intent.period_start,
        'period_end', v_intent.period_end,
        'company_period_end_before', v_company.current_period_ends_at
      ));
END;
$$;

REVOKE ALL ON FUNCTION public.activate_subscription_from_intent(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_subscription_from_intent(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_resolve_payment_intent(
  p_intent_id   uuid,
  p_action      text,
  p_admin_email text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_intent public.payment_intents%ROWTYPE;
BEGIN
  IF p_action NOT IN ('approve', 'reject') THEN
    RETURN 'invalid_action';
  END IF;

  -- Mismo orden de bloqueo: intent → (empresa dentro de la activación)
  SELECT * INTO v_intent
  FROM public.payment_intents WHERE id = p_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_intent.provider NOT IN ('manual', 'yappy_manual') THEN RETURN 'not_manual'; END IF;

  -- Un intent pagado nunca se rechaza ni se acredita de nuevo
  IF v_intent.status = 'paid' THEN RETURN 'already_paid'; END IF;

  IF p_action = 'reject' THEN
    IF v_intent.status = 'failed' THEN RETURN 'already_rejected'; END IF;
    IF v_intent.status NOT IN ('pending', 'claimed', 'awaiting_verification', 'manual_review') THEN
      RETURN 'invalid_status';
    END IF;

    UPDATE public.payment_intents SET
      status            = 'failed',
      verified_at       = NOW(),
      verified_by_email = p_admin_email,
      updated_at        = NOW()
    WHERE id = p_intent_id;

    INSERT INTO public.payment_audit_logs (intent_id, action, from_status, to_status, actor_type, metadata)
    VALUES (p_intent_id, 'rejected', v_intent.status, 'failed', 'admin',
            jsonb_build_object('admin_email', p_admin_email));

    RETURN 'rejected';
  END IF;

  IF v_intent.status NOT IN ('pending', 'claimed', 'awaiting_verification', 'manual_review') THEN
    RETURN 'invalid_status';
  END IF;

  BEGIN
    PERFORM public.activate_subscription_from_intent(p_intent_id, p_admin_email);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'DISCOUNT_EXHAUSTED' THEN
      RETURN 'discount_exhausted';
    END IF;
    RAISE;
  END;

  RETURN 'approved';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_payment_intent(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_payment_intent(uuid, text, text) TO service_role;

-- ── Compatibilidad de intents abiertos previos a la Fase 0 ───────
-- Aplicado como billing_phase0_period_compat_open_intents (1 intent rellenado).
-- Misma regla vigente: fin del período actual si sigue activo; si no, ahora;
-- +30/365 días. Solo intents de período abiertos; nunca intents pagados.
WITH target AS (
  SELECT pi.id,
         CASE WHEN c.current_period_ends_at > now() THEN c.current_period_ends_at ELSE now() END AS p_start,
         pi.billing_cycle
  FROM public.payment_intents pi
  JOIN public.companies c ON c.id = pi.company_id
  WHERE pi.status IN ('pending', 'claimed', 'awaiting_verification', 'manual_review')
    AND pi.intent_type = 'subscription_payment'
    AND (pi.period_start IS NULL OR pi.period_end IS NULL)
), updated AS (
  UPDATE public.payment_intents pi
  SET period_start = t.p_start,
      period_end   = t.p_start + CASE WHEN t.billing_cycle = 'annual' THEN interval '365 days' ELSE interval '30 days' END,
      updated_at   = now()
  FROM target t
  WHERE pi.id = t.id
  RETURNING pi.id, pi.period_start, pi.period_end
)
INSERT INTO public.payment_audit_logs (intent_id, action, actor_type, metadata)
SELECT id, 'period_backfilled', 'system',
       jsonb_build_object('period_start', period_start, 'period_end', period_end)
FROM updated;

-- ── create_payment_intent persiste el período ────────────────────
-- Solo reutiliza intents con período; los nuevos lo guardan al crearse.
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
  v_intent_id    uuid;
  v_amount       numeric;
  v_slot_id      uuid;
  v_current_end  timestamptz;
  v_period_start timestamptz;
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

  SELECT pi.id, pi.exact_amount, pi.slot_id
  INTO v_intent_id, v_amount, v_slot_id
  FROM payment_intents pi
  WHERE pi.company_id = p_company_id
    AND pi.plan_id = p_plan_id
    AND pi.billing_cycle = p_billing_cycle
    AND pi.status IN ('pending', 'claimed', 'awaiting_verification')
    AND pi.expires_at > NOW()
    AND pi.period_start IS NOT NULL
    AND pi.period_end IS NOT NULL
  ORDER BY pi.created_at DESC
  LIMIT 1;

  IF v_intent_id IS NOT NULL THEN
    RETURN QUERY SELECT v_intent_id, v_amount, v_slot_id, true;
    RETURN;
  END IF;

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

  -- Período a acreditar (misma regla que getNextBillingPeriod en la app)
  SELECT current_period_ends_at INTO v_current_end FROM companies WHERE id = p_company_id;
  v_period_start := CASE WHEN v_current_end > NOW() THEN v_current_end ELSE NOW() END;

  INSERT INTO payment_intents (
    company_id, user_id, plan_id, billing_cycle,
    slot_id, exact_amount, expires_at, period_start, period_end
  ) VALUES (
    p_company_id, p_user_id, p_plan_id, p_billing_cycle,
    v_slot_id, v_amount, p_expires_at, v_period_start,
    v_period_start + CASE WHEN p_billing_cycle = 'annual' THEN INTERVAL '365 days' ELSE INTERVAL '30 days' END
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

REVOKE ALL ON FUNCTION public.create_payment_intent(uuid, uuid, text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_payment_intent(uuid, uuid, text, text, timestamptz) TO authenticated, service_role;

COMMIT;

-- ================================================================
-- Reserva de descuento y período cubierto (VERSIÓN VIGENTE)
-- Migraciones: billing_phase0_discount_reservation_and_covered_review
--              billing_phase0_pf_review_idempotent
-- ================================================================

BEGIN;

ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS discount_reserved_at timestamptz,
  ADD COLUMN IF NOT EXISTS discount_released_at timestamptz;

CREATE OR REPLACE FUNCTION public.reserve_intent_discount(p_intent_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_intent public.payment_intents%ROWTYPE;
BEGIN
  SELECT * INTO v_intent FROM public.payment_intents WHERE id = p_intent_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_intent.discount_code_id IS NULL THEN RETURN 'no_discount'; END IF;
  IF v_intent.discount_reserved_at IS NOT NULL AND v_intent.discount_released_at IS NULL THEN
    RETURN 'already_reserved';
  END IF;
  IF v_intent.status NOT IN ('pending', 'claimed', 'awaiting_verification', 'manual_review') THEN
    RETURN 'invalid_status';
  END IF;

  UPDATE public.discount_codes
  SET used_count = used_count + 1
  WHERE id = v_intent.discount_code_id
    AND (max_uses IS NULL OR used_count < max_uses);

  IF NOT FOUND THEN RETURN 'exhausted'; END IF;

  UPDATE public.payment_intents
  SET discount_reserved_at = NOW(), discount_released_at = NULL, updated_at = NOW()
  WHERE id = p_intent_id;

  INSERT INTO public.payment_audit_logs (intent_id, action, actor_type)
  VALUES (p_intent_id, 'discount_reserved', 'system');

  RETURN 'reserved';
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_intent_discount(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_intent_discount(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.release_intent_discount(p_intent_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code uuid;
BEGIN
  UPDATE public.payment_intents
  SET discount_released_at = NOW(), updated_at = NOW()
  WHERE id = p_intent_id
    AND discount_code_id IS NOT NULL
    AND discount_reserved_at IS NOT NULL
    AND discount_released_at IS NULL
  RETURNING discount_code_id INTO v_code;

  IF v_code IS NULL THEN RETURN; END IF;

  UPDATE public.discount_codes
  SET used_count = greatest(used_count - 1, 0)
  WHERE id = v_code;

  INSERT INTO public.payment_audit_logs (intent_id, action, actor_type)
  VALUES (p_intent_id, 'discount_released', 'system');
END;
$$;

REVOKE ALL ON FUNCTION public.release_intent_discount(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_intent_discount(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.activate_subscription_from_intent(
  p_intent_id   uuid,
  p_admin_email text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_intent      public.payment_intents%ROWTYPE;
  v_company     public.companies%ROWTYPE;
  v_old_status  text;
  v_credited    boolean := false;
BEGIN
  SELECT * INTO v_intent
  FROM public.payment_intents WHERE id = p_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'INTENT_NOT_FOUND'; END IF;
  IF v_intent.status = 'paid' THEN RETURN; END IF;

  IF v_intent.status NOT IN ('pending', 'claimed', 'awaiting_verification', 'manual_review') THEN
    RAISE EXCEPTION 'INVALID_STATUS: %', v_intent.status;
  END IF;

  SELECT * INTO v_company
  FROM public.companies WHERE id = v_intent.company_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'COMPANY_NOT_FOUND'; END IF;

  IF v_intent.intent_type <> 'plan_upgrade'
     AND (v_intent.period_start IS NULL OR v_intent.period_end IS NULL) THEN
    RAISE EXCEPTION 'PERIOD_NOT_SET';
  END IF;

  v_old_status := v_intent.status;

  IF v_intent.intent_type = 'plan_upgrade' THEN
    UPDATE public.companies SET
      subscription_plan                    = v_intent.plan_id,
      scheduled_subscription_plan          = NULL,
      scheduled_subscription_billing_cycle = NULL,
      scheduled_subscription_change_at     = NULL
    WHERE id = v_intent.company_id;
    v_credited := true;
  ELSIF v_company.current_period_ends_at IS NULL
        OR v_intent.period_start >= v_company.current_period_ends_at - interval '1 second' THEN
    -- Solo se acredita un período que empieza cuando termina el vigente o
    -- después (tolerancia de 1 s por la precisión de milisegundos de la app).
    -- Cualquier solapamiento con el período ya acreditado queda en revisión.
    -- (billing_phase0_full_period_overlap_check)
    UPDATE public.companies SET
      subscription_status                  = 'active',
      subscription_plan                    = v_intent.plan_id,
      subscription_billing_cycle           = v_intent.billing_cycle,
      current_period_starts_at             = v_intent.period_start,
      current_period_ends_at               = v_intent.period_end,
      scheduled_subscription_plan          = NULL,
      scheduled_subscription_billing_cycle = NULL,
      scheduled_subscription_change_at     = NULL,
      subscription_cancel_at_period_end    = false,
      subscription_cancelled_at            = NULL
    WHERE id = v_intent.company_id;
    v_credited := true;
  END IF;

  IF NOT v_credited THEN
    UPDATE public.payment_intents SET
      status            = 'manual_review',
      verified_at       = NOW(),
      verified_by_email = p_admin_email,
      updated_at        = NOW()
    WHERE id = p_intent_id;

    INSERT INTO public.payment_audit_logs (intent_id, action, from_status, to_status, actor_type, metadata)
    VALUES (p_intent_id, 'period_already_covered', v_old_status, 'manual_review', 'admin',
            jsonb_build_object(
              'admin_email', p_admin_email,
              'period_start', v_intent.period_start,
              'period_end', v_intent.period_end,
              'company_period_end', v_company.current_period_ends_at));
    RETURN;
  END IF;

  UPDATE public.payment_intents SET
    status            = 'paid',
    verified_at       = NOW(),
    verified_by_email = p_admin_email,
    updated_at        = NOW()
  WHERE id = p_intent_id;

  IF v_intent.discount_code_id IS NOT NULL
     AND (v_intent.discount_reserved_at IS NULL OR v_intent.discount_released_at IS NOT NULL) THEN
    UPDATE public.discount_codes
    SET used_count = used_count + 1
    WHERE id = v_intent.discount_code_id
      AND (max_uses IS NULL OR used_count < max_uses);

    IF FOUND THEN
      UPDATE public.payment_intents
      SET discount_reserved_at = NOW(), discount_released_at = NULL
      WHERE id = p_intent_id;
    ELSE
      INSERT INTO public.payment_audit_logs (intent_id, action, actor_type, metadata)
      VALUES (p_intent_id, 'discount_limit_exceeded_review', 'system',
              jsonb_build_object('discount_code_id', v_intent.discount_code_id));
    END IF;
  END IF;

  UPDATE public.payment_amount_slots SET
    reserved_by = NULL, reserved_at = NULL, slot_expires_at = NULL
  WHERE id = v_intent.slot_id;

  INSERT INTO public.payment_audit_logs (intent_id, action, from_status, to_status, actor_type, metadata)
  VALUES
    (p_intent_id, 'verified', v_old_status, 'paid', 'admin',
      jsonb_build_object('admin_email', p_admin_email)),
    (p_intent_id, 'subscription_activated', NULL, 'active', 'admin',
      jsonb_build_object(
        'intent_type', v_intent.intent_type,
        'period_start', v_intent.period_start,
        'period_end', v_intent.period_end,
        'company_period_end_before', v_company.current_period_ends_at
      ));
END;
$$;

REVOKE ALL ON FUNCTION public.activate_subscription_from_intent(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_subscription_from_intent(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_resolve_payment_intent(
  p_intent_id   uuid,
  p_action      text,
  p_admin_email text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_intent public.payment_intents%ROWTYPE;
  v_status text;
BEGIN
  IF p_action NOT IN ('approve', 'reject') THEN
    RETURN 'invalid_action';
  END IF;

  SELECT * INTO v_intent
  FROM public.payment_intents WHERE id = p_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_intent.provider NOT IN ('manual', 'yappy_manual') THEN RETURN 'not_manual'; END IF;
  IF v_intent.status = 'paid' THEN RETURN 'already_paid'; END IF;

  IF p_action = 'reject' THEN
    IF v_intent.status = 'failed' THEN RETURN 'already_rejected'; END IF;
    IF v_intent.status NOT IN ('pending', 'claimed', 'awaiting_verification', 'manual_review') THEN
      RETURN 'invalid_status';
    END IF;

    UPDATE public.payment_intents SET
      status            = 'failed',
      verified_at       = NOW(),
      verified_by_email = p_admin_email,
      updated_at        = NOW()
    WHERE id = p_intent_id;

    PERFORM public.release_intent_discount(p_intent_id);

    INSERT INTO public.payment_audit_logs (intent_id, action, from_status, to_status, actor_type, metadata)
    VALUES (p_intent_id, 'rejected', v_intent.status, 'failed', 'admin',
            jsonb_build_object('admin_email', p_admin_email));

    RETURN 'rejected';
  END IF;

  IF v_intent.status NOT IN ('pending', 'claimed', 'awaiting_verification', 'manual_review') THEN
    RETURN 'invalid_status';
  END IF;

  PERFORM public.activate_subscription_from_intent(p_intent_id, p_admin_email);

  SELECT status INTO v_status FROM public.payment_intents WHERE id = p_intent_id;
  IF v_status <> 'paid' THEN
    RETURN 'period_already_covered';
  END IF;

  RETURN 'approved';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_payment_intent(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_payment_intent(uuid, text, text) TO service_role;

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
  v_status text;
BEGIN
  IF p_intent_id IS NULL OR coalesce(btrim(p_transaction_id), '') = '' THEN
    RETURN 'invalid';
  END IF;

  SELECT * INTO v_intent
  FROM public.payment_intents
  WHERE id = p_intent_id
  FOR UPDATE;

  IF NOT FOUND OR v_intent.provider <> 'paguelofacil' THEN
    RETURN 'not_found';
  END IF;

  IF v_intent.status = 'paid' THEN
    RETURN CASE
      WHEN v_intent.provider_transaction_id = p_transaction_id THEN 'already_paid'
      ELSE 'paid_other_transaction'
    END;
  END IF;

  IF v_intent.status = 'manual_review' AND v_intent.provider_transaction_id = p_transaction_id THEN
    RETURN 'needs_review';
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

    PERFORM public.release_intent_discount(p_intent_id);

    INSERT INTO public.payment_audit_logs (intent_id, action, from_status, to_status, actor_type, metadata)
    VALUES (p_intent_id, 'provider_not_approved', v_intent.status, 'failed', 'system',
            jsonb_build_object('provider_transaction_id', p_transaction_id));

    RETURN 'not_approved';
  END IF;

  UPDATE public.payment_intents
  SET provider_transaction_id = p_transaction_id,
      raw_response = coalesce(p_raw_response, raw_response),
      updated_at = NOW()
  WHERE id = p_intent_id;

  PERFORM public.activate_subscription_from_intent(p_intent_id, 'paguelofacil-return');

  SELECT status INTO v_status FROM public.payment_intents WHERE id = p_intent_id;
  IF v_status <> 'paid' THEN
    RETURN 'needs_review';
  END IF;

  RETURN 'activated';
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_paguelofacil_payment(uuid, text, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_paguelofacil_payment(uuid, text, jsonb, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.expire_stale_intents()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH locked AS (
    SELECT pi.id, pi.status AS old_status, pi.slot_id, pi.discount_code_id,
           (pi.discount_code_id IS NOT NULL
            AND pi.discount_reserved_at IS NOT NULL
            AND pi.discount_released_at IS NULL) AS release_discount
    FROM payment_intents pi
    WHERE pi.expires_at < NOW()
      AND (
        pi.status IN ('pending', 'claimed', 'awaiting_verification')
        -- Yappy manual vencido sin verificar: libera su reserva de descuento.
        -- Otros manual_review (cobros a conciliar) nunca expiran.
        OR (pi.status = 'manual_review'
            AND pi.provider = 'yappy_manual'
            AND pi.provider_transaction_id IS NULL)
      )
    FOR UPDATE SKIP LOCKED
  ),
  expired AS (
    UPDATE payment_intents pi
    SET status = 'expired',
        discount_released_at = CASE WHEN l.release_discount THEN NOW() ELSE pi.discount_released_at END,
        updated_at = NOW()
    FROM locked l
    WHERE pi.id = l.id
    RETURNING pi.id, l.old_status, l.slot_id, l.discount_code_id, l.release_discount
  ),
  released AS (
    UPDATE payment_amount_slots s
    SET reserved_by = NULL, reserved_at = NULL, slot_expires_at = NULL
    FROM expired e
    WHERE s.id = e.slot_id
      AND s.reserved_by = e.id
    RETURNING s.id
  ),
  discounts AS (
    UPDATE discount_codes d
    SET used_count = greatest(d.used_count - x.n, 0)
    FROM (
      SELECT discount_code_id, count(*)::integer AS n
      FROM expired
      WHERE release_discount
      GROUP BY discount_code_id
    ) x
    WHERE d.id = x.discount_code_id
    RETURNING d.id
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

REVOKE ALL ON FUNCTION public.expire_stale_intents() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_intents() TO service_role;

COMMIT;
