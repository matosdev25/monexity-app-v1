"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

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