"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "../../lib/supabase/server";
import { createAdminClient } from "../../lib/supabase/admin";
import { PRIVACY_VERSION, TERMS_VERSION } from "../../lib/legal/versions";
import { hasAcceptedCurrentLegalVersions } from "../../lib/legal/acceptance-status";

export async function switchCompany(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "").trim();

  if (!companyId) return;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!membership?.company_id) return;

  const cookieStore = await cookies();
  cookieStore.set("active_company_id", companyId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect("/dashboard");
}

export type LegalAcceptanceState = {
  success: boolean;
  message: string;
};

// Aceptación de las versiones vigentes por un usuario existente (modal del dashboard).
// user_id sale de la sesión validada; versiones y fecha las fija el servidor.
// recorded_at lo pone PostgreSQL. Reintentos no duplican (UNIQUE + ON CONFLICT DO NOTHING).
export async function acceptCurrentLegalVersions(
  prevState: LegalAcceptanceState
): Promise<LegalAcceptanceState> {
  void prevState;

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/auth/login");

  // Escritura solo server-side: la tabla no admite INSERT desde el cliente (RLS)
  const adminClient = createAdminClient();
  const { error } = await adminClient.from("user_legal_acceptances").upsert(
    {
      user_id: user.id,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
      accepted_at: new Date().toISOString(),
    },
    { onConflict: "user_id,terms_version,privacy_version", ignoreDuplicates: true }
  );

  if (error) {
    return {
      success: false,
      message: "No se pudo registrar tu aceptación. Intenta de nuevo.",
    };
  }

  // Confirmar con la misma consulta (RLS) que usa el dashboard antes de desbloquear
  const accepted = await hasAcceptedCurrentLegalVersions(supabase, user.id);
  if (!accepted) {
    return {
      success: false,
      message: "No se pudo confirmar tu aceptación. Intenta de nuevo.",
    };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true, message: "" };
}