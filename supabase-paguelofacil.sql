-- ================================================================
-- MONEXITY — PagueloFacil para membresías SaaS
-- Ejecutar en Supabase SQL Editor antes de activar el checkout.
-- No modifica RLS existente; solo agrega metadata al payment_intent SaaS.
-- ================================================================

ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS provider_reference text,
  ADD COLUMN IF NOT EXISTS provider_transaction_id text,
  ADD COLUMN IF NOT EXISTS checkout_url text,
  ADD COLUMN IF NOT EXISTS raw_response jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS intent_type text NOT NULL DEFAULT 'subscription_payment'
    CHECK (intent_type IN ('subscription_payment', 'plan_upgrade'));

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS scheduled_subscription_plan text,
  ADD COLUMN IF NOT EXISTS scheduled_subscription_billing_cycle text
    CHECK (scheduled_subscription_billing_cycle IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS scheduled_subscription_change_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_cancelled_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_payment_intents_provider_status
  ON payment_intents (provider, status, company_id);

CREATE INDEX IF NOT EXISTS idx_payment_intents_provider_reference
  ON payment_intents (provider, provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_provider_transaction_id
  ON payment_intents (provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

-- Checkout normal de PagueloFacil: no usa slots ni montos simulados de Yappy.
DROP FUNCTION IF EXISTS create_paguelofacil_payment_intent(
  uuid, uuid, text, text, numeric, timestamptz
);

CREATE OR REPLACE FUNCTION create_paguelofacil_payment_intent(
  p_company_id    uuid,
  p_user_id       uuid,
  p_plan_id       text,
  p_billing_cycle text,
  p_exact_amount  numeric,
  p_expires_at    timestamptz,
  p_intent_type   text DEFAULT 'subscription_payment'
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
  IF p_intent_type NOT IN ('subscription_payment', 'plan_upgrade') THEN
    RAISE EXCEPTION 'INVALID_INTENT_TYPE';
  END IF;

  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = p_user_id
      AND company_id = p_company_id
      AND role IN ('owner', 'admin')
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
    AND pi.intent_type = p_intent_type
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
    exact_amount, provider, expires_at, intent_type
  ) VALUES (
    p_company_id, p_user_id, p_plan_id, p_billing_cycle,
    p_exact_amount, 'paguelofacil', p_expires_at, p_intent_type
  )
  RETURNING id INTO v_intent_id;

  INSERT INTO payment_audit_logs (intent_id, action, to_status, actor_type)
  VALUES (v_intent_id, 'created', 'pending', 'user');

  RETURN QUERY SELECT v_intent_id, false;
END;
$$;

GRANT EXECUTE ON FUNCTION create_paguelofacil_payment_intent TO authenticated;

-- Un pago normal renueva/extiende el período. Un upgrade solo cambia el plan
-- luego de confirmarse la diferencia y conserva las fechas del período actual.
CREATE OR REPLACE FUNCTION activate_subscription_from_intent(
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
