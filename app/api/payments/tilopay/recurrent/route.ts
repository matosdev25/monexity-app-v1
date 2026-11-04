import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveTilopayCharge, TilopayConfigError } from "@/lib/billing/tilopay/core";
import { getTilopayConfig, getTilopayRemotePlanId } from "@/lib/billing/tilopay/config";
import {
  getTilopayRecurrentRegistration,
  isTilopayRecurringEnabled,
  TilopayExistingSubscriptionError,
} from "@/lib/billing/tilopay/service";

// URL de registro/renovación de cobro recurrente (POST /api/v1/recurrentUrl).
// Solo dueño. Bloqueada mientras los webhooks recurrentes no puedan verificarse:
// sin firma válida Monexity no podría reflejar cobros ni cancelaciones.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const companyId = String(body?.companyId ?? "").trim();
  const charge = resolveTilopayCharge(String(body?.planId ?? ""), String(body?.billingCycle ?? ""));
  if (!companyId || !charge) {
    return NextResponse.json({ error: "Faltan parámetros válidos" }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (String(membership?.role ?? "").toLowerCase() !== "owner") {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  try {
    getTilopayConfig();
    getTilopayRemotePlanId(charge.plan.id, charge.billingCycle);
  } catch (error) {
    if (error instanceof TilopayConfigError) {
      console.error("Tilopay recurring configuration missing", { message: error.message });
      return NextResponse.json({ error: "El cobro recurrente aún no está disponible." }, { status: 503 });
    }
    throw error;
  }

  if (!isTilopayRecurringEnabled() || !user.email) {
    return NextResponse.json(
      { error: "El cobro recurrente estará disponible cuando se habilite la verificación de webhooks de Tilopay." },
      { status: 409 }
    );
  }

  try {
    const registration = await getTilopayRecurrentRegistration({
      companyId,
      planId: charge.plan.id,
      billingCycle: charge.billingCycle,
      amount: charge.amount,
      email: user.email,
    });
    return NextResponse.json({ url: registration.url });
  } catch (error) {
    if (error instanceof TilopayExistingSubscriptionError) {
      return NextResponse.json(
        { error: "Tienes una suscripción activa con otro método de pago. Contáctanos para cambiarla." },
        { status: 409 }
      );
    }
    console.error("Tilopay recurrentUrl failed", { error: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "No se pudo conectar con Tilopay." }, { status: 502 });
  }
}
