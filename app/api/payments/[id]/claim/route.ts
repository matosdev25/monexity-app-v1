import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPaymentClaimEmail } from "@/lib/email/send-payment-email";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // RLS garantiza que solo puedes ver tus propios intents
  const { data: intent, error } = await supabase
    .from("payment_intents")
    .select("id, status, expires_at, exact_amount, plan_id, company_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !intent) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  // Idempotente: si ya está claimed o más avanzado, devolver estado actual
  if (["claimed", "awaiting_verification", "paid"].includes(intent.status)) {
    return NextResponse.json({ status: intent.status });
  }

  if (intent.status !== "pending") {
    return NextResponse.json(
      { error: "El intento no está en estado válido para reclamar" },
      { status: 409 }
    );
  }

  if (new Date(intent.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "El intento ha expirado", status: "expired" },
      { status: 410 }
    );
  }

  // Actualizar a claimed usando admin client (el usuario no tiene política de UPDATE libre)
  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("payment_intents")
    .update({ status: "claimed", claimed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending"); // guard extra

  if (updateError) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }

  await admin.from("payment_audit_logs").insert({
    intent_id:   id,
    action:      "claimed",
    from_status: "pending",
    to_status:   "claimed",
    actor_type:  "user",
  });

  // Notificar al admin por email
  const adminEmails = (process.env.BILLING_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (adminEmails.length > 0) {
    await sendPaymentClaimEmail({
      to:          adminEmails[0],
      intentId:    id,
      exactAmount: Number(intent.exact_amount),
      planId:      intent.plan_id,
    }).catch(() => null); // no bloquear si falla el email
  }

  return NextResponse.json({ status: "claimed" });
}
