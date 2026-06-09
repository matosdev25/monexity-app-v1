"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "../../lib/supabase/server";
import { createAdminClient } from "../../lib/supabase/admin";
import { normalizeInviteCodeInput } from "../../lib/invites/invite-utils";
import { PLAN_MAP } from "../../lib/plans/plans";
import type { OnboardingState } from "./types";

// ─── Crear negocio ────────────────────────────────────────────────────────────

type PendingSignup = { fn: string; un: string; em: string; ph: string; pw: string };

function parsePendingSignup(raw: string): PendingSignup | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf-8")) as Record<string, unknown>;
    if (parsed?.fn && parsed?.un && parsed?.em && parsed?.pw) {
      return parsed as unknown as PendingSignup;
    }
    return null;
  } catch {
    return null;
  }
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

  let userId: string;
  let isNewUser = false;

  if (existingUser) {
    userId = existingUser.id;
  } else {
    // Crear usuario desde cookie de signup pendiente (envía correo de confirmación)
    const pendingRaw = cookieStore.get("pending_signup")?.value;
    if (!pendingRaw) redirect("/auth/sign-up");

    const pending = parsePendingSignup(pendingRaw);
    if (!pending) redirect("/auth/sign-up");

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: pending.em,
      password: pending.pw,
      options: {
        data: { full_name: pending.fn, username: pending.un, phone: pending.ph },
      },
    });

    if (signUpError || !signUpData.user) {
      return { success: false, message: signUpError?.message || "No se pudo crear el usuario." };
    }

    userId = signUpData.user.id;
    isNewUser = true;

    const { error: profileError } = await adminClient.from("profiles").upsert(
      { id: userId, full_name: pending.fn, email: pending.em, username: pending.un, phone: pending.ph },
      { onConflict: "id" }
    );

    if (profileError) {
      await adminClient.auth.admin.deleteUser(userId);
      return { success: false, message: "No se pudo guardar el perfil." };
    }
  }

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

  if (companyError || !company) {
    if (isNewUser) await adminClient.auth.admin.deleteUser(userId);
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
    if (isNewUser) await adminClient.auth.admin.deleteUser(userId);
    return { success: false, message: membershipError.message ?? "No se pudo crear el acceso al negocio." };
  }

  if (isNewUser) {
    cookieStore.delete("pending_signup");
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

  // Validar invite via RPC antes de crear el usuario
  type InviteLookup = { id: string; company_id: string; role: string | null };
  const { data: invite, error: inviteError } = await adminClient
    .rpc("get_valid_company_invite", { invite_code: code })
    .maybeSingle() as { data: InviteLookup | null; error: unknown };

  if (inviteError) {
    return { success: false, message: "No se pudo validar el código." };
  }

  if (!invite) {
    return { success: false, message: "El código no es válido o ya fue utilizado." };
  }

  let userId: string;
  let isNewUser = false;

  if (existingUser) {
    userId = existingUser.id;
  } else {
    // Crear usuario desde cookie de signup pendiente (envía correo de confirmación)
    const pendingRaw = cookieStore.get("pending_signup")?.value;
    if (!pendingRaw) redirect("/auth/sign-up");

    const pending = parsePendingSignup(pendingRaw);
    if (!pending) redirect("/auth/sign-up");

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: pending.em,
      password: pending.pw,
      options: {
        data: { full_name: pending.fn, username: pending.un, phone: pending.ph },
      },
    });

    if (signUpError || !signUpData.user) {
      return { success: false, message: signUpError?.message || "No se pudo crear el usuario." };
    }

    userId = signUpData.user.id;
    isNewUser = true;

    const { error: profileError } = await adminClient.from("profiles").upsert(
      { id: userId, full_name: pending.fn, email: pending.em, username: pending.un, phone: pending.ph },
      { onConflict: "id" }
    );

    if (profileError) {
      await adminClient.auth.admin.deleteUser(userId);
      return { success: false, message: "No se pudo guardar el perfil." };
    }
  }

  // Verificar que el usuario no sea ya miembro
  const { data: existingMembership } = await adminClient
    .from("memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("company_id", invite.company_id)
    .maybeSingle();

  if (existingMembership) {
    if (isNewUser) await adminClient.auth.admin.deleteUser(userId);
    return { success: false, message: "Ya perteneces a este negocio." };
  }

  const validRoles = ["owner", "admin", "seller"];
  const role = validRoles.includes(invite.role ?? "") ? (invite.role as string) : "seller";

  // Crear membership
  const { error: membershipError } = await adminClient.from("memberships").insert({
    company_id: invite.company_id,
    user_id: userId,
    role,
  });

  if (membershipError) {
    if (isNewUser) await adminClient.auth.admin.deleteUser(userId);
    return { success: false, message: membershipError.message ?? "No se pudo crear el acceso." };
  }

  // Marcar invite como usada
  await adminClient
    .from("company_invites")
    .update({ used_by: userId, used_at: new Date().toISOString(), is_active: false })
    .eq("id", invite.id);

  if (isNewUser) {
    cookieStore.delete("pending_signup");
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

  await supabase
    .from("companies")
    .update({
      ...(!keepsPaidPlan ? { subscription_plan: plan } : {}),
      ...(!keepsPaidPlan ? { subscription_billing_cycle: billing as "monthly" | "annual" } : {}),
      ...(!keepsPaidPlan ? { needs_inventory: needsInventory } : {}),
    })
    .eq("id", companyId);

  redirect("/dashboard/billing");
}
