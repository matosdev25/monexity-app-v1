import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGlobalAdminUser } from "@/lib/admin-auth";

export async function GET() {
  const user = await getGlobalAdminUser();
  if (!user) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_intents")
    .select(`
      id, company_id, user_id, plan_id, billing_cycle,
      exact_amount, status, claimed_at, expires_at, created_at,
      companies ( name )
    `)
    .or(
      "and(provider.eq.manual,status.in.(claimed,awaiting_verification,pending)),and(provider.eq.yappy_manual,status.eq.manual_review)"
    )
    .gt("expires_at", new Date().toISOString())
    .order("claimed_at", { ascending: true, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }

  return NextResponse.json({ intents: data ?? [] });
}
