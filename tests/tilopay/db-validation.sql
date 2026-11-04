-- Validación de base de datos de Tilopay (RLS, privilegios, idempotencia y guards).
-- Se ejecuta completa en una transacción que SIEMPRE se revierte: el resultado
-- llega en el mensaje de la excepción final "ROLLBACK_RESULTS". No deja datos.
-- Ejecutar con Supabase MCP (execute_sql) o el SQL Editor.
DO $$
DECLARE
  v_user uuid; v_other uuid := gen_random_uuid(); v_company uuid; i1 uuid; i2 uuid;
  r text; out text := ''; n int; v_start timestamptz := now();
BEGIN
  SELECT id INTO v_user FROM auth.users ORDER BY created_at LIMIT 1;
  INSERT INTO companies (name, owner_user_id, subscription_status, subscription_plan, trial_ends_at)
  VALUES ('__tilopay_test__', v_user, 'trialing', 'control', now() - interval '1 day') RETURNING id INTO v_company;

  INSERT INTO payment_intents (company_id,user_id,plan_id,billing_cycle,exact_amount,provider,provider_order_id,status,expires_at,period_start,period_end)
  VALUES (v_company,v_user,'control','monthly',8.99,'tilopay','MNXTEST000000000000000001','pending',now()+interval '1 day',v_start,v_start + interval '1 month')
  RETURNING id INTO i1;

  -- 3. Misma orden: rechazada.
  BEGIN
    INSERT INTO payment_intents (company_id,user_id,plan_id,billing_cycle,exact_amount,provider,provider_order_id,status,expires_at)
    VALUES (v_company,v_user,'control','monthly',8.99,'tilopay','MNXTEST000000000000000001','failed',now()+interval '1 day');
    out := out || 'dupOrder=FAIL ';
  EXCEPTION WHEN unique_violation THEN out := out || 'dupOrder=rejected ';
  END;

  -- Concurrencia: segunda intención abierta (otra orden) para la misma empresa: rechazada.
  BEGIN
    INSERT INTO payment_intents (company_id,user_id,plan_id,billing_cycle,exact_amount,provider,provider_order_id,status,expires_at)
    VALUES (v_company,v_user,'emprende','monthly',3.99,'tilopay','MNXTEST000000000000000009','pending',now()+interval '1 day');
    out := out || 'secondOpen=FAIL ';
  EXCEPTION WHEN unique_violation THEN out := out || 'secondOpen=rejected ';
  END;

  -- 14. Usuario de otra empresa (authenticated) y anon.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM payment_intents WHERE id = i1;
  out := out || 'otherCompanyVisible=' || n || ' ';
  BEGIN
    PERFORM confirm_tilopay_payment(i1,'MNXTEST000000000000000001','succeeded','TXA',8.99,'USD','{}');
    out := out || 'otherCompanyExec=FAIL ';
  EXCEPTION WHEN insufficient_privilege THEN out := out || 'otherCompanyExec=denied ';
  END;
  BEGIN
    UPDATE payment_intents SET status = 'paid' WHERE id = i1;
    GET DIAGNOSTICS n = ROW_COUNT;
    out := out || 'otherCompanyUpdate=' || n || ' ';
  EXCEPTION WHEN insufficient_privilege THEN out := out || 'otherCompanyUpdate=denied ';
  END;
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE anon';
  BEGIN
    PERFORM confirm_tilopay_payment(i1,'MNXTEST000000000000000001','succeeded','TXA',8.99,'USD','{}');
    out := out || 'anonExec=FAIL ';
  EXCEPTION WHEN insufficient_privilege THEN out := out || 'anonExec=denied ';
  END;
  EXECUTE 'RESET ROLE';

  -- Ambigua y vencida: el cron NO la expira (sigue abierta hasta conciliarse).
  EXECUTE 'SET LOCAL ROLE service_role';
  r := confirm_tilopay_payment(i1,'MNXTEST000000000000000001','pending',null,null,null,'{}');
  UPDATE payment_intents SET expires_at = now() - interval '2 days' WHERE id = i1;
  PERFORM expire_stale_intents();
  out := out || 'awaitingAfterCron=' || (SELECT status FROM payment_intents WHERE id = i1) || ' ';

  -- 11. Confirmación doble: una sola extensión.
  r := confirm_tilopay_payment(i1,'MNXTEST000000000000000001','succeeded','TXA',8.99,'USD','{}'); out := out || 'first=' || r || ' ';
  r := confirm_tilopay_payment(i1,'MNXTEST000000000000000001','succeeded','TXA',8.99,'USD','{}'); out := out || 'second=' || r || ' ';
  SELECT count(*) INTO n FROM payment_audit_logs WHERE intent_id = i1 AND action = 'subscription_activated';
  out := out || 'activations=' || n || ' ';
  out := out || 'periodOk=' || ((SELECT current_period_ends_at FROM companies WHERE id = v_company) = v_start + interval '1 month') || ' ';

  -- Tras pagar, la empresa puede abrir una nueva intención (la anterior ya no está abierta).
  INSERT INTO payment_intents (company_id,user_id,plan_id,billing_cycle,exact_amount,provider,provider_order_id,status,expires_at)
  VALUES (v_company,v_user,'control','monthly',8.99,'tilopay','MNXTEST000000000000000002','pending',now()+interval '1 day')
  RETURNING id INTO i2;
  out := out || 'newAfterPaid=ok';
  EXECUTE 'RESET ROLE';

  RAISE EXCEPTION 'ROLLBACK_RESULTS: %', out;
END $$;

-- Bloque 2: eventos recurrentes (también revertido).
-- Esperado: confirm=activated linkedTilopay=tilopay/active
-- openSubs=1 unsigned=signature_not_verified recurring=activated sameEventAgain=already_processed
-- sameOrderOtherEvent=already_processed extendedOnce=true unsub=applied/cancelled cancelAtEnd=true
-- periodKept=true reactive=applied/active cancelAtEnd=false openCheckout=retry_later/received
-- amountMismatch=needs_review periodUnchanged=true
DO $$
DECLARE
  v_user uuid; v_company uuid; v_old_sub uuid; v_sub uuid; i1 uuid; e1 uuid; e2 uuid; e3 uuid; e4 uuid; e5 uuid; e6 uuid;
  r text; out text := ''; v_end timestamptz; v_end2 timestamptz; v_start timestamptz := now(); n int;
BEGIN
  SELECT id INTO v_user FROM auth.users ORDER BY created_at LIMIT 1;
  INSERT INTO companies (name, owner_user_id, subscription_status, subscription_plan, trial_ends_at)
  VALUES ('__tilopay_test__', v_user, 'trialing', 'equipo', now() - interval '1 day') RETURNING id INTO v_company;
  EXECUTE 'SET LOCAL ROLE service_role';

  INSERT INTO payment_intents (company_id,user_id,plan_id,billing_cycle,exact_amount,provider,provider_order_id,status,expires_at,period_start,period_end)
  VALUES (v_company,v_user,'equipo','monthly',14.99,'tilopay','MNXTEST000000000000000001','pending',now()+interval '1 day',v_start,v_start + interval '1 month') RETURNING id INTO i1;
  r := confirm_tilopay_payment(i1,'MNXTEST000000000000000001','succeeded','TXA',14.99,'USD','{}');
  out := out || 'confirm=' || r;
  SELECT billing_subscription_id INTO v_sub FROM payment_intents WHERE id = i1;
  out := out || ' linkedTilopay=' || coalesce((SELECT provider || '/' || status FROM billing_subscriptions WHERE id = v_sub), 'NULL') || ' ';
  SELECT count(*) INTO n FROM billing_subscriptions WHERE company_id = v_company AND status IN ('pending','active','past_due','cancel_requested');
  out := out || 'openSubs=' || n || ' ';

  UPDATE billing_subscriptions SET external_subscription_id = 'plan:7:owner@negocio.com' WHERE id = v_sub;
  SELECT current_period_ends_at INTO v_end FROM companies WHERE id = v_company;

  INSERT INTO billing_provider_events (provider, external_event_id, event_type, signature_valid)
  VALUES ('tilopay', 'test:payment:unsigned', 'webhook_payment', NULL) RETURNING id INTO e1;
  r := apply_tilopay_subscription_event(e1,'webhook_payment','plan:7:owner@negocio.com','PRE1','TXP1',14.99,'USD','{}');
  out := out || 'unsigned=' || r || ' ';

  INSERT INTO billing_provider_events (provider, external_event_id, event_type, signature_valid)
  VALUES ('tilopay', 'test:payment:1', 'webhook_payment', true) RETURNING id INTO e2;
  r := apply_tilopay_subscription_event(e2,'webhook_payment','plan:7:owner@negocio.com','PRE1','TXP1',14.99,'USD','{}');
  out := out || 'recurring=' || r || ' ';
  r := apply_tilopay_subscription_event(e2,'webhook_payment','plan:7:owner@negocio.com','PRE1','TXP1',14.99,'USD','{}');
  out := out || 'sameEventAgain=' || r || ' ';
  INSERT INTO billing_provider_events (provider, external_event_id, event_type, signature_valid)
  VALUES ('tilopay', 'test:payment:1b', 'webhook_payment', true) RETURNING id INTO e3;
  r := apply_tilopay_subscription_event(e3,'webhook_payment','plan:7:owner@negocio.com','PRE1','TXP1',14.99,'USD','{}');
  out := out || 'sameOrderOtherEvent=' || r || ' ';
  SELECT current_period_ends_at INTO v_end2 FROM companies WHERE id = v_company;
  out := out || 'extendedOnce=' || (v_end2 = ((v_end AT TIME ZONE 'America/Panama') + interval '1 month') AT TIME ZONE 'America/Panama') || ' ';

  INSERT INTO billing_provider_events (provider, external_event_id, event_type, signature_valid)
  VALUES ('tilopay', 'test:unsub', 'webhook_unsubscribe', true) RETURNING id INTO e4;
  r := apply_tilopay_subscription_event(e4,'webhook_unsubscribe','plan:7:owner@negocio.com',null,null,null,null,'{}');
  out := out || 'unsub=' || r || '/' || (SELECT status FROM billing_subscriptions WHERE id = v_sub)
         || ' cancelAtEnd=' || (SELECT subscription_cancel_at_period_end FROM companies WHERE id = v_company)
         || ' periodKept=' || ((SELECT current_period_ends_at FROM companies WHERE id = v_company) = v_end2) || ' ';

  INSERT INTO billing_provider_events (provider, external_event_id, event_type, signature_valid)
  VALUES ('tilopay', 'test:reactive', 'webhook_reactive', true) RETURNING id INTO e5;
  r := apply_tilopay_subscription_event(e5,'webhook_reactive','plan:7:owner@negocio.com',null,null,null,null,'{}');
  out := out || 'reactive=' || r || '/' || (SELECT status FROM billing_subscriptions WHERE id = v_sub)
         || ' cancelAtEnd=' || (SELECT subscription_cancel_at_period_end FROM companies WHERE id = v_company) || ' ';

  INSERT INTO payment_intents (company_id,user_id,plan_id,billing_cycle,exact_amount,provider,provider_order_id,status,expires_at)
  VALUES (v_company,v_user,'equipo','monthly',14.99,'tilopay','MNXTEST000000000000000002','pending',now()+interval '1 day');
  INSERT INTO billing_provider_events (provider, external_event_id, event_type, signature_valid)
  VALUES ('tilopay', 'test:payment:2', 'webhook_payment', true) RETURNING id INTO e6;
  r := apply_tilopay_subscription_event(e6,'webhook_payment','plan:7:owner@negocio.com','PRE2','TXP2',14.99,'USD','{}');
  out := out || 'openCheckout=' || r || '/' || (SELECT processing_status FROM billing_provider_events WHERE id = e6) || ' ';

  UPDATE payment_intents SET status = 'cancelled' WHERE provider_order_id = 'MNXTEST000000000000000002';
  r := apply_tilopay_subscription_event(e6,'webhook_payment','plan:7:owner@negocio.com','PRE2','TXP2',1.00,'USD','{}');
  out := out || 'amountMismatch=' || r || ' periodUnchanged=' || ((SELECT current_period_ends_at FROM companies WHERE id = v_company) = v_end2);
  EXECUTE 'RESET ROLE';

  RAISE EXCEPTION 'ROLLBACK_RESULTS: %', out;
END $$;

-- Bloque 3: sin segunda orden al cambiar de selección y relación de otro
-- proveedor intacta (también revertido). Esperado:
-- retarget=retargeted MNXTEST000000000000000001/pending/NULL/149.99 ordersForCompany=1
-- oldLinkPaid=needs_review companyStatus=trialing retargetClosed=not_open confirm=activated
-- otherSub=active/NULL tilopaySubs=0 intervention=1 companyActive=active
DO $$
DECLARE
  v_user uuid; v_company uuid; v_other_sub uuid; i1 uuid; r text; out text := ''; n int; v_start timestamptz := now();
BEGIN
  SELECT id INTO v_user FROM auth.users ORDER BY created_at LIMIT 1;
  INSERT INTO companies (name, owner_user_id, subscription_status, subscription_plan, trial_ends_at)
  VALUES ('__tilopay_test__', v_user, 'trialing', 'control', now() - interval '1 day') RETURNING id INTO v_company;
  EXECUTE 'SET LOCAL ROLE service_role';

  INSERT INTO payment_intents (company_id,user_id,plan_id,billing_cycle,exact_amount,provider,provider_order_id,status,expires_at,period_start,period_end,checkout_url)
  VALUES (v_company,v_user,'control','monthly',8.99,'tilopay','MNXTEST000000000000000001','awaiting_verification',now()-interval '1 day',v_start,v_start + interval '1 month','https://app.tilopay.com/old')
  RETURNING id INTO i1;

  r := retarget_tilopay_intent(i1,'equipo','annual','subscription_payment',149.99,v_start,v_start + interval '1 year',now()+interval '1 day',null,null,0);
  out := out || 'retarget=' || r || ' ' || (SELECT provider_order_id || '/' || status || '/' || coalesce(checkout_url,'NULL') || '/' || exact_amount FROM payment_intents WHERE id = i1) || ' ';
  SELECT count(*) INTO n FROM payment_intents WHERE company_id = v_company AND provider = 'tilopay';
  out := out || 'ordersForCompany=' || n || ' ';

  r := confirm_tilopay_payment(i1,'MNXTEST000000000000000001','succeeded','TXOLD',8.99,'USD','{}');
  out := out || 'oldLinkPaid=' || r || ' companyStatus=' || (SELECT subscription_status FROM companies WHERE id = v_company) || ' ';
  r := retarget_tilopay_intent(i1,'control','monthly','subscription_payment',8.99,v_start,v_start + interval '1 month',now()+interval '1 day',null,null,0);
  out := out || 'retargetClosed=' || r || ' ';

  INSERT INTO billing_subscriptions (company_id, provider, plan_id, billing_cycle, amount, status)
  VALUES (v_company, 'yappy_manual', 'control', 'monthly', 8.99, 'active') RETURNING id INTO v_other_sub;
  INSERT INTO payment_intents (company_id,user_id,plan_id,billing_cycle,exact_amount,provider,provider_order_id,status,expires_at,period_start,period_end)
  VALUES (v_company,v_user,'control','monthly',8.99,'tilopay','MNXTEST000000000000000002','pending',now()+interval '1 day',v_start,v_start + interval '1 month')
  RETURNING id INTO i1;
  r := confirm_tilopay_payment(i1,'MNXTEST000000000000000002','succeeded','TXB',8.99,'USD','{}');
  out := out || 'confirm=' || r
         || ' otherSub=' || (SELECT status || '/' || coalesce(external_status,'NULL') FROM billing_subscriptions WHERE id = v_other_sub)
         || ' tilopaySubs=' || (SELECT count(*) FROM billing_subscriptions WHERE company_id = v_company AND provider = 'tilopay')
         || ' intervention=' || (SELECT count(*) FROM payment_audit_logs WHERE intent_id = i1 AND action = 'external_subscription_cancellation_required')
         || ' companyActive=' || (SELECT subscription_status FROM companies WHERE id = v_company);
  EXECUTE 'RESET ROLE';
  RAISE EXCEPTION 'ROLLBACK_RESULTS: %', out;
END $$;
