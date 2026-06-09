import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PLAN_MAP } from "@/lib/plans/plans";
import { formatShortDate } from "@/lib/date-format";
import { PaymentFlow } from "./payment-flow";

export const metadata = { title: "Plan y facturación — Monexity" };

const STATUS_LABELS: Record<string, string> = {
  trialing:  "Período de prueba",
  active:    "Activo",
  pending:   "Pendiente",
  pending_payment_method: "Pago pendiente",
  paid:      "Pagado",
  failed:    "Fallido",
  cancelled: "Cancelado",
  expired:   "Expirado",
  past_due:  "Vencido",
  inactive:  "Inactivo",
  canceled:  "Cancelado",
};

const PLAN_LABELS: Record<string, string> = {
  emprende: "Emprende",
  control:  "Control",
  equipo:   "Equipo",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Promise<{ pf?: string; reason?: string; trialPlanUpdated?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const cookieStore = await cookies();
  const cookieCompanyId = cookieStore.get("active_company_id")?.value ?? null;
  const membershipQuery = supabase
    .from("memberships")
    .select("company_id, role")
    .eq("user_id", user.id);

  const { data: membership } = await (
    cookieCompanyId
      ? membershipQuery.eq("company_id", cookieCompanyId)
      : membershipQuery.limit(1)
  ).maybeSingle();

  const activeCompanyId = membership?.company_id ?? null;

  if (!activeCompanyId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-app-muted">No se encontró empresa activa.</p>
      </div>
    );
  }

  const { data: company } = await supabase
    .from("companies")
    .select(
      "id, name, subscription_status, subscription_plan, subscription_billing_cycle, trial_ends_at, current_period_ends_at"
    )
    .eq("id", activeCompanyId)
    .maybeSingle();

  if (!company) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-app-muted">Error al cargar datos de facturación.</p>
      </div>
    );
  }

  // Metadata nueva: opcional mientras se aplica la migración de cambios de plan.
  const { data: subscriptionMetadata } = await supabase
    .from("companies")
    .select("scheduled_subscription_plan, scheduled_subscription_billing_cycle, scheduled_subscription_change_at, subscription_cancel_at_period_end")
    .eq("id", activeCompanyId)
    .maybeSingle();

  // Buscar intento activo existente. Si falla, la pantalla sigue cargando sin CTA pendiente.
  const { data: activeIntent } = await supabase
    .from("payment_intents")
    .select("id, status, exact_amount, expires_at, plan_id, billing_cycle, checkout_url")
    .eq("company_id", activeCompanyId)
    .eq("provider", "paguelofacil")
    .in("status", ["pending", "claimed", "awaiting_verification"])
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: activeIntentMetadata } = activeIntent
    ? await supabase
        .from("payment_intents")
        .select("intent_type")
        .eq("id", activeIntent.id)
        .maybeSingle()
    : { data: null };

  const { data: yappyIntent } = await supabase
    .from("payment_intents")
    .select("id, status, exact_amount, expires_at, plan_id, billing_cycle")
    .eq("company_id", activeCompanyId)
    .eq("provider", "yappy_manual")
    .eq("status", "manual_review")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const status = company.subscription_status ?? "inactive";
  const planId = company.subscription_plan ?? null;
  const periodEnd = company.current_period_ends_at;
  const trialEnd = company.trial_ends_at;
  const nowTime = new Date().getTime();

  const isActive = status === "active";
  const isPaid = status === "paid";
  const hasPaidAccess = isActive || isPaid;
  const isTrialing = status === "trialing";
  const hasValidTrial = Boolean(trialEnd && new Date(trialEnd).getTime() > nowTime);
  const needsPayment = !hasPaidAccess && !hasValidTrial;
  const currentPlanName = PLAN_LABELS[planId ?? ""] ?? "seleccionado";
  const updatedTrialPlanName = params.trialPlanUpdated
    ? PLAN_MAP[params.trialPlanUpdated]?.name ?? null
    : null;

  const daysLeft = periodEnd
    ? Math.ceil((new Date(periodEnd).getTime() - nowTime) / 86_400_000)
    : null;

  const trialDaysLeft = trialEnd
    ? Math.ceil((new Date(trialEnd).getTime() - nowTime) / 86_400_000)
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6 px-1">
      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-soft">
          Facturación
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-app">
          Plan y suscripción
        </h1>
      </div>

      {params.pf === "success" && (
        <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
          Pago confirmado. Tu membresía fue actualizada.
        </div>
      )}

      {params.pf === "error" && (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          No pudimos confirmar el pago automáticamente. Intenta nuevamente o contáctanos.
        </div>
      )}

      {updatedTrialPlanName && (
        <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium leading-6 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
          Tu plan se cambió a {updatedTrialPlanName}. No pagarás nada durante la prueba gratis. Al finalizar el período de prueba, se te facturará el plan {updatedTrialPlanName} si decides continuar.
        </div>
      )}

      {isTrialing && hasValidTrial && trialEnd && (
        <div className="rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium leading-6 text-sky-700 dark:border-cyan-500/25 dark:bg-cyan-500/10 dark:text-cyan-300">
          Estás en tu prueba gratis. Al finalizar el {formatShortDate(trialEnd)}, deberás pagar el plan {currentPlanName} para continuar usando Monexity.
        </div>
      )}

      {subscriptionMetadata?.subscription_cancel_at_period_end && (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          Tu cancelación está programada para el final del período actual.
        </div>
      )}

      {yappyIntent && (
        <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium leading-6 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
          <p>Pago por Yappy pendiente de revisión.</p>
          <p className="font-normal">Cuando el pago sea confirmado, activaremos tu membresía.</p>
        </div>
      )}

      {/* Estado actual */}
      <div className="app-card rounded-[24px] border border-app p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-app-muted">Estado del plan</p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-app">
              {hasPaidAccess || hasValidTrial
                ? `Plan ${PLAN_LABELS[planId ?? ""] ?? "sin plan"}`
                : "Sin plan activo"}
            </p>
          </div>
          <span
            className={[
              "rounded-full px-3 py-1 text-xs font-semibold",
              hasPaidAccess
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : hasValidTrial
                ? "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
                : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
            ].join(" ")}
          >
            {STATUS_LABELS[status] ?? status}
          </span>
        </div>

        {hasPaidAccess && daysLeft !== null && (
          <p className="mt-3 text-sm text-app-muted">
            {daysLeft > 0
              ? `Acceso garantizado por ${daysLeft} día${daysLeft !== 1 ? "s" : ""} más.`
              : "Tu plan venció hoy."}
          </p>
        )}

        {isTrialing && hasValidTrial && trialDaysLeft !== null && (
          <p className="mt-3 text-sm text-app-muted">
            {trialDaysLeft > 0
              ? `Tu período de prueba termina en ${trialDaysLeft} día${trialDaysLeft !== 1 ? "s" : ""}.`
              : "Tu período de prueba termina hoy."}
          </p>
        )}

        {needsPayment && (
          <p className="mt-3 text-sm text-rose-500 dark:text-rose-400">
            Tu acceso está bloqueado. Realiza el pago de tu plan para continuar.
          </p>
        )}
      </div>

      {/* Flujo de pago */}
      <PaymentFlow
        companyId={activeCompanyId}
        canManage={String(membership?.role ?? "").toLowerCase() === "owner"}
        currentPlanId={planId}
        currentBillingCycle={company.subscription_billing_cycle as "monthly" | "annual" | null}
        currentStatus={status}
        renewalDate={isTrialing ? trialEnd : periodEnd}
        scheduledChange={
          subscriptionMetadata?.scheduled_subscription_plan && subscriptionMetadata.scheduled_subscription_billing_cycle
            ? {
                planId: subscriptionMetadata.scheduled_subscription_plan,
                billingCycle: subscriptionMetadata.scheduled_subscription_billing_cycle as "monthly" | "annual",
                changeAt: subscriptionMetadata.scheduled_subscription_change_at,
              }
            : null
        }
        existingIntent={
          activeIntent
            ? {
                id:           activeIntent.id,
                status:       activeIntent.status,
                exactAmount:  Number(activeIntent.exact_amount),
                expiresAt:    activeIntent.expires_at,
                planId:       activeIntent.plan_id,
                billingCycle: activeIntent.billing_cycle as "monthly" | "annual",
                intentType:   activeIntentMetadata?.intent_type as "subscription_payment" | "plan_upgrade" | undefined,
                checkoutUrl:  activeIntent.checkout_url,
              }
            : null
        }
        pendingYappyIntent={
          yappyIntent
            ? {
                id: yappyIntent.id,
                status: yappyIntent.status,
                exactAmount: Number(yappyIntent.exact_amount),
                expiresAt: yappyIntent.expires_at,
                planId: yappyIntent.plan_id,
                billingCycle: yappyIntent.billing_cycle as "monthly" | "annual",
              }
            : null
        }
      />
    </div>
  );
}
