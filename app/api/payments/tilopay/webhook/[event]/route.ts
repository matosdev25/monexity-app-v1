import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordProviderEvent } from "@/lib/billing/events";
import { getTilopayWebhookEventType, resolveTilopayCharge } from "@/lib/billing/tilopay/core";
import { findTilopayLocalPlan, getTilopayConfig } from "@/lib/billing/tilopay/config";
import { tilopayConsult } from "@/lib/billing/tilopay/client";
import { handleTilopayWebhook } from "@/lib/billing/tilopay/flow";

const MAX_BODY_BYTES = 64 * 1024;

// Webhooks recurrentes de Tilopay (configurados en el plan):
//   /api/payments/tilopay/webhook/subscribe | payment | rejected | unsubscribe | reactive
// Se auditan de forma idempotente. Solo con firma verificada se aplican vía
// apply_tilopay_subscription_event (hoy la verificación está PENDIENTE de la
// especificación de Tilopay, así que no cambian estado de negocio).
// No es el webhook de processPayment.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ event: string }> }
) {
  const { event } = await params;
  const eventType = getTilopayWebhookEventType(event);
  if (!eventType) {
    return NextResponse.json({ error: "Evento no soportado" }, { status: 422 });
  }

  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Cuerpo demasiado grande" }, { status: 413 });
  }

  let config: ReturnType<typeof getTilopayConfig> | null = null;
  try {
    config = getTilopayConfig();
  } catch {
    config = null;
  }

  const admin = createAdminClient();

  try {
    const result = await handleTilopayWebhook(
      {
        eventType,
        rawBody,
        hashHeader: req.headers.get("hash-tilopay"),
        timestampHeader: req.headers.get("unix-timestamp"),
      },
      {
        recordEvent: async (input) => {
          const recorded = await recordProviderEvent({
            provider: "tilopay",
            externalEventId: input.externalEventId,
            eventType: input.eventType,
            signatureValid: input.signatureValid,
            payload: input.payload,
          });
          return { id: recorded.id, duplicate: recorded.duplicate, processingStatus: recorded.processingStatus };
        },
        // Solo se invoca con firma válida y, para cobros, con consult confirmado.
        applyBusinessEvent: async (input) => {
          const { data, error } = await admin.rpc("apply_tilopay_subscription_event", {
            p_event_id: input.eventId,
            p_event_type: input.eventType,
            p_external_subscription_id: input.externalSubscriptionId,
            p_order_number: input.orderNumber,
            p_transaction_id: input.transactionId,
            p_amount: input.amount,
            p_currency: input.currency,
            p_raw: input.raw,
          });
          if (error) throw new Error("TILOPAY_EVENT_APPLY_FAILED");
          return String(data ?? "");
        },
        updateEvent: async (id, patch) => {
          await admin
            .from("billing_provider_events")
            .update({ payload: patch.payload, processing_error: patch.processingError })
            .eq("id", id)
            .eq("processing_status", "received");
        },
        consult: config ? tilopayConsult : null,
        expectedEnvironment: config?.expectedEnvironment ?? null,
        resolveExpectedAmount: (remotePlanId) => {
          const local = findTilopayLocalPlan(remotePlanId);
          return local ? resolveTilopayCharge(local.planId, local.billingCycle)?.amount ?? null : null;
        },
      }
    );

    return NextResponse.json(
      { received: result.httpStatus === 200, duplicate: result.duplicate },
      { status: result.httpStatus }
    );
  } catch (error) {
    console.error("Tilopay webhook storage failed", {
      eventType,
      error: error instanceof Error ? error.name : "unknown",
    });
    // 502 está en la lista de reintentos de Tilopay (recurrencia: 5 intentos).
    return NextResponse.json({ error: "No se pudo registrar el evento" }, { status: 502 });
  }
}
