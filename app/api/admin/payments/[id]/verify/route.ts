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

  // Acción explícita obligatoria: nunca se aprueba por defecto
  const body = await req.json().catch(() => null);
  const action = body && typeof body === "object" ? (body as { action?: unknown }).action : undefined;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Acción inválida. Usa \"approve\" o \"reject\"." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Aprobación/rechazo atómico e idempotente: bloquea el intent, nunca toca un
  // pago ya acreditado y, al aprobar, acredita período, ciclo y descuento en la
  // misma transacción.
  const { data: result, error } = await admin.rpc("admin_resolve_payment_intent", {
    p_intent_id: id,
    p_action: action,
    p_admin_email: user.email ?? "admin",
  });

  if (error) {
    return NextResponse.json({ error: "No se pudo procesar el pago." }, { status: 500 });
  }

  switch (result) {
    case "approved":
      return NextResponse.json({ ok: true });
    case "rejected":
      return NextResponse.json({ ok: true, status: "rejected" });
    case "already_paid":
      return NextResponse.json({ ok: true, status: "already_paid" });
    case "already_rejected":
      return NextResponse.json({ ok: true, status: "already_rejected" });
    case "not_found":
      return NextResponse.json({ error: "Intento no encontrado" }, { status: 404 });
    case "period_already_covered":
      return NextResponse.json(
        { error: "El período de este pago ya estaba cubierto por otro pago. Quedó en revisión y no se acreditó." },
        { status: 409 }
      );
    case "not_manual":
      return NextResponse.json({ error: "Este pago no admite verificación manual" }, { status: 409 });
    default:
      return NextResponse.json({ error: "El intento no está en un estado verificable" }, { status: 409 });
  }
}
