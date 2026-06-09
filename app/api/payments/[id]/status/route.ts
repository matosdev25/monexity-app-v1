import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
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

  const { data: intent, error } = await supabase
    .from("payment_intents")
    .select("id, status, exact_amount, expires_at, plan_id, billing_cycle")
    .eq("id", id)
    .maybeSingle();

  if (error || !intent) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    status:      intent.status,
    exactAmount: Number(intent.exact_amount),
    expiresAt:   intent.expires_at,
    planId:      intent.plan_id,
    billingCycle: intent.billing_cycle,
  });
}
