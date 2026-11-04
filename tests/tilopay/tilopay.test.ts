// Tests de la integración Tilopay (sin red ni credenciales reales).
// Ejecutar: node --import ./tests/support/register.mjs --test tests/tilopay/*.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addCalendarMonths,
  canWebhookApplyBusinessChanges,
  containsPanLikeNumber,
  evaluateTilopayConsult,
  generateTilopayOrderNumber,
  getNextCalendarBillingPeriod,
  getTilopayRemotePlanEnvName,
  isTilopayWebhookVerificationConfigured,
  isValidTilopayOrderNumber,
  resolveTilopayCharge,
  TilopayTimeoutError,
  verifyTilopayOrderHash,
  verifyTilopayWebhookSignature,
} from "../../lib/billing/tilopay/core";
import {
  decideOpenTilopayIntent,
  handleTilopayWebhook,
  prepareTilopayCheckout,
  reconcileTilopayIntent,
  verifyTilopayIntentForUser,
  type CheckoutDeps,
  type VerifyAccessDeps,
  type ConfirmArgs,
} from "../../lib/billing/tilopay/flow";

const ORDER = "MNX0123456789ABCDEF01234567".slice(0, 27);

function consultBody(entry: Record<string, unknown>) {
  return {
    type: "200",
    message: "",
    response: [
      {
        id_tilopay: 734312,
        orderNumber: ORDER,
        amount: "8.99",
        currency: "USD",
        code: "1",
        response: "Transacción aprobada",
        auth: "123456",
        card: "4021",
        last: "5221",
        environment: "Test",
        type: "Payment",
        ...entry,
      },
    ],
  };
}

const expectation = { orderNumber: ORDER, amount: 8.99, currency: "USD", environment: "TEST" as const };

// Emula la semántica de confirm_tilopay_payment (bloqueo + idempotencia).
function fakeLedger() {
  const state = { status: "pending", credits: 0, transactionId: null as string | null, calls: 0 };
  const confirm = async (args: ConfirmArgs) => {
    state.calls += 1;
    if (state.status === "paid") return "already_paid";
    if (args.result === "succeeded") {
      state.status = "paid";
      state.credits += 1;
      state.transactionId = args.transactionId;
      return "activated";
    }
    if (args.result === "failed") {
      state.status = "failed";
      return "not_approved";
    }
    if (args.result === "review") {
      state.status = "manual_review";
      return "needs_review";
    }
    state.status = "awaiting_verification";
    return "pending";
  };
  return { state, confirm };
}

// 1. Monto manipulado desde cliente
test("1. el monto se resuelve en servidor desde lib/plans e ignora el del cliente", () => {
  const body = { planId: "control", billingCycle: "monthly", amount: 0.01, exactAmount: 0.01 };
  const charge = resolveTilopayCharge(body.planId, body.billingCycle);
  assert.ok(charge);
  assert.equal(charge.amount, 8.99);
  assert.equal(resolveTilopayCharge("emprende", "monthly")?.amount, 3.99);
  assert.equal(resolveTilopayCharge("equipo", "annual")?.amount, 149.99);
});

// 2. Plan/ciclo inválido
test("2. plan o ciclo inválido se rechaza", () => {
  assert.equal(resolveTilopayCharge("premium", "monthly"), null);
  assert.equal(resolveTilopayCharge("control", "weekly"), null);
  assert.equal(resolveTilopayCharge("__proto__", "monthly"), null);
  assert.equal(resolveTilopayCharge("toString", "annual"), null);
  assert.equal(resolveTilopayCharge(undefined, undefined), null);
  assert.equal(getTilopayRemotePlanEnvName("equipo", "annual"), "TILOPAY_PLAN_ID_EQUIPO_ANNUAL");
});

// 3. Orden duplicada
test("3. orderNumber aleatorio, válido y sin colisiones; un intent existente reutiliza SU orden", async () => {
  const orders = new Set(Array.from({ length: 5000 }, () => generateTilopayOrderNumber()));
  assert.equal(orders.size, 5000);
  for (const order of orders) assert.ok(isValidTilopayOrderNumber(order));

  const processed: string[] = [];
  const deps: CheckoutDeps = {
    expectedEnvironment: "TEST",
    consult: async () => ({ type: "200", message: "", response: [] }),
    confirm: async () => "pending",
    processPayment: async (orderNumber) => {
      processed.push(orderNumber);
      return { url: "https://app.tilopay.com/pay/x" };
    },
    saveCheckoutUrl: async (url) => url,
    markUncertain: async () => {},
  };
  const intent = { id: "i1", orderNumber: ORDER, amount: 8.99, currency: "USD", checkoutUrl: null };
  await prepareTilopayCheckout(intent, true, deps);
  await prepareTilopayCheckout(intent, true, deps);
  assert.deepEqual(processed, [ORDER, ORDER], "nunca se genera otra orden para el mismo intent");

  const withUrl = await prepareTilopayCheckout({ ...intent, checkoutUrl: "https://app.tilopay.com/pay/x" }, true, deps);
  assert.deepEqual(withUrl, { kind: "redirect", url: "https://app.tilopay.com/pay/x" });
  assert.equal(processed.length, 2, "si ya hay URL y no hay transacción, se reutiliza sin llamar processPayment");
});

// 4. Redirect repetido
test("4. verificar el retorno varias veces solo acredita una vez", async () => {
  const ledger = fakeLedger();
  const deps = { expectedEnvironment: "TEST" as const, consult: async () => consultBody({}), confirm: ledger.confirm };
  const intent = { id: "i1", orderNumber: ORDER, amount: 8.99, currency: "USD" };
  const results = [];
  for (let i = 0; i < 5; i += 1) results.push((await reconcileTilopayIntent(intent, deps)).outcome);
  assert.deepEqual(results, ["paid", "paid", "paid", "paid", "paid"]);
  assert.equal(ledger.state.credits, 1);
});

// 5. Consult approved correcto
test("5. consult aprobado y coincidente → succeeded (code 1 documentado o 00 de soporte)", () => {
  const evaluation = evaluateTilopayConsult(expectation, consultBody({}));
  assert.equal(evaluation.result, "succeeded");
  assert.equal(evaluation.transactionId, "734312");
  assert.equal(evaluateTilopayConsult(expectation, consultBody({ code: "00" })).result, "succeeded");
  assert.equal(
    evaluateTilopayConsult(expectation, consultBody({ code: "99", response: "Transacción aprobada" })).result,
    "unknown",
    "el texto descriptivo nunca activa el servicio"
  );
  assert.equal(evaluateTilopayConsult(expectation, consultBody({ orderNumber: "OTRA" })).result, "not_found");
});

// 6. Monto distinto
test("6. consult con monto distinto → review (nunca paid)", () => {
  const evaluation = evaluateTilopayConsult(expectation, consultBody({ amount: "8.98" }));
  assert.equal(evaluation.result, "review");
  assert.ok(evaluation.reasons.includes("amount_mismatch"));
});

// 7. Moneda distinta
test("7. consult con moneda distinta → review", () => {
  const evaluation = evaluateTilopayConsult(expectation, consultBody({ currency: "CRC" }));
  assert.equal(evaluation.result, "review");
  assert.ok(evaluation.reasons.includes("currency_mismatch"));
});

// 8. Entorno distinto
test("8. TEST esperado PROD y viceversa → review", () => {
  const prodExpected = evaluateTilopayConsult({ ...expectation, environment: "PROD" }, consultBody({ environment: "Test" }));
  assert.equal(prodExpected.result, "review");
  assert.ok(prodExpected.reasons.includes("environment_mismatch"));
  const testExpected = evaluateTilopayConsult(expectation, consultBody({ environment: "Production" }));
  assert.equal(testExpected.result, "review");
  assert.equal(evaluateTilopayConsult(expectation, consultBody({ environment: "sandbox?" })).result, "review");
});

// 9. Rechazos
test("9. rechazos 05/51/54 → failed", async () => {
  for (const code of ["05", "51", "54"]) {
    assert.equal(evaluateTilopayConsult(expectation, consultBody({ code })).result, "failed", code);
    const ledger = fakeLedger();
    const result = await reconcileTilopayIntent(
      { id: "i1", orderNumber: ORDER, amount: 8.99, currency: "USD" },
      { expectedEnvironment: "TEST", consult: async () => consultBody({ code }), confirm: ledger.confirm }
    );
    assert.equal(result.outcome, "failed");
    assert.equal(ledger.state.credits, 0);
  }
});

// 10. Timeout sin doble cobro
test("10. timeout en processPayment: no se reintenta ni se crea otra orden; luego se consulta primero", async () => {
  let processCalls = 0;
  let consultCalls = 0;
  let uncertain = 0;
  const deps: CheckoutDeps = {
    expectedEnvironment: "TEST",
    consult: async () => {
      consultCalls += 1;
      return consultBody({});
    },
    confirm: fakeLedger().confirm,
    processPayment: async () => {
      processCalls += 1;
      throw new TilopayTimeoutError("processPayment");
    },
    saveCheckoutUrl: async (url) => url,
    markUncertain: async () => {
      uncertain += 1;
    },
  };
  const intent = { id: "i1", orderNumber: ORDER, amount: 8.99, currency: "USD", checkoutUrl: null };
  assert.deepEqual(await prepareTilopayCheckout(intent, false, deps), { kind: "uncertain" });
  assert.equal(processCalls, 1);
  assert.equal(uncertain, 1);

  // Siguiente intento: consult encuentra el cobro y NO se vuelve a llamar processPayment.
  assert.deepEqual(await prepareTilopayCheckout(intent, true, deps), { kind: "paid" });
  assert.equal(processCalls, 1);
  assert.equal(consultCalls, 1);

  // consult caído: error recuperable, sin processPayment.
  const down = await prepareTilopayCheckout(intent, true, {
    ...deps,
    consult: async () => {
      throw new TilopayTimeoutError("consult");
    },
  });
  assert.deepEqual(down, { kind: "error", reason: "consult_failed" });
  assert.equal(processCalls, 1);
});

// 11. Confirmación dos veces
test("11. confirmación concurrente/doble: una sola extensión", async () => {
  const ledger = fakeLedger();
  const deps = { expectedEnvironment: "TEST" as const, consult: async () => consultBody({}), confirm: ledger.confirm };
  const intent = { id: "i1", orderNumber: ORDER, amount: 8.99, currency: "USD" };
  const [a, b] = await Promise.all([reconcileTilopayIntent(intent, deps), reconcileTilopayIntent(intent, deps)]);
  assert.equal(a.outcome, "paid");
  assert.equal(b.outcome, "paid");
  assert.equal(ledger.state.credits, 1);
  assert.deepEqual([a.confirmation, b.confirmation].sort(), ["activated", "already_paid"]);
});

function webhookDeps() {
  const events = new Map<string, { id: string; payload: unknown; error: string | null }>();
  let consults = 0;
  return {
    events,
    get consults() {
      return consults;
    },
    deps: {
      recordEvent: async (e: { externalEventId: string; payload: Record<string, unknown> }) => {
        const existing = events.get(e.externalEventId);
        if (existing) return { id: existing.id, duplicate: true };
        const id = `ev${events.size + 1}`;
        events.set(e.externalEventId, { id, payload: e.payload, error: null });
        return { id, duplicate: false };
      },
      updateEvent: async (id: string, patch: { payload: Record<string, unknown>; processingError: string | null }) => {
        for (const value of events.values()) {
          if (value.id === id) {
            value.payload = patch.payload;
            value.error = patch.processingError;
          }
        }
      },
      consult: async () => {
        consults += 1;
        return { ...consultBody({ orderNumber: "PRE123456", amount: "14.99" }) };
      },
      expectedEnvironment: "TEST" as const,
      resolveExpectedAmount: () => 14.99,
    },
  };
}

// 12. Webhook duplicado
test("12. webhook duplicado se registra una sola vez y no se reprocesa", async () => {
  const w = webhookDeps();
  const rawBody = JSON.stringify({ id_plan: 1, email: "a@b.com", amount: 14.99, auth: "1", orderNumber: "PRE123456" });
  const input = { eventType: "webhook_payment" as const, rawBody, hashHeader: "abc", timestampHeader: "1700000000" };
  const first = await handleTilopayWebhook(input, w.deps);
  const second = await handleTilopayWebhook(input, w.deps);
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(w.events.size, 1);
  assert.equal(w.consults, 1);

  const rejected = { eventType: "webhook_rejected" as const, rawBody: JSON.stringify({ id_plan: 1, email: "a@b.com", amount: 25 }), hashHeader: null, timestampHeader: "1" };
  await handleTilopayWebhook(rejected, w.deps);
  assert.equal((await handleTilopayWebhook(rejected, w.deps)).duplicate, true);
  // Mismo cuerpo con otro timestamp = otro evento (p. ej. otro rechazo mensual).
  assert.equal((await handleTilopayWebhook({ ...rejected, timestampHeader: "2" }, w.deps)).duplicate, false);
});

// 13. Webhook sin firma/secreto
test("13. webhook sin firma verificable nunca aplica cambios de negocio, aun con consult aprobado", async () => {
  for (const headers of [{ hashHeader: null, timestampHeader: null }, { hashHeader: "deadbeef", timestampHeader: "1700000000" }]) {
    const signature = verifyTilopayWebhookSignature({ ...headers, rawBody: "{}" });
    assert.equal(signature.status, "pending_configuration");
    assert.equal(canWebhookApplyBusinessChanges(signature), false);
  }

  const w = webhookDeps();
  for (const eventType of ["webhook_subscribe", "webhook_payment", "webhook_rejected", "webhook_unsubscribe", "webhook_reactive"] as const) {
    const result = await handleTilopayWebhook(
      { eventType, rawBody: JSON.stringify({ id_plan: 1, email: "a@b.com", amount: 14.99, orderNumber: "PRE123456" }), hashHeader: "x", timestampHeader: eventType },
      w.deps
    );
    assert.equal(result.httpStatus, 200);
    assert.equal(result.businessChangesApplied, false);
  }
  for (const event of w.events.values()) assert.equal(event.error, "signature_verification_pending");

  assert.equal((await handleTilopayWebhook({ eventType: "webhook_payment", rawBody: "no-json", hashHeader: null, timestampHeader: null }, w.deps)).httpStatus, 422);
  assert.equal(verifyTilopayOrderHash().status, "unsupported", "OrderHash no se inventa: consult es la confirmación");
});

// 14. Aislamiento entre empresas en el endpoint de verificación
test("14. usuario de otra empresa no puede consultar ni activar el intent", async () => {
  const INTENT = "11111111-1111-4111-8111-111111111111";
  const COMPANY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const OWNER_A = "u-owner-a";
  const USER_B = "u-company-b";
  const stored = { id: INTENT, company_id: COMPANY_A, provider: "tilopay", status: "pending" };
  const members = new Set([`${COMPANY_A}:${OWNER_A}`]);

  function deps(userId: string | null, rlsEnforced = true) {
    const calls = { reconcile: 0 };
    const value: VerifyAccessDeps = {
      getUserId: async () => userId,
      // Emula pi_select: solo devuelve el intent si el usuario es miembro.
      readIntent: async (id) =>
        id === INTENT && (!rlsEnforced || (userId && members.has(`${stored.company_id}:${userId}`))) ? stored : null,
      isMember: async (companyId, uid) => members.has(`${companyId}:${uid}`),
      reconcile: async () => {
        calls.reconcile += 1;
        return { outcome: "paid" };
      },
    };
    return { value, calls };
  }

  const anon = deps(null);
  assert.equal((await verifyTilopayIntentForUser(INTENT, anon.value)).httpStatus, 401);
  assert.equal(anon.calls.reconcile, 0);

  const other = deps(USER_B);
  const otherResult = await verifyTilopayIntentForUser(INTENT, other.value);
  assert.equal(otherResult.httpStatus, 404);
  assert.equal(other.calls.reconcile, 0, "otra empresa no provoca consult ni activación");

  // Defensa en profundidad: aunque RLS fallara, la membresía explícita bloquea.
  const leaked = deps(USER_B, false);
  assert.equal((await verifyTilopayIntentForUser(INTENT, leaked.value)).httpStatus, 404);
  assert.equal(leaked.calls.reconcile, 0);

  assert.equal((await verifyTilopayIntentForUser("not-a-uuid", deps(OWNER_A).value)).httpStatus, 400);

  const owner = deps(OWNER_A);
  const ownerResult = await verifyTilopayIntentForUser(INTENT, owner.value);
  assert.deepEqual(ownerResult, { httpStatus: 200, body: { status: "paid" } });
  assert.equal(owner.calls.reconcile, 1);
});

// 13b. Con firma válida (verificador inyectado) los eventos se aplican vía RPC,
// los cobros solo si consult confirma, y sin firma la puerta sigue cerrada.
test("13b. webhooks con firma válida se aplican; cobros solo con consult confirmado", async () => {
  assert.equal(isTilopayWebhookVerificationConfigured(), false, "hoy la especificación no está confirmada");
  assert.notEqual(
    verifyTilopayWebhookSignature({ hashHeader: "a", timestampHeader: "1", rawBody: "{}" }).status,
    "valid",
    "el verificador real nunca acepta firmas mientras falte la especificación"
  );

  const status = new Map<string, string>();
  const applied: Array<Record<string, unknown>> = [];
  let applyResult = "activated";
  let consultAmount = "14.99";
  const deps = {
    recordEvent: async (e: { externalEventId: string }) => {
      const existing = status.get(e.externalEventId);
      if (existing) return { id: e.externalEventId, duplicate: true, processingStatus: existing };
      status.set(e.externalEventId, "received");
      return { id: e.externalEventId, duplicate: false, processingStatus: "received" };
    },
    updateEvent: async () => {},
    consult: async (orderNumber: string) => consultBody({ orderNumber, amount: consultAmount }),
    expectedEnvironment: "TEST" as const,
    resolveExpectedAmount: () => 14.99,
    verifySignature: () => ({ status: "valid" as const }),
    applyBusinessEvent: async (event: Record<string, unknown>) => {
      applied.push(event);
      if (applyResult !== "retry_later") status.set(String(event.eventId), "processed");
      return applyResult;
    },
  };
  const payment = (order: string) => ({
    eventType: "webhook_payment" as const,
    rawBody: JSON.stringify({ id_plan: 7, email: "Owner@Negocio.com", amount: 14.99, auth: "1", orderNumber: order }),
    hashHeader: "h",
    timestampHeader: "1",
  });

  const ok = await handleTilopayWebhook(payment("PRE123456"), deps);
  assert.equal(ok.businessChangesApplied, true);
  assert.equal(applied.length, 1);
  assert.equal(applied[0].externalSubscriptionId, "plan:7:owner@negocio.com");
  assert.equal(applied[0].amount, 14.99);
  assert.equal(applied[0].transactionId, "734312");

  // Duplicado ya procesado: no se reaplica.
  assert.equal((await handleTilopayWebhook(payment("PRE123456"), deps)).duplicate, true);
  assert.equal(applied.length, 1);

  // Consult con monto distinto: nunca se aplica.
  consultAmount = "1.00";
  const mismatch = await handleTilopayWebhook(payment("PRE123456X"), deps);
  assert.equal(mismatch.businessChangesApplied, false);
  assert.equal(applied.length, 1);
  consultAmount = "14.99";

  // Checkout abierto: retry_later → 502 y el reintento de Tilopay se reprocesa.
  applyResult = "retry_later";
  const retry = await handleTilopayWebhook(payment("PRE123456"), { ...deps });
  assert.equal(retry.duplicate, true, "evento ya procesado no se reaplica aunque haya retry");
  const busy = await handleTilopayWebhook(payment("PRE999"), deps);
  assert.equal(busy.httpStatus, 502);
  applyResult = "activated";
  const retried = await handleTilopayWebhook(payment("PRE999"), deps);
  assert.equal(retried.businessChangesApplied, true);

  // Cancelación de renovación: se aplica sin consult (no es un cobro).
  const unsubscribe = await handleTilopayWebhook(
    { eventType: "webhook_unsubscribe", rawBody: JSON.stringify({ id_plan: 7, email: "owner@negocio.com", expire: "2026-12-01" }), hashHeader: "h", timestampHeader: "2" },
    { ...deps, applyBusinessEvent: async (event: Record<string, unknown>) => { applied.push(event); return "applied"; } }
  );
  assert.equal(unsubscribe.businessChangesApplied, true);
  assert.equal(applied.at(-1)?.eventType, "webhook_unsubscribe");

  // Sin identidad de suscriptor: no se aplica.
  const anonymous = await handleTilopayWebhook(
    { eventType: "webhook_reactive", rawBody: JSON.stringify({ next_payment_date: "2026-12-01" }), hashHeader: "h", timestampHeader: "3" },
    deps
  );
  assert.equal(anonymous.businessChangesApplied, false);
});

// 10b. Cambio de selección con una orden ya emitida: nunca una orden nueva
// mientras la anterior no esté consumida.
test("10b. consult not_found no autoriza una orden nueva: se reutiliza el mismo orderNumber", () => {
  assert.equal(decideOpenTilopayIntent(true, null), "reuse");
  assert.equal(decideOpenTilopayIntent(false, "not_found"), "retarget");
  assert.equal(decideOpenTilopayIntent(false, "paid"), "paid");
  assert.equal(decideOpenTilopayIntent(false, "failed"), "new", "solo un rechazo consume la orden");
  for (const outcome of ["pending", "review", "error", null] as const) {
    assert.equal(decideOpenTilopayIntent(false, outcome), "verifying", String(outcome));
  }
});

// Datos de tarjeta en un webhook público: nunca se persisten.
test("webhook con PAN/CVV/campos arbitrarios: solo se persiste la lista blanca sanitizada", async () => {
  assert.equal(containsPanLikeNumber("4111111111111111"), true);
  assert.equal(containsPanLikeNumber("4111-1111-1111-1111"), true);
  assert.equal(containsPanLikeNumber("PRE123456"), false);
  assert.equal(containsPanLikeNumber(generateTilopayOrderNumber()), false);

  const w = webhookDeps();
  const rawBody = JSON.stringify({
    id_plan: 1,
    email: "a@b.com",
    amount: 14.99,
    orderNumber: "4111 1111 1111 1111",
    card: "4111111111111111",
    cvv: "123",
    "4111111111111111": "x",
    note: "<script>",
  });
  await handleTilopayWebhook({ eventType: "webhook_payment", rawBody, hashHeader: "abc", timestampHeader: "1700000000" }, w.deps);
  assert.equal(w.events.size, 1);
  // El hash hexadecimal del cuerpo se excluye de la búsqueda (podría contener "4111" por azar).
  const stored = JSON.stringify({ ...([...w.events.values()][0].payload as object), raw_body_sha256: null });
  for (const forbidden of ["4111", "cvv", "card", "<script>", "note"]) {
    assert.ok(!stored.includes(forbidden), `no debe persistirse: ${forbidden}`);
  }
  const payload = [...w.events.values()][0].payload as { body: Record<string, string>; dropped_field_count: number };
  assert.deepEqual(payload.body, { id_plan: "1", email: "a@b.com", amount: "14.99" });
  assert.equal(payload.dropped_field_count, 5);
  assert.equal(w.consults, 0, "sin orderNumber válido no se consulta");
});

// Periodo por calendario
test("periodo mensual/anual por calendario (no días fijos)", () => {
  const jan31 = new Date("2026-01-31T15:00:00.000Z");
  assert.equal(addCalendarMonths(jan31, 1).toISOString(), "2026-02-28T15:00:00.000Z");
  assert.equal(addCalendarMonths(new Date("2028-01-31T15:00:00.000Z"), 1).toISOString(), "2028-02-29T15:00:00.000Z");
  assert.equal(addCalendarMonths(new Date("2028-02-29T15:00:00.000Z"), 12).toISOString(), "2029-02-28T15:00:00.000Z");
  // 31 ene 23:00 en Panamá (= 1 feb 04:00 UTC) → 28 feb 23:00 Panamá.
  assert.equal(addCalendarMonths(new Date("2026-02-01T04:00:00.000Z"), 1).toISOString(), "2026-03-01T04:00:00.000Z");

  const now = Date.parse("2026-03-10T12:00:00.000Z");
  const renewal = getNextCalendarBillingPeriod("2026-04-15T12:00:00.000Z", "monthly", now);
  assert.deepEqual(renewal, { periodStart: "2026-04-15T12:00:00.000Z", periodEnd: "2026-05-15T12:00:00.000Z" });
  const expired = getNextCalendarBillingPeriod("2026-01-01T00:00:00.000Z", "annual", now);
  assert.deepEqual(expired, { periodStart: "2026-03-10T12:00:00.000Z", periodEnd: "2027-03-10T12:00:00.000Z" });
});
