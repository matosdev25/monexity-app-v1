"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "../../../lib/supabase/admin";
import { createClient } from "../../../lib/supabase/server";
import { sendInviteEmail } from "../../../lib/email/send-invite-email";
import {
  generateInviteCode,
  normalizeInviteCodeInput,
} from "../../../lib/invites/invite-utils";
import { PLAN_MAP } from "../../../lib/plans/plans";

async function requireAdmin(companyId: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (membershipError || !membership || !["owner", "admin"].includes(membership.role ?? "")) return null;

  const { data: co } = await supabase
    .from("companies")
    .select("subscription_plan")
    .eq("id", companyId)
    .maybeSingle();

  const planConfig = PLAN_MAP[co?.subscription_plan ?? ""] ?? null;
  if (planConfig && !planConfig.multiUser) return null;

  return { supabase, user, role: String(membership.role ?? "").toLowerCase() };
}

async function requireOwner(companyId: string) {
  const ctx = await requireAdmin(companyId);
  if (!ctx || ctx.role !== "owner") return null;
  return ctx;
}

async function generateUniqueCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyName: string,
  role: string,
  maxAttempts = 10
): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateInviteCode(companyName, role);
    const { data, error } = await supabase
      .from("company_invites")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (error) return null;
    if (!data) return code;
  }
  return null;
}

async function getCompanyName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string
): Promise<string> {
  const { data } = await supabase
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .maybeSingle();
  return data?.name ?? "MON";
}

export async function createInvite(formData: FormData): Promise<void> {
  const companyId = String(formData.get("companyId") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const invitedEmail = String(formData.get("invitedEmail") ?? "")
    .trim()
    .toLowerCase();

  if (!companyId || !["admin", "seller"].includes(role)) {
    redirect("/dashboard/mi-negocio?tab=equipo&invite=invalid");
  }

  const ctx = await requireAdmin(companyId);
  if (!ctx) {
    redirect("/dashboard/mi-negocio?tab=equipo&invite=forbidden");
  }

  const { user } = ctx;
  const admin = createAdminClient();

  if (invitedEmail) {
    const { data: existing } = await admin
      .from("company_invites")
      .select("id")
      .eq("company_id", companyId)
      .eq("invited_email", invitedEmail)
      .eq("is_active", true)
      .is("used_by", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (existing) {
      redirect("/dashboard/mi-negocio?tab=equipo&invite=duplicate");
    }
  }

  const companyName = await getCompanyName(admin, companyId);
  const code = await generateUniqueCode(admin, companyName, role);
  if (!code) {
    redirect("/dashboard/mi-negocio?tab=equipo&invite=error");
  }

  const { data: invite, error: insertError } = await admin
    .from("company_invites")
    .insert({
      company_id: companyId,
      created_by: user.id,
      role,
      code,
      invited_email: invitedEmail || null,
    })
    .select("id")
    .single();

  if (insertError || !invite) {
    redirect("/dashboard/mi-negocio?tab=equipo&invite=error");
  }

  const result = invitedEmail
    ? await sendInviteEmail({
        to: invitedEmail,
        companyName,
        role,
        code,
      })
    : null;

  if (result?.ok) {
    await admin
      .from("company_invites")
      .update({ email_sent: true, email_sent_at: new Date().toISOString() })
      .eq("id", invite.id);
  }

  revalidatePath("/dashboard/mi-negocio");
  revalidatePath("/dashboard/team");
  redirect(`/dashboard/mi-negocio?tab=equipo&invite=${!invitedEmail || result?.ok ? "created" : "email_pending"}`);
}

export async function cancelInvite(formData: FormData): Promise<void> {
  const inviteId = String(formData.get("inviteId") ?? "").trim();
  const companyId = String(formData.get("companyId") ?? "").trim();

  if (!inviteId || !companyId) return;

  const ctx = await requireAdmin(companyId);
  if (!ctx) return;

  await ctx.supabase
    .from("company_invites")
    .update({ is_active: false })
    .eq("id", inviteId)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .is("used_by", null);

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/mi-negocio");
}

export async function regenerateInvite(formData: FormData): Promise<void> {
  const inviteId = String(formData.get("inviteId") ?? "").trim();
  const companyId = String(formData.get("companyId") ?? "").trim();

  if (!inviteId || !companyId) return;

  const ctx = await requireAdmin(companyId);
  if (!ctx) return;

  const { supabase, user } = ctx;

  const { data: existing } = await supabase
    .from("company_invites")
    .select("role, invited_email, is_active, used_by")
    .eq("id", inviteId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!existing || !existing.is_active || existing.used_by) return;

  const { error: deactivateError } = await supabase
    .from("company_invites")
    .update({ is_active: false })
    .eq("id", inviteId)
    .eq("company_id", companyId);

  if (deactivateError) return;

  const companyName = await getCompanyName(supabase, companyId);
  const code = await generateUniqueCode(supabase, companyName, existing.role);
  if (!code) return;

  const { data: newInvite, error: insertError } = await supabase
    .from("company_invites")
    .insert({
      company_id: companyId,
      created_by: user.id,
      role: existing.role,
      code,
      invited_email: existing.invited_email ?? null,
    })
    .select("id")
    .single();

  if (insertError || !newInvite) return;

  if (existing.invited_email) {
    const result = await sendInviteEmail({
      to: existing.invited_email,
      companyName,
      role: existing.role,
      code,
    });

    if (result.ok) {
      await supabase
        .from("company_invites")
        .update({ email_sent: true, email_sent_at: new Date().toISOString() })
        .eq("id", newInvite.id);
    }
  }

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/mi-negocio");
}

export async function resendInviteEmail(formData: FormData): Promise<void> {
  const inviteId = String(formData.get("inviteId") ?? "").trim();
  const companyId = String(formData.get("companyId") ?? "").trim();

  if (!inviteId || !companyId) return;

  const ctx = await requireAdmin(companyId);
  if (!ctx) return;

  const { supabase } = ctx;

  const { data: invite } = await supabase
    .from("company_invites")
    .select("code, role, invited_email, is_active, used_by, expires_at")
    .eq("id", inviteId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (
    !invite ||
    !invite.invited_email ||
    !invite.is_active ||
    invite.used_by ||
    new Date(invite.expires_at) <= new Date()
  )
    return;

  const companyName = await getCompanyName(supabase, companyId);

  const result = await sendInviteEmail({
    to: invite.invited_email,
    companyName,
    role: invite.role,
    code: invite.code,
  });

  if (!result.ok) return;

  await supabase
    .from("company_invites")
    .update({ email_sent: true, email_sent_at: new Date().toISOString() })
    .eq("id", inviteId);

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/mi-negocio");
}

export async function removeMember(formData: FormData): Promise<void> {
  const targetUserId = String(formData.get("targetUserId") ?? "").trim();
  const companyId = String(formData.get("companyId") ?? "").trim();

  if (!targetUserId || !companyId) {
    redirect("/dashboard/mi-negocio?tab=equipo&member=error");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/dashboard/mi-negocio?tab=equipo&member=forbidden");
  }

  if (targetUserId === user.id) {
    redirect("/dashboard/mi-negocio?tab=equipo&member=forbidden");
  }

  const admin = createAdminClient();

  const { data: actorMembership, error: actorMembershipError } = await admin
    .from("memberships")
    .select("id, role")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .maybeSingle();

  const actorRole = String(actorMembership?.role ?? "").trim().toLowerCase();

  if (actorMembershipError || !actorMembership?.id || actorRole !== "owner") {
    redirect("/dashboard/mi-negocio?tab=equipo&member=forbidden");
  }

  const { data: targetMembership, error: targetMembershipError } = await admin
    .from("memberships")
    .select("id, role")
    .eq("user_id", targetUserId)
    .eq("company_id", companyId)
    .maybeSingle();

  const targetRole = String(targetMembership?.role ?? "").trim().toLowerCase();

  if (
    targetMembershipError ||
    !targetMembership?.id ||
    !["admin", "seller"].includes(targetRole)
  ) {
    redirect("/dashboard/mi-negocio?tab=equipo&member=forbidden");
  }

  const { error } = await admin
    .from("memberships")
    .delete()
    .eq("id", targetMembership.id)
    .eq("company_id", companyId)
    .eq("user_id", targetUserId)
    .in("role", ["admin", "seller"]);

  if (error) {
    redirect("/dashboard/mi-negocio?tab=equipo&member=error");
  }

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/mi-negocio");
  redirect("/dashboard/mi-negocio?tab=equipo&member=removed");
}

export async function changeMemberRole(formData: FormData): Promise<void> {
  const targetUserId = String(formData.get("targetUserId") ?? "").trim();
  const companyId = String(formData.get("companyId") ?? "").trim();
  const newRole = String(formData.get("newRole") ?? "").trim();

  if (!targetUserId || !companyId) return;
  if (!["admin", "seller"].includes(newRole)) return;

  const ctx = await requireOwner(companyId);
  if (!ctx) return;

  if (targetUserId === ctx.user.id) return;

  const { data: targetMembership } = await ctx.supabase
    .from("memberships")
    .select("role")
    .eq("user_id", targetUserId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (String(targetMembership?.role ?? "").toLowerCase() === "owner") return;

  const { error } = await ctx.supabase.rpc("change_member_role", {
    p_company_id: companyId,
    p_target_user_id: targetUserId,
    p_new_role: newRole,
  });

  if (error) return;

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/mi-negocio");
}

export async function acceptInvite(formData: FormData): Promise<void> {
  const rawCode = String(formData.get("code") ?? "").trim();
  const code = normalizeInviteCodeInput(rawCode);

  if (!code) return;

  const supabase = await createClient();

  const { error } = await supabase.rpc("accept_company_invite", {
    invite_code: code,
  });

  if (error) return;

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/team");
}
