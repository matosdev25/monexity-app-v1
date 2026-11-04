import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { BillingProvider, ProviderEventProcessingStatus } from "./types";

type RecordProviderEventInput = {
  provider: BillingProvider;
  externalEventId: string;
  eventType: string | null;
  signatureValid: boolean | null;
  payload: unknown;
  companyId?: string | null;
  paymentIntentId?: string | null;
  billingSubscriptionId?: string | null;
};

// Registra un webhook/IPN de forma idempotente por provider + external_event_id.
// Un reintento del proveedor no crea una segunda fila: devuelve la existente.
// Solo servidor (service_role); los clientes no tienen acceso a esta tabla.
export async function recordProviderEvent(input: RecordProviderEventInput) {
  const admin = createAdminClient();

  const { data: inserted, error: insertError } = await admin
    .from("billing_provider_events")
    .upsert(
      {
        provider: input.provider,
        external_event_id: input.externalEventId,
        event_type: input.eventType,
        signature_valid: input.signatureValid,
        payload: input.payload ?? {},
        company_id: input.companyId ?? null,
        payment_intent_id: input.paymentIntentId ?? null,
        billing_subscription_id: input.billingSubscriptionId ?? null,
      },
      { onConflict: "provider,external_event_id", ignoreDuplicates: true }
    )
    .select("id, processing_status")
    .maybeSingle();

  if (insertError) throw insertError;
  if (inserted) return { id: inserted.id as string, duplicate: false, processingStatus: inserted.processing_status as ProviderEventProcessingStatus };

  const { data: existing, error: existingError } = await admin
    .from("billing_provider_events")
    .select("id, processing_status")
    .eq("provider", input.provider)
    .eq("external_event_id", input.externalEventId)
    .single();

  if (existingError) throw existingError;
  return { id: existing.id as string, duplicate: true, processingStatus: existing.processing_status as ProviderEventProcessingStatus };
}
