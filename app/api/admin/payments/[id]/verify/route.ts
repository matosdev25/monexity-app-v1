import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGlobalAdminUser } from "@/lib/admin-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getGlobalAdminUser();
  if (!user) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const admin = createAdminClient();
  const body = await req.json().catch(() => null);
  const action = body?.action === "reject" ? "reject" : "approve";
  const { data: intent } = await admin
    .from("payment_intents")
    .select("company_id, status, billing_cycle, discount_code_id, provider")
    .eq("id", id)
    .maybeSingle();

  if (!intent || !["manual", "yappy_manual"].includes(String(intent.provider))) {
    return NextResponse.json(
      { error: "Este pago no admite verificación manual" },
      { status: 409 }
    );
  }

  if (action === "reject") {
    if (!["pending", "claimed", "awaiting_verification", "manual_review"].includes(String(intent.status))) {
      return NextResponse.json(
        { error: "El intento no está en un estado rechazable" },
        { status: 409 }
      );
    }

    const { error: rejectError } = await admin
      .from("payment_intents")
      .update({
        status: "failed",
        verified_at: new Date().toISOString(),
        verified_by_email: user.email ?? "admin",
      })
      .eq("id", id);

    if (rejectError) {
      return NextResponse.json({ error: "No se pudo rechazar el pago." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status: "rejected" });
  }

  const { error } = await admin.rpc("activate_subscription_from_intent", {
    p_intent_id:   id,
    p_admin_email: user.email ?? "admin",
  });

  if (error) {
    if (error.message.includes("INTENT_NOT_FOUND")) {
      return NextResponse.json({ error: "Intento no encontrado" }, { status: 404 });
    }
    if (error.message.includes("INVALID_STATUS")) {
      return NextResponse.json(
        { error: "El intento no está en un estado verificable" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Error interno", detail: error.message }, { status: 500 });
  }

  if (intent?.discount_code_id && intent.status !== "paid") {
    await admin.rpc("increment_discount_code_usage", {
      p_discount_code_id: intent.discount_code_id,
    });
  }

  if (intent?.company_id) {
    await admin
      .from("companies")
      .update({ subscription_billing_cycle: intent.billing_cycle })
      .eq("id", intent.company_id);
  }

  return NextResponse.json({ ok: true });
}
