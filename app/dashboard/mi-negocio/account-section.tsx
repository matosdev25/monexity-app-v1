import Link from "next/link";
import { PLAN_MAP } from "../../../lib/plans/plans";
import { formatShortDate } from "../../../lib/date-format";
import { formatCurrency } from "../../../lib/currency-format";
import { hasValidTrialToday, isTrialEndingToday } from "../../../lib/memberships/app-access";
import { CancelMembershipButton } from "./cancel-membership-button";

type AccountSectionProps = {
  companyId: string;
  canCancel: boolean;
  company: {
    subscription_status: string | null;
    subscription_plan: string | null;
    trial_ends_at: string | null;
    current_period_starts_at: string | null;
    current_period_ends_at: string | null;
    subscription_billing_cycle: string | null;
    scheduled_subscription_plan: string | null;
    scheduled_subscription_billing_cycle: string | null;
    scheduled_subscription_change_at: string | null;
    subscription_cancel_at_period_end: boolean;
  };
  latestPayment: {
    status: string;
    provider: string | null;
    plan_id: string | null;
    billing_cycle: string;
    exact_amount: number | string;
    verified_at: string | null;
    created_at: string;
  } | null;
};

const STATUS_LABELS: Record<string, string> = {
  trialing: "Prueba gratis",
  pending: "Pendiente",
  pending_payment_method: "Pago pendiente",
  active: "Activa",
  paid: "Pagada",
  failed: "Fallida",
  cancelled: "Cancelada",
  expired: "Expirada",
  inactive: "Inactiva",
  canceled: "Cancelada",
};

const PAYMENT_PROVIDER_LABELS: Record<string, string> = {
  paguelofacil: "PagueloFácil",
  yappy_manual: "Yappy",
};

function formatDate(value: string | null) {
  return formatShortDate(value, "No definido");
}

export function AccountSection({ companyId, canCancel, company, latestPayment }: AccountSectionProps) {
  const plan = company.subscription_plan ? PLAN_MAP[company.subscription_plan] : null;
  const status = company.subscription_status ?? "inactive";
  const cycle = company.subscription_billing_cycle
    ? company.subscription_billing_cycle === "annual" ? "Anual" : "Mensual"
    : "Ciclo no definido";
  const paymentStatus = latestPayment?.status
    ? STATUS_LABELS[latestPayment.status] ?? latestPayment.status
    : "Sin pago reciente";
  const paymentProvider = latestPayment?.provider
    ? PAYMENT_PROVIDER_LABELS[latestPayment.provider] ?? latestPayment.provider
    : null;
  const paymentPlan = latestPayment?.plan_id
    ? PLAN_MAP[latestPayment.plan_id]?.name ?? latestPayment.plan_id
    : null;
  const paymentAmount =
    latestPayment?.exact_amount != null
      ? formatCurrency(Number(latestPayment.exact_amount))
      : null;
  const paymentDate = latestPayment
    ? formatShortDate(latestPayment.verified_at ?? latestPayment.created_at, "Fecha pendiente")
    : null;
  const isCancelled = ["cancelled", "canceled"].includes(status);
  const isTrialing = status === "trialing";
  const hasValidTrial = isTrialing && hasValidTrialToday(company.trial_ends_at);
  const trialEnded = isTrialing && !hasValidTrial;
  const trialEndsToday = isTrialing && isTrialEndingToday(company.trial_ends_at);
  const statusLabel = trialEnded ? "Prueba vencida" : STATUS_LABELS[status] ?? status;
  const scheduledPlan = company.scheduled_subscription_plan
    ? PLAN_MAP[company.scheduled_subscription_plan]
    : null;

  return (
    <section className="space-y-4 pb-6">
      <div>
        <p className="section-label">Mi cuenta</p>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-app-soft">
          Información de la membresía SaaS de Monexity para este negocio.
        </p>
      </div>

      <div className="app-card rounded-[24px] border border-app p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-app-muted">Plan actual</p>
            <p className="mt-1 text-xl font-semibold tracking-[-0.02em] text-app">
              {plan ? plan.name : "Sin plan"}
            </p>
            {plan && (
              <p className="mt-1 text-sm text-app-soft">{plan.tagline}</p>
            )}
          </div>

          <span
            className={[
              "w-fit rounded-full px-3 py-1 text-xs font-semibold",
              isCancelled
                ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                : "bg-sky-100 text-sky-700 dark:bg-cyan-500/15 dark:text-cyan-300",
            ].join(" ")}
          >
            {statusLabel}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[18px] border border-app bg-app-soft p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-soft">
              Inicio del período
            </p>
            <p className="mt-2 text-sm font-medium text-app">
              {formatDate(company.current_period_starts_at)}
            </p>
          </div>

          <div className="rounded-[18px] border border-app bg-app-soft p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-soft">
              Fin de prueba gratis
            </p>
            <p className="mt-2 text-sm font-medium text-app">
              {formatDate(company.trial_ends_at)}
            </p>
          </div>

          <div className="rounded-[18px] border border-app bg-app-soft p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-soft">
              Próxima renovación
            </p>
            <p className="mt-2 text-sm font-medium text-app">
              {formatDate(company.current_period_ends_at)}
            </p>
          </div>

          <div className="rounded-[18px] border border-app bg-app-soft p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-app-soft">
              Pago
            </p>
            <p className="mt-2 text-sm font-medium text-app">
              {latestPayment
                ? [
                    paymentProvider,
                    paymentStatus,
                    paymentAmount,
                    paymentDate,
                    paymentPlan,
                    cycle,
                  ].filter(Boolean).join(" · ")
                : paymentStatus}
            </p>
          </div>
        </div>

        {hasValidTrial && plan && (
          <div className="mt-5 rounded-[18px] border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-700 dark:border-cyan-500/25 dark:bg-cyan-500/10 dark:text-cyan-300">
            {trialEndsToday ? (
              <>
                <p className="font-semibold">Tu prueba gratis termina hoy</p>
                <p className="mt-1">
                  Hoy finaliza tu periodo de prueba de Monexity. Realiza el pago de tu plan para seguir disfrutando tus beneficios sin interrupciones.
                </p>
              </>
            ) : (
              <>Estás en tu prueba gratis. Al finalizar el {formatDate(company.trial_ends_at)}, deberás pagar el plan {plan.name} para continuar usando Monexity.</>
            )}
          </div>
        )}

        {trialEnded && plan && (
          <div className="mt-5 rounded-[18px] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
            Tu prueba gratis finalizó. Elige un plan para continuar.
          </div>
        )}

        {scheduledPlan && (
          <div className="mt-5 rounded-[18px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="font-semibold">Cambio programado</p>
            <p className="mt-1 leading-5">
              Tu plan cambiará a {scheduledPlan.name} ({company.scheduled_subscription_billing_cycle === "annual" ? "anual" : "mensual"}) el {formatDate(company.scheduled_subscription_change_at)}.
            </p>
          </div>
        )}

        {company.subscription_cancel_at_period_end && (
          <div className="mt-5 rounded-[18px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
            Tu cancelación está programada para el final del período actual.
          </div>
        )}

        <Link
          href="/dashboard/billing"
          className="mt-5 inline-flex w-full items-center justify-center rounded-[20px] bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition-[background-color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-sky-700 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 sm:w-auto dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
        >
          Gestionar membresía
        </Link>

        {canCancel && !isCancelled && !company.subscription_cancel_at_period_end && (
          <CancelMembershipButton companyId={companyId} />
        )}
      </div>
    </section>
  );
}
