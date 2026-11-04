import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { BillingCycle } from "@/lib/billing/types";
import { tilopayConsult, tilopayProcessPayment, tilopayRecurrentUrl } from "./client";
import { getTilopayConfig, getTilopayRemotePlanId } from "./config";
import {
  buildProcessPaymentBody,
  buildTilopayExternalSubscriptionId,
  isTilopayWebhookVerificationConfigured,
  type TilopayCustomer,
} from "./core";
import {
  prepareTilopayCheckout,
  reconcileTilopayIntent,
  type ConfirmArgs,
  type ReconcileDeps,
  type TilopayIntentSnapshot,
} from "./flow";

// Conecta el flujo Tilopay con Supabase (service_role). Los llamadores deben
// haber validado usuario, empresa y permisos ANTES de invocar estas funciones.

async function confirmViaRpc(args: ConfirmArgs) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("confirm_tilopay_payment", {
    p_intent_id: args.intentId,
    p_order_number: args.orderNumber,
    p_result: args.result,
    p_transaction_id: args.transactionId,
    p_amount: args.amount,
    p_currency: args.currency,
    p_raw_response: args.raw,
  });

  if (error) {
    console.error("Tilopay confirmation RPC failed", { intentId: args.intentId, code: error.code });
    throw new Error("TILOPAY_CONFIRMATION_FAILED");
  }

  return String(data ?? "");
}

function reconcileDeps(): ReconcileDeps {
  const config = getTilopayConfig();
  return {
    expectedEnvironment: config.expectedEnvironment,
    consult: tilopayConsult,
    confirm: confirmViaRpc,
  };
}

type StoredTilopayIntent = {
  id: string;
  provider: string;
  provider_order_id: string | null;
  exact_amount: number | string;
  currency: string | null;
  checkout_url: string | null;
};

function toSnapshot(intent: StoredTilopayIntent): TilopayIntentSnapshot | null {
  if (intent.provider !== "tilopay" || !intent.provider_order_id) return null;
  return {
    id: intent.id,
    orderNumber: intent.provider_order_id,
    amount: Number(intent.exact_amount),
    currency: intent.currency ?? "USD",
    checkoutUrl: intent.checkout_url,
  };
}

// Reconsulta Tilopay y aplica el resultado. Idempotente: puede llamarse cuantas
// veces se quiera (refresh del redirect, botón "verificar") sin duplicar efectos.
export async function reconcileTilopayIntentById(intentId: string) {
  const admin = createAdminClient();
  const { data: intent } = await admin
    .from("payment_intents")
    .select("id, provider, provider_order_id, exact_amount, currency, checkout_url")
    .eq("id", intentId)
    .maybeSingle();

  const snapshot = intent ? toSnapshot(intent as StoredTilopayIntent) : null;
  if (!snapshot) return { outcome: "error" as const };

  try {
    const result = await reconcileTilopayIntent(snapshot, reconcileDeps());
    return { outcome: result.outcome };
  } catch (error) {
    console.error("Tilopay reconciliation failed", {
      intentId,
      error: error instanceof Error ? error.name : "unknown",
    });
    return { outcome: "error" as const };
  }
}

export async function startTilopayCheckout(input: {
  intent: StoredTilopayIntent;
  isExisting: boolean;
  customer: TilopayCustomer;
  origin: string;
}) {
  const snapshot = toSnapshot(input.intent);
  if (!snapshot) return { kind: "error" as const, reason: "invalid_intent" };

  const admin = createAdminClient();
  const redirectUrl = new URL("/api/payments/tilopay/return", input.origin);
  redirectUrl.searchParams.set("intent", snapshot.id);

  return prepareTilopayCheckout(snapshot, input.isExisting, {
    ...reconcileDeps(),
    processPayment: (orderNumber) =>
      tilopayProcessPayment((apiKey) =>
        buildProcessPaymentBody({
          apiKey,
          orderNumber,
          amount: snapshot.amount,
          redirectUrl: redirectUrl.toString(),
          customer: input.customer,
        })
      ),
    saveCheckoutUrl: async (url) => {
      // Escritura condicional: si otra petición ya guardó una URL, se conserva esa.
      const { data: stored } = await admin
        .from("payment_intents")
        .update({ checkout_url: url })
        .eq("id", snapshot.id)
        .is("checkout_url", null)
        .select("checkout_url");
      if ((stored ?? []).length > 0) return url;

      const { data: current } = await admin
        .from("payment_intents")
        .select("checkout_url")
        .eq("id", snapshot.id)
        .maybeSingle();
      return current?.checkout_url ?? url;
    },
    markUncertain: async (reason) => {
      const { data: updated } = await admin
        .from("payment_intents")
        .update({ status: "awaiting_verification" })
        .eq("id", snapshot.id)
        .in("status", ["pending", "claimed"])
        .select("id");

      if ((updated ?? []).length > 0) {
        await admin.from("payment_audit_logs").insert({
          intent_id: snapshot.id,
          action: "provider_uncertain",
          from_status: "pending",
          to_status: "awaiting_verification",
          actor_type: "system",
          metadata: { provider: "tilopay", reason },
        });
      }
    },
  });
}

// La recurrencia solo se habilita cuando los webhooks recurrentes puedan
// verificarse criptográficamente: sin eso, los cobros/cancelaciones de Tilopay
// no podrían reflejarse en Monexity de forma segura.
export function isTilopayRecurringEnabled() {
  return isTilopayWebhookVerificationConfigured();
}

export class TilopayExistingSubscriptionError extends Error {
  constructor() {
    super("TILOPAY_EXISTING_SUBSCRIPTION_OTHER_PROVIDER");
    this.name = "TilopayExistingSubscriptionError";
  }
}

export async function getTilopayRecurrentRegistration(input: {
  companyId: string;
  planId: string;
  billingCycle: BillingCycle;
  amount: number;
  email: string;
}) {
  const remotePlanId = getTilopayRemotePlanId(input.planId, input.billingCycle);
  const admin = createAdminClient();
  const { data: open } = await admin
    .from("billing_subscriptions")
    .select("id, provider")
    .eq("company_id", input.companyId)
    .in("status", ["pending", "active", "past_due", "cancel_requested"])
    .maybeSingle();

  // Una relación recurrente abierta con otro proveedor debe cerrarse antes
  // (los cobros de ese proveedor no se detienen desde aquí).
  if (open && open.provider !== "tilopay") throw new TilopayExistingSubscriptionError();

  const urls = await tilopayRecurrentUrl(remotePlanId, input.email);
  const checkoutUrl = urls.urlRenew ?? urls.urlRegister;
  // Identidad con la que llegan los webhooks: plan remoto + email.
  const relation = {
    external_subscription_id: buildTilopayExternalSubscriptionId(remotePlanId, input.email),
    external_customer_id: input.email.toLowerCase(),
    plan_id: input.planId,
    billing_cycle: input.billingCycle,
    amount: input.amount,
    currency: "USD",
    external_status: "registration_url_issued",
    external_status_observed_at: new Date().toISOString(),
    checkout_url: checkoutUrl,
  };

  // La relación se activa solo con eventos verificados (subscribe/payment).
  const { error } = open
    ? await admin.from("billing_subscriptions").update(relation).eq("id", open.id)
    : await admin
        .from("billing_subscriptions")
        .insert({ ...relation, company_id: input.companyId, provider: "tilopay", status: "pending" });

  if (error) throw new Error("TILOPAY_SUBSCRIPTION_SAVE_FAILED");

  return { url: checkoutUrl, remotePlanId };
}
