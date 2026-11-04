// Contrato que debe implementar cada proveedor de pago.
// La lógica de Monexity depende solo de este contrato, nunca de un proveedor concreto.
import type {
  BillingCycle,
  BillingProvider,
  BillingSubscriptionStatus,
  NormalizedPaymentResult,
  PaymentIntentStatus,
  PaymentIntentType,
} from "./types";

export type CreateCheckoutInput = {
  intentId: string;
  companyId: string;
  intentType: PaymentIntentType;
  planId: string;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  description: string;
  returnUrl: string;
  idempotencyKey: string;
};

export type CreateCheckoutResult = {
  checkoutUrl: string | null;
  providerReference: string | null;
  providerOrderId: string | null;
  // Vencimiento real del checkout u orden según el proveedor, si lo informa.
  validUntil: string | null;
};

// Lo que el proveedor confirma sobre un cobro.
export type ProviderChargeSnapshot = {
  providerPaymentId: string;
  providerOrderId: string | null;
  providerSubscriptionId: string | null;
  result: NormalizedPaymentResult;
  providerStatus: string | null;
  amount: number | null;
  currency: string | null;
  paidAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  raw: unknown;
};

export type ProviderSubscriptionSnapshot = {
  externalSubscriptionId: string;
  status: BillingSubscriptionStatus;
  externalStatus: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  raw: unknown;
};

export type IncomingNotification = {
  headers: Record<string, string>;
  rawBody: string;
  query: Record<string, string>;
};

// Notificación (webhook/IPN) ya verificada y normalizada por el adaptador.
export type VerifiedNotification = {
  externalEventId: string;
  eventType: string | null;
  signatureValid: boolean;
  charge: ProviderChargeSnapshot | null;
  subscription: ProviderSubscriptionSnapshot | null;
  raw: unknown;
};

// Origen de una confirmación de cobro.
export type PaymentConfirmationSource = "return" | "webhook" | "reconciliation";

// Entrada del servicio interno que confirma un intent a partir de lo que el
// proveedor reporta. La acreditación la decide Monexity, no el adaptador.
export type PaymentConfirmationInput = {
  intentId: string;
  provider: BillingProvider;
  source: PaymentConfirmationSource;
  charge: ProviderChargeSnapshot;
  providerEventId: string | null;
};

export type PaymentConfirmationResult = {
  intentId: string;
  status: PaymentIntentStatus;
  // true solo si esta confirmación acreditó el período; un reintento devuelve false.
  credited: boolean;
  duplicate: boolean;
};

export type ChargeLookup = {
  providerPaymentId?: string;
  providerOrderId?: string;
};

export type RecurringSubscriptionInput = {
  companyId: string;
  planId: string;
  billingCycle: BillingCycle;
  amount: number;
  currency: string;
  idempotencyKey: string;
};

// Operaciones de recurrencia: solo para proveedores que la soportan.
export interface RecurringBillingOperations {
  create(input: RecurringSubscriptionInput): Promise<ProviderSubscriptionSnapshot>;
  change(externalSubscriptionId: string, input: RecurringSubscriptionInput): Promise<ProviderSubscriptionSnapshot>;
  cancel(externalSubscriptionId: string, idempotencyKey: string): Promise<ProviderSubscriptionSnapshot>;
  fetch(externalSubscriptionId: string): Promise<ProviderSubscriptionSnapshot | null>;
  listCharges(externalSubscriptionId: string, since: string | null): Promise<ProviderChargeSnapshot[]>;
}

export interface BillingProviderAdapter {
  readonly provider: BillingProvider;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  fetchCharge(lookup: ChargeLookup): Promise<ProviderChargeSnapshot | null>;
  verifyNotification(notification: IncomingNotification): Promise<VerifiedNotification | null>;
  readonly recurring?: RecurringBillingOperations;
}
