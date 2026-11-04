import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UNCONFIRMED_SIGNUP_RETENTION_DAYS } from "@/lib/auth/pending-signup";

// Elimina cuentas creadas en el registro que nunca confirmaron el correo ni
// iniciaron sesión (política de privacidad: "Conservación de los datos").
// Auth borra el usuario y, en cascada, su perfil, membresías, aceptación legal y
// el negocio creado en el onboarding. Si una referencia lo impide, se omite.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: candidates, error } = await admin.rpc("list_stale_unconfirmed_users", {
    p_older_than: `${UNCONFIRMED_SIGNUP_RETENTION_DAYS} days`,
    p_limit: 100,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let deleted = 0;
  const skipped: string[] = [];

  for (const row of (candidates ?? []) as { user_id: string }[]) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(row.user_id);
    if (deleteError) {
      skipped.push(row.user_id);
      console.error("Unconfirmed signup purge skipped", { userId: row.user_id, error: deleteError.message });
    } else {
      deleted += 1;
    }
  }

  return NextResponse.json({ deleted, skipped: skipped.length });
}
