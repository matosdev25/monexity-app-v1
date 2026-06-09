import { createClient } from "../supabase/server";
import { canAccessCompanyAppWithPendingYappy } from "../memberships/app-access";

type CompanyMembershipRole = "owner" | "admin" | "seller" | string;

type ActiveCompanyContext =
  | {
      ok: false;
      error: string;
      userId: null;
      companyId: null;
      membership: null;
      company: null;
      canOperate: false;
    }
  | {
      ok: true;
      error: null;
      userId: string;
      companyId: string;
      membership: {
        company_id: string;
        role: CompanyMembershipRole | null;
      };
      company: {
        id: string;
        name: string | null;
        subscription_status: string;
        subscription_plan: string;
        trial_ends_at: string | null;
        current_period_starts_at: string | null;
        current_period_ends_at: string | null;
        is_blocked: boolean;
        blocked_reason: string | null;
      };
      canOperate: boolean;
    };

export async function getActiveCompanyContext(
  companyId: string
): Promise<ActiveCompanyContext> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "Debes iniciar sesión.",
      userId: null,
      companyId: null,
      membership: null,
      company: null,
      canOperate: false,
    };
  }

  if (!companyId) {
    return {
      ok: false,
      error: "No se recibió la empresa activa.",
      userId: null,
      companyId: null,
      membership: null,
      company: null,
      canOperate: false,
    };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("company_id, role")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership?.company_id) {
    return {
      ok: false,
      error: "No tienes acceso a este negocio.",
      userId: null,
      companyId: null,
      membership: null,
      company: null,
      canOperate: false,
    };
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select(`
      id,
      name,
      subscription_status,
      subscription_plan,
      trial_ends_at,
      current_period_starts_at,
      current_period_ends_at,
      is_blocked,
      blocked_reason
    `)
    .eq("id", companyId)
    .maybeSingle();

  if (companyError || !company?.id) {
    return {
      ok: false,
      error: "No se encontró la empresa activa.",
      userId: null,
      companyId: null,
      membership: null,
      company: null,
      canOperate: false,
    };
  }

  const canOperate = await canAccessCompanyAppWithPendingYappy(company, supabase);

  return {
    ok: true,
    error: null,
    userId: user.id,
    companyId: company.id,
    membership: {
      company_id: membership.company_id,
      role: membership.role ?? null,
    },
    company: {
      id: company.id,
      name: company.name ?? null,
      subscription_status: company.subscription_status,
      subscription_plan: company.subscription_plan,
      trial_ends_at: company.trial_ends_at ?? null,
      current_period_starts_at: company.current_period_starts_at ?? null,
      current_period_ends_at: company.current_period_ends_at ?? null,
      is_blocked: company.is_blocked,
      blocked_reason: company.blocked_reason ?? null,
    },
    canOperate,
  };
}
