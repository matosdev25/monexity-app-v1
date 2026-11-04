import type { createClient } from "../supabase/server";
import { PRIVACY_VERSION, TERMS_VERSION } from "./versions";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

// ¿El usuario ya aceptó las versiones vigentes de Términos y Privacidad?
// Se consulta con el cliente del usuario (RLS: solo ve sus propias filas).
// Fail-closed: ante error devuelve false y se vuelve a pedir la aceptación.
// Al cambiar TERMS_VERSION o PRIVACY_VERSION, todos los usuarios deben aceptar de nuevo.
export async function hasAcceptedCurrentLegalVersions(
  supabase: ServerSupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_legal_acceptances")
    .select("id")
    .eq("user_id", userId)
    .eq("terms_version", TERMS_VERSION)
    .eq("privacy_version", PRIVACY_VERSION)
    .limit(1)
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}
