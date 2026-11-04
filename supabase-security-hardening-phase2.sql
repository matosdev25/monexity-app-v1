-- ================================================================
-- MONEXITY — Endurecimiento de seguridad (fase 2: SECURITY DEFINER críticas)
-- Aplicado en Monexi (mnwzltvkwfxlpxuwshfo) como migración
-- security_hardening_phase2_record_sale_payment_create_company.
-- Idempotente. No borra datos ni desactiva RLS.
--
-- 1. record_sale_payment (7 parámetros, la que usa la app):
--    auth.uid() obligatorio, rol owner/admin en la empresa, venta de esa
--    empresa (bloqueada FOR UPDATE), monto válido, created_by = auth.uid(),
--    search_path fijo. Rechaza ventas ya pagadas y pagos mayores al saldo
--    pendiente, leído bajo el mismo bloqueo (migración
--    record_sale_payment_reject_overpayment).
-- 2. create_company_for_user: sin usos. Sin acceso cliente.
-- Las firmas obsoletas quedan inaccesibles (sin EXECUTE para nadie).
-- ================================================================

BEGIN;

-- ── 1. record_sale_payment ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.record_sale_payment(
  p_sale_id        uuid,
  p_company_id     uuid,
  p_amount         numeric,
  p_payment_date   date,
  p_payment_method text,
  p_note           text DEFAULT NULL,
  p_reference      text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_balance numeric;
  v_status  text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;

  IF p_amount IS NULL
     OR p_amount::text IN ('NaN', 'Infinity', '-Infinity')
     OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Ingresa un monto válido mayor a 0.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = v_uid
      AND m.company_id = p_company_id
      AND lower(m.role) IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para registrar pagos.' USING ERRCODE = '42501';
  END IF;

  -- Saldo leído bajo el mismo bloqueo: pagos concurrentes no pueden superar el saldo
  SELECT coalesce(s.balance_due, 0), lower(coalesce(s.payment_status, ''))
  INTO v_balance, v_status
  FROM public.sales s
  WHERE s.id = p_sale_id
    AND s.company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF v_status = 'paid' OR round(v_balance, 2) <= 0 THEN
    RAISE EXCEPTION 'Esta venta ya está pagada.' USING ERRCODE = '22023';
  END IF;

  IF round(p_amount, 2) > round(v_balance, 2) THEN
    RAISE EXCEPTION 'El pago no puede ser mayor al saldo pendiente (%).', to_char(round(v_balance, 2), 'FM999999990.00')
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.sale_payments (
    sale_id, company_id, amount, payment_method,
    payment_date, reference, note, created_by
  ) VALUES (
    p_sale_id, p_company_id, p_amount, p_payment_method,
    p_payment_date, p_reference, p_note, v_uid
  );

  UPDATE public.sales
  SET
    balance_due = greatest(coalesce(balance_due, 0) - p_amount, 0),
    payment_status = CASE
      WHEN greatest(coalesce(balance_due, 0) - p_amount, 0) <= 0 THEN 'paid'
      ELSE 'pending'
    END
  WHERE id = p_sale_id
    AND company_id = p_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_sale_payment(uuid, uuid, numeric, date, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_sale_payment(uuid, uuid, numeric, date, text, text, text) TO authenticated, service_role;

-- Firma obsoleta (6 parámetros): sin usos y rota (inserta en columna
-- inexistente "method"). Inaccesible para todos.
REVOKE ALL ON FUNCTION public.record_sale_payment(uuid, uuid, numeric, date, text, text) FROM PUBLIC, anon, authenticated, service_role;
-- search_path fijo también en la firma obsoleta (migración
-- record_sale_payment_legacy_fixed_search_path).
ALTER FUNCTION public.record_sale_payment(uuid, uuid, numeric, date, text, text)
  SET search_path = public, pg_temp;

-- ── 2. create_company_for_user ───────────────────────────────────

-- Versión antigua (company_name): rota (no envía owner_user_id). Inaccesible.
REVOKE ALL ON FUNCTION public.create_company_for_user(text) FROM PUBLIC, anon, authenticated, service_role;

-- Versión (p_user_id, p_company_name): acepta un usuario arbitrario.
-- Solo service_role (onboarding real usa createAdminClient con inserts directos).
REVOKE ALL ON FUNCTION public.create_company_for_user(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_company_for_user(uuid, text) TO service_role;

COMMIT;

-- ── Pendiente de aprobación manual (no aplicado) ─────────────────
-- Retirar las firmas obsoletas. Sin usos, sin dependencias. Sin CASCADE.
-- Además elimina la ambigüedad de llamadas con 6 argumentos posicionales.
--
-- DROP FUNCTION IF EXISTS public.record_sale_payment(uuid, uuid, numeric, date, text, text);
-- DROP FUNCTION IF EXISTS public.create_company_for_user(text);
