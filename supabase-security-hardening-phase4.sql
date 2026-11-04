-- ================================================================
-- MONEXITY — Endurecimiento de seguridad (fase 4: RPC financieras)
-- Aplicado en Monexi (mnwzltvkwfxlpxuwshfo) como migraciones
-- security_hardening_phase4_create_sale_with_plan,
-- security_hardening_phase4b_revoke_unused_create_sale_with_plan,
-- security_hardening_phase4c_installments_cap (introdujo un tope de 520
-- cuotas no definido en PROJECT.md) y
-- security_hardening_phase4d_remove_installments_cap (lo retira; sin máximo).
-- Idempotente. No borra datos ni desactiva RLS.
--
-- create_sale_with_plan (19 parámetros) la usan ventas a cuotas y la
-- conversión de cotizaciones. Se mantiene SECURITY DEFINER porque las
-- políticas de inserción de sale_payment_plans y sale_installments solo
-- admiten owner/admin, y PROJECT.md permite al seller registrar ventas:
-- con SECURITY INVOKER el seller dejaría de poder crearlas.
-- La lógica de venta y generación de cuotas no cambia.
-- ================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.create_sale_with_plan(
  p_company_id          uuid,
  p_created_by          uuid,
  p_customer_name       text,
  p_customer_email      text,
  p_customer_phone      text,
  p_amount              numeric,
  p_payment_method      text,
  p_payment_type        text,
  p_sale_date           date,
  p_payment_date        date,
  p_note                text,
  p_invoice_notes       text,
  p_down_payment_amount numeric,
  p_plan_name           text,
  p_frequency           text,
  p_installment_amount  numeric,
  p_installments_count  integer,
  p_start_date          date,
  p_plan_notes          text
) RETURNS TABLE (sale_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_sale_id  uuid;
  v_plan_id  uuid;
  v_balance  numeric;
  v_paid     numeric;
  v_status   text;
  v_due_date date;
  i          integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;

  -- Autor forzado a la identidad autenticada
  IF p_created_by IS NOT NULL AND p_created_by IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'No puedes registrar ventas a nombre de otro usuario.' USING ERRCODE = '42501';
  END IF;

  -- Membresía con rol permitido (PROJECT.md: seller puede registrar ventas)
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = v_uid
      AND m.company_id = p_company_id
      AND lower(m.role) IN ('owner', 'admin', 'seller')
  ) THEN
    RAISE EXCEPTION 'No tienes acceso a esta empresa.' USING ERRCODE = '42501';
  END IF;

  IF p_amount IS NULL
     OR p_amount::text IN ('NaN', 'Infinity', '-Infinity')
     OR p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto total debe ser mayor a 0.' USING ERRCODE = '22023';
  END IF;

  IF p_down_payment_amount IS NOT NULL AND (
       p_down_payment_amount::text IN ('NaN', 'Infinity', '-Infinity')
       OR p_down_payment_amount < 0
       OR p_down_payment_amount > p_amount
     ) THEN
    RAISE EXCEPTION 'El abono inicial no es válido.' USING ERRCODE = '22023';
  END IF;

  IF p_installment_amount IS NULL
     OR p_installment_amount::text IN ('NaN', 'Infinity', '-Infinity')
     OR p_installment_amount <= 0 THEN
    RAISE EXCEPTION 'El monto de la cuota no es válido.' USING ERRCODE = '22023';
  END IF;

  IF p_installments_count IS NULL OR p_installments_count <= 0 THEN
    RAISE EXCEPTION 'La cantidad de cuotas no es válida.' USING ERRCODE = '22023';
  END IF;

  IF p_frequency IS NULL OR p_frequency NOT IN ('weekly', 'biweekly', 'monthly') THEN
    RAISE EXCEPTION 'Selecciona una frecuencia válida para el plan.' USING ERRCODE = '22023';
  END IF;

  IF p_start_date IS NULL THEN
    RAISE EXCEPTION 'La fecha de inicio del plan es requerida.' USING ERRCODE = '22023';
  END IF;

  -- Lógica de venta y cuotas sin cambios
  v_paid    := coalesce(p_down_payment_amount, 0);
  v_balance := p_amount - v_paid;
  v_status  := CASE WHEN v_balance <= 0 THEN 'paid' WHEN v_paid > 0 THEN 'partial' ELSE 'pending' END;

  INSERT INTO public.sales (
    company_id, created_by,
    customer_name, customer_email, customer_phone,
    amount, paid_amount, balance_due,
    payment_method, payment_type, payment_status,
    has_payment_plan,
    sale_date, payment_date,
    note, invoice_notes
  ) VALUES (
    p_company_id, v_uid,
    p_customer_name, p_customer_email, p_customer_phone,
    p_amount, v_paid, v_balance,
    p_payment_method, 'installment', v_status,
    true,
    p_sale_date, p_payment_date,
    p_note, p_invoice_notes
  )
  RETURNING id INTO v_sale_id;

  INSERT INTO public.sale_payment_plans (
    sale_id, company_id, created_by,
    plan_name, down_payment_amount,
    installment_amount, installments_count,
    frequency, start_date, status, notes
  ) VALUES (
    v_sale_id, p_company_id, v_uid,
    p_plan_name, v_paid,
    p_installment_amount, p_installments_count,
    p_frequency, p_start_date, 'active', p_plan_notes
  )
  RETURNING id INTO v_plan_id;

  v_due_date := p_start_date;

  FOR i IN 1..p_installments_count LOOP
    INSERT INTO public.sale_installments (
      sale_id, plan_id, company_id,
      installment_number, due_date,
      amount, paid_amount, status
    ) VALUES (
      v_sale_id, v_plan_id, p_company_id,
      i, v_due_date,
      p_installment_amount, 0, 'pending'
    );

    v_due_date := CASE p_frequency
      WHEN 'weekly'   THEN v_due_date + interval '7 days'
      WHEN 'biweekly' THEN v_due_date + interval '14 days'
      WHEN 'monthly'  THEN v_due_date + interval '1 month'
      ELSE v_due_date + interval '1 month'
    END;
  END LOOP;

  RETURN QUERY SELECT v_sale_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_sale_with_plan(uuid, uuid, text, text, text, numeric, text, text, date, date, text, text, numeric, text, text, numeric, integer, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sale_with_plan(uuid, uuid, text, text, text, numeric, text, text, date, date, text, text, numeric, text, text, numeric, integer, date, text) TO authenticated, service_role;

-- Versión SECURITY INVOKER (15 parámetros): sin usos (la app llama la de 19
-- por nombre) y sin las validaciones de arriba. Inaccesible para todos.
-- Aplicado como security_hardening_phase4b_revoke_unused_create_sale_with_plan.
REVOKE ALL ON FUNCTION public.create_sale_with_plan(uuid, uuid, numeric, text, numeric, date, text, text, text, text, text, numeric, integer, date, text) FROM PUBLIC, anon, authenticated, service_role;

-- get_dashboard_totals: validan membresía internamente; solo requieren sesión.
REVOKE ALL ON FUNCTION public.get_dashboard_totals(uuid, date, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_totals(uuid, date, date, date) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_dashboard_totals(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_totals(uuid, date, date) TO authenticated, service_role;

COMMIT;
