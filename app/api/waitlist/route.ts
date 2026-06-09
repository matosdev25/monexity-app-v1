import { NextResponse } from "next/server";
import { createAdminClient } from "../../../lib/supabase/admin";

export async function POST(request: Request) {
  if (process.env.WAITLIST_MODE !== "true") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const { method, value } = body as Record<string, unknown>;

  if (method !== "email" && method !== "whatsapp") {
    return NextResponse.json({ error: "Método inválido" }, { status: 400 });
  }

  const cleaned = typeof value === "string" ? value.trim() : "";
  if (!cleaned || cleaned.length > 120) {
    return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
  }

  if (method === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("waitlist")
    .insert({ method, value: cleaned });

  if (error) {
    // Duplicado → tratarlo como éxito silencioso
    if (error.code === "23505") {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Error al guardar. Intenta de nuevo." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
