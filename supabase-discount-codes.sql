-- ================================================================
-- MONEXITY — Códigos de descuento para membresías SaaS
-- Ejecutar en Supabase SQL Editor.
-- Admin global se valida en server con BILLING_ADMIN_EMAILS.
-- ================================================================

CREATE TABLE IF NOT EXISTS discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric(10,2) NOT NULL CHECK (discount_value > 0),
  applies_to text NOT NULL DEFAULT 'both' CHECK (applies_to IN ('monthly', 'yearly', 'both')),
  starts_at timestamptz,
  expires_at timestamptz,
  max_uses integer CHECK (max_uses IS NULL OR max_uses >= 0),
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE discount_codes
  DROP CONSTRAINT IF EXISTS discount_codes_percentage_below_100;
ALTER TABLE discount_codes
  ADD CONSTRAINT discount_codes_percentage_below_100
  CHECK (discount_type != 'percentage' OR discount_value < 100)
  NOT VALID;

CREATE INDEX IF NOT EXISTS idx_discount_codes_active
  ON discount_codes (is_active, code);

CREATE OR REPLACE FUNCTION set_discount_codes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_discount_codes_updated_at ON discount_codes;
CREATE TRIGGER trg_discount_codes_updated_at
  BEFORE UPDATE ON discount_codes
  FOR EACH ROW
  EXECUTE FUNCTION set_discount_codes_updated_at();

ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "discount_codes_no_client_select" ON discount_codes;
CREATE POLICY "discount_codes_no_client_select" ON discount_codes
  FOR SELECT TO authenticated
  USING (false);

DROP POLICY IF EXISTS "discount_codes_no_client_insert" ON discount_codes;
CREATE POLICY "discount_codes_no_client_insert" ON discount_codes
  FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "discount_codes_no_client_update" ON discount_codes;
CREATE POLICY "discount_codes_no_client_update" ON discount_codes
  FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);

ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS discount_code_id uuid REFERENCES discount_codes(id),
  ADD COLUMN IF NOT EXISTS discount_code text,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_payment_intents_discount_code_id
  ON payment_intents (discount_code_id)
  WHERE discount_code_id IS NOT NULL;

CREATE OR REPLACE FUNCTION increment_discount_code_usage(
  p_discount_code_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE discount_codes
  SET used_count = used_count + 1
  WHERE id = p_discount_code_id;
END;
$$;

DROP FUNCTION IF EXISTS activate_subscription_with_promo(uuid, uuid, text, text, uuid);
