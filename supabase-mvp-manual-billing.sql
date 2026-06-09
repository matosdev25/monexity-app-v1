-- Monexity MVP: trial gratis y pago normal, sin tokenización ni recurrencia.
-- Ejecutar una vez en Supabase SQL Editor antes de desplegar la app.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS subscription_billing_cycle text
    CHECK (subscription_billing_cycle IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS trial_starts_at timestamptz;
