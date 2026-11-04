"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "../../lib/supabase/server";
import { createAdminClient } from "../../lib/supabase/admin";
import { normalizeInviteCodeInput } from "../../lib/invites/invite-utils";
import { PLAN_MAP } from "../../lib/plans/plans";
import {
  PENDING_SIGNUP_COOKIE,
  PENDING_SIGNUP_DELETE_OPTIONS,
  openPendingSignup,
} from "../../lib/auth/pending-signup";
import type { OnboardingState } from "./types";

type AdminClient = ReturnType<typeof createAdminClient>;
type CookieStore = Awaited<ReturnType<typeof cookies>>;

// Usuario del onboarding: la sesión si existe; si no (correo sin confirmar), el
// userId de la cookie pending_signup cifrada. La cuenta, el perfil y la aceptación
// legal ya los creó signUp(); aquí solo se crea el negocio o la membresía.
async function resolveOnboardingUser(
  sessionUserId: string | null,
  adminClient: AdminClient,
  cookieStore: CookieStore
): Promise<{ userId: string; fromPendingSignup: boolean } | null> {
  if (sessionUserId) return { userId: sessionUserId, fromPendingSignup: false };

  // Ausente, alterada o vencida → registro
  const pending = openPendingSignup(cookieStore.get(PENDING_SIGNUP_COOKIE)?.value);
  if (!pending) redirect("/auth/sign-up");

  const { data: authUser, error: authError } = await adminClient.auth.admin.getUserById(pending.userId);
  if (authError || !authUser?.user) {
    cookieStore.delete(PENDING_SIGNUP_DELETE_OPTIONS);
    redirect("/auth/sign-up");
  }

  // La cookie sirve para un único onboarding: si ya tiene acceso a un negocio,
  // debe iniciar sesión (evita reutilizar la cookie para crear más negocios).
  const { count, error: membershipError } = await adminClient
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("user_id", pending.userId);
  // null = no se pudo verificar (error recuperable: se conserva la cookie)
  if (membershipError || count === null) return null;
  if (count > 0) {
    cookieStore.delete(PENDING_SIGNUP_DELETE_OPTIONS);
    redirect("/auth/login");
  }

  return { userId: pending.userId, fromPendingSignup: true };
}

export async function createBusiness(
  prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  void prevState;

  const supabase = await createClient();
  const adminClient = createAdminClient();
  const cookieStore = await cookies();

  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();

  const companyName = String(formData.get("companyName") ?? "").trim();
  const plan = String(formData.get("plan") ?? "").trim();
  const billing = String(formData.get("billing") ?? "").trim();
  const planConfig = PLAN_MAP[plan];

  if (!companyName || companyName.length < 2 || companyName.length > 120) {
    return { success: false, message: "El nombre debe tener entre 2 y 120 caracteres." };
  }

  if (!planConfig || !["monthly", "annual"].includes(billing)) {
    return { success: false, message: "Selecciona un plan antes de crear tu negocio." };
  }

  const billingCycle = billing as "monthly" | "annual";

  // Verificar duplicado case-insensitive antes de insertar
  const { data: existingCompany } = await adminClient
    .from("companies")
    .select("id")
    .ilike("name", companyName)
    .maybeSingle();

  if (existingCompany) {
    return { success: false, message: "Ya existe un negocio con ese nombre. Elige uno diferente." };
  }

  const resolved = await resolveOnboardingUser(existingUser?.id ?? null, adminClient, cookieStore);
  if (!resolved) {
    return { success: false, message: "No se pudo verificar tu registro. Intenta de nuevo." };
  }
  const { userId, fromPendingSignup } = resolved;

  const trialStartsAt = new Date();
  const trialEndsAt = new Date(trialStartsAt.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Insertar empresa con trial listo para usar. El plan es obligatorio arriba.
  const { data: company, error: companyError } = await adminClient
    .from("companies")
    .insert({
      name: companyName,
      needs_inventory: planConfig.hasInventory,
      subscription_plan: plan,
      subscription_billing_cycle: billingCycle,
      subscription_status: "trialing",
      trial_starts_at: trialStartsAt.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
      current_period_starts_at: trialStartsAt.toISOString(),
      owner_user_id: userId,
    })
    .select("id")
    .single();

  // Errores recuperables: la cuenta ya existe y se conserva junto con la cookie para reintentar.
  if (companyError || !company) {
    if (companyError?.code === "23505") {
      return { success: false, message: "Ya existe un negocio con ese nombre. Elige uno diferente." };
    }
    return { success: false, message: "No se pudo crear el negocio. Intenta de nuevo." };
  }

  // Insertar membership como owner
  const { error: membershipError } = await adminClient.from("memberships").insert({
    company_id: company.id,
    user_id: userId,
    role: "owner",
  });

  if (membershipError) {
    await adminClient.from("companies").delete().eq("id", company.id);
    return { success: false, message: "No se pudo crear el acceso al negocio. Intenta de nuevo." };
  }

  cookieStore.delete(PENDING_SIGNUP_DELETE_OPTIONS);

  if (fromPendingSignup) {
    return { success: true, message: "", requiresConfirmation: true };
  }

  revalidatePath("/onboarding");
  cookieStore.set("active_company_id", company.id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
  return {
    success: true,
    message: "",
    companyId: company.id,
    planId: plan,
    billingCycle,
  };
}

// ─── Unirse con código ────────────────────────────────────────────────────────

export async function joinViaCode(
  prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  void prevState;

  const supabase = await createClient();
  const adminClient = createAdminClient();
  const cookieStore = await cookies();

  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();

  const rawCode = String(formData.get("inviteCode") ?? "").trim();
  const code = normalizeInviteCodeInput(rawCode);

  if (!code || code.length < 6) {
    return { success: false, message: "Ingresa un código de invitación válido." };
  }

  const resolved = await resolveOnboardingUser(existingUser?.id ?? null, adminClient, cookieStore);
  if (!resolved) {
    return { success: false, message: "No se pudo verificar tu registro. Intenta de nuevo." };
  }
  const { userId, fromPendingSignup } = resolved;

  // Bloquea la invitación, crea la membresía y la consume en una sola transacción:
  // dos solicitudes simultáneas con el mismo código no pueden usarla ambas.
  const { data: consumed, error: consumeError } = await adminClient
    .rpc("consume_company_invite", { p_invite_code: code, p_user_id: userId })
    .maybeSingle<{ status: string; company_id: string | null }>();

  if (consumeError || !consumed) {
    return { success: false, message: "No se pudo validar el código. Intenta de nuevo." };
  }

  if (consumed.status === "already_member") {
    return { success: false, message: "Ya perteneces a este negocio." };
  }

  if (consumed.status !== "joined" || !consumed.company_id) {
    return { success: false, message: "El código no es válido o ya fue utilizado." };
  }

  const invite = { company_id: consumed.company_id };

  cookieStore.delete(PENDING_SIGNUP_DELETE_OPTIONS);

  if (fromPendingSignup) {
    return { success: true, message: "", requiresConfirmation: true };
  }

  // Setear cookie con negocio activo para usuarios existentes
  cookieStore.set("active_company_id", invite.company_id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// ─── Seleccionar plan ─────────────────────────────────────────────────────────

export async function selectPlan(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const companyId = String(formData.get("companyId") ?? "").trim();
  const plan = String(formData.get("plan") ?? "").trim();

  const billing = String(formData.get("billing") ?? "monthly").trim();
  if (!companyId || !plan) return;
  if (!["monthly", "annual"].includes(billing)) return;

  // Verificar que el usuario sea owner del negocio
  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (membership?.role !== "owner") return;

  // Derivar needs_inventory desde la config del plan — es la fuente de verdad
  const planConfig = PLAN_MAP[plan];
  if (!planConfig) return;

  const needsInventory = planConfig?.hasInventory ?? false;
  const { data: company } = await supabase
    .from("companies")
    .select("subscription_status")
    .eq("id", companyId)
    .maybeSingle();
  const keepsPaidPlan = ["active", "paid"].includes(company?.subscription_status ?? "");

  // Campos de suscripción protegidos por privilegios de columna: solo service_role.
  await createAdminClient()
    .from("companies")
    .update({
      ...(!keepsPaidPlan ? { subscription_plan: plan } : {}),
      ...(!keepsPaidPlan ? { subscription_billing_cycle: billing as "monthly" | "annual" } : {}),
      ...(!keepsPaidPlan ? { needs_inventory: needsInventory } : {}),
    })
    .eq("id", companyId);

  redirect("/dashboard/billing");
}
