-- ================================================================
-- MONEXITY — Capa de persistencia de billing agnóstica al proveedor
-- Aplicado en Monexi (mnwzltvkwfxlpxuwshfo) como migración
-- billing_neutral_persistence_layer.
-- Aditiva: no borra ni renombra columnas; no desactiva RLS.
--
-- payment_intents: moneda, importes base/final, idempotency_key,
--   provider_payment_id, provider_order_id, provider_subscription_id,
--   billing_subscription_id, source_plan, target_plan. (provider,
--   intent_type, period_start y period_end ya existían.)
--   Históricos: final_amount = exact_amount; base_amount = exact + descuento.
-- billing_subscriptions: relación recurrente externa por empresa.
-- billing_provider_events: webhooks/IPN idempotentes por provider + external_event_id.
-- Referencias entre tablas exigen la misma empresa (FK compuestas con company_id).
-- Clientes: solo lectura de payment_intents y billing_subscriptions de su empresa;
-- billing_provider_events sin acceso cliente. Escritura solo service_role.
-- ================================================================

-- ── payment_intents: campos neutrales que faltan ─────────────────
ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS currency                 text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS base_amount              numeric(10,2),
  ADD COLUMN IF NOT EXISTS final_amount             numeric(10,2),
  ADD COLUMN IF NOT EXISTS idempotency_key          text,
  ADD COLUMN IF NOT EXISTS provider_payment_id      text,
  ADD COLUMN IF NOT EXISTS provider_order_id        text,
  ADD COLUMN IF NOT EXISTS provider_subscription_id text,
  ADD COLUMN IF NOT EXISTS billing_subscription_id  uuid,
  ADD COLUMN IF NOT EXISTS source_plan              text,
  ADD COLUMN IF NOT EXISTS target_plan              text;

UPDATE public.payment_intents
SET final_amount = exact_amount
WHERE final_amount IS NULL;

UPDATE public.payment_intents
SET base_amount = exact_amount + coalesce(discount_amount, 0)
WHERE base_amount IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.payment_intents'::regclass AND conname = 'payment_intents_provider_check') THEN
    ALTER TABLE public.payment_intents ADD CONSTRAINT payment_intents_provider_check
      CHECK (provider IN ('manual', 'yappy_manual', 'paguelofacil', 'yappy'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.payment_intents'::regclass AND conname = 'payment_intents_currency_check') THEN
    ALTER TABLE public.payment_intents ADD CONSTRAINT payment_intents_currency_check
      CHECK (currency ~ '^[A-Z]{3}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.payment_intents'::regclass AND conname = 'payment_intents_amounts_check') THEN
    ALTER TABLE public.payment_intents ADD CONSTRAINT payment_intents_amounts_check
      CHECK ((base_amount IS NULL OR base_amount >= 0) AND (final_amount IS NULL OR final_amount >= 0));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.payment_intents'::regclass AND conname = 'payment_intents_upgrade_plans_check') THEN
    ALTER TABLE public.payment_intents ADD CONSTRAINT payment_intents_upgrade_plans_check
      CHECK (intent_type = 'plan_upgrade' OR (source_plan IS NULL AND target_plan IS NULL));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_provider_idempotency_key
  ON public.payment_intents (provider, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_provider_payment_id
  ON public.payment_intents (provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_provider_order_id
  ON public.payment_intents (provider, provider_order_id) WHERE provider_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_intents_billing_subscription
  ON public.payment_intents (billing_subscription_id) WHERE billing_subscription_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_id_company
  ON public.payment_intents (id, company_id);

-- ── billing_subscriptions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider                    text NOT NULL CHECK (provider IN ('yappy', 'paguelofacil', 'manual', 'yappy_manual')),
  external_subscription_id    text,
  external_customer_id        text,
  plan_id                     text NOT NULL,
  billing_cycle               text NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  amount                      numeric(10,2) CHECK (amount IS NULL OR amount >= 0),
  currency                    text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  status                      text NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'active', 'past_due', 'cancel_requested', 'cancelled', 'unknown')),
  external_status             text,
  external_status_observed_at timestamptz,
  current_period_start        timestamptz,
  current_period_end          timestamptz,
  cancel_requested_at         timestamptz,
  cancelled_at                timestamptz,
  reconciled_until            timestamptz,
  last_full_reread_at         timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_subscriptions_period_check
    CHECK (current_period_start IS NULL OR current_period_end IS NULL OR current_period_end > current_period_start),
  CONSTRAINT billing_subscriptions_id_company_key UNIQUE (id, company_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_subscriptions_provider_external
  ON public.billing_subscriptions (provider, external_subscription_id)
  WHERE external_subscription_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_subscriptions_one_open_per_company
  ON public.billing_subscriptions (company_id)
  WHERE status IN ('pending', 'active', 'past_due', 'cancel_requested');
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_company
  ON public.billing_subscriptions (company_id, status);

-- Nota: en re-ejecuciones, este CREATE TRIGGER falla si ya existe; la tabla es nueva.
CREATE TRIGGER trg_billing_subscriptions_updated_at
  BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.payment_intents'::regclass AND conname = 'payment_intents_billing_subscription_fkey') THEN
    ALTER TABLE public.payment_intents ADD CONSTRAINT payment_intents_billing_subscription_fkey
      FOREIGN KEY (billing_subscription_id, company_id)
      REFERENCES public.billing_subscriptions (id, company_id);
  END IF;
END $$;

-- ── billing_provider_events ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.billing_provider_events (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider                text NOT NULL CHECK (provider IN ('yappy', 'paguelofacil', 'manual', 'yappy_manual')),
  external_event_id       text NOT NULL,
  event_type              text,
  company_id              uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  payment_intent_id       uuid,
  billing_subscription_id uuid,
  signature_valid         boolean,
  payload                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_status       text NOT NULL DEFAULT 'received'
                          CHECK (processing_status IN ('received', 'processed', 'ignored', 'failed')),
  processing_error        text,
  attempts                integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  received_at             timestamptz NOT NULL DEFAULT now(),
  processed_at            timestamptz,
  CONSTRAINT billing_provider_events_provider_event_key UNIQUE (provider, external_event_id),
  CONSTRAINT billing_provider_events_company_required
    CHECK ((payment_intent_id IS NULL AND billing_subscription_id IS NULL) OR company_id IS NOT NULL),
  CONSTRAINT billing_provider_events_intent_fkey
    FOREIGN KEY (payment_intent_id, company_id) REFERENCES public.payment_intents (id, company_id),
  CONSTRAINT billing_provider_events_subscription_fkey
    FOREIGN KEY (billing_subscription_id, company_id) REFERENCES public.billing_subscriptions (id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_provider_events_pending
  ON public.billing_provider_events (provider, processing_status, received_at)
  WHERE processing_status IN ('received', 'failed');
CREATE INDEX IF NOT EXISTS idx_billing_provider_events_company
  ON public.billing_provider_events (company_id) WHERE company_id IS NOT NULL;

-- ── RLS y privilegios: sin escritura desde clientes ──────────────
ALTER TABLE public.billing_subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_provider_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.billing_subscriptions   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.billing_provider_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.billing_subscriptions   TO service_role;
GRANT ALL ON public.billing_provider_events TO service_role;

GRANT SELECT ON public.billing_subscriptions TO authenticated;
CREATE POLICY billing_subscriptions_select_members ON public.billing_subscriptions
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT m.company_id FROM public.memberships m WHERE m.user_id = auth.uid()));

-- billing_provider_events: sin políticas ni grants de cliente (payloads internos).

-- payment_intents: los clientes solo leen (política pi_select); escritura solo servidor.
REVOKE ALL ON public.payment_intents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.payment_intents TO authenticated;

-- ================================================================
-- Delta aplicado como migración billing_neutral_layer_lookup_indexes.
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_payment_intents_provider_subscription_id
  ON public.payment_intents (provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_provider_events_intent
  ON public.billing_provider_events (payment_intent_id) WHERE payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_provider_events_subscription
  ON public.billing_provider_events (billing_subscription_id) WHERE billing_subscription_id IS NOT NULL;

-- ================================================================
-- Delta aplicado como migración billing_neutral_layer_sync_amounts.
-- Las RPC actuales insertan/actualizan intents sin final_amount/base_amount.
-- El trigger los mantiene desde exact_amount/discount_amount sin pisar valores
-- escritos explícitamente. No modifica ninguna RPC.
-- ================================================================
CREATE OR REPLACE FUNCTION public.payment_intents_sync_neutral_amounts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.final_amount := coalesce(NEW.final_amount, NEW.exact_amount);
    NEW.base_amount  := coalesce(NEW.base_amount, NEW.exact_amount + coalesce(NEW.discount_amount, 0));
  ELSE
    IF NEW.final_amount IS NULL
       OR (NEW.exact_amount IS DISTINCT FROM OLD.exact_amount AND NEW.final_amount IS NOT DISTINCT FROM OLD.final_amount) THEN
      NEW.final_amount := NEW.exact_amount;
    END IF;
    IF NEW.base_amount IS NULL
       OR ((NEW.exact_amount IS DISTINCT FROM OLD.exact_amount OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount)
           AND NEW.base_amount IS NOT DISTINCT FROM OLD.base_amount) THEN
      NEW.base_amount := NEW.exact_amount + coalesce(NEW.discount_amount, 0);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.payment_intents_sync_neutral_amounts() FROM PUBLIC, anon, authenticated;

-- Nota: en re-ejecuciones, este CREATE TRIGGER falla si ya existe.
CREATE TRIGGER trg_pi_sync_neutral_amounts
  BEFORE INSERT OR UPDATE OF exact_amount, discount_amount, final_amount, base_amount
  ON public.payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.payment_intents_sync_neutral_amounts();
