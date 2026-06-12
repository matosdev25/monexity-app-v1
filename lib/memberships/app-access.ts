import "server-only";
import { cookies } from "next/headers";
import { isGlobalAdminEmail } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AppAccessCompany = {
  subscription_status: string | null;
  subscription_plan: string | null;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  subscription_cancel_at_period_end?: boolean | null;
  is_blocked: boolean | null;
};

const APP_TIME_ZONE = "America/Panama";

function parseAppDate(value: Date | string | number) {
  if (value instanceof Date || typeof value === "number") {
    return new Date(value);
  }

  const trimmed = value.trim();
  const slashDate = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDate) {
    const [, day, month, year] = slashDate;
    return new Date(
      `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00`
    );
  }

  return new Date(trimmed);
}

function getDateKeyInAppTimeZone(value: Date | string | number) {
  const date = parseAppDate(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : null;
}

export function hasValidTrialToday(trialEndsAt: string | null) {
  if (!trialEndsAt) return false;

  const trialEndDate = getDateKeyInAppTimeZone(trialEndsAt);
  const today = getDateKeyInAppTimeZone(new Date());

  return Boolean(trialEndDate && today && trialEndDate >= today);
}

export function isTrialEndingToday(trialEndsAt: string | null) {
  if (!trialEndsAt) return false;

  const trialEndDate = getDateKeyInAppTimeZone(trialEndsAt);
  const today = getDateKeyInAppTimeZone(new Date());

  return Boolean(trialEndDate && today && trialEndDate === today);
}

export function canAccessCompanyApp(company: AppAccessCompany) {
  if (company.is_blocked || !company.subscription_plan) return false;

  const status = String(company.subscription_status ?? "").toLowerCase();
  if (status === "trialing") {
    return hasValidTrialToday(company.trial_ends_at);
  }

  if (["active", "paid"].includes(status)) {
    if (
      company.subscription_cancel_at_period_end &&
      company.current_period_ends_at &&
      new Date(company.current_period_ends_at).getTime() <= Date.now()
    ) {
      return false;
    }

    return true;
  }

  return false;
}

export async function hasPendingYappyManualPayment(
  companyId: string,
  client = createAdminClient()
) {
  if (!companyId) return false;

  const { data } = await client
    .from("payment_intents")
    .select("id")
    .eq("company_id", companyId)
    .eq("provider", "yappy_manual")
    .eq("status", "manual_review")
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();

  return Boolean(data?.id);
}

export async function canAccessCompanyAppWithPendingYappy(
  company: AppAccessCompany & { id: string }
) {
  return canAccessCompanyApp(company);
}

type MembershipWithCompany = {
  company_id: string;
  companies: (AppAccessCompany & { id: string }) | (AppAccessCompany & { id: string })[] | null;
};

function getCompany(
  companies: MembershipWithCompany["companies"]
) {
  return Array.isArray(companies) ? companies[0] ?? null : companies;
}

async function setActiveCompanyCookie(companyId: string) {
  const cookieStore = await cookies();
  cookieStore.set("active_company_id", companyId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function getCurrentUserAppEntryPath(currentUser?: {
  id: string;
  email?: string | null;
}) {
  const supabase = await createClient();
  const user =
    currentUser ??
    (
      await supabase.auth.getUser()
    ).data.user;

  if (!user) return "/auth/login";
  if (isGlobalAdminEmail(user.email)) return "/admin";

  const queryClient = currentUser ? createAdminClient() : supabase;

  const { data } = await queryClient
    .from("memberships")
    .select("company_id, companies(id, subscription_status, subscription_plan, trial_ends_at, current_period_ends_at, is_blocked)")
    .eq("user_id", user.id);

  const memberships = (data ?? []) as unknown as MembershipWithCompany[];
  let validMembership: MembershipWithCompany | null = null;
  for (const membership of memberships) {
    const company = getCompany(membership.companies);
    if (!company) continue;
    if (canAccessCompanyApp(company)) {
      validMembership = membership;
      break;
    }
  }

  if (validMembership) {
    await setActiveCompanyCookie(validMembership.company_id);
    return "/dashboard";
  }

  const membership = memberships.find((item) => getCompany(item.companies)) ?? null;
  const company = membership ? getCompany(membership.companies) : null;

  if (!membership || !company) return "/onboarding";
  await setActiveCompanyCookie(membership.company_id);
  if (!company.subscription_plan) {
    return `/onboarding/plan?cid=${membership.company_id}`;
  }

  return "/dashboard/mi-negocio?tab=cuenta";
}
