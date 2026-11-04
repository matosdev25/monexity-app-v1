-- ================================================================
-- MONEXITY — RUC y DV del cliente en ventas
-- Cambio aditivo: columnas opcionales (nullable) en public.sales.
-- Idempotente. No borra datos, no cambia políticas ni desactiva RLS.
-- Las ventas existentes quedan con NULL y siguen siendo compatibles.
-- ================================================================

BEGIN;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS customer_ruc text NULL,
  ADD COLUMN IF NOT EXISTS customer_dv text NULL;

COMMENT ON COLUMN public.sales.customer_ruc IS 'RUC opcional del cliente para la factura.';
COMMENT ON COLUMN public.sales.customer_dv IS 'Dígito verificador (DV) opcional del RUC del cliente.';

COMMIT;

-- Verificación:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'sales'
--   AND column_name IN ('customer_ruc', 'customer_dv');
