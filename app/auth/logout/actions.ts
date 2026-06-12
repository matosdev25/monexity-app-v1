"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "../../../lib/supabase/server";

export async function logout() {
  const supabase = await createClient();
  const cookieStore = await cookies();

  try {
    await supabase.auth.signOut();
  } catch {
    // Si la sesión ya expiró, igual limpiamos cookies propias y salimos.
  }

  cookieStore.delete("active_company_id");
  cookieStore.delete("pending_signup");

  redirect("/");
}
