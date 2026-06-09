-- ================================================================
-- MONEXITY - Conservar auditoria al eliminar intents de pago
-- Ejecutar en Supabase SQL Editor.
-- No modifica RLS ni elimina registros existentes.
-- ================================================================

ALTER TABLE public.payment_audit_logs
  ALTER COLUMN intent_id DROP NOT NULL;

ALTER TABLE public.payment_audit_logs
  DROP CONSTRAINT IF EXISTS payment_audit_logs_intent_id_fkey;

ALTER TABLE public.payment_audit_logs
  ADD CONSTRAINT payment_audit_logs_intent_id_fkey
  FOREIGN KEY (intent_id)
  REFERENCES public.payment_intents(id)
  ON DELETE SET NULL;
