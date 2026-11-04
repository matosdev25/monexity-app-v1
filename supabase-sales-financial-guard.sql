-- ================================================================
-- MONEXITY — Acceso vigente y montos calculados en la base para ventas
-- Aplicada en Monexi como sales_financial_guard.
--
-- 1) assert_company_access(company_id): misma regla que canAccessCompanyApp
--    (lib/memberships/app-access.ts): empresa no bloqueada, con plan, y trial
--    vigente (fecha de Panamá) o período pagado (active/paid) no vencido.
--    Exige además que auth.uid() sea miembro de la empresa.
-- 2) create_sale_with_items: subtotal, descuento, total, pagado, saldo y estado
--    se calculan aquí a partir de los ítems; un "amount" del cliente que no
--    coincida se rechaza. El estado de pago enviado por el cliente se ignora.
-- 3) convert_quotation_to_sale_atomic (migración convert_quotation_tax_as_item):
--    el impuesto de la cotización se agrega como ítem "Impuesto" (sales no tiene
--    columna de impuesto) y ya no se envía "amount": el total lo calcula
--    create_sale_with_items. Su definición vigente está en ese migration; el
--    resto del cuerpo es igual al de supabase-quotations-atomic.sql.
-- 4) create_sale_with_plan deja de ser invocable por authenticated (solo se usa
--    dentro de create_sale_with_items, que corre como propietario).
-- Verificado con rollback: total manipulado, paid/status manipulados, abono,
-- descuento >= subtotal, trial vencido, cuotas manipuladas, llamada directa al
-- plan y conversión con impuesto (100 − 10 + 7 = 97).
-- Sin cambios de firma, tablas ni RLS.
-- ================================================================

CREATE OR REPLACE FUNCTION public.assert_company_access(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_company record;
  v_status  text;
  v_today   date := (now() AT TIME ZONE 'America/Panama')::date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = v_uid AND m.company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'No tienes acceso a esta empresa.' USING ERRCODE = '42501';
  END IF;

  SELECT c.is_blocked, c.subscription_plan, c.subscription_status, c.trial_ends_at, c.current_period_ends_at
  INTO v_company
  FROM public.companies c
  WHERE c.id = p_company_id;

  v_status := lower(coalesce(v_company.subscription_status, ''));

  IF coalesce(v_company.is_blocked, false)
     OR v_company.subscription_plan IS NULL
     OR (v_status = 'trialing' AND (
           v_company.trial_ends_at IS NULL
           OR (v_company.trial_ends_at AT TIME ZONE 'America/Panama')::date < v_today))
     OR (v_status <> 'trialing' AND (
           v_status NOT IN ('active', 'paid')
           OR v_company.current_period_ends_at IS NULL
           OR v_company.current_period_ends_at <= now()))
  THEN
    RAISE EXCEPTION 'Tu cuenta necesita pago activo para usar ventas.'
      USING ERRCODE = '42501', HINT = 'account_inactive';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_company_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_company_access(uuid) TO authenticated, service_role;

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
  v_item         jsonb;
  v_qty          numeric;
  v_price        numeric;
  v_subtotal     numeric;
  v_discount     numeric;
  v_total        numeric;
  v_client_total numeric;
  v_paid         numeric;
  v_status       text;
  v_payment_type text;
  v_req          record;
  v_product      record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;

  -- PROJECT.md: seller puede registrar ventas
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = v_uid
      AND m.company_id = p_company_id
      AND lower(m.role) IN ('owner', 'admin', 'seller')
  ) THEN
    RAISE EXCEPTION 'No tienes acceso a esta empresa.' USING ERRCODE = '42501';
  END IF;

  -- Acceso vigente (trial o período pagado): el bloqueo del dashboard no basta
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

  -- Montos calculados aquí (misma regla que la app): total = Σ(cant × precio) − descuento
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

  -- Un total enviado por el cliente que no coincida con los ítems se rechaza
  v_client_total := nullif(p_sale->>'amount', '')::numeric;
  IF v_client_total IS NOT NULL AND abs(round(v_client_total, 2) - v_total) > 0.005 THEN
    RAISE EXCEPTION 'El total no coincide con los ítems de la venta.' USING ERRCODE = '22023';
  END IF;

  IF p_plan IS NOT NULL THEN
    -- Venta a cuotas: la RPC del plan recibe el total calculado aquí
    SELECT s.sale_id INTO v_sale_id
    FROM public.create_sale_with_plan(
      p_company_id,
      v_uid,
      nullif(p_sale->>'customer_name', ''),
      nullif(p_sale->>'customer_email', ''),
      nullif(p_sale->>'customer_phone', ''),
      v_total,
      p_sale->>'payment_method',
      'installment',
      (p_sale->>'sale_date')::date,
      nullif(p_sale->>'payment_date', '')::date,
      nullif(p_sale->>'note', ''),
      nullif(p_sale->>'invoice_notes', ''),
      (p_plan->>'down_payment_amount')::numeric,
      nullif(p_plan->>'plan_name', ''),
      p_plan->>'frequency',
      (p_plan->>'installment_amount')::numeric,
      (p_plan->>'installments_count')::integer,
      (p_plan->>'start_date')::date,
      nullif(p_plan->>'plan_notes', '')
    ) s;

    IF v_sale_id IS NULL THEN
      RAISE EXCEPTION 'No se pudo crear la venta con plan.' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.sales
    SET invoice_number   = btrim(p_invoice_number),
        customer_company = nullif(p_sale->>'customer_company', ''),
        customer_ruc     = nullif(p_sale->>'customer_ruc', ''),
        customer_dv      = nullif(p_sale->>'customer_dv', ''),
        discount_amount  = v_discount
    WHERE id = v_sale_id
      AND company_id = p_company_id;
  ELSE
    v_payment_type := p_sale->>'payment_type';

    IF v_payment_type IS NULL OR v_payment_type NOT IN ('full', 'partial') THEN
      RAISE EXCEPTION 'Tipo de pago no válido.' USING ERRCODE = '22023';
    END IF;

    IF v_payment_type = 'full' THEN
      -- Pago completo: se cobra el total calculado, no lo que diga el cliente
      v_paid := v_total;
      v_status := 'paid';
    ELSE
      v_paid := round(coalesce(nullif(p_sale->>'paid_amount', '')::numeric, 0), 2);
      IF v_paid::text IN ('NaN', 'Infinity', '-Infinity') OR v_paid <= 0 OR v_paid >= v_total THEN
        RAISE EXCEPTION 'El monto pagado no es válido.' USING ERRCODE = '22023';
      END IF;
      v_status := 'partial';
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
      round(v_total - v_paid, 2),
      v_status,
      false,
      p_sale->>'payment_method',
      v_payment_type,
      (p_sale->>'sale_date')::date,
      nullif(p_sale->>'payment_date', '')::date,
      nullif(p_sale->>'note', ''),
      nullif(p_sale->>'invoice_notes', ''),
      btrim(p_invoice_number)
    )
    RETURNING id INTO v_sale_id;
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

  -- Stock: agrupado por producto, bloqueado en orden estable (evita deadlocks)
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

-- create_sale_with_plan solo se usa dentro de create_sale_with_items (que corre
-- como propietario): llamarla directo permitiría montos sin ítems.
REVOKE ALL ON FUNCTION public.create_sale_with_plan(uuid, uuid, text, text, text, numeric, text, text, date, date, text, text, numeric, text, text, numeric, integer, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_sale_with_plan(uuid, uuid, text, text, text, numeric, text, text, date, date, text, text, numeric, text, text, numeric, integer, date, text) TO service_role;
