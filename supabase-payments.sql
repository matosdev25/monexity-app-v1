-- ================================================================
-- MONEXITY — Sistema de pagos Yappy (manual/semi-automático)
-- Ejecutar completo en: Supabase → SQL Editor
-- ================================================================

-- ── 1. Slots de montos únicos ────────────────────────────────────
-- Cada slot = un monto exacto de pago que puede reservarse por un intento.
-- 30 slots por plan+ciclo garantizan hasta 30 pagos simultáneos sin colisión.

CREATE TABLE IF NOT EXISTS payment_amount_slots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         text NOT NULL,
  billing_cycle   text NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  offset_index    smallint NOT NULL,         -- 1..30
  exact_amount    numeric(10,2) NOT NULL,   -- precio base + offset cents
  reserved_by     uuid,                      -- id del payment_intent activo
  reserved_at     timestamptz,
  slot_expires_at timestamptz,              -- se libera cuando expira el intento
  UNIQUE (plan_id, billing_cycle, offset_index),
  UNIQUE (plan_id, billing_cycle, exact_amount)
);

CREATE INDEX IF NOT EXISTS idx_pas_free
  ON payment_amount_slots (plan_id, billing_cycle, offset_index)
  WHERE reserved_by IS NULL;

-- ── 2. Intentos de pago ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_intents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL,
  plan_id             text NOT NULL,
  billing_cycle       text NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  slot_id             uuid REFERENCES payment_amount_slots(id),
  exact_amount        numeric(10,2) NOT NULL,
  provider            text NOT NULL DEFAULT 'manual',
  provider_reference  text,
  checkout_url        text,
  raw_response        jsonb DEFAULT '{}',
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN (
                        'pending', 'claimed', 'awaiting_verification',
                        'paid', 'expired', 'cancelled', 'failed', 'manual_review'
                      )),
  claimed_at          timestamptz,
  verified_at         timestamptz,
  verified_by_email   text,
  expires_at          timestamptz NOT NULL,
  created_at          timestamptz DEFAULT NOW(),
  updated_at          timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pi_company_status
  ON payment_intents (company_id, status);
CREATE INDEX IF NOT EXISTS idx_pi_active_expires
  ON payment_intents (expires_at)
  WHERE status IN ('pending', 'claimed', 'awaiting_verification');
CREATE INDEX IF NOT EXISTS idx_pi_provider_status
  ON payment_intents (provider, status, company_id);
CREATE INDEX IF NOT EXISTS idx_pi_provider_reference
  ON payment_intents (provider, provider_reference)
  WHERE provider_reference IS NOT NULL;

-- ── 3. Audit log ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id   uuid REFERENCES payment_intents(id) ON DELETE SET NULL,
  action      text NOT NULL,
  from_status text,
  to_status   text,
  actor_type  text NOT NULL CHECK (actor_type IN ('user', 'admin', 'system')),
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pal_intent ON payment_audit_logs (intent_id);

-- ── 4. Trigger updated_at ────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_pi_updated_at ON payment_intents;
CREATE TRIGGER trg_pi_updated_at
  BEFORE UPDATE ON payment_intents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 5. Poblar slots ──────────────────────────────────────────────
-- Montos base (en centavos) + offset 1..30
-- emprende monthly: $4.01–$4.30   annual: $40.01–$40.30
-- control  monthly: $9.01–$9.30   annual: $90.01–$90.30
-- equipo   monthly: $15.01–$15.30 annual: $150.01–$150.30

INSERT INTO payment_amount_slots (plan_id, billing_cycle, offset_index, exact_amount)
SELECT
  plan_id,
  billing_cycle,
  s AS offset_index,
  ROUND((base_cents + s) / 100.0, 2) AS exact_amount
FROM (
  VALUES
    ('emprende', 'monthly',  400),
    ('emprende', 'annual',  4000),
    ('control',  'monthly',  900),
    ('control',  'annual',  9000),
    ('equipo',   'monthly', 1500),
    ('equipo',   'annual', 15000)
) AS t(plan_id, billing_cycle, base_cents),
generate_series(1, 30) AS s
ON CONFLICT DO NOTHING;

-- ── 6. RLS ───────────────────────────────────────────────────────

ALTER TABLE payment_amount_slots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_intents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_audit_logs    ENABLE ROW LEVEL SECURITY;

-- Slots: solo lectura para usuarios autenticados
DROP POLICY IF EXISTS "pas_select" ON payment_amount_slots;
CREATE POLICY "pas_select" ON payment_amount_slots
  FOR SELECT TO authenticated USING (true);

-- Intents: ver solo los de tu empresa
DROP POLICY IF EXISTS "pi_select" ON payment_intents;
CREATE POLICY "pi_select" ON payment_intents
  FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM memberships WHERE user_id = auth.uid()
    )
  );

-- Audit: ver los de tus intents
DROP POLICY IF EXISTS "pal_select" ON payment_audit_logs;
CREATE POLICY "pal_select" ON payment_audit_logs
  FOR SELECT TO authenticated
  USING (
    intent_id IN (
      SELECT pi.id FROM payment_intents pi
      WHERE pi.company_id IN (
        SELECT company_id FROM memberships WHERE user_id = auth.uid()
      )
    )
  );

-- ── 7. Función: crear intento de pago (atómica) ──────────────────
-- SECURITY DEFINER para poder usar FOR UPDATE SKIP LOCKED.
-- Valida membresía internamente antes de crear.
-- Retorna intento existente activo si lo hay (idempotente).

CREATE OR REPLACE FUNCTION create_payment_intent(
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
  -- Verificar que el caller es el usuario declarado
  IF auth.uid() != p_user_id THEN
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

  -- Crear intento
  INSERT INTO payment_intents (
    company_id, user_id, plan_id, billing_cycle,
    slot_id, exact_amount, expires_at
  ) VALUES (
    p_company_id, p_user_id, p_plan_id, p_billing_cycle,
    v_slot_id, v_amount, p_expires_at
  )
  RETURNING id INTO v_intent_id;

  -- Marcar slot como reservado
  UPDATE payment_amount_slots SET
    reserved_by     = v_intent_id,
    reserved_at     = NOW(),
    slot_expires_at = p_expires_at + INTERVAL '2 hours'
  WHERE id = v_slot_id;

  -- Audit
  INSERT INTO payment_audit_logs (intent_id, action, to_status, actor_type)
  VALUES (v_intent_id, 'created', 'pending', 'user');

  RETURN QUERY SELECT v_intent_id, v_amount, v_slot_id, false;
END;
$$;

GRANT EXECUTE ON FUNCTION create_payment_intent TO authenticated;

-- ── 8. Función: activar suscripción ──────────────────────────────
-- Solo callable desde service role (admin endpoints).
-- Idempotente: si ya está paid, retorna sin error.
-- Extiende período si la suscripción actual aún está vigente.

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

  -- Idempotente
  IF v_intent.status = 'paid' THEN RETURN; END IF;

  IF v_intent.status NOT IN ('pending', 'claimed', 'awaiting_verification', 'manual_review') THEN
    RAISE EXCEPTION 'INVALID_STATUS: %', v_intent.status;
  END IF;

  v_old_status := v_intent.status;

  -- Calcular período: extender si ya hay suscripción activa
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

  -- Marcar intento como pagado
  UPDATE payment_intents SET
    status              = 'paid',
    verified_at         = NOW(),
    verified_by_email   = p_admin_email,
    updated_at          = NOW()
  WHERE id = p_intent_id;

  -- Activar suscripción en companies (misma tabla que ya existe)
  UPDATE companies SET
    subscription_status         = 'active',
    subscription_plan           = v_intent.plan_id,
    subscription_billing_cycle  = v_intent.billing_cycle,
    current_period_starts_at    = v_period_start,
    current_period_ends_at      = v_period_end
  WHERE id = v_intent.company_id;

  -- Liberar slot
  UPDATE payment_amount_slots SET
    reserved_by = NULL, reserved_at = NULL, slot_expires_at = NULL
  WHERE id = v_intent.slot_id;

  -- Audit
  INSERT INTO payment_audit_logs (intent_id, action, from_status, to_status, actor_type, metadata)
  VALUES
    (p_intent_id, 'verified', v_old_status, 'paid', 'admin',
      jsonb_build_object('admin_email', p_admin_email)),
    (p_intent_id, 'subscription_activated', NULL, 'active', 'admin',
      jsonb_build_object('period_start', v_period_start, 'period_end', v_period_end));
END;
$$;
-- Sin GRANT: solo service_role puede llamarlo

-- ── 9. Función: expirar intentos vencidos ───────────────────────
-- Llamada por el cron. Libera slots de intentos expirados.

CREATE OR REPLACE FUNCTION expire_stale_intents()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids      uuid[];
  v_slot_ids uuid[];
BEGIN
  SELECT array_agg(id), array_agg(slot_id)
  INTO v_ids, v_slot_ids
  FROM payment_intents
  WHERE status IN ('pending', 'claimed', 'awaiting_verification')
    AND expires_at < NOW()
  FOR UPDATE SKIP LOCKED;

  IF v_ids IS NULL THEN RETURN 0; END IF;

  UPDATE payment_intents
  SET status = 'expired', updated_at = NOW()
  WHERE id = ANY(v_ids);

  UPDATE payment_amount_slots
  SET reserved_by = NULL, reserved_at = NULL, slot_expires_at = NULL
  WHERE id = ANY(v_slot_ids) AND id IS NOT NULL;

  INSERT INTO payment_audit_logs (intent_id, action, from_status, to_status, actor_type)
  SELECT unnest(v_ids), 'expired', 'pending', 'expired', 'system';

  RETURN array_length(v_ids, 1);
END;
$$;
-- Sin GRANT: solo service_role
