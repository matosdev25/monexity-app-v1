import { type EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { createClient } from "../../../lib/supabase/server";
import { isGlobalAdminEmail } from "../../../lib/admin-auth";
import { canAccessCompanyApp } from "../../../lib/memberships/app-access";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  if (!code && (!token_hash || !type)) {
    return NextResponse.redirect(
      new URL("/auth/error?message=Enlace de confirmación inválido", origin)
    );
  }

  const supabase = await createClient();

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
        token_hash: token_hash as string,
        type: type as EmailOtpType,
      });

  if (error) {
    return NextResponse.redirect(
      new URL(`/auth/error?message=${encodeURIComponent(error.message)}`, origin)
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/onboarding", origin));
  }

  if (isGlobalAdminEmail(user.email)) {
    return NextResponse.redirect(new URL("/admin", origin));
  }

  if (safeNext !== "/dashboard") {
    return NextResponse.redirect(new URL(safeNext, origin));
  }

  const adminClient = createAdminClient();
  const { data: membership } = await adminClient
    .from("memberships")
    .select("company_id, companies(subscription_status, subscription_plan, trial_ends_at, current_period_ends_at, is_blocked)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return NextResponse.redirect(new URL("/onboarding", origin));
  }

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

  if (!plan) {
    return NextResponse.redirect(new URL(`/onboarding/plan?cid=${companyId}`, origin));
  }

  const cookieStore = await cookies();
  if (!company || !canAccessCompanyApp(company)) {
    return NextResponse.redirect(new URL("/dashboard/mi-negocio?tab=cuenta", origin));
  }

  cookieStore.set("active_company_id", companyId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.redirect(new URL("/dashboard", origin));
}
