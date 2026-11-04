import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("expire_stale_intents");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Depura cobros conservados de cuentas eliminadas cuyo retain_until ya venció.
  const { data: purged, error: purgeError } = await admin.rpc("purge_expired_billing_retained_charges");

  if (purgeError) {
    return NextResponse.json({ error: purgeError.message, expired: data ?? 0 }, { status: 500 });
  }

  return NextResponse.json({ expired: data ?? 0, purged: purged ?? 0 });
}
