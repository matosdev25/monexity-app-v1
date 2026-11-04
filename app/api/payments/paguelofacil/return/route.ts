import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  findPagueloFacilTransaction,
  isApprovedPagueloFacilTransaction,
  isPagueloFacilTransactionLinkedToIntent,
} from "@/lib/paguelofacil";

async function confirmPayment(req: NextRequest) {
  const params = req.method === "POST"
    ? new URLSearchParams(await req.text())
    : req.nextUrl.searchParams;
  const returnedIntentId = params.get("PARM_1") ?? "";
  const intentId = req.nextUrl.searchParams.get("intent") ?? returnedIntentId;
  const codOper = params.get("Oper") ?? params.get("codOper") ?? params.get("CODOPER") ?? "";
  const billingUrl = new URL("/dashboard/billing", req.nextUrl.origin);

  if (!intentId || returnedIntentId !== intentId || !codOper) {
    billingUrl.searchParams.set("pf", "error");
    billingUrl.searchParams.set("reason", "missing_confirmation");
    return NextResponse.redirect(billingUrl);
  }

  const admin = createAdminClient();
  const { data: intent } = await admin
    .from("payment_intents")
    .select("id, company_id, status, exact_amount, billing_cycle, discount_code_id")
    .eq("id", intentId)
    .maybeSingle();

  if (!intent) {
    billingUrl.searchParams.set("pf", "error");
    billingUrl.searchParams.set("reason", "intent_not_found");
    return NextResponse.redirect(billingUrl);
  }

  if (intent.status === "paid") {
    billingUrl.searchParams.set("pf", "success");
    return NextResponse.redirect(billingUrl);
  }

  try {
    const transaction = await findPagueloFacilTransaction(codOper);

    // Sin vínculo verificable con este intent no se toca la base.
    if (!isPagueloFacilTransactionLinkedToIntent(transaction, codOper, intent.id)) {
      billingUrl.searchParams.set("pf", "error");
      billingUrl.searchParams.set("reason", "transaction_not_linked");
      return NextResponse.redirect(billingUrl);
    }

    const approved = isApprovedPagueloFacilTransaction(
      transaction,
      Number(intent.exact_amount)
    );

    // Atómica e idempotente: bloquea el intent, nunca retrocede desde paid
    // y solo una llamada concurrente obtiene "activated".
    const { data: result, error } = await admin.rpc("confirm_paguelofacil_payment", {
      p_intent_id: intent.id,
      p_transaction_id: codOper,
      p_raw_response: transaction,
      p_approved: approved,
    });

    if (error) throw error;

    if (result === "already_paid") {
      billingUrl.searchParams.set("pf", "success");
      return NextResponse.redirect(billingUrl);
    }

    if (result !== "activated") {
      billingUrl.searchParams.set("pf", "error");
      billingUrl.searchParams.set(
        "reason",
        result === "not_approved"
          ? "payment_not_approved"
          : result === "needs_review"
          ? "payment_in_review"
          : "verification_failed"
      );
      return NextResponse.redirect(billingUrl);
    }

    // Ciclo, período y descuento ya se acreditaron dentro de la confirmación atómica.
    billingUrl.searchParams.set("pf", "success");
    return NextResponse.redirect(billingUrl);
  } catch {
    billingUrl.searchParams.set("pf", "error");
    billingUrl.searchParams.set("reason", "verification_failed");
    return NextResponse.redirect(billingUrl);
  }
}

export async function GET(req: NextRequest) {
  return confirmPayment(req);
}

export async function POST(req: NextRequest) {
  return confirmPayment(req);
}
