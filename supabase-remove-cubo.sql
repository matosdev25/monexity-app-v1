-- ================================================================
-- MONEXITY — Retiro de Cubo Pago
-- Elimina los objetos de base de datos exclusivos de Cubo y retira 'cubo'
-- de los valores permitidos de proveedor. Conserva la capa neutral de billing
-- (payment_intents, billing_subscriptions, billing_provider_events y sus
-- columnas neutrales). No borra datos ni desactiva RLS. Idempotente.
--
-- ESTADO EN MONEXI: PENDIENTE. Salvaguardas verificadas en remoto antes de aplicar:
-- 0 filas provider='cubo' en las tres tablas, 0 valores en provider_link_token y
-- ninguna función/vista depende de confirm_cubo_payment ni de esa columna.
-- El cliente MCP cancela automáticamente esta migración (contiene DROP); ejecutar
-- este archivo completo en el SQL Editor y luego las consultas de verificación.
-- ================================================================

BEGIN;

-- Salvaguarda: si hay registros de Cubo, abortar sin cambios para revisarlos.
DO $$
DECLARE
  v_rows bigint;
BEGIN
  SELECT
      (SELECT count(*) FROM public.payment_intents        WHERE provider = 'cubo')
    + (SELECT count(*) FROM public.billing_subscriptions  WHERE provider = 'cubo')
    + (SELECT count(*) FROM public.billing_provider_events WHERE provider = 'cubo')
  INTO v_rows;

  IF v_rows > 0 THEN
    RAISE EXCEPTION 'Existen % registros con provider = cubo. Revisarlos antes de retirar Cubo.', v_rows;
  END IF;
END $$;

-- Columna exclusiva del link alojado de Cubo (migración cubo_subscription_link_reference).
-- Solo se elimina si no contiene datos. billing_subscriptions.checkout_url se conserva:
-- es un campo neutral (URL de checkout de la suscripción) útil para cualquier proveedor.
DO $$
DECLARE
  v_rows bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'billing_subscriptions'
      AND column_name = 'provider_link_token'
  ) THEN
    EXECUTE 'SELECT count(*) FROM public.billing_subscriptions WHERE provider_link_token IS NOT NULL'
      INTO v_rows;
    IF v_rows > 0 THEN
      RAISE EXCEPTION 'billing_subscriptions.provider_link_token tiene % valores. Revisarlos antes de eliminarla.', v_rows;
    END IF;
    ALTER TABLE public.billing_subscriptions DROP COLUMN provider_link_token;
  END IF;
END $$;

-- RPC exclusiva de Cubo (confirmación de cobros por webhook)
DROP FUNCTION IF EXISTS public.confirm_cubo_payment(uuid, uuid, uuid, text, bigint, boolean, jsonb);

-- Índice exclusivo de Cubo (un link abierto por suscripción)
DROP INDEX IF EXISTS public.idx_payment_intents_cubo_one_open_per_subscription;

-- Valores permitidos de proveedor sin 'cubo' en las tres tablas neutrales.
-- Se eliminan los CHECK de proveedor existentes (nombre explícito o generado)
-- y se recrean con nombre estable.
DO $$
DECLARE
  v_table text;
  v_constraint record;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['payment_intents', 'billing_subscriptions', 'billing_provider_events'] LOOP
    FOR v_constraint IN
      SELECT c.conname
      FROM pg_constraint c
      WHERE c.conrelid = format('public.%I', v_table)::regclass
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%provider%'
        AND pg_get_constraintdef(c.oid) ILIKE '%cubo%'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_table, v_constraint.conname);
    END LOOP;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = format('public.%I', v_table)::regclass
        AND conname = v_table || '_provider_check'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (provider IN (''manual'', ''yappy_manual'', ''paguelofacil'', ''yappy''))',
        v_table,
        v_table || '_provider_check'
      );
    END IF;
  END LOOP;
END $$;

COMMIT;

-- Verificación:
-- 1) Sin funciones ni índices de Cubo:
-- SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND (proname ILIKE '%cubo%' OR prosrc ILIKE '%cubo%');
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname ILIKE '%cubo%';
--
-- 0) Antes de aplicar, registros de Cubo (deben ser 0):
-- SELECT 'payment_intents' t, count(*) FROM public.payment_intents WHERE provider = 'cubo'
-- UNION ALL SELECT 'billing_subscriptions', count(*) FROM public.billing_subscriptions WHERE provider = 'cubo'
-- UNION ALL SELECT 'billing_provider_events', count(*) FROM public.billing_provider_events WHERE provider = 'cubo';
--
-- 3) Columna exclusiva eliminada (debe devolver 0 filas):
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'billing_subscriptions' AND column_name = 'provider_link_token';
--
-- 2) CHECK de proveedor sin 'cubo':
-- SELECT conrelid::regclass, conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid IN ('public.payment_intents'::regclass, 'public.billing_subscriptions'::regclass,
--                    'public.billing_provider_events'::regclass)
--   AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%provider%';
