import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Building2 } from "lucide-react";
import type { ReactNode } from "react";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { formatShortDate } from "../../../lib/date-format";
import { resolveLogoUrl, isStoragePath } from "../../../lib/storage/resolve-logo";
import { MiNegocioTabs } from "./mi-negocio-tabs";

import { BusinessSettingsForm } from "./business-settings-form";
import { PaymentMethodsSection } from "./payment-methods-section";
import { fetchPaymentMethods } from "./actions";
import { ServicesSection } from "./services-section";
import { fetchAllServices } from "./services-actions";
import { AccountSection } from "./account-section";
import {
  createInvite,
  cancelInvite,
  regenerateInvite,
  resendInviteEmail,
  removeMember,
  changeMemberRole,
} from "../team/actions";
import { ConfirmSubmitButton } from "../../../components/confirm-submit-button";
import { InviteCodeDisplay } from "../team/invite-code-display";
import { PLAN_MAP } from "../../../lib/plans/plans";

type Invite = {
  id: string;
  role: string;
  code: string;
  is_active: boolean;
  used_by: string | null;
  expires_at: string;
  created_at: string;
  invited_email: string | null;
  email_sent: boolean;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  username: string | null;
};

type Member = {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profile: Omit<ProfileRow, "id"> | null;
};

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    owner: { label: "Dueño", cls: "bg-violet-500/10 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300" },
    admin: { label: "Administrador", cls: "bg-sky-500/10 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300" },
    seller: { label: "Vendedor", cls: "bg-slate-500/10 text-slate-600 dark:bg-slate-400/10 dark:text-slate-300" },
  };
  const { label, cls } = map[role] ?? map.seller;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function InviteStatusBadge({ invite }: { invite: Invite }) {
  const expired = new Date(invite.expires_at) < new Date();

  if (invite.used_by) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
        Usada
      </span>
    );
  }

  if (!invite.is_active || expired) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-400/10 dark:text-red-300">
        {expired ? "Expirada" : "Cancelada"}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
      Pendiente
    </span>
  );
}

export default async function MiNegocioPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; invite?: string; member?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const cookieStore = await cookies();
  const activeCompanyId = cookieStore.get("active_company_id")?.value ?? null;

  const membershipQuery = supabase
    .from("memberships")
    .select("company_id, role")
    .eq("user_id", user.id);

  const { data: membership, error: membershipError } = await (
    activeCompanyId
      ? membershipQuery.eq("company_id", activeCompanyId)
      : membershipQuery.limit(1)
  ).maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membership?.company_id) {
    return (
      <div className="h-full overflow-x-hidden overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl">
          <div className="rounded-[28px] border border-app bg-app-soft p-6 sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-app bg-app-soft px-3 py-1 text-xs font-medium text-app-muted">
              <Building2 className="h-3.5 w-3.5" />
              Configuración del negocio
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-app sm:text-4xl">
              Mi negocio
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-app-soft">
              Tu usuario todavía no está vinculado a una empresa dentro de
              Monexity.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { tab: rawTab, invite: inviteStatus, member: memberStatus } = await searchParams;

  const role = String(membership.role ?? "").toLowerCase();
  const canEdit = ["owner", "admin"].includes(role);
  const isAdmin = ["owner", "admin"].includes(role);
  const isOwner = role === "owner";

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, name, owner_user_id, contact_footer, logo_url, needs_inventory, subscription_status, subscription_plan, subscription_billing_cycle, trial_ends_at, current_period_starts_at, current_period_ends_at, invoice_ruc, invoice_dv, invoice_address, invoice_email, invoice_phone")
    .eq("id", membership.company_id)
    .maybeSingle();

  if (companyError) throw new Error(companyError.message);

  if (!company) {
    return (
      <div className="h-full overflow-x-hidden overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl">
          <div className="rounded-[28px] border border-app bg-app-soft p-6 sm:p-8">
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-app sm:text-4xl">
              Mi negocio
            </h1>
            <p className="mt-3 text-sm text-app-soft">
              No se encontró la empresa asociada a tu cuenta.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const planConfig = PLAN_MAP[(company as { subscription_plan?: string | null }).subscription_plan ?? ""] ?? null;
  const hasTeam = planConfig?.multiUser ?? true;
  const tab = rawTab === "equipo" && hasTeam
    ? "equipo"
    : rawTab === "servicios"
      ? "servicios"
      : rawTab === "cuenta" && isOwner
        ? "cuenta"
        : "general";

  let generalSlot: ReactNode = null;
  let cuentaSlot: ReactNode = null;
  let serviciosSlot: ReactNode = null;
  let equipoSlot: ReactNode = null;
  const cardClass = "app-card rounded-[24px] p-4";
  const inviteMessages: Record<string, { type: "success" | "warning" | "error"; text: string }> = {
    created: {
      type: "success",
      text: "Invitación creada. Copia el código de la lista para compartirlo.",
    },
    email_pending: {
      type: "warning",
      text: "Invitación creada. No se pudo enviar el correo, puedes reenviarlo desde la lista.",
    },
    duplicate: {
      type: "warning",
      text: "Ya existe una invitación activa para ese correo.",
    },
    invalid: {
      type: "error",
      text: "Selecciona un rol válido.",
    },
    forbidden: {
      type: "error",
      text: "No tienes permisos para crear invitaciones.",
    },
    error: {
      type: "error",
      text: "No se pudo crear la invitación. Intenta nuevamente.",
    },
  };
  const inviteMessage = inviteStatus ? inviteMessages[inviteStatus] ?? null : null;
  const memberMessages: Record<string, { type: "success" | "error"; text: string }> = {
    removed: {
      type: "success",
      text: "Miembro eliminado del equipo.",
    },
    forbidden: {
      type: "error",
      text: "No tienes permisos para quitar este miembro.",
    },
    error: {
      type: "error",
      text: "No se pudo quitar el miembro. Intenta nuevamente.",
    },
  };
  const memberMessage = memberStatus ? memberMessages[memberStatus] ?? null : null;

  if (tab === "general") {
    const rawLogoValue = company.logo_url ?? null;
    const [
      { data: profile, error: profileError },
      paymentMethods,
      resolvedLogoUrl,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, phone, username")
        .eq("id", user.id)
        .maybeSingle(),
      fetchPaymentMethods(membership.company_id),
      resolveLogoUrl(rawLogoValue),
    ]);

    if (profileError) throw new Error(profileError.message);

    const logoIsUploadedPath = rawLogoValue ? isStoragePath(rawLogoValue) : false;

    generalSlot = (
      <BusinessSettingsForm
        initialData={{
          companyId: company.id,
          companyName: company.name ?? "",
          contactFooter: company.contact_footer ?? "",
          logoUrl: resolvedLogoUrl ?? "",
          logoStoredPath: logoIsUploadedPath ? (rawLogoValue ?? "") : "",
          logoIsUploadedPath,
          needsInventory: Boolean(company.needs_inventory),
          role: membership.role ?? "",
          profileName: profile?.full_name ?? "",
          profileEmail: profile?.email ?? "",
          profilePhone: profile?.phone ?? "",
          username: profile?.username ?? "",
          subscriptionPlan: (company as { subscription_plan?: string | null }).subscription_plan ?? null,
          invoiceRuc: (company as { invoice_ruc?: string | null }).invoice_ruc ?? "",
          invoiceDv: (company as { invoice_dv?: string | null }).invoice_dv ?? "",
          invoiceAddress: (company as { invoice_address?: string | null }).invoice_address ?? "",
          invoiceEmail: (company as { invoice_email?: string | null }).invoice_email ?? "",
          invoicePhone: (company as { invoice_phone?: string | null }).invoice_phone ?? "",
        }}
        paymentMethodsSlot={
          <PaymentMethodsSection
            methods={paymentMethods}
            companyId={company.id}
            canEdit={canEdit}
          />
        }
      />
    );
  }

  if (tab === "servicios") {
    const allServices = await fetchAllServices(membership.company_id);
    serviciosSlot = (
      <ServicesSection
        services={allServices}
        companyId={company.id}
        canEdit={canEdit}
      />
    );
  }

  if (tab === "cuenta" && isOwner) {
    const [{ data: latestPayment }, { data: subscriptionMetadata }] = await Promise.all([
      supabase
        .from("payment_intents")
        .select("status, provider, plan_id, billing_cycle, exact_amount, verified_at, created_at")
        .eq("company_id", membership.company_id)
        .in("provider", ["paguelofacil", "yappy_manual"])
        .eq("status", "paid")
        .order("verified_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("companies")
        .select("scheduled_subscription_plan, scheduled_subscription_billing_cycle, scheduled_subscription_change_at, subscription_cancel_at_period_end")
        .eq("id", membership.company_id)
        .maybeSingle(),
    ]);

    cuentaSlot = (
      <AccountSection
        companyId={company.id}
        canCancel={isOwner}
        company={{
          subscription_status: company.subscription_status ?? null,
          subscription_plan: company.subscription_plan ?? null,
          trial_ends_at: company.trial_ends_at ?? null,
          current_period_starts_at: company.current_period_starts_at ?? null,
          current_period_ends_at: company.current_period_ends_at ?? null,
          subscription_billing_cycle: company.subscription_billing_cycle ?? null,
          scheduled_subscription_plan: subscriptionMetadata?.scheduled_subscription_plan ?? null,
          scheduled_subscription_billing_cycle: subscriptionMetadata?.scheduled_subscription_billing_cycle ?? null,
          scheduled_subscription_change_at: subscriptionMetadata?.scheduled_subscription_change_at ?? null,
          subscription_cancel_at_period_end: Boolean(subscriptionMetadata?.subscription_cancel_at_period_end),
        }}
        latestPayment={latestPayment ?? null}
      />
    );
  }

  // ── Datos Equipo — solo cuando se abre el tab ─────────────────────────────
  let members: Member[] = [];
  let activeInvites: Invite[] = [];
  let pastInvites: Invite[] = [];

  if (tab === "equipo" && hasTeam) {
    const adminClient = createAdminClient();

    const { data: allMemberships } = await adminClient
      .from("memberships")
      .select("id, user_id, role, created_at")
      .eq("company_id", membership.company_id)
      .order("created_at", { ascending: true });

    const memberUserIds = (allMemberships ?? []).map((m) => m.user_id);

    const [profileRowsResult, invitesResult] = await Promise.all([
      memberUserIds.length > 0
        ? adminClient.from("profiles").select("id, full_name, email, username").in("id", memberUserIds)
        : Promise.resolve({ data: [] as ProfileRow[] }),
      isAdmin
        ? adminClient.from("company_invites")
            .select("id, role, code, is_active, used_by, expires_at, created_at, invited_email, email_sent")
            .eq("company_id", membership.company_id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as Invite[] }),
    ]);

    const profilesMap = new Map<string, Omit<ProfileRow, "id">>();
    for (const p of (profileRowsResult.data ?? []) as ProfileRow[]) {
      profilesMap.set(p.id, { full_name: p.full_name, email: p.email, username: p.username });
    }

    members = (allMemberships ?? []).map((m) => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      created_at: m.created_at,
      profile: profilesMap.get(m.user_id) ?? null,
    }));

    if (isAdmin) {
      const invites = (invitesResult.data ?? []) as Invite[];
      activeInvites = invites.filter(
        (i) => i.is_active && !i.used_by && new Date(i.expires_at) > new Date()
      );
      pastInvites = invites
        .filter((i) => !i.is_active || !!i.used_by || new Date(i.expires_at) <= new Date())
        .slice(0, 5);
    }

    equipoSlot = (
      <div className="flex flex-col gap-6">

        {/* Miembros */}
        <section>
          <p className="section-label">Miembros</p>

          {memberMessage && (
            <p
              className={[
                "mt-3 rounded-[18px] px-4 py-3 text-sm font-medium",
                memberMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
              ].join(" ")}
            >
              {memberMessage.text}
            </p>
          )}

          {members.length === 0 ? (
            <div className="mt-3 rounded-[22px] border border-dashed border-app bg-app-soft p-4">
              <p className="text-sm text-app-muted">No hay miembros aún.</p>
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {members.map((member) => {
                const isCurrentUser = member.user_id === user.id;
                const displayName =
                  member.profile?.full_name ||
                  member.profile?.username ||
                  member.profile?.email ||
                  "Miembro";
                const displayEmail = member.profile?.email || null;

                return (
                  <div key={member.id} className={`${cardClass} flex flex-col gap-3`}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-app">
                        {displayName}
                        {isCurrentUser && (
                          <span className="ml-1.5 text-xs font-normal text-app-muted">
                            (tú)
                          </span>
                        )}
                      </p>
                      {displayEmail && displayEmail !== displayName && (
                        <p className="mt-0.5 truncate text-xs text-app-muted">
                          {displayEmail}
                        </p>
                      )}
                      <div className="mt-2">
                        <RoleBadge role={member.role} />
                      </div>
                    </div>

                    {isOwner && !isCurrentUser && member.role !== "owner" && (
                      <div className="flex items-center gap-2 border-t border-app pt-3">
                        <form action={changeMemberRole} className="flex-1">
                          <input type="hidden" name="targetUserId" value={member.user_id} />
                          <input type="hidden" name="companyId" value={membership.company_id} />
                          <input
                            type="hidden"
                            name="newRole"
                            value={member.role === "admin" ? "seller" : "admin"}
                          />
                          <button
                            type="submit"
                            className="w-full rounded-xl border border-app bg-app-soft px-3 py-1.5 text-xs font-medium text-app-muted transition hover:text-app"
                          >
                            {member.role === "admin" ? "Hacer vendedor" : "Hacer administrador"}
                          </button>
                        </form>

                        <form action={removeMember} className="flex-1">
                          <input type="hidden" name="targetUserId" value={member.user_id} />
                          <input type="hidden" name="companyId" value={membership.company_id} />
                          <ConfirmSubmitButton
                            label="Eliminar"
                            title="Eliminar miembro"
                            confirmMessage="¿Seguro que deseas quitar este miembro del equipo?"
                            confirmLabel="Sí, eliminar"
                            className="w-full rounded-xl border border-red-200/70 bg-red-50/70 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
                          />
                        </form>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Invitaciones — solo admin */}
        {isAdmin && (
          <>
            <section>
              <p className="section-label">Invitaciones activas</p>

              <form action={createInvite} className="mt-3">
                <input type="hidden" name="companyId" value={membership.company_id} />
                <div className={`${cardClass} flex flex-col gap-3`}>
                  {inviteMessage && (
                    <p
                      className={[
                        "rounded-[18px] px-4 py-3 text-sm font-medium",
                        inviteMessage.type === "success"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                          : inviteMessage.type === "warning"
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                            : "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
                      ].join(" ")}
                    >
                      {inviteMessage.text}
                    </p>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="invite-role"
                        className="mb-1.5 block text-xs font-medium text-app-muted"
                      >
                        Rol
                      </label>
                      <select
                        id="invite-role"
                        name="role"
                        defaultValue="seller"
                        className="w-full rounded-[14px] border border-app bg-app-soft px-3 py-2 text-sm text-app outline-none transition-[background-color,border-color,box-shadow] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] focus:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-400/30"
                      >
                        <option value="admin">Administrador</option>
                        <option value="seller">Vendedor</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="invited-email"
                        className="mb-1.5 block text-xs font-medium text-app-muted"
                      >
                        Correo del invitado{" "}
                        <span className="text-app-soft">(opcional)</span>
                      </label>
                      <input
                        id="invited-email"
                        name="invitedEmail"
                        type="email"
                        placeholder="correo@ejemplo.com"
                        className="w-full rounded-[14px] border border-app bg-app-soft px-3 py-2 text-sm text-app outline-none transition-[background-color,border-color,box-shadow] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] placeholder:text-app-soft focus:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-400/30"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="rounded-[14px] bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-[background-color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-sky-700 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
                    >
                      Crear invitación
                    </button>
                  </div>
                </div>
              </form>

              <div className="mt-3 space-y-2">
                {activeInvites.length === 0 && (
                  <div className="rounded-[22px] border border-dashed border-app bg-app-soft p-4">
                    <p className="text-sm text-app-muted">No hay invitaciones activas.</p>
                  </div>
                )}

                {activeInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className={`${cardClass} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <InviteCodeDisplay code={invite.code} />
                        <RoleBadge role={invite.role} />
                        <InviteStatusBadge invite={invite} />
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {invite.invited_email && (
                          <p className="text-xs text-app-muted">{invite.invited_email}</p>
                        )}
                        {invite.invited_email && (
                          <span
                            className={[
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                              invite.email_sent
                                ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300"
                                : "bg-slate-500/10 text-slate-500 dark:bg-slate-400/10 dark:text-slate-400",
                            ].join(" ")}
                          >
                            {invite.email_sent ? "Correo enviado" : "Correo pendiente"}
                          </span>
                        )}
                        <p className="text-xs text-app-soft">
                          Expira{" "}
                          {formatShortDate(invite.expires_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {invite.invited_email && (
                        <form action={resendInviteEmail}>
                          <input type="hidden" name="inviteId" value={invite.id} />
                          <input type="hidden" name="companyId" value={membership.company_id} />
                          <button
                            type="submit"
                            className="rounded-xl border border-app bg-app-soft px-3 py-1.5 text-xs font-medium text-app-muted transition hover:text-app"
                          >
                            Reenviar correo
                          </button>
                        </form>
                      )}

                      <form action={regenerateInvite}>
                        <input type="hidden" name="inviteId" value={invite.id} />
                        <input type="hidden" name="companyId" value={membership.company_id} />
                        <button
                          type="submit"
                          className="rounded-xl border border-app bg-app-soft px-3 py-1.5 text-xs font-medium text-app-muted transition hover:text-app"
                        >
                          Regenerar
                        </button>
                      </form>

                      <form action={cancelInvite}>
                        <input type="hidden" name="inviteId" value={invite.id} />
                        <input type="hidden" name="companyId" value={membership.company_id} />
                        <ConfirmSubmitButton
                          label="Cancelar"
                          title="Cancelar invitación"
                          confirmMessage="¿Seguro que quieres cancelar esta invitación? Ya no podrá ser usada."
                          confirmLabel="Sí, cancelar"
                          className="rounded-xl border border-red-200/70 bg-red-50/70 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
                        />
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {pastInvites.length > 0 && (
              <section>
                <p className="section-label">Historial de invitaciones</p>
                <div className="mt-3 space-y-2">
                  {pastInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className={`${cardClass} flex items-center justify-between gap-4 opacity-50`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold tracking-[0.1em] text-app">
                            {invite.code.length === 13
                              ? `${invite.code.slice(0, 3)}·${invite.code.slice(3, 6)}·${invite.code.slice(6, 9)}·${invite.code.slice(9)}`
                              : invite.code}
                          </span>
                          <RoleBadge role={invite.role} />
                          <InviteStatusBadge invite={invite} />
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          {invite.invited_email && (
                            <p className="text-xs text-app-muted">{invite.invited_email}</p>
                          )}
                          <p className="text-xs text-app-soft">
                            {formatShortDate(invite.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-x-hidden overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl">

        {/* Header */}
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-app bg-app-soft px-3 py-1 text-xs font-medium text-app-muted">
            <Building2 className="h-3.5 w-3.5" />
            Configuración del negocio
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-app sm:text-4xl">
            Mi negocio
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-app-soft sm:text-[15px]">
            Administra la información principal de tu empresa dentro de Monexity.
          </p>
        </div>

        <MiNegocioTabs
          activeTab={tab}
          hasTeam={hasTeam}
          canViewAccount={isOwner}
          generalSlot={generalSlot}
          cuentaSlot={cuentaSlot}
          serviciosSlot={serviciosSlot}
          equipoSlot={equipoSlot}
        />
      </div>
    </div>
  );
}
