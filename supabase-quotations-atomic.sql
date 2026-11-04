-- ================================================================
-- MONEXITY — Cotizaciones atómicas
-- Estado en Monexi:
--   * assert_quotation_manager + convert_quotation_to_sale_atomic: APLICADAS
--     (migración quotations_atomic_convert) y verificadas con rollback.
--   * update_quotation_atomic: APLICADA (SQL Editor) y verificada con rollback
--     (owner/admin, bloqueo de seller/otra empresa/convertidas, totales
--     recalculados y sin cambios parciales ante fallo en los ítems).
-- Usada por app/dashboard/quotations/actions.ts:
--   * update_quotation_atomic: cabecera + reemplazo de ítems en una sola
--     transacción. Rechaza cotizaciones convertidas.
--   * convert_quotation_to_sale_atomic: crea la venta (pago completo o plan de
--     cuotas) reutilizando create_sale_with_items y marca la cotización como
--     convertida en la misma transacción. Idempotente por quotation_id:
--     la fila se bloquea (FOR UPDATE) y, si ya está convertida, devuelve el
--     converted_sale_id existente sin crear otra venta ni ingreso.
--
-- Ingreso: se deriva de sales.paid_amount (pago completo) y del abono inicial
-- del plan (sale_payment_plans.down_payment_amount). Ninguna de estas RPC
-- inserta en sale_payments, así que el ingreso se registra una sola vez.
--
-- Seguridad: SECURITY INVOKER (RLS de quotations/quotation_items vigente) +
-- validación explícita de auth.uid(), rol owner/admin y company_id.
-- create_sale_with_items (SECURITY DEFINER) repite su propia validación.
-- No modifica quotes, tablas ni políticas. Idempotente (CREATE OR REPLACE).
-- ================================================================

CREATE OR REPLACE FUNCTION public.assert_quotation_manager(p_company_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;

  IF p_company_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = v_uid
      AND m.company_id = p_company_id
      AND lower(m.role) IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para gestionar cotizaciones.' USING ERRCODE = '42501';
  END IF;

  RETURN v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_quotation_atomic(
  p_company_id   uuid,
  p_quotation_id uuid,
  p_quotation    jsonb,
  p_items        jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status   text;
  v_item     jsonb;
  v_qty      numeric;
  v_price    numeric;
  v_subtotal numeric;
  v_discount numeric;
  v_tax      numeric;
BEGIN
  PERFORM public.assert_quotation_manager(p_company_id);

  IF p_quotation IS NULL OR jsonb_typeof(p_quotation) <> 'object' THEN
    RAISE EXCEPTION 'Datos de cotización no válidos.' USING ERRCODE = '22023';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Agrega al menos un ítem válido.' USING ERRCODE = '22023';
  END IF;

  SELECT q.status INTO v_status
  FROM public.quotations q
  WHERE q.id = p_quotation_id
    AND q.company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotización no encontrada.' USING ERRCODE = '22023';
  END IF;

  IF v_status = 'converted' THEN
    RAISE EXCEPTION 'No se puede editar una cotización ya convertida a venta.' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF nullif(btrim(coalesce(v_item->>'description', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Cada ítem debe tener descripción.' USING ERRCODE = '22023';
    END IF;

    v_qty   := (v_item->>'quantity')::numeric;
    v_price := (v_item->>'unit_price')::numeric;

    IF v_qty IS NULL OR v_qty::text IN ('NaN', 'Infinity', '-Infinity') OR v_qty <= 0 THEN
      RAISE EXCEPTION 'La cantidad de un ítem no es válida.' USING ERRCODE = '22023';
    END IF;

    IF v_price IS NULL OR v_price::text IN ('NaN', 'Infinity', '-Infinity') OR v_price < 0 THEN
      RAISE EXCEPTION 'El precio de un ítem no es válido.' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- Totales recalculados en la base (misma regla que la Server Action)
  SELECT round(coalesce(sum(round((e->>'quantity')::numeric * (e->>'unit_price')::numeric, 2)), 0), 2)
  INTO v_subtotal
  FROM jsonb_array_elements(p_items) AS e;

  v_discount := round(greatest(0, coalesce((p_quotation->>'discount_amount')::numeric, 0)), 2);
  v_tax      := round(greatest(0, coalesce((p_quotation->>'tax_amount')::numeric, 0)), 2);

  UPDATE public.quotations
  SET customer_name    = nullif(p_quotation->>'customer_name', ''),
      customer_email   = nullif(p_quotation->>'customer_email', ''),
      customer_phone   = nullif(p_quotation->>'customer_phone', ''),
      customer_company = nullif(p_quotation->>'customer_company', ''),
      issue_date       = (p_quotation->>'issue_date')::date,
      valid_until      = nullif(p_quotation->>'valid_until', '')::date,
      subtotal         = v_subtotal,
      discount_amount  = v_discount,
      tax_amount       = v_tax,
      total            = greatest(0, v_subtotal - v_discount + v_tax),
      notes            = nullif(p_quotation->>'notes', ''),
      terms            = nullif(p_quotation->>'terms', ''),
      updated_at       = now()
  WHERE id = p_quotation_id
    AND company_id = p_company_id;

  DELETE FROM public.quotation_items
  WHERE quotation_id = p_quotation_id
    AND company_id = p_company_id;

  INSERT INTO public.quotation_items (
    quotation_id, company_id, description, quantity, unit_price, line_total,
    sort_order, service_id, service_name_snapshot
  )
  SELECT
    p_quotation_id,
    p_company_id,
    btrim(t.e->>'description'),
    (t.e->>'quantity')::numeric,
    (t.e->>'unit_price')::numeric,
    round((t.e->>'quantity')::numeric * (t.e->>'unit_price')::numeric, 2),
    coalesce((t.e->>'sort_order')::integer, (t.ord - 1)::integer),
    nullif(t.e->>'service_id', '')::uuid,
    nullif(t.e->>'service_name_snapshot', '')
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(e, ord);
END;
$$;

CREATE OR REPLACE FUNCTION public.convert_quotation_to_sale_atomic(
  p_company_id     uuid,
  p_quotation_id   uuid,
  p_invoice_number text,
  p_payment        jsonb
) RETURNS TABLE (sale_id uuid, already_converted boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_q            record;
  v_payment_type text;
  v_items        jsonb;
  v_sale         jsonb;
  v_plan         jsonb;
  v_sale_id      uuid;
BEGIN
  PERFORM public.assert_quotation_manager(p_company_id);

  IF p_payment IS NULL OR jsonb_typeof(p_payment) <> 'object' THEN
    RAISE EXCEPTION 'Datos de pago no válidos.' USING ERRCODE = '22023';
  END IF;

  -- Clave de idempotencia: la propia cotización. Conversiones simultáneas se
  -- serializan aquí; la segunda ve el estado ya convertido.
  SELECT q.* INTO v_q
  FROM public.quotations q
  WHERE q.id = p_quotation_id
    AND q.company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotización no encontrada.' USING ERRCODE = '22023';
  END IF;

  IF v_q.status = 'converted' THEN
    IF v_q.converted_sale_id IS NULL THEN
      -- La venta generada se eliminó después: no se vuelve a convertir.
      RAISE EXCEPTION 'Esta cotización ya fue convertida a venta.' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY SELECT v_q.converted_sale_id, true;
    RETURN;
  END IF;

  v_payment_type := coalesce(nullif(p_payment->>'payment_type', ''), 'full');
  IF v_payment_type NOT IN ('full', 'installment') THEN
    RAISE EXCEPTION 'Tipo de pago no válido.' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'description', qi.description,
           'quantity',    qi.quantity,
           'unit_price',  qi.unit_price,
           'sort_order',  qi.sort_order
         ) ORDER BY qi.sort_order, qi.created_at), '[]'::jsonb)
  INTO v_items
  FROM public.quotation_items qi
  WHERE qi.quotation_id = p_quotation_id
    AND qi.company_id = p_company_id;

  v_sale := jsonb_build_object(
    'customer_name',    v_q.customer_name,
    'customer_company', v_q.customer_company,
    'customer_email',   v_q.customer_email,
    'customer_phone',   coalesce(v_q.customer_phone, nullif(p_payment->>'customer_phone', '')),
    'amount',           v_q.total,
    'discount_amount',  round(greatest(0, coalesce(v_q.discount_amount, 0)), 2),
    'payment_method',   coalesce(nullif(p_payment->>'payment_method', ''), 'cash'),
    'sale_date',        v_q.issue_date,
    'payment_date',     v_q.issue_date,
    'note',             v_q.notes,
    'invoice_notes',    v_q.notes
  );

  IF v_payment_type = 'installment' THEN
    v_plan := p_payment->'plan';
    IF v_plan IS NULL OR jsonb_typeof(v_plan) <> 'object' THEN
      RAISE EXCEPTION 'Datos del plan de cuotas no válidos.' USING ERRCODE = '22023';
    END IF;
  ELSE
    v_plan := NULL;
    v_sale := v_sale || jsonb_build_object(
      'payment_type',   'full',
      'paid_amount',    v_q.total,
      'payment_status', 'paid'
    );
  END IF;

  -- Venta + ítems (+ plan y cuotas) en esta misma transacción
  v_sale_id := public.create_sale_with_items(p_company_id, p_invoice_number, v_sale, v_items, v_plan);

  UPDATE public.quotations
  SET status            = 'converted',
      converted_sale_id = v_sale_id,
      converted_at      = now(),
      updated_at        = now()
  WHERE id = p_quotation_id
    AND company_id = p_company_id;

  RETURN QUERY SELECT v_sale_id, false;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_quotation_manager(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_quotation_atomic(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.convert_quotation_to_sale_atomic(uuid, uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_quotation_manager(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_quotation_atomic(uuid, uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_quotation_to_sale_atomic(uuid, uuid, text, jsonb) TO authenticated;
