import { NextRequest, NextResponse } from "next/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Retorno del navegador desde Tilopay. NO acredita nada: los parámetros del
// redirect (code, auth, OrderHash…) no son confiables por sí solos. Solo lleva al
// usuario a Facturación, donde el servidor verifica con POST /api/v1/consult.
export async function GET(req: NextRequest) {
  const intentId = req.nextUrl.searchParams.get("intent") ?? "";
  const billingUrl = new URL("/dashboard/billing", req.nextUrl.origin);

  if (UUID_RE.test(intentId)) {
    billingUrl.searchParams.set("tilopay", "return");
    billingUrl.searchParams.set("intent", intentId);
  } else {
    billingUrl.searchParams.set("tilopay", "error");
  }

  return NextResponse.redirect(billingUrl);
}
