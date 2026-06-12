"use server";

import { cookies } from "next/headers";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { isGlobalAdminEmail } from "../../../lib/admin-auth";
import { canAccessCompanyApp } from "../../../lib/memberships/app-access";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function verifyEmailToken(
  token_hash: string,
  type: string
): Promise<{ success: true; redirectTo: string } | { success: false; error: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as EmailOtpType,
    });
    if (error) return { success: false, error: error.message };

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: true, redirectTo: "/onboarding" };
    if (isGlobalAdminEmail(user.email)) return { success: true, redirectTo: "/admin" };

    // Usar adminClient para saltar RLS — el usuario acaba de confirmar y la sesión
    // puede no estar completamente propagada para leer con el cliente normal.
    const adminClient = createAdminClient();
    const { data: membership } = await adminClient
      .from("memberships")
      .select("company_id, companies(subscription_status, subscription_plan, trial_ends_at, current_period_ends_at, is_blocked)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!membership) return { success: true, redirectTo: "/onboarding" };

    const companyId = membership.company_id;
    const companies = (
      membership as unknown as {
        companies?: {
          subscription_status: string | null;
          subscription_plan: string | null;
          trial_ends_at: string | null;
          current_period_ends_at: string | null;
          is_blocked: boolean | null;
        } | {
          subscription_status: string | null;
          subscription_plan: string | null;
          trial_ends_at: string | null;
          current_period_ends_at: string | null;
          is_blocked: boolean | null;
        }[] | null;
      }
    ).companies;
    const company = Array.isArray(companies) ? companies[0] ?? null : companies;
    const plan = company?.subscription_plan ?? null;

    if (!plan) return { success: true, redirectTo: `/onboarding/plan?cid=${companyId}` };

    const cookieStore = await cookies();
    if (!company || !canAccessCompanyApp(company)) {
      return { success: true, redirectTo: "/dashboard/mi-negocio?tab=cuenta" };
    }

    cookieStore.set("active_company_id", companyId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });

    return { success: true, redirectTo: "/dashboard" };
  } catch {
    return { success: false, error: "Error inesperado al confirmar." };
  }
}
