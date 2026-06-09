import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  findPagueloFacilTransaction,
  isApprovedPagueloFacilTransaction,
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
    const { data: consumedTransaction } = await admin
      .from("payment_intents")
      .select("id")
      .eq("provider_transaction_id", codOper)
      .neq("id", intent.id)
      .maybeSingle();

    if (consumedTransaction) {
      billingUrl.searchParams.set("pf", "error");
      billingUrl.searchParams.set("reason", "transaction_already_used");
      return NextResponse.redirect(billingUrl);
    }

    const transaction = await findPagueloFacilTransaction(codOper);
    const approved = isApprovedPagueloFacilTransaction(
      transaction,
      Number(intent.exact_amount)
    );

    const { error: transactionUpdateError } = await admin
      .from("payment_intents")
      .update({
        provider_reference: codOper,
        provider_transaction_id: codOper,
        raw_response: transaction ?? Object.fromEntries(params),
        status: approved ? "awaiting_verification" : "failed",
      })
      .eq("id", intent.id);

    if (transactionUpdateError) throw transactionUpdateError;

    if (!approved) {
      billingUrl.searchParams.set("pf", "error");
      billingUrl.searchParams.set("reason", "payment_not_approved");
      return NextResponse.redirect(billingUrl);
    }

    const { error } = await admin.rpc("activate_subscription_from_intent", {
      p_intent_id: intent.id,
      p_admin_email: "paguelofacil-return",
    });

    if (error) throw error;

    await admin
      .from("companies")
      .update({ subscription_billing_cycle: intent.billing_cycle })
      .eq("id", intent.company_id);

    if (intent.discount_code_id) {
      await admin.rpc("increment_discount_code_usage", {
        p_discount_code_id: intent.discount_code_id,
      });
    }

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
