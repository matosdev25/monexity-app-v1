-- ================================================================
-- MONEXITY — Ventas con plan de cuotas sin depender de create_sale_with_plan
-- Aplicada en Monexi como sales_inline_plan_and_payment_access_guard
-- (versión 20261104185312). Este archivo registra solo su parte de
-- create_sale_with_items: esa migración también tocó abonos, fuera de este
-- hotfix, y eso no se incluye aquí. No reaplicar.
-- Reemplaza la definición de create_sale_with_items de
-- supabase-sales-financial-guard.sql.
-- ================================================================

-- create_sale_with_items crea venta + plan + cuotas por sí mismo: deja de depender de
-- create_sale_with_plan, que sigue sin EXECUTE para authenticated/anon.
-- Las cuotas vuelven a sumar el saldo (la última absorbe la diferencia, como indica el modal).
CREATE OR REPLACE FUNCTION public.create_sale_with_items(
  p_company_id     uuid,
  p_invoice_number text,
  p_sale           jsonb,
  p_items          jsonb,
  p_plan           jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_sale_id      uuid;
  v_plan_id      uuid;
  v_item         jsonb;
  v_qty          numeric;
  v_price        numeric;
  v_subtotal     numeric;
  v_discount     numeric;
  v_total        numeric;
  v_client_total numeric;
  v_paid         numeric;
  v_balance      numeric;
  v_status       text;
  v_payment_type text;
  v_inst_amount  numeric;
  v_inst_count   integer;
  v_regular      numeric;
  v_frequency    text;
  v_start_date   date;
  v_due_date     date;
  v_req          record;
  v_product      record;
  i              integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = v_uid
      AND m.company_id = p_company_id
      AND lower(m.role) IN ('owner', 'admin', 'seller')
  ) THEN
    RAISE EXCEPTION 'No tienes acceso a esta empresa.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.assert_company_access(p_company_id);

  IF nullif(btrim(coalesce(p_invoice_number, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Falta el número de factura.' USING ERRCODE = '22023';
  END IF;

  IF p_sale IS NULL OR jsonb_typeof(p_sale) <> 'object' THEN
    RAISE EXCEPTION 'Datos de venta no válidos.' USING ERRCODE = '22023';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Agrega al menos un ítem válido.' USING ERRCODE = '22023';
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

    IF nullif(v_item->>'product_id', '') IS NOT NULL AND v_qty <> trunc(v_qty) THEN
      RAISE EXCEPTION 'La cantidad de un producto debe ser un número entero.' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  SELECT round(sum(round((e->>'quantity')::numeric, 2) * round((e->>'unit_price')::numeric, 2)), 2)
  INTO v_subtotal
  FROM jsonb_array_elements(p_items) AS e;

  v_discount := round(coalesce(nullif(p_sale->>'discount_amount', '')::numeric, 0), 2);
  IF v_discount::text IN ('NaN', 'Infinity', '-Infinity') OR v_discount < 0 THEN
    RAISE EXCEPTION 'El descuento no es válido.' USING ERRCODE = '22023';
  END IF;
  IF v_discount > 0 AND v_discount >= v_subtotal THEN
    RAISE EXCEPTION 'El descuento debe ser menor al total.' USING ERRCODE = '22023';
  END IF;

  v_total := round(v_subtotal - v_discount, 2);
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'El monto total debe ser mayor a 0.' USING ERRCODE = '22023';
  END IF;

  v_client_total := nullif(p_sale->>'amount', '')::numeric;
  IF v_client_total IS NOT NULL AND abs(round(v_client_total, 2) - v_total) > 0.005 THEN
    RAISE EXCEPTION 'El total no coincide con los ítems de la venta.' USING ERRCODE = '22023';
  END IF;

  IF p_plan IS NOT NULL THEN
    IF jsonb_typeof(p_plan) <> 'object' THEN
      RAISE EXCEPTION 'Datos del plan de cuotas no válidos.' USING ERRCODE = '22023';
    END IF;

    v_payment_type := 'installment';
    v_paid         := round(coalesce(nullif(p_plan->>'down_payment_amount', '')::numeric, 0), 2);
    v_inst_amount  := round(nullif(p_plan->>'installment_amount', '')::numeric, 2);
    v_inst_count   := nullif(p_plan->>'installments_count', '')::integer;
    v_frequency    := p_plan->>'frequency';
    v_start_date   := nullif(p_plan->>'start_date', '')::date;

    IF v_paid::text IN ('NaN', 'Infinity', '-Infinity') OR v_paid < 0 OR v_paid > v_total THEN
      RAISE EXCEPTION 'El abono inicial no es válido.' USING ERRCODE = '22023';
    END IF;

    IF v_inst_amount IS NULL
       OR v_inst_amount::text IN ('NaN', 'Infinity', '-Infinity')
       OR v_inst_amount <= 0 THEN
      RAISE EXCEPTION 'El monto de la cuota no es válido.' USING ERRCODE = '22023';
    END IF;

    IF v_inst_count IS NULL OR v_inst_count <= 0 THEN
      RAISE EXCEPTION 'La cantidad de cuotas no es válida.' USING ERRCODE = '22023';
    END IF;

    IF v_frequency IS NULL OR v_frequency NOT IN ('weekly', 'biweekly', 'monthly') THEN
      RAISE EXCEPTION 'Selecciona una frecuencia válida para el plan.' USING ERRCODE = '22023';
    END IF;

    IF v_start_date IS NULL THEN
      RAISE EXCEPTION 'La fecha de inicio del plan es requerida.' USING ERRCODE = '22023';
    END IF;

    v_balance := round(v_total - v_paid, 2);
    IF v_balance <= 0 THEN
      RAISE EXCEPTION 'El plan no puede crearse si la venta ya quedó pagada.' USING ERRCODE = '22023';
    END IF;

    -- La última cuota absorbe la diferencia: las cuotas siempre suman el saldo
    v_regular := round(v_inst_amount * (v_inst_count - 1), 2);
    IF v_regular >= v_balance THEN
      RAISE EXCEPTION 'El monto y la cantidad de cuotas superan el saldo pendiente.' USING ERRCODE = '22023';
    END IF;

    v_status := CASE WHEN v_paid > 0 THEN 'partial' ELSE 'pending' END;
  ELSE
    v_payment_type := p_sale->>'payment_type';

    IF v_payment_type IS NULL OR v_payment_type NOT IN ('full', 'partial') THEN
      RAISE EXCEPTION 'Tipo de pago no válido.' USING ERRCODE = '22023';
    END IF;

    IF v_payment_type = 'full' THEN
      v_paid := v_total;
      v_status := 'paid';
    ELSE
      v_paid := round(coalesce(nullif(p_sale->>'paid_amount', '')::numeric, 0), 2);
      IF v_paid::text IN ('NaN', 'Infinity', '-Infinity') OR v_paid <= 0 OR v_paid >= v_total THEN
        RAISE EXCEPTION 'El monto pagado no es válido.' USING ERRCODE = '22023';
      END IF;
      v_status := 'partial';
    END IF;

    v_balance := round(v_total - v_paid, 2);
  END IF;

  INSERT INTO public.sales (
    company_id, created_by,
    customer_name, customer_company, customer_email, customer_phone,
    customer_ruc, customer_dv,
    amount, discount_amount, paid_amount, balance_due,
    payment_status, has_payment_plan,
    payment_method, payment_type,
    sale_date, payment_date,
    note, invoice_notes, invoice_number
  ) VALUES (
    p_company_id, v_uid,
    nullif(p_sale->>'customer_name', ''),
    nullif(p_sale->>'customer_company', ''),
    nullif(p_sale->>'customer_email', ''),
    nullif(p_sale->>'customer_phone', ''),
    nullif(p_sale->>'customer_ruc', ''),
    nullif(p_sale->>'customer_dv', ''),
    v_total,
    v_discount,
    v_paid,
    v_balance,
    v_status,
    p_plan IS NOT NULL,
    p_sale->>'payment_method',
    v_payment_type,
    (p_sale->>'sale_date')::date,
    nullif(p_sale->>'payment_date', '')::date,
    nullif(p_sale->>'note', ''),
    nullif(p_sale->>'invoice_notes', ''),
    btrim(p_invoice_number)
  )
  RETURNING id INTO v_sale_id;

  IF p_plan IS NOT NULL THEN
    INSERT INTO public.sale_payment_plans (
      sale_id, company_id, created_by,
      plan_name, down_payment_amount,
      installment_amount, installments_count,
      frequency, start_date, status, notes
    ) VALUES (
      v_sale_id, p_company_id, v_uid,
      nullif(p_plan->>'plan_name', ''), v_paid,
      v_inst_amount, v_inst_count,
      v_frequency, v_start_date, 'active', nullif(p_plan->>'plan_notes', '')
    )
    RETURNING id INTO v_plan_id;

    v_due_date := v_start_date;

    FOR i IN 1..v_inst_count LOOP
      INSERT INTO public.sale_installments (
        sale_id, plan_id, company_id,
        installment_number, due_date,
        amount, paid_amount, status
      ) VALUES (
        v_sale_id, v_plan_id, p_company_id,
        i, v_due_date,
        CASE WHEN i < v_inst_count THEN v_inst_amount ELSE round(v_balance - v_regular, 2) END,
        0, 'pending'
      );

      v_due_date := CASE v_frequency
        WHEN 'weekly'   THEN v_due_date + interval '7 days'
        WHEN 'biweekly' THEN v_due_date + interval '14 days'
        ELSE v_due_date + interval '1 month'
      END;
    END LOOP;
  END IF;

  INSERT INTO public.sale_items (
    sale_id, company_id, description, quantity, unit_price, sort_order, product_id
  )
  SELECT
    v_sale_id,
    p_company_id,
    btrim(t.e->>'description'),
    (t.e->>'quantity')::numeric,
    (t.e->>'unit_price')::numeric,
    coalesce((t.e->>'sort_order')::integer, (t.ord - 1)::integer),
    nullif(t.e->>'product_id', '')::uuid
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(e, ord);

  FOR v_req IN
    SELECT nullif(e->>'product_id', '')::uuid AS product_id,
           sum((e->>'quantity')::numeric)     AS qty
    FROM jsonb_array_elements(p_items) AS e
    WHERE nullif(e->>'product_id', '') IS NOT NULL
    GROUP BY 1
    ORDER BY 1
  LOOP
    SELECT p.id, p.name, p.stock, p.track_inventory
    INTO v_product
    FROM public.products p
    WHERE p.id = v_req.product_id
      AND p.company_id = p_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Uno de los productos no pertenece a este negocio.' USING ERRCODE = '42501';
    END IF;

    IF v_product.track_inventory THEN
      IF coalesce(v_product.stock, 0) < v_req.qty THEN
        RAISE EXCEPTION 'Stock insuficiente para "%" (disponible: %).',
          v_product.name, coalesce(v_product.stock, 0)
          USING ERRCODE = '23514', HINT = 'insufficient_stock';
      END IF;

      UPDATE public.products
      SET stock = coalesce(stock, 0) - v_req.qty
      WHERE id = v_product.id
        AND company_id = p_company_id;

      UPDATE public.sale_items
      SET inventory_deducted = true
      WHERE sale_id = v_sale_id
        AND company_id = p_company_id
        AND product_id = v_product.id;
    END IF;
  END LOOP;

  RETURN v_sale_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_sale_with_items(uuid, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sale_with_items(uuid, text, jsonb, jsonb, jsonb) TO authenticated, service_role;
