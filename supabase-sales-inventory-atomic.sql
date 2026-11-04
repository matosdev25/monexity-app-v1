-- ================================================================
-- MONEXITY — Ventas e inventario atómicos
-- Crea dos RPC transaccionales usadas por app/dashboard/sales/actions.ts:
--   * create_sale_with_items: venta (normal o a cuotas) + sale_items +
--     descuento de stock en una sola transacción.
--   * delete_sale_with_stock_restore: restaura stock y elimina la venta en
--     una sola transacción.
-- Cualquier error (stock insuficiente, producto ajeno, número duplicado,
-- fallo intermedio) revierte todo: no quedan ventas, ítems ni stock parciales.
--
-- Seguridad: SECURITY DEFINER con validación explícita de auth.uid(),
-- membresía, rol y company_id (mismo patrón que create_sale_with_plan).
-- Crear: owner/admin/seller. Eliminar: owner/admin.
-- No modifica políticas RLS ni create_sale_with_plan (la siguen usando las
-- cotizaciones). Idempotente.
-- sale_items.inventory_deducted (migración sale_items_inventory_deducted):
-- indica si el ítem descontó stock al venderse; la restauración al eliminar
-- usa solo ese dato histórico. Ventas anteriores: se marcan según el
-- track_inventory vigente del producto al aplicar la migración (mejor dato
-- disponible; replica el comportamiento previo de restauración).
-- ================================================================

BEGIN;

-- Columna y retroalimentación solo la primera vez (re-ejecutar no re-marca ítems)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sale_items' AND column_name = 'inventory_deducted'
  ) THEN
    ALTER TABLE public.sale_items
      ADD COLUMN inventory_deducted boolean NOT NULL DEFAULT false;

    UPDATE public.sale_items si
    SET inventory_deducted = true
    FROM public.products p
    WHERE si.product_id = p.id
      AND si.company_id = p.company_id
      AND p.track_inventory;
  END IF;
END $$;

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
  v_amount       numeric;
  v_paid         numeric;
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

  IF nullif(btrim(coalesce(p_invoice_number, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Falta el número de factura.' USING ERRCODE = '22023';
  END IF;

  IF p_sale IS NULL OR jsonb_typeof(p_sale) <> 'object' THEN
    RAISE EXCEPTION 'Datos de venta no válidos.' USING ERRCODE = '22023';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Agrega al menos un ítem válido.' USING ERRCODE = '22023';
  END IF;

  -- Validación por ítem: cada fila conserva su propio product_id y cantidad
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

  IF p_plan IS NOT NULL THEN
    -- Venta a cuotas: reutiliza la RPC vigente dentro de esta misma transacción
    SELECT s.sale_id INTO v_sale_id
    FROM public.create_sale_with_plan(
      p_company_id,
      v_uid,
      nullif(p_sale->>'customer_name', ''),
      nullif(p_sale->>'customer_email', ''),
      nullif(p_sale->>'customer_phone', ''),
      (p_sale->>'amount')::numeric,
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
        discount_amount  = coalesce((p_sale->>'discount_amount')::numeric, 0)
    WHERE id = v_sale_id
      AND company_id = p_company_id;
  ELSE
    v_payment_type := p_sale->>'payment_type';
    v_amount       := (p_sale->>'amount')::numeric;
    v_paid         := coalesce((p_sale->>'paid_amount')::numeric, 0);

    IF v_payment_type IS NULL OR v_payment_type NOT IN ('full', 'partial') THEN
      RAISE EXCEPTION 'Tipo de pago no válido.' USING ERRCODE = '22023';
    END IF;

    IF v_amount IS NULL OR v_amount::text IN ('NaN', 'Infinity', '-Infinity') OR v_amount <= 0 THEN
      RAISE EXCEPTION 'El monto total debe ser mayor a 0.' USING ERRCODE = '22023';
    END IF;

    IF v_paid::text IN ('NaN', 'Infinity', '-Infinity') OR v_paid < 0 OR v_paid > v_amount THEN
      RAISE EXCEPTION 'El monto pagado no es válido.' USING ERRCODE = '22023';
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
      v_amount,
      coalesce((p_sale->>'discount_amount')::numeric, 0),
      v_paid,
      v_amount - v_paid,
      p_sale->>'payment_status',
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

  -- Ítems: product_id viaja dentro de cada ítem (sin arrays paralelos)
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

  -- Stock: agrupado por producto, bloqueado en orden estable (evita deadlocks).
  -- Ítems con product_id NULL (servicios registrados o manuales) no participan.
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

      -- Registro histórico: estos ítems descontaron inventario
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


CREATE OR REPLACE FUNCTION public.delete_sale_with_stock_restore(
  p_company_id uuid,
  p_sale_id    uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_req     record;
  v_deleted integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado.' USING ERRCODE = '42501';
  END IF;

  -- Mismo permiso que canManageSalesRecords: solo owner/admin eliminan ventas
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = v_uid
      AND m.company_id = p_company_id
      AND lower(m.role) IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para eliminar ventas.' USING ERRCODE = '42501';
  END IF;

  PERFORM 1
  FROM public.sales s
  WHERE s.id = p_sale_id
    AND s.company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La venta no existe.' USING ERRCODE = 'P0002';
  END IF;

  -- Restaurar exactamente lo que la venta descontó (dato histórico del ítem),
  -- sin depender del valor actual de track_inventory del producto.
  FOR v_req IN
    SELECT si.product_id, sum(si.quantity) AS qty
    FROM public.sale_items si
    WHERE si.sale_id = p_sale_id
      AND si.company_id = p_company_id
      AND si.product_id IS NOT NULL
      AND si.inventory_deducted
    GROUP BY si.product_id
    ORDER BY si.product_id
  LOOP
    UPDATE public.products
    SET stock = coalesce(stock, 0) + v_req.qty
    WHERE id = v_req.product_id
      AND company_id = p_company_id;
  END LOOP;

  DELETE FROM public.sale_items
  WHERE sale_id = p_sale_id
    AND company_id = p_company_id;

  DELETE FROM public.sales
  WHERE id = p_sale_id
    AND company_id = p_company_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted <> 1 THEN
    RAISE EXCEPTION 'No se pudo eliminar la venta.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_sale_with_stock_restore(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_sale_with_stock_restore(uuid, uuid) TO authenticated, service_role;

COMMIT;

-- Verificación:
-- SELECT p.proname, p.prosecdef, pg_get_function_identity_arguments(p.oid)
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN ('create_sale_with_items', 'delete_sale_with_stock_restore');
