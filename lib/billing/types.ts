// Tipos internos de billing, independientes del proveedor.
// Reflejan los valores permitidos por los CHECK de la base de datos.

export type BillingProvider =
  | "paguelofacil"
  | "yappy_manual"
  | "manual"
  | "yappy"
  | "tilopay";

export type BillingCycle = "monthly" | "annual";

export type PaymentIntentType = "subscription_payment" | "plan_upgrade";

// Estado interno de un cobro (payment_intents.status).
export type PaymentIntentStatus =
  | "pending"
  | "claimed"
  | "awaiting_verification"
  | "paid"
  | "expired"
  | "cancelled"
  | "failed"
  | "manual_review";

// Estado interno de la relación recurrente (billing_subscriptions.status).
// Es independiente del acceso al producto, que decide companies.
export type BillingSubscriptionStatus =
  | "pending"
  | "active"
  | "past_due"
  | "cancel_requested"
  | "cancelled"
  | "unknown";

// Estado de procesamiento de un webhook/IPN (billing_provider_events.processing_status).
export type ProviderEventProcessingStatus =
  | "received"
  | "processed"
  | "ignored"
  | "failed";

// Resultado normalizado que un adaptador obtiene de su proveedor.
export type NormalizedPaymentResult =
  | "succeeded"
  | "pending"
  | "failed"
  | "cancelled"
  | "expired"
  | "unknown";

// Traducción del resultado normalizado al estado interno del cobro.
// `unknown` no cambia el estado: queda para conciliación.
export const PAYMENT_RESULT_TO_INTENT_STATUS: Record<
  NormalizedPaymentResult,
  PaymentIntentStatus | null
> = {
  succeeded: "paid",
  pending: "awaiting_verification",
  failed: "failed",
  cancelled: "cancelled",
  expired: "expired",
  unknown: null,
};

export const BILLING_CURRENCY = "USD";
