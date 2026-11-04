-- ================================================================
-- MONEXITY — Tilopay (tarjetas / recurrencia)
-- Aplicado en Monexi (mnwzltvkwfxlpxuwshfo) como migración tilopay_provider_and_confirmation.
-- Aditiva: no borra datos, no desactiva RLS, no abre EXECUTE a anon/authenticated.
--
-- 1. 'tilopay' se añade a los CHECK de proveedor de las tres tablas neutrales
--    (se recrea el CHECK con el mismo nombre; los valores previos se conservan).
-- 2. Un mismo id de transacción Tilopay nunca puede pertenecer a dos intents.
-- 3. confirm_tilopay_payment: aplica de forma atómica e idempotente el resultado
--    YA VALIDADO en servidor contra POST /api/v1/consult (orden, monto, moneda,
--    aprobación y entorno). Bloquea intent → empresa (vía
--    activate_subscription_from_intent) y actualiza billing_subscriptions en la
--    misma transacción. SECURITY INVOKER: solo la ejecuta service_role, que ya
--    tiene los privilegios necesarios; no se necesita SECURITY DEFINER.
-- ================================================================

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['payment_intents', 'billing_subscriptions', 'billing_provider_events'] LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', v_table, v_table || '_provider_check');
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (provider IN (''manual'', ''yappy_manual'', ''paguelofacil'', ''yappy'', ''tilopay''))',
      v_table,
      v_table || '_provider_check'
    );
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_tilopay_transaction
  ON public.payment_intents (provider, provider_transaction_id)
  WHERE provider = 'tilopay' AND provider_transaction_id IS NOT NULL;

-- p_result: resultado normalizado por el servidor tras consultar Tilopay.
--   succeeded → transacción aprobada y coincidente (orden, monto, moneda USD, entorno)
--   failed    → rechazo explícito del emisor/Tilopay
--   pending   → sin transacción todavía o estado ambiguo
--   review    → aprobada pero con discrepancias (monto/moneda/entorno/tipo): revisión manual
CREATE OR REPLACE FUNCTION public.confirm_tilopay_payment(
  p_intent_id      uuid,
  p_order_number   text,
  p_result         text,
  p_transaction_id text,
  p_amount         numeric,
  p_currency       text,
  p_raw_response   jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_intent public.payment_intents%ROWTYPE;
  v_status text;
  v_sub_id uuid;
  v_sub_provider text;
BEGIN
  IF p_intent_id IS NULL
     OR coalesce(btrim(p_order_number), '') = ''
     OR p_result NOT IN ('succeeded', 'failed', 'pending', 'review') THEN
    RETURN 'invalid';
  END IF;

  SELECT * INTO v_intent
  FROM public.payment_intents
  WHERE id = p_intent_id
  FOR UPDATE;

  IF NOT FOUND OR v_intent.provider <> 'tilopay' THEN
    RETURN 'not_found';
  END IF;

  IF v_intent.provider_order_id IS DISTINCT FROM p_order_number THEN
    RETURN 'order_mismatch';
  END IF;

  -- Idempotencia: un intent pagado nunca se vuelve a acreditar ni retrocede.
  IF v_intent.status = 'paid' THEN
    RETURN 'already_paid';
  END IF;

  IF v_intent.status = 'manual_review' THEN
    RETURN 'needs_review';
  END IF;

  IF p_result = 'pending' THEN
    IF v_intent.status IN ('pending', 'claimed') THEN
      UPDATE public.payment_intents
      SET status = 'awaiting_verification',
          raw_response = coalesce(p_raw_response, raw_response),
          updated_at = NOW()
      WHERE id = p_intent_id;

      INSERT INTO public.payment_audit_logs (intent_id, action, from_status, to_status, actor_type, metadata)
      VALUES (p_intent_id, 'provider_pending', v_intent.status, 'awaiting_verification', 'system',
              jsonb_build_object('provider', 'tilopay', 'order_number', p_order_number));
    END IF;
    RETURN 'pending';
  END IF;

  IF p_result = 'failed' THEN
    IF v_intent.status IN ('pending', 'claimed', 'awaiting_verification') THEN
      UPDATE public.payment_intents
      SET status = 'failed',
          provider_transaction_id = coalesce(nullif(btrim(p_transaction_id), ''), provider_transaction_id),
          raw_response = coalesce(p_raw_response, raw_response),
          updated_at = NOW()
      WHERE id = p_intent_id;

      PERFORM public.release_intent_discount(p_intent_id);

      INSERT INTO public.payment_audit_logs (intent_id, action, from_status, to_status, actor_type, metadata)
      VALUES (p_intent_id, 'provider_not_approved', v_intent.status, 'failed', 'system',
              jsonb_build_object('provider', 'tilopay', 'order_number', p_order_number,
                                 'provider_transaction_id', p_transaction_id));
      RETURN 'not_approved';
    END IF;
    RETURN 'already_final';
  END IF;

  -- succeeded / review: hubo un cobro aprobado en Tilopay para esta orden.
  IF coalesce(btrim(p_transaction_id), '') = '' THEN
    RETURN 'invalid';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payment_intents o
    WHERE o.provider = 'tilopay'
      AND o.provider_transaction_id = p_transaction_id
      AND o.id <> p_intent_id
  ) THEN
    RETURN 'transaction_used';
  END IF;

  -- Defensa en profundidad: el servidor ya comparó monto y moneda; si llegan
  -- distintos al intent, nunca se acredita.
  IF p_result = 'succeeded'
     AND (p_amount IS DISTINCT FROM v_intent.exact_amount
          OR upper(coalesce(p_currency, '')) <> upper(v_intent.currency)) THEN
    p_result := 'review';
  END IF;

  -- Aprobado pero con discrepancias, o intent ya expirado/cancelado/fallido:
  -- se conserva el cobro para revisión manual, nunca se acredita automáticamente.
  IF p_result = 'review' OR v_intent.status NOT IN ('pending', 'claimed', 'awaiting_verification') THEN
    UPDATE public.payment_intents
    SET status = 'manual_review',
        provider_transaction_id = p_transaction_id,
        provider_payment_id = p_transaction_id,
        raw_response = coalesce(p_raw_response, raw_response),
        updated_at = NOW()
    WHERE id = p_intent_id;

    INSERT INTO public.payment_audit_logs (intent_id, action, from_status, to_status, actor_type, metadata)
    VALUES (p_intent_id, 'provider_approved_needs_review', v_intent.status, 'manual_review', 'system',
            jsonb_build_object('provider', 'tilopay', 'order_number', p_order_number,
                               'provider_transaction_id', p_transaction_id,
                               'provider_amount', p_amount, 'provider_currency', p_currency));
    RETURN 'needs_review';
  END IF;

  UPDATE public.payment_intents
  SET provider_transaction_id = p_transaction_id,
      provider_payment_id = p_transaction_id,
      raw_response = coalesce(p_raw_response, raw_response),
      updated_at = NOW()
  WHERE id = p_intent_id;

  -- Bloquea intent → empresa → descuento y acredita exactamente el período guardado.
  PERFORM public.activate_subscription_from_intent(p_intent_id, 'tilopay-consult');

  SELECT status INTO v_status FROM public.payment_intents WHERE id = p_intent_id;
  IF v_status <> 'paid' THEN
    -- Cobro registrado, pero su período ya estaba cubierto: queda en revisión.
    RETURN 'needs_review';
  END IF;

  -- Relación de facturación Tilopay de la empresa, en la misma transacción.
  IF v_intent.intent_type = 'subscription_payment' THEN
    SELECT id, provider INTO v_sub_id, v_sub_provider
    FROM public.billing_subscriptions
    WHERE company_id = v_intent.company_id
      AND status IN ('pending', 'active', 'past_due', 'cancel_requested')
    FOR UPDATE;

    IF v_sub_id IS NULL THEN
      INSERT INTO public.billing_subscriptions (
        company_id, provider, plan_id, billing_cycle, amount, currency, status,
        external_status, external_status_observed_at, current_period_start, current_period_end
      )
      VALUES (
        v_intent.company_id, 'tilopay', v_intent.plan_id, v_intent.billing_cycle,
        v_intent.exact_amount, v_intent.currency, 'active',
        'consult_approved', NOW(), v_intent.period_start, v_intent.period_end
      )
      RETURNING id INTO v_sub_id;
      v_sub_provider := 'tilopay';
    ELSIF v_sub_provider = 'tilopay' THEN
      UPDATE public.billing_subscriptions
      SET plan_id = v_intent.plan_id,
          billing_cycle = v_intent.billing_cycle,
          amount = v_intent.exact_amount,
          currency = v_intent.currency,
          status = CASE WHEN status = 'cancel_requested' THEN status ELSE 'active' END,
          external_status = 'consult_approved',
          external_status_observed_at = NOW(),
          current_period_start = v_intent.period_start,
          current_period_end = v_intent.period_end
      WHERE id = v_sub_id;
    END IF;

    IF v_sub_provider = 'tilopay' THEN
      UPDATE public.payment_intents
      SET billing_subscription_id = v_sub_id
      WHERE id = p_intent_id;
    END IF;
  END IF;

  RETURN 'activated';
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_tilopay_payment(uuid, text, text, text, numeric, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_tilopay_payment(uuid, text, text, text, numeric, text, jsonb) TO service_role;

-- Verificación:
-- SELECT conrelid::regclass, pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conname IN ('payment_intents_provider_check','billing_subscriptions_provider_check','billing_provider_events_provider_check');
-- SELECT has_function_privilege('anon', 'public.confirm_tilopay_payment(uuid,text,text,text,numeric,text,jsonb)', 'EXECUTE'),
--        has_function_privilege('authenticated', 'public.confirm_tilopay_payment(uuid,text,text,text,numeric,text,jsonb)', 'EXECUTE'),
--        has_function_privilege('service_role', 'public.confirm_tilopay_payment(uuid,text,text,text,numeric,text,jsonb)', 'EXECUTE');

-- ================================================================
-- Delta aplicado como migración tilopay_open_intent_guard.
-- 1. Una sola intención Tilopay abierta por empresa (pending/claimed/
--    awaiting_verification): dos solicitudes concurrentes no pueden crear dos
--    órdenes ni llamar dos veces a processPayment.
-- 2. expire_stale_intents ya no expira intenciones Tilopay en
--    awaiting_verification: siguen abiertas hasta conciliarse con consult.
--    (Cuerpo idéntico al vigente salvo la condición añadida.)
-- ================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_tilopay_one_open_per_company
  ON public.payment_intents (company_id)
  WHERE provider = 'tilopay' AND status IN ('pending', 'claimed', 'awaiting_verification');

CREATE OR REPLACE FUNCTION public.expire_stale_intents()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_count integer;
BEGIN
  WITH locked AS (
    SELECT pi.id, pi.status AS old_status, pi.slot_id, pi.discount_code_id,
           (pi.discount_code_id IS NOT NULL
            AND pi.discount_reserved_at IS NOT NULL
            AND pi.discount_released_at IS NULL) AS release_discount
    FROM payment_intents pi
    WHERE pi.expires_at < NOW()
      AND NOT (pi.provider = 'tilopay' AND pi.status = 'awaiting_verification')
      AND (
        pi.status IN ('pending', 'claimed', 'awaiting_verification')
        OR (pi.status = 'manual_review'
            AND pi.provider = 'yappy_manual'
            AND pi.provider_transaction_id IS NULL)
      )
    FOR UPDATE SKIP LOCKED
  ),
  expired AS (
    UPDATE payment_intents pi
    SET status = 'expired',
        discount_released_at = CASE WHEN l.release_discount THEN NOW() ELSE pi.discount_released_at END,
        updated_at = NOW()
    FROM locked l
    WHERE pi.id = l.id
    RETURNING pi.id, l.old_status, l.slot_id, l.discount_code_id, l.release_discount
  ),
  released AS (
    UPDATE payment_amount_slots s
    SET reserved_by = NULL, reserved_at = NULL, slot_expires_at = NULL
    FROM expired e
    WHERE s.id = e.slot_id
      AND s.reserved_by = e.id
    RETURNING s.id
  ),
  discounts AS (
    UPDATE discount_codes d
    SET used_count = greatest(d.used_count - x.n, 0)
    FROM (
      SELECT discount_code_id, count(*)::integer AS n
      FROM expired
      WHERE release_discount
      GROUP BY discount_code_id
    ) x
    WHERE d.id = x.discount_code_id
    RETURNING d.id
  ),
  audited AS (
    INSERT INTO payment_audit_logs (intent_id, action, from_status, to_status, actor_type)
    SELECT e.id, 'expired', e.old_status, 'expired', 'system'
    FROM expired e
    RETURNING id
  )
  SELECT count(*)::integer INTO v_count FROM expired;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.expire_stale_intents() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_intents() TO service_role;

-- ================================================================
-- Delta aplicado como migración tilopay_recurring_events.
-- 1. Se conserva idx_payment_intents_tilopay_one_open_per_company (sin DROP:
--    operación destructiva no necesaria). Si un cobro recurrente llega mientras
--    la empresa tiene un checkout abierto, el evento queda 'received' con
--    'retry_later' (Tilopay reintenta) y nunca se acredita a medias.
-- 2. confirm_tilopay_payment crea/actualiza y vincula la relación Tilopay en la
--    misma transacción. Si el intent ya trae billing_subscription_id (cobro
--    recurrente), se actualiza esa relación. Si la empresa tiene una relación
--    abierta de OTRO proveedor, no se toca (ver tilopay_root_cause_fixes).
-- 3. apply_tilopay_subscription_event: aplica de forma atómica e idempotente
--    los cinco eventos recurrentes. Exige billing_provider_events.signature_valid
--    = true (puerta en base de datos, además de la del servidor). La relación se
--    identifica por external_subscription_id = 'plan:<id_plan>:<email>'.
--    Cancelación (webhook_unsubscribe): detiene la relación y marca
--    subscription_cancel_at_period_end; el acceso se conserva hasta
--    current_period_ends_at (no se toca).
--    Ambas funciones son SECURITY INVOKER, solo service_role.
-- ================================================================
CREATE OR REPLACE FUNCTION public.confirm_tilopay_payment(
  p_intent_id      uuid,
  p_order_number   text,
  p_result         text,
  p_transaction_id text,
  p_amount         numeric,
  p_currency       text,
  p_raw_response   jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_intent public.payment_intents%ROWTYPE;
  v_status text;
  v_sub_id uuid;
  v_sub_provider text;
BEGIN
  IF p_intent_id IS NULL
     OR coalesce(btrim(p_order_number), '') = ''
     OR p_result NOT IN ('succeeded', 'failed', 'pending', 'review') THEN
    RETURN 'invalid';
  END IF;

  SELECT * INTO v_intent
  FROM public.payment_intents
  WHERE id = p_intent_id
  FOR UPDATE;

  IF NOT FOUND OR v_intent.provider <> 'tilopay' THEN
    RETURN 'not_found';
  END IF;

  IF v_intent.provider_order_id IS DISTINCT FROM p_order_number THEN
    RETURN 'order_mismatch';
  END IF;

  IF v_intent.status = 'paid' THEN
    RETURN 'already_paid';
  END IF;

  IF v_intent.status = 'manual_review' THEN
    RETURN 'needs_review';
  END IF;

  IF p_result = 'pending' THEN
    IF v_intent.status IN ('pending', 'claimed') THEN
      UPDATE public.payment_intents
      SET status = 'awaiting_verification',
          raw_response = coalesce(p_raw_response, raw_response),
          updated_at = NOW()
      WHERE id = p_intent_id;

      INSERT INTO public.payment_audit_logs (intent_id, action, from_status, to_status, actor_type, metadata)
      VALUES (p_intent_id, 'provider_pending', v_intent.status, 'awaiting_verification', 'system',
              jsonb_build_object('provider', 'tilopay', 'order_number', p_order_number));
    END IF;
    RETURN 'pending';
  END IF;

  IF p_result = 'failed' THEN
    IF v_intent.status IN ('pending', 'claimed', 'awaiting_verification') THEN
      UPDATE public.payment_intents
      SET status = 'failed',
          provider_transaction_id = coalesce(nullif(btrim(p_transaction_id), ''), provider_transaction_id),
          raw_response = coalesce(p_raw_response, raw_response),
          updated_at = NOW()
      WHERE id = p_intent_id;

      PERFORM public.release_intent_discount(p_intent_id);

      INSERT INTO public.payment_audit_logs (intent_id, action, from_status, to_status, actor_type, metadata)
      VALUES (p_intent_id, 'provider_not_approved', v_intent.status, 'failed', 'system',
              jsonb_build_object('provider', 'tilopay', 'order_number', p_order_number,
                                 'provider_transaction_id', p_transaction_id));
      RETURN 'not_approved';
    END IF;
    RETURN 'already_final';
  END IF;

  IF coalesce(btrim(p_transaction_id), '') = '' THEN
    RETURN 'invalid';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payment_intents o
    WHERE o.provider = 'tilopay'
      AND o.provider_transaction_id = p_transaction_id
      AND o.id <> p_intent_id
  ) THEN
    RETURN 'transaction_used';
  END IF;

  IF p_result = 'succeeded'
     AND (p_amount IS DISTINCT FROM v_intent.exact_amount
          OR upper(coalesce(p_currency, '')) <> upper(v_intent.currency)) THEN
    p_result := 'review';
  END IF;

  IF p_result = 'review' OR v_intent.status NOT IN ('pending', 'claimed', 'awaiting_verification') THEN
    UPDATE public.payment_intents
    SET status = 'manual_review',
        provider_transaction_id = p_transaction_id,
        provider_payment_id = p_transaction_id,
        raw_response = coalesce(p_raw_response, raw_response),
        updated_at = NOW()
    WHERE id = p_intent_id;

    INSERT INTO public.payment_audit_logs (intent_id, action, from_status, to_status, actor_type, metadata)
    VALUES (p_intent_id, 'provider_approved_needs_review', v_intent.status, 'manual_review', 'system',
            jsonb_build_object('provider', 'tilopay', 'order_number', p_order_number,
                               'provider_transaction_id', p_transaction_id,
                               'provider_amount', p_amount, 'provider_currency', p_currency));
    RETURN 'needs_review';
  END IF;

  UPDATE public.payment_intents
  SET provider_transaction_id = p_transaction_id,
      provider_payment_id = p_transaction_id,
      raw_response = coalesce(p_raw_response, raw_response),
      updated_at = NOW()
  WHERE id = p_intent_id;

  -- Bloquea intent → empresa → descuento y acredita exactamente el período guardado.
  PERFORM public.activate_subscription_from_intent(p_intent_id, 'tilopay-consult');

  SELECT status INTO v_status FROM public.payment_intents WHERE id = p_intent_id;
  IF v_status <> 'paid' THEN
    RETURN 'needs_review';
  END IF;

  -- Relación de facturación de la empresa, en la misma transacción.
  IF v_intent.intent_type = 'subscription_payment' THEN
    IF v_intent.billing_subscription_id IS NOT NULL THEN
      SELECT id, provider INTO v_sub_id, v_sub_provider
      FROM public.billing_subscriptions
      WHERE id = v_intent.billing_subscription_id
      FOR UPDATE;
    ELSE
      SELECT id, provider INTO v_sub_id, v_sub_provider
      FROM public.billing_subscriptions
      WHERE company_id = v_intent.company_id
        AND status IN ('pending', 'active', 'past_due', 'cancel_requested')
      FOR UPDATE;
    END IF;

    -- Relación abierta de otro proveedor: NO se marca cancelada (su renovación
    -- no se detuvo en ese proveedor). Queda intacta y pendiente de intervención.
    -- (Definición vigente desde la migración tilopay_root_cause_fixes.)
    IF v_sub_id IS NOT NULL AND v_sub_provider <> 'tilopay' THEN
      INSERT INTO public.payment_audit_logs (intent_id, action, actor_type, metadata)
      VALUES (p_intent_id, 'external_subscription_cancellation_required', 'system',
              jsonb_build_object('open_subscription_id', v_sub_id, 'open_subscription_provider', v_sub_provider));
      RETURN 'activated';
    END IF;

    IF v_sub_id IS NULL THEN
      INSERT INTO public.billing_subscriptions (
        company_id, provider, plan_id, billing_cycle, amount, currency, status,
        external_status, external_status_observed_at, current_period_start, current_period_end
      )
      VALUES (
        v_intent.company_id, 'tilopay', v_intent.plan_id, v_intent.billing_cycle,
        v_intent.exact_amount, v_intent.currency, 'active',
        'consult_approved', NOW(), v_intent.period_start, v_intent.period_end
      )
      RETURNING id INTO v_sub_id;
    ELSE
      UPDATE public.billing_subscriptions
      SET plan_id = v_intent.plan_id,
          billing_cycle = v_intent.billing_cycle,
          amount = v_intent.exact_amount,
          currency = v_intent.currency,
          status = CASE WHEN status IN ('cancel_requested', 'cancelled') THEN status ELSE 'active' END,
          external_status = 'consult_approved',
          external_status_observed_at = NOW(),
          current_period_start = v_intent.period_start,
          current_period_end = v_intent.period_end
      WHERE id = v_sub_id;
    END IF;

    UPDATE public.payment_intents
    SET billing_subscription_id = v_sub_id
    WHERE id = p_intent_id;
  END IF;

  RETURN 'activated';
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_tilopay_payment(uuid, text, text, text, numeric, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_tilopay_payment(uuid, text, text, text, numeric, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_tilopay_subscription_event(
  p_event_id                 uuid,
  p_event_type               text,
  p_external_subscription_id text,
  p_order_number             text,
  p_transaction_id           text,
  p_amount                   numeric,
  p_currency                 text,
  p_raw                      jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event   public.billing_provider_events%ROWTYPE;
  v_sub     public.billing_subscriptions%ROWTYPE;
  v_company public.companies%ROWTYPE;
  v_intent_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_result text := 'applied';
BEGIN
  SELECT * INTO v_event FROM public.billing_provider_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.provider <> 'tilopay' THEN RETURN 'event_not_found'; END IF;
  IF v_event.processing_status <> 'received' THEN RETURN 'already_processed'; END IF;
  -- Nunca se aplican cambios de negocio sin firma verificada.
  IF v_event.signature_valid IS NOT TRUE THEN RETURN 'signature_not_verified'; END IF;
  IF v_event.event_type IS DISTINCT FROM p_event_type THEN RETURN 'event_type_mismatch'; END IF;

  SELECT * INTO v_sub
  FROM public.billing_subscriptions
  WHERE provider = 'tilopay' AND external_subscription_id = p_external_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    UPDATE public.billing_provider_events
    SET processing_status = 'ignored', processing_error = 'subscription_not_found',
        processed_at = NOW(), attempts = attempts + 1
    WHERE id = p_event_id;
    RETURN 'subscription_not_found';
  END IF;

  IF p_event_type = 'webhook_payment' THEN
    IF coalesce(btrim(p_order_number), '') = '' OR coalesce(btrim(p_transaction_id), '') = '' THEN
      UPDATE public.billing_provider_events
      SET processing_status = 'failed', processing_error = 'invalid_payment_event',
          attempts = attempts + 1, company_id = v_sub.company_id, billing_subscription_id = v_sub.id
      WHERE id = p_event_id;
      RETURN 'invalid';
    END IF;

    -- Un mismo cobro (orderNumber de Tilopay) nunca acredita dos veces.
    SELECT id INTO v_intent_id FROM public.payment_intents
    WHERE provider = 'tilopay' AND provider_order_id = p_order_number;

    IF v_intent_id IS NOT NULL THEN
      v_result := 'already_processed';
    ELSE
      SELECT * INTO v_company FROM public.companies WHERE id = v_sub.company_id FOR UPDATE;

      -- Período por calendario (hora de Panamá): empieza al terminar el vigente.
      v_start := greatest(NOW(), coalesce(v_company.current_period_ends_at, NOW()));
      v_end := ((v_start AT TIME ZONE 'America/Panama')
                + CASE WHEN v_sub.billing_cycle = 'annual' THEN interval '1 year' ELSE interval '1 month' END)
               AT TIME ZONE 'America/Panama';

      BEGIN
        INSERT INTO public.payment_intents (
          company_id, user_id, plan_id, billing_cycle, exact_amount, currency, provider,
          provider_order_id, provider_subscription_id, billing_subscription_id,
          intent_type, status, expires_at, period_start, period_end
        )
        VALUES (
          v_sub.company_id, v_company.owner_user_id, v_sub.plan_id, v_sub.billing_cycle,
          v_sub.amount, v_sub.currency, 'tilopay',
          p_order_number, v_sub.external_subscription_id, v_sub.id,
          'subscription_payment', 'pending', NOW() + interval '1 day', v_start, v_end
        )
        RETURNING id INTO v_intent_id;
      EXCEPTION WHEN unique_violation THEN
        -- Checkout abierto de la misma empresa (o carrera con otro evento):
        -- el evento sigue 'received' para reintentarse; nada se acredita.
        UPDATE public.billing_provider_events
        SET attempts = attempts + 1, processing_error = 'retry_later_open_checkout',
            company_id = v_sub.company_id, billing_subscription_id = v_sub.id
        WHERE id = p_event_id;
        RETURN 'retry_later';
      END;

      INSERT INTO public.payment_audit_logs (intent_id, action, to_status, actor_type, metadata)
      VALUES (v_intent_id, 'created', 'pending', 'system',
              jsonb_build_object('provider', 'tilopay', 'source', 'webhook_payment', 'event_id', p_event_id));

      -- El monto esperado es el de la relación (lib/plans al registrarla); si
      -- Tilopay informa otro monto/moneda, confirm lo deja en revisión manual.
      v_result := public.confirm_tilopay_payment(
        v_intent_id, p_order_number, 'succeeded', p_transaction_id, p_amount, p_currency, p_raw
      );
    END IF;

    UPDATE public.billing_provider_events
    SET processing_status = 'processed', processed_at = NOW(), attempts = attempts + 1,
        company_id = v_sub.company_id, billing_subscription_id = v_sub.id,
        payment_intent_id = v_intent_id,
        processing_error = CASE WHEN v_result IN ('activated', 'already_processed') THEN NULL ELSE v_result END
    WHERE id = p_event_id;
    RETURN v_result;
  ELSIF p_event_type = 'webhook_subscribe' THEN
    UPDATE public.billing_subscriptions
    SET status = CASE WHEN status = 'pending' THEN 'active' ELSE status END,
        external_status = 'subscribed', external_status_observed_at = NOW()
    WHERE id = v_sub.id;
  ELSIF p_event_type = 'webhook_rejected' THEN
    UPDATE public.billing_subscriptions
    SET status = CASE WHEN status IN ('active', 'pending') THEN 'past_due' ELSE status END,
        external_status = 'payment_rejected', external_status_observed_at = NOW()
    WHERE id = v_sub.id;
  ELSIF p_event_type = 'webhook_unsubscribe' THEN
    -- Detiene cargos futuros; el acceso pagado se conserva hasta current_period_ends_at.
    UPDATE public.billing_subscriptions
    SET status = 'cancelled', cancelled_at = NOW(),
        cancel_requested_at = coalesce(cancel_requested_at, NOW()),
        external_status = 'unsubscribed', external_status_observed_at = NOW()
    WHERE id = v_sub.id;
    UPDATE public.companies
    SET subscription_cancel_at_period_end = true, subscription_cancelled_at = NOW()
    WHERE id = v_sub.company_id;
  ELSIF p_event_type = 'webhook_reactive' THEN
    UPDATE public.billing_subscriptions
    SET status = 'active', cancelled_at = NULL, cancel_requested_at = NULL,
        external_status = 'reactivated', external_status_observed_at = NOW()
    WHERE id = v_sub.id;
    UPDATE public.companies
    SET subscription_cancel_at_period_end = false, subscription_cancelled_at = NULL
    WHERE id = v_sub.company_id;
  ELSE
    RETURN 'invalid_event_type';
  END IF;

  UPDATE public.billing_provider_events
  SET processing_status = 'processed', processed_at = NOW(), attempts = attempts + 1,
      processing_error = NULL, company_id = v_sub.company_id, billing_subscription_id = v_sub.id
  WHERE id = p_event_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_tilopay_subscription_event(uuid, text, text, text, text, numeric, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_tilopay_subscription_event(uuid, text, text, text, text, numeric, text, jsonb) TO service_role;

-- ================================================================
-- Delta aplicado como migración tilopay_root_cause_fixes.
-- 1. retarget_tilopay_intent: mientras exista una intención Tilopay abierta
--    NUNCA se abre otra orden. Si el usuario cambia de selección y consult
--    confirma que la orden no tiene transacción, se re-apunta la MISMA
--    intención (mismo orderNumber, como indican los reintentos seguros de
--    Tilopay). Tilopay rechaza un orderNumber repetido, así que de los enlaces
--    emitidos para esa orden solo uno puede cobrar; si se pagara el anterior,
--    el monto no coincide y confirm lo deja en revisión manual.
-- 2. confirm_tilopay_payment: la versión vigente es la de arriba (bloque
--    "Relación abierta de otro proveedor"): no cancela localmente relaciones
--    de otros proveedores; registra external_subscription_cancellation_required.
-- SECURITY INVOKER, solo service_role.
-- ================================================================
CREATE OR REPLACE FUNCTION public.retarget_tilopay_intent(
  p_intent_id        uuid,
  p_plan_id          text,
  p_billing_cycle    text,
  p_intent_type      text,
  p_exact_amount     numeric,
  p_period_start     timestamptz,
  p_period_end       timestamptz,
  p_expires_at       timestamptz,
  p_discount_code_id uuid,
  p_discount_code    text,
  p_discount_amount  numeric
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v public.payment_intents%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.payment_intents WHERE id = p_intent_id FOR UPDATE;
  IF NOT FOUND OR v.provider <> 'tilopay' OR v.billing_subscription_id IS NOT NULL THEN
    RETURN 'not_found';
  END IF;
  IF v.status NOT IN ('pending', 'claimed', 'awaiting_verification') THEN
    RETURN 'not_open';
  END IF;

  IF v.discount_code_id IS DISTINCT FROM p_discount_code_id THEN
    PERFORM public.release_intent_discount(p_intent_id);
  END IF;

  UPDATE public.payment_intents
  SET plan_id = p_plan_id,
      billing_cycle = p_billing_cycle,
      intent_type = p_intent_type,
      exact_amount = p_exact_amount,
      period_start = p_period_start,
      period_end = p_period_end,
      expires_at = p_expires_at,
      discount_code_id = p_discount_code_id,
      discount_code = p_discount_code,
      discount_amount = coalesce(p_discount_amount, 0),
      discount_reserved_at = CASE WHEN v.discount_code_id IS DISTINCT FROM p_discount_code_id THEN NULL ELSE discount_reserved_at END,
      discount_released_at = CASE WHEN v.discount_code_id IS DISTINCT FROM p_discount_code_id THEN NULL ELSE discount_released_at END,
      status = 'pending',
      checkout_url = NULL,
      updated_at = NOW()
  WHERE id = p_intent_id;

  INSERT INTO public.payment_audit_logs (intent_id, action, from_status, to_status, actor_type, metadata)
  VALUES (p_intent_id, 'retargeted', v.status, 'pending', 'system',
          jsonb_build_object(
            'provider', 'tilopay',
            'order_number', v.provider_order_id,
            'previous', jsonb_build_object('plan_id', v.plan_id, 'billing_cycle', v.billing_cycle,
                                           'intent_type', v.intent_type, 'exact_amount', v.exact_amount,
                                           'discount_code', v.discount_code),
            'current', jsonb_build_object('plan_id', p_plan_id, 'billing_cycle', p_billing_cycle,
                                          'intent_type', p_intent_type, 'exact_amount', p_exact_amount,
                                          'discount_code', p_discount_code)));
  RETURN 'retargeted';
END;
$$;

REVOKE ALL ON FUNCTION public.retarget_tilopay_intent(uuid, text, text, text, numeric, timestamptz, timestamptz, timestamptz, uuid, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retarget_tilopay_intent(uuid, text, text, text, numeric, timestamptz, timestamptz, timestamptz, uuid, text, numeric) TO service_role;
