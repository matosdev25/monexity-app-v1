// Orquestación Tilopay con dependencias inyectadas (red y base de datos llegan
// desde service.ts). Así las reglas de reintento seguro e idempotencia se
// prueban sin credenciales reales.
import { createHash } from "node:crypto";
import {
  buildTilopayExternalSubscriptionId,
  canWebhookApplyBusinessChanges,
  parseTilopayWebhook,
  sanitizeTilopayWebhookHeaders,
  sanitizeTilopayWebhookPayload,
  verifyTilopayWebhookSignature,
  type TilopaySignatureCheck,
  type TilopayWebhookEventType,
  evaluateTilopayConsult,
  sanitizeConsultResponse,
  toConfirmationResult,
  TilopayTimeoutError,
  type TilopayConsultEvaluation,
  type TilopayEnvironment,
} from "./core";

export type TilopayIntentSnapshot = {
  id: string;
  orderNumber: string;
  amount: number;
  currency: string;
  checkoutUrl: string | null;
};

export type ConfirmArgs = {
  intentId: string;
  orderNumber: string;
  result: "succeeded" | "failed" | "pending" | "review";
  transactionId: string | null;
  amount: number | null;
  currency: string | null;
  raw: unknown;
};

export type ReconcileDeps = {
  expectedEnvironment: TilopayEnvironment;
  consult: (orderNumber: string) => Promise<unknown>;
  confirm: (args: ConfirmArgs) => Promise<string>;
};

export type ReconcileOutcome =
  | "paid"
  | "failed"
  | "pending"
  | "review"
  | "not_found"
  | "error";

export type ReconcileResult = {
  outcome: ReconcileOutcome;
  evaluation: TilopayConsultEvaluation | null;
  confirmation: string | null;
};

const CONFIRMATION_TO_OUTCOME: Record<string, ReconcileOutcome> = {
  activated: "paid",
  already_paid: "paid",
  not_approved: "failed",
  already_final: "failed",
  pending: "pending",
  needs_review: "review",
  transaction_used: "review",
  order_mismatch: "review",
};

// Consulta Tilopay (fuente de verdad) y aplica el resultado de forma atómica.
// El redirect del navegador nunca participa en la decisión.
export async function reconcileTilopayIntent(
  intent: Pick<TilopayIntentSnapshot, "id" | "orderNumber" | "amount" | "currency">,
  deps: ReconcileDeps
): Promise<ReconcileResult> {
  let raw: unknown;
  try {
    raw = await deps.consult(intent.orderNumber);
  } catch {
    return { outcome: "error", evaluation: null, confirmation: null };
  }

  const evaluation = evaluateTilopayConsult(
    {
      orderNumber: intent.orderNumber,
      amount: intent.amount,
      currency: intent.currency,
      environment: deps.expectedEnvironment,
    },
    raw
  );

  if (evaluation.result === "consult_error") {
    return { outcome: "error", evaluation, confirmation: null };
  }
  if (evaluation.result === "not_found") {
    return { outcome: "not_found", evaluation, confirmation: null };
  }

  const result = toConfirmationResult(evaluation);
  if (!result) return { outcome: "error", evaluation, confirmation: null };

  const confirmation = await deps.confirm({
    intentId: intent.id,
    orderNumber: intent.orderNumber,
    result,
    transactionId: evaluation.transactionId,
    amount: evaluation.amount,
    currency: evaluation.currency,
    raw: {
      provider: "tilopay",
      source: "consult",
      evaluation: {
        result: evaluation.result,
        code: evaluation.code,
        environment: evaluation.environment,
        reasons: evaluation.reasons,
      },
      consult: sanitizeConsultResponse(raw),
    },
  });

  return {
    outcome: CONFIRMATION_TO_OUTCOME[confirmation] ?? "error",
    evaluation,
    confirmation,
  };
}

export type OpenIntentAction = "reuse" | "retarget" | "new" | "paid" | "verifying";

// Qué hacer con la intención Tilopay abierta de la empresa al pedir un checkout.
// Regla: mientras una orden no esté consumida (rechazo explícito) nunca se abre
// otra. "not_found" NO autoriza una orden nueva: el enlace hospedado anterior
// puede seguir vivo, así que se reutiliza el MISMO orderNumber (retarget).
export function decideOpenTilopayIntent(
  matchesSelection: boolean,
  reconcileOutcome: ReconcileOutcome | null
): OpenIntentAction {
  if (matchesSelection) return "reuse";
  switch (reconcileOutcome) {
    case "paid":
      return "paid";
    case "failed":
      // Orden consumida por un rechazo: Tilopay ya no acepta otro cobro con ella.
      return "new";
    case "not_found":
      return "retarget";
    default:
      return "verifying";
  }
}

const UUID_RE =/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Estados finales que no requieren volver a consultar Tilopay.
// expired/cancelled se reconsultan: un cobro tardío queda en revisión manual.
const FINAL_INTENT_STATUS: Record<string, string> = {
  paid: "paid",
  failed: "failed",
  manual_review: "review",
};

export type VerifyAccessDeps = {
  getUserId: () => Promise<string | null>;
  // Lectura con el cliente del usuario: RLS (pi_select) limita a sus empresas.
  readIntent: (intentId: string) => Promise<{ id: string; company_id: string; provider: string; status: string } | null>;
  isMember: (companyId: string, userId: string) => Promise<boolean>;
  reconcile: (intentId: string) => Promise<{ outcome: ReconcileOutcome }>;
};

// Autorización de POST /api/payments/tilopay/verify: solo miembros de la
// empresa dueña del intent pueden consultarlo o provocar su conciliación.
// Cualquier otro caso responde 404 sin tocar Tilopay ni la base.
export async function verifyTilopayIntentForUser(
  rawIntentId: unknown,
  deps: VerifyAccessDeps
): Promise<{ httpStatus: number; body: Record<string, unknown> }> {
  const userId = await deps.getUserId();
  if (!userId) return { httpStatus: 401, body: { error: "No autenticado" } };

  const intentId = String(rawIntentId ?? "");
  if (!UUID_RE.test(intentId)) return { httpStatus: 400, body: { error: "Solicitud inválida" } };

  const intent = await deps.readIntent(intentId);
  if (!intent || intent.provider !== "tilopay") {
    return { httpStatus: 404, body: { error: "No encontrado" } };
  }

  // Comprobación explícita de membresía además de RLS.
  if (!(await deps.isMember(intent.company_id, userId))) {
    return { httpStatus: 404, body: { error: "No encontrado" } };
  }

  if (FINAL_INTENT_STATUS[intent.status]) {
    return { httpStatus: 200, body: { status: FINAL_INTENT_STATUS[intent.status] } };
  }

  const { outcome } = await deps.reconcile(intent.id);
  return { httpStatus: outcome === "error" ? 502 : 200, body: { status: outcome } };
}

export type CheckoutDeps = ReconcileDeps & {
  processPayment: (orderNumber: string) => Promise<{ url: string }>;
  // Guarda la URL solo si el intent aún no tiene una; devuelve la URL vigente.
  saveCheckoutUrl: (url: string) => Promise<string>;
  markUncertain: (reason: string) => Promise<void>;
};

export type CheckoutResult =
  | { kind: "redirect"; url: string }
  | { kind: "paid" }
  | { kind: "failed" }
  | { kind: "review" }
  | { kind: "uncertain" }
  | { kind: "error"; reason: string };

// Prepara el checkout hospedado sin generar nunca una segunda orden:
// - intent nuevo: processPayment con su orderNumber ya persistido;
// - intent existente: primero consult; si hay transacción se usa su resultado;
//   si no existe, se reutiliza la URL o se reintenta con el MISMO orderNumber;
// - timeout/ambigüedad: se marca para verificación y no se reintenta.
export async function prepareTilopayCheckout(
  intent: TilopayIntentSnapshot,
  isExisting: boolean,
  deps: CheckoutDeps
): Promise<CheckoutResult> {
  if (isExisting) {
    const reconciled = await reconcileTilopayIntent(intent, deps);
    switch (reconciled.outcome) {
      case "paid":
        return { kind: "paid" };
      case "failed":
        return { kind: "failed" };
      case "review":
        return { kind: "review" };
      case "pending":
        return { kind: "uncertain" };
      case "error":
        return { kind: "error", reason: "consult_failed" };
      case "not_found":
        if (intent.checkoutUrl) return { kind: "redirect", url: intent.checkoutUrl };
        break;
    }
  }

  let url: string;
  try {
    ({ url } = await deps.processPayment(intent.orderNumber));
  } catch (error) {
    if (error instanceof TilopayTimeoutError) {
      await deps.markUncertain("process_payment_timeout");
      return { kind: "uncertain" };
    }
    return { kind: "error", reason: "process_payment_failed" };
  }

  const stored = await deps.saveCheckoutUrl(url);
  return { kind: "redirect", url: stored };
}

export type WebhookInput = {
  eventType: TilopayWebhookEventType;
  rawBody: string;
  hashHeader: string | null;
  timestampHeader: string | null;
};

export type WebhookDeps = {
  // Inserta idempotentemente por provider + external_event_id.
  recordEvent: (event: {
    externalEventId: string;
    eventType: string;
    signatureValid: boolean | null;
    payload: Record<string, unknown>;
  }) => Promise<{ id: string; duplicate: boolean; processingStatus?: string }>;
  updateEvent: (id: string, patch: { payload: Record<string, unknown>; processingError: string | null }) => Promise<void>;
  // null cuando Tilopay no está configurado: no se consulta.
  consult: ((orderNumber: string) => Promise<unknown>) | null;
  expectedEnvironment: TilopayEnvironment | null;
  // Monto esperado según lib/plans para el plan remoto, o null si no hay mapeo.
  resolveExpectedAmount: (remotePlanId: string | null) => number | null;
  // Aplica el evento de forma atómica (apply_tilopay_subscription_event).
  applyBusinessEvent?: (event: {
    eventId: string;
    eventType: TilopayWebhookEventType;
    externalSubscriptionId: string;
    orderNumber: string | null;
    transactionId: string | null;
    amount: number | null;
    currency: string | null;
    raw: Record<string, unknown>;
  }) => Promise<string>;
  // Inyectable para pruebas; por defecto el verificador real.
  verifySignature?: (input: { hashHeader: string | null; timestampHeader: string | null; rawBody: string }) => TilopaySignatureCheck;
};

export type WebhookResult = {
  httpStatus: number;
  duplicate: boolean;
  businessChangesApplied: boolean;
  signature: string;
};

// Webhooks recurrentes: siempre se auditan de forma idempotente.
// - Firma no verificable (estado actual): nunca cambian estado de negocio; un
//   webhook_payment se concilia con consult y queda registrado para revisión.
// - Firma válida: se aplican mediante apply_tilopay_subscription_event; un
//   cobro solo se acredita si consult lo confirma (orden, monto, USD, entorno).
export async function handleTilopayWebhook(input: WebhookInput, deps: WebhookDeps): Promise<WebhookResult> {
  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(input.rawBody) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not_object");
    payload = parsed as Record<string, unknown>;
  } catch {
    return { httpStatus: 422, duplicate: false, businessChangesApplied: false, signature: "not_checked" };
  }

  // La firma se verifica sobre el cuerpo crudo (en memoria); lo que se persiste
  // y procesa es SOLO la versión sanitizada (lista blanca de campos documentados).
  const signature = (deps.verifySignature ?? verifyTilopayWebhookSignature)(input);
  const canApply = canWebhookApplyBusinessChanges(signature);
  const sanitized = sanitizeTilopayWebhookPayload(payload);
  const event = parseTilopayWebhook(input.eventType, sanitized.fields, input.rawBody, input.timestampHeader);

  // Nunca se guarda el cuerpo crudo de un webhook público: podría contener PAN,
  // CVV u otros datos arbitrarios. Para auditoría basta el hash del cuerpo.
  const storedPayload: Record<string, unknown> = {
    body: sanitized.fields,
    dropped_field_count: sanitized.dropped_field_count,
    raw_body_sha256: createHash("sha256").update(input.rawBody).digest("hex"),
    headers: sanitizeTilopayWebhookHeaders(input.hashHeader, input.timestampHeader),
    signature,
  };

  const recorded = await deps.recordEvent({
    externalEventId: event.externalEventId,
    eventType: event.eventType,
    signatureValid: signature.status === "valid" ? true : signature.status === "invalid" ? false : null,
    payload: storedPayload,
  });

  // Un duplicado solo se reprocesa si quedó sin aplicar ('received') y la firma
  // es válida (reintento de Tilopay tras un fallo transitorio).
  const retryPending = recorded.duplicate && canApply && recorded.processingStatus === "received";
  if (recorded.duplicate && !retryPending) {
    return { httpStatus: 200, duplicate: true, businessChangesApplied: false, signature: signature.status };
  }

  let evaluation: TilopayConsultEvaluation | null = null;
  let consultFailed = false;
  if (event.eventType === "webhook_payment" && event.orderNumber && deps.consult && deps.expectedEnvironment) {
    const expectedAmount = deps.resolveExpectedAmount(event.remotePlanId);
    try {
      const raw = await deps.consult(event.orderNumber);
      evaluation = evaluateTilopayConsult(
        {
          orderNumber: event.orderNumber,
          amount: expectedAmount ?? Number.NaN,
          currency: "USD",
          environment: deps.expectedEnvironment,
        },
        raw
      );
      storedPayload.reconciliation = {
        expected_amount: expectedAmount,
        result: evaluation.result,
        code: evaluation.code,
        reasons: evaluation.reasons,
        consult: sanitizeConsultResponse(raw),
      };
    } catch {
      consultFailed = true;
      storedPayload.reconciliation = { result: "consult_error" };
    }
  }

  const notApplied = async (processingError: string, httpStatus = 200): Promise<WebhookResult> => {
    await deps.updateEvent(recorded.id, { payload: storedPayload, processingError });
    return { httpStatus, duplicate: recorded.duplicate, businessChangesApplied: false, signature: signature.status };
  };

  // Puerta 1: sin firma verificada nunca se cambia estado de negocio.
  if (!canApply) return notApplied("signature_verification_pending");

  // Puerta 2 (firma válida): identidad del suscriptor y, para cobros, consult.
  const externalSubscriptionId =
    event.remotePlanId && event.email ? buildTilopayExternalSubscriptionId(event.remotePlanId, event.email) : null;
  if (!externalSubscriptionId) return notApplied("missing_subscriber_identity");

  if (event.eventType === "webhook_payment") {
    if (consultFailed || !deps.consult) return notApplied("consult_unavailable", 502);
    if (!evaluation || evaluation.result !== "succeeded") return notApplied("consult_not_confirmed");
  }

  if (!deps.applyBusinessEvent) return notApplied("business_handler_unavailable", 502);

  await deps.updateEvent(recorded.id, { payload: storedPayload, processingError: null });

  const result = await deps.applyBusinessEvent({
    eventId: recorded.id,
    eventType: event.eventType,
    externalSubscriptionId,
    orderNumber: event.orderNumber,
    transactionId: evaluation?.transactionId ?? null,
    amount: evaluation?.amount ?? null,
    currency: evaluation?.currency ?? null,
    raw: storedPayload,
  });

  return {
    // retry_later: checkout abierto de la misma empresa; Tilopay reintenta (502).
    httpStatus: result === "retry_later" ? 502 : 200,
    duplicate: recorded.duplicate,
    businessChangesApplied: result === "applied" || result === "activated",
    signature: signature.status,
  };
}
