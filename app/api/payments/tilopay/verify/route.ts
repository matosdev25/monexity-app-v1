import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reconcileTilopayIntentById } from "@/lib/billing/tilopay/service";
import { verifyTilopayIntentForUser } from "@/lib/billing/tilopay/flow";

// Verificación server-side de un intent Tilopay (retorno del navegador o botón
// "verificar"). Idempotente: repetirla nunca duplica la acreditación.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json().catch(() => null);

  const result = await verifyTilopayIntentForUser(body?.intentId, {
    getUserId: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user?.id ?? null;
    },
    // Cliente del usuario: RLS (pi_select) solo devuelve intents de sus empresas.
    readIntent: async (intentId) => {
      const { data } = await supabase
        .from("payment_intents")
        .select("id, company_id, provider, status")
        .eq("id", intentId)
        .maybeSingle();
      return data ?? null;
    },
    isMember: async (companyId, userId) => {
      const { data } = await supabase
        .from("memberships")
        .select("role")
        .eq("company_id", companyId)
        .eq("user_id", userId)
        .maybeSingle();
      return Boolean(data);
    },
    reconcile: reconcileTilopayIntentById,
  });

  return NextResponse.json(result.body, { status: result.httpStatus });
}
