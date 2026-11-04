// Reglas puras de la integración Tilopay (sin red, sin base de datos, sin secretos).
// Se usan desde módulos server-only; no importar desde componentes cliente.
// Referencia: https://tilopay.com/developers (login, processPayment, consult,
// recurrentUrl, createPlanRepeat, webhooks, reintentos seguros).
import { createHash, randomBytes } from "node:crypto";
import { PLAN_MAP, type Plan } from "@/lib/plans/plans";
import { getPlanAmount } from "@/lib/billing/plans";
import type { BillingCycle } from "@/lib/billing/types";

export const TILOPAY_CURRENCY = "USD";
export type TilopayEnvironment = "TEST" | "PROD";

// ── Errores ───────────────────────────────────────────────────────

// Configuración server-side incompleta. El mensaje es administrativo y solo
// nombra variables, nunca sus valores.
export class TilopayConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TilopayConfigError";
  }
}

// Sin respuesta de Tilopay dentro del plazo: el resultado es desconocido.
// Nunca se reintenta con otra orden; primero se consulta.
export class TilopayTimeoutError extends Error {
  constructor(operation: string) {
    super(`TILOPAY_TIMEOUT:${operation}`);
    this.name = "TilopayTimeoutError";
  }
}

// Respuesta de Tilopay no exitosa (HTTP o cuerpo). No incluye credenciales.
export class TilopayRequestError extends Error {
  readonly httpStatus: number | null;
  readonly providerType: string | null;
  constructor(operation: string, httpStatus: number | null, providerType: string | null) {
    super(`TILOPAY_REQUEST_FAILED:${operation}:${httpStatus ?? "-"}:${providerType ?? "-"}`);
    this.name = "TilopayRequestError";
    this.httpStatus = httpStatus;
    this.providerType = providerType;
  }
}

// ── Plan, ciclo y monto (fuente de verdad: lib/plans) ─────────────

export function isBillingCycle(value: unknown): value is BillingCycle {
  return value === "monthly" || value === "annual";
}

// Resuelve el cobro solo desde la configuración de Monexity. Cualquier monto
// enviado por el cliente se ignora.
export function resolveTilopayCharge(
  planId: unknown,
  billingCycle: unknown
): { plan: Plan; billingCycle: BillingCycle; amount: number } | null {
  if (typeof planId !== "string" || !Object.prototype.hasOwnProperty.call(PLAN_MAP, planId)) return null;
  if (!isBillingCycle(billingCycle)) return null;
  const plan = PLAN_MAP[planId];
  const amount = Number(getPlanAmount(plan, billingCycle).toFixed(2));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { plan, billingCycle, amount };
}

// Nombre de la variable de entorno con el id del plan recurrente remoto.
// Ej.: TILOPAY_PLAN_ID_EQUIPO_ANNUAL
export function getTilopayRemotePlanEnvName(planId: string, billingCycle: BillingCycle) {
  return `TILOPAY_PLAN_ID_${planId.toUpperCase()}_${billingCycle.toUpperCase()}`;
}

// Frecuencias oficiales de createPlanRepeat: 3 mensual, 4 anual.
export const TILOPAY_FREQUENCY: Record<BillingCycle, number> = {
  monthly: 3,
  annual: 4,
};

// ── orderNumber ───────────────────────────────────────────────────

// Único por comercio y para siempre (Tilopay rechaza repetidos). Se genera y
// persiste antes de llamar a Tilopay; aleatorio, nunca derivado de algo repetible.
export function generateTilopayOrderNumber() {
  return `MNX${randomBytes(12).toString("hex").toUpperCase()}`;
}

export function isValidTilopayOrderNumber(value: unknown): value is string {
  return typeof value === "string" && /^MNX[0-9A-F]{24}$/.test(value);
}

// ── Periodo por calendario ────────────────────────────────────────

// Panamá usa UTC-5 fijo (sin horario de verano): el día del mes se calcula en
// hora local para que "31 ene" → "28/29 feb" y no salte por la zona horaria.
const APP_UTC_OFFSET_MS = -5 * 60 * 60 * 1000;

export function addCalendarMonths(date: Date, months: number) {
  const local = new Date(date.getTime() + APP_UTC_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth() + months;
  const day = local.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const result = new Date(Date.UTC(
    year,
    month,
    Math.min(day, lastDay),
    local.getUTCHours(),
    local.getUTCMinutes(),
    local.getUTCSeconds(),
    local.getUTCMilliseconds()
  ));
  return new Date(result.getTime() - APP_UTC_OFFSET_MS);
}

// Periodo que acreditará un pago Tilopay: empieza al terminar el periodo
// vigente (si sigue activo) o ahora; dura 1 mes o 1 año de calendario.
export function getNextCalendarBillingPeriod(
  currentPeriodEndsAt: string | null,
  billingCycle: BillingCycle,
  now: number = Date.now()
) {
  const currentEnd = currentPeriodEndsAt ? new Date(currentPeriodEndsAt).getTime() : NaN;
  const start = new Date(Number.isFinite(currentEnd) && currentEnd > now ? currentEnd : now);
  const end = addCalendarMonths(start, billingCycle === "annual" ? 12 : 1);
  return { periodStart: start.toISOString(), periodEnd: end.toISOString() };
}

// ── processPayment ────────────────────────────────────────────────

export type TilopayCustomer = {
  fullName: string | null;
  email: string;
  phone: string | null;
  address: string | null;
};

function splitName(fullName: string | null, fallback: string) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: fallback, last: fallback };
  if (parts.length === 1) return { first: parts[0], last: parts[0] };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

// Cuerpo de POST /api/v1/processPayment. Todos los valores son string.
// subscription="0": no se fuerza guardar tarjeta. capture="1": autoriza y captura.
// Los campos billTo* son obligatorios en la documentación; se envían los datos
// disponibles del dueño/negocio y valores genéricos de Panamá cuando faltan.
export function buildProcessPaymentBody(input: {
  apiKey: string;
  orderNumber: string;
  amount: number;
  redirectUrl: string;
  customer: TilopayCustomer;
}) {
  const name = splitName(input.customer.fullName, "Cliente");
  const phone = (input.customer.phone ?? "").replace(/[^0-9+]/g, "").slice(0, 20);
  const address = (input.customer.address ?? "").trim().slice(0, 120) || "Panama";

  return {
    redirect: input.redirectUrl,
    key: input.apiKey,
    amount: input.amount.toFixed(2),
    currency: TILOPAY_CURRENCY,
    orderNumber: input.orderNumber,
    capture: "1",
    billToFirstName: name.first.slice(0, 60),
    billToLastName: name.last.slice(0, 60),
    billToAddress: address,
    billToAddress2: address,
    billToCity: "Panama",
    billToState: "PA-8",
    billToZipPostCode: "0000",
    billToCountry: "PA",
    billToTelephone: phone || "00000000",
    billToEmail: input.customer.email,
    subscription: "0",
    platform: "Monexity",
    hashVersion: "V2",
    token_version: "v2",
  };
}

// ── consult: evaluación contra la intención local ─────────────────

// Aprobación: la documentación de consult devuelve code "1" ("Transacción
// aprobada"); soporte informó "00" como aprobada. Ambos se aceptan como
// aprobación, siempre junto con orden, monto, moneda y entorno coincidentes.
export const TILOPAY_APPROVED_CODES = new Set(["1", "00"]);

// Rechazos informados por Tilopay (pueden variar por adquirente).
export const TILOPAY_DECLINE_CODES: Record<string, string> = {
  "05": "No aprobada por el banco",
  "12": "Transacción inválida",
  "14": "Tarjeta inválida",
  "34": "Sospecha de fraude",
  "51": "Fondos insuficientes",
  "54": "Tarjeta vencida",
  "57": "Transacción no permitida",
  "91": "Emisor no disponible",
  "96": "Error de sistema",
};

export function normalizeTilopayEnvironment(value: unknown): TilopayEnvironment | null {
  const env = String(value ?? "").trim().toLowerCase();
  if (env === "test") return "TEST";
  if (env === "prod" || env === "production") return "PROD";
  return null;
}

function toCents(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const raw = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(raw)) return null;
  return Math.round(raw * 100);
}

export type TilopayConsultExpectation = {
  orderNumber: string;
  amount: number;
  currency: string;
  environment: TilopayEnvironment;
};

export type TilopayConsultEvaluation = {
  // consult_error: respuesta no interpretable → no se cambia estado.
  // not_found: Tilopay no tiene transacción para la orden → no se cambia estado.
  // unknown: transacción con código no reconocido → requiere conciliación.
  result: "succeeded" | "failed" | "review" | "unknown" | "not_found" | "consult_error";
  transactionId: string | null;
  amount: number | null;
  currency: string | null;
  environment: TilopayEnvironment | null;
  code: string | null;
  reasons: string[];
};

type ConsultEntry = Record<string, unknown>;

export function evaluateTilopayConsult(
  expected: TilopayConsultExpectation,
  response: unknown
): TilopayConsultEvaluation {
  const base: TilopayConsultEvaluation = {
    result: "consult_error",
    transactionId: null,
    amount: null,
    currency: null,
    environment: null,
    code: null,
    reasons: [],
  };

  if (!response || typeof response !== "object") {
    return { ...base, reasons: ["invalid_response"] };
  }

  const body = response as Record<string, unknown>;
  if (String(body.type ?? "") !== "200" || !Array.isArray(body.response)) {
    return { ...base, reasons: ["consult_not_ok"] };
  }

  const entries = (body.response as unknown[]).filter(
    (entry): entry is ConsultEntry =>
      Boolean(entry) && typeof entry === "object" &&
      String((entry as ConsultEntry).orderNumber ?? "") === expected.orderNumber
  );

  if (entries.length === 0) {
    return { ...base, result: "not_found", reasons: ["order_not_found"] };
  }

  const isPayment = (entry: ConsultEntry) =>
    entry.type === undefined || String(entry.type).trim().toLowerCase() === "payment";
  const nonPayment = entries.filter((entry) => !isPayment(entry));
  const approved = entries.filter(
    (entry) => isPayment(entry) && TILOPAY_APPROVED_CODES.has(String(entry.code ?? "").trim())
  );

  if (approved.length > 0) {
    const entry = approved[0];
    const cents = toCents(entry.amount);
    const currency = String(entry.currency ?? "").trim().toUpperCase() || null;
    const environment = normalizeTilopayEnvironment(entry.environment);
    const transactionId = String(entry.id_tilopay ?? "").trim() || null;
    const reasons: string[] = [];

    if (approved.length > 1) reasons.push("multiple_approved_transactions");
    if (nonPayment.length > 0) reasons.push("non_payment_operations_present");
    if (cents === null || cents !== Math.round(expected.amount * 100)) reasons.push("amount_mismatch");
    if (currency !== expected.currency.toUpperCase() || currency !== TILOPAY_CURRENCY) reasons.push("currency_mismatch");
    if (environment !== expected.environment) reasons.push("environment_mismatch");
    if (!transactionId) reasons.push("missing_transaction_id");

    return {
      result: reasons.length === 0 ? "succeeded" : "review",
      transactionId,
      amount: cents === null ? null : cents / 100,
      currency,
      environment,
      code: String(entry.code ?? "").trim(),
      reasons,
    };
  }

  const latest = entries[entries.length - 1];
  const code = String(latest.code ?? "").trim() || null;
  const evaluation = {
    ...base,
    transactionId: String(latest.id_tilopay ?? "").trim() || null,
    amount: (() => {
      const cents = toCents(latest.amount);
      return cents === null ? null : cents / 100;
    })(),
    currency: String(latest.currency ?? "").trim().toUpperCase() || null,
    environment: normalizeTilopayEnvironment(latest.environment),
    code,
  };

  if (code && Object.prototype.hasOwnProperty.call(TILOPAY_DECLINE_CODES, code) && nonPayment.length === 0) {
    return { ...evaluation, result: "failed", reasons: ["declined"] };
  }

  // Código no reconocido u operaciones no-pago: nunca se asume pagado ni rechazado.
  return { ...evaluation, result: "unknown", reasons: ["unrecognized_code"] };
}

// Resultado que se entrega a confirm_tilopay_payment (o null: no tocar la base).
export function toConfirmationResult(
  evaluation: TilopayConsultEvaluation
): "succeeded" | "failed" | "pending" | "review" | null {
  switch (evaluation.result) {
    case "succeeded":
    case "failed":
    case "review":
      return evaluation.result;
    case "unknown":
      return "pending";
    default:
      return null;
  }
}

// Copia segura de la respuesta de consult para auditoría: sin datos de tarjeta.
export function sanitizeConsultResponse(response: unknown) {
  if (!response || typeof response !== "object") return { invalid: true };
  const body = response as Record<string, unknown>;
  const entries = Array.isArray(body.response) ? body.response : [];
  return {
    type: body.type ?? null,
    message: typeof body.message === "string" ? body.message.slice(0, 200) : null,
    response: entries.slice(0, 10).map((entry) => {
      const e = (entry ?? {}) as Record<string, unknown>;
      return {
        id_tilopay: e.id_tilopay ?? null,
        orderNumber: e.orderNumber ?? null,
        amount: e.amount ?? null,
        currency: e.currency ?? null,
        code: e.code ?? null,
        response: typeof e.response === "string" ? e.response.slice(0, 120) : null,
        auth: e.auth ?? null,
        capture: e.capture ?? null,
        environment: e.environment ?? null,
        type: e.type ?? null,
        date: e.date ?? null,
      };
    }),
  };
}

// ── OrderHash (redirect) ──────────────────────────────────────────

export type TilopayOrderHashCheck =
  | { status: "unsupported"; reason: string };

// PENDIENTE: la documentación pública indica que el algoritmo de OrderHash no
// es público. Soporte entregó llave (tpt | api_key | api_password), orden de
// campos y HMAC-SHA256, pero no el separador/concatenación exacta, el encoding,
// el tratamiento de null/vacíos ni si la salida es hex o base64. Hasta tenerlo
// por escrito no se implementa: la confirmación definitiva es siempre consult.
export function verifyTilopayOrderHash(): TilopayOrderHashCheck {
  return { status: "unsupported", reason: "order_hash_spec_incomplete" };
}

// ── Webhooks recurrentes ──────────────────────────────────────────

export const TILOPAY_WEBHOOK_EVENTS = {
  subscribe: "webhook_subscribe",
  payment: "webhook_payment",
  rejected: "webhook_rejected",
  unsubscribe: "webhook_unsubscribe",
  reactive: "webhook_reactive",
} as const;

export type TilopayWebhookSlug = keyof typeof TILOPAY_WEBHOOK_EVENTS;
export type TilopayWebhookEventType = (typeof TILOPAY_WEBHOOK_EVENTS)[TilopayWebhookSlug];

export function getTilopayWebhookEventType(slug: string): TilopayWebhookEventType | null {
  return Object.prototype.hasOwnProperty.call(TILOPAY_WEBHOOK_EVENTS, slug)
    ? TILOPAY_WEBHOOK_EVENTS[slug as TilopayWebhookSlug]
    : null;
}

export type TilopaySignatureCheck =
  | { status: "valid" }
  | { status: "invalid"; reason: string }
  | { status: "pending_configuration"; reason: string };

// PENDIENTE (único bloqueo de la recurrencia): soporte informó headers
// hash-tilopay + unix-timestamp con HMAC-SHA256 y secreto compartido, pero no
// cómo se obtiene el secreto ni la cadena exacta firmada/encoding/tolerancia.
// La documentación pública de webhooks, en cambio, indica que la única
// verificación de origen disponible es OrderHash (algoritmo no público).
// Al confirmarse la especificación: implementar el cálculo aquí y poner esta
// bandera en true. Todo lo demás (eventos, idempotencia, RPC) ya está listo.
const TILOPAY_WEBHOOK_SIGNATURE_SPEC_CONFIRMED = false;

export function isTilopayWebhookVerificationConfigured() {
  return TILOPAY_WEBHOOK_SIGNATURE_SPEC_CONFIRMED;
}

// No se inventa el algoritmo: mientras la especificación no esté confirmada
// nunca devuelve "valid".
export function verifyTilopayWebhookSignature(input: {
  hashHeader: string | null;
  timestampHeader: string | null;
  rawBody: string;
}): TilopaySignatureCheck {
  if (!input.hashHeader || !input.timestampHeader) {
    return { status: "pending_configuration", reason: "signature_headers_missing" };
  }
  if (!isTilopayWebhookVerificationConfigured()) {
    return { status: "pending_configuration", reason: "webhook_secret_not_configured" };
  }
  return { status: "invalid", reason: "signature_algorithm_not_implemented" };
}

// Identificador estable de la relación recurrente: Tilopay identifica al
// suscriptor por plan remoto + email en sus webhooks.
export function buildTilopayExternalSubscriptionId(remotePlanId: string, email: string) {
  return `plan:${remotePlanId.trim()}:${email.trim().toLowerCase()}`;
}

// Un webhook solo puede cambiar estado de negocio (acreditar, renovar,
// cancelar, reactivar) con firma criptográfica válida.
export function canWebhookApplyBusinessChanges(signature: TilopaySignatureCheck) {
  return signature.status === "valid";
}

// ── Sanitización de webhooks (antes de persistir) ────────────────

// Campos documentados de los webhooks recurrentes (create-plan) y su formato.
// Nada fuera de esta lista se persiste: un webhook público aún no verificable
// podría traer PAN, CVV u otros datos arbitrarios.
const WEBHOOK_FIELD_RULES: Record<string, RegExp> = {
  id_plan: /^[A-Za-z0-9_-]{1,64}$/,
  email: /^[^\s@]{1,64}@[^\s@]{1,190}$/,
  modality: /^[\p{L}\p{N} ._-]{1,64}$/u,
  amount: /^\d{1,7}(\.\d{1,2})?$/,
  frequency: /^\d{0,2}$/,
  coupon: /^[A-Za-z0-9_-]{1,32}$/,
  free_trial: /^[01]$/,
  next_payment_date: /^\d{4}-\d{2}-\d{2}$/,
  expire: /^\d{4}-\d{2}-\d{2}$/,
  auth: /^[A-Za-z0-9]{1,12}$/,
  orderNumber: /^[A-Za-z0-9_-]{1,64}$/,
};

function passesLuhn(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

// Posible PAN: 13–19 dígitos (con o sin separadores) que cumplen Luhn.
export function containsPanLikeNumber(value: string) {
  const candidates = value.match(/\d(?:[ -]?\d){12,18}/g) ?? [];
  return candidates.some((candidate) => passesLuhn(candidate.replace(/\D/g, "")));
}

export function sanitizeTilopayWebhookPayload(payload: Record<string, unknown>) {
  const fields: Record<string, string> = {};
  let dropped = 0;

  for (const [key, raw] of Object.entries(payload)) {
    const rule = Object.prototype.hasOwnProperty.call(WEBHOOK_FIELD_RULES, key) ? WEBHOOK_FIELD_RULES[key] : null;
    const value = typeof raw === "string" || typeof raw === "number" ? String(raw).trim() : null;
    if (!rule || value === null || !rule.test(value) || containsPanLikeNumber(value)) {
      dropped += 1;
      continue;
    }
    fields[key] = key === "email" ? value.toLowerCase() : value;
  }

  // Solo el conteo: los nombres de campo descartados también podrían contener datos.
  return { fields, dropped_field_count: dropped };
}

export function sanitizeTilopayWebhookHeaders(hashHeader: string | null, timestampHeader: string | null) {
  return {
    "hash-tilopay": hashHeader && /^[A-Za-z0-9+/=_-]{1,256}$/.test(hashHeader) ? hashHeader : null,
    "unix-timestamp": timestampHeader && /^\d{1,13}$/.test(timestampHeader) ? timestampHeader : null,
  };
}

export type ParsedTilopayWebhook = {
  eventType: TilopayWebhookEventType;
  externalEventId: string;
  orderNumber: string | null;
  remotePlanId: string | null;
  email: string | null;
  amount: number | null;
};

function cleanString(value: unknown, max = 200) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

// Identificador idempotente: cobros por orderNumber (único en Tilopay);
// el resto por hash del evento + timestamp + cuerpo crudo.
export function parseTilopayWebhook(
  eventType: TilopayWebhookEventType,
  payload: Record<string, unknown>,
  rawBody: string,
  timestampHeader: string | null
): ParsedTilopayWebhook {
  const orderNumber = cleanString(payload.orderNumber, 100);
  const cents = toCents(payload.amount);
  const externalEventId = eventType === "webhook_payment" && orderNumber
    ? `${eventType}:order:${orderNumber}`
    : `${eventType}:sha256:${createHash("sha256")
        .update(`${eventType}\n${timestampHeader ?? ""}\n${rawBody}`)
        .digest("hex")}`;

  return {
    eventType,
    externalEventId,
    orderNumber,
    remotePlanId: cleanString(payload.id_plan, 64),
    email: cleanString(payload.email, 254)?.toLowerCase() ?? null,
    amount: cents === null ? null : cents / 100,
  };
}
