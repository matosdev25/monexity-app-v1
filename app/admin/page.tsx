import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGlobalAdmin } from "@/lib/admin-auth";
import { AdminErrorState } from "./admin-ui";
import { MANUAL_PAYMENT_PROVIDERS, pendingPaymentsFilter } from "./billing/constants";

export const metadata = { title: "Admin — Monexity" };
export const dynamic = "force-dynamic";

const ISSUE_STATUSES = [
  "pending",
  "pending_payment_method",
  "failed",
  "cancelled",
  "canceled",
  "expired",
  "past_due",
  "inactive",
];

function Metric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={[
        "app-card rounded-[24px] p-4 sm:p-5",
        tone === "warning" && value > 0 ? "ring-1 ring-amber-300/70 dark:ring-amber-400/30" : "",
      ].join(" ")}
    >
      <p className="text-sm font-medium text-app-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-app">{value}</p>
      {hint ? <p className="mt-1 text-xs text-app-soft">{hint}</p> : null}
    </div>
  );
}

const quickLinkClass =
  "app-card-interactive rounded-[24px] p-5 transition-[background-color,border-color,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 motion-reduce:transition-none";

export default async function AdminHomePage() {
  await requireGlobalAdmin();

  const admin = createAdminClient();
  const now = new Date();
  const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const head = { count: "exact" as const, head: true };

  const results = await Promise.all([
    admin.from("companies").select("id", head),
    admin.from("companies").select("id", head).eq("subscription_status", "active"),
    admin.from("companies").select("id", head).eq("subscription_status", "trialing"),
    admin
      .from("companies")
      .select("id", head)
      .eq("subscription_status", "trialing")
      .gte("trial_ends_at", now.toISOString())
      .lte("trial_ends_at", inSevenDays.toISOString()),
    admin.from("companies").select("id", head).in("subscription_status", ISSUE_STATUSES),
    admin.from("profiles").select("id", head),
    admin
      .from("payment_intents")
      .select("id", head)
      .in("provider", MANUAL_PAYMENT_PROVIDERS)
      .or(pendingPaymentsFilter(now.toISOString())),
  ]);

  const failed = results.some((result) => result.error);
  const [companies, active, trialing, trialsEnding, issues, users, pendingPayments] = results.map(
    (result) => result.count ?? 0
  );

  return (
    <div className="space-y-6">
      {failed ? (
        <AdminErrorState message="Algunos indicadores no están disponibles. Recarga la página para intentarlo de nuevo." />
      ) : null}

      <section aria-label="Indicadores" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Empresas registradas" value={companies} />
        <Metric label="Usuarios" value={users} />
        <Metric label="Suscripciones activas" value={active} />
        <Metric label="En prueba" value={trialing} hint={`${trialsEnding} vencen en 7 días`} />
        <Metric label="Pagos por verificar" value={pendingPayments} tone="warning" />
        <Metric label="Pendientes / fallidas" value={issues} tone="warning" />
      </section>

      <section aria-label="Accesos rápidos" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/billing" className={quickLinkClass}>
          <p className="text-lg font-semibold text-app">Pagos</p>
          <p className="mt-2 text-sm leading-6 text-app-muted">
            {pendingPayments > 0
              ? `${pendingPayments} pago(s) Yappy esperan verificación.`
              : "Sin pagos pendientes. Revisa el historial reciente."}
          </p>
        </Link>
        <Link href="/admin/subscribers" className={quickLinkClass}>
          <p className="text-lg font-semibold text-app">Empresas</p>
          <p className="mt-2 text-sm leading-6 text-app-muted">
            Dueños, planes, estados y fechas clave.
          </p>
        </Link>
        <Link href="/admin/users" className={quickLinkClass}>
          <p className="text-lg font-semibold text-app">Usuarios</p>
          <p className="mt-2 text-sm leading-6 text-app-muted">
            Cuentas registradas y sus negocios.
          </p>
        </Link>
        <Link href="/admin/discount-codes" className={quickLinkClass}>
          <p className="text-lg font-semibold text-app">Códigos</p>
          <p className="mt-2 text-sm leading-6 text-app-muted">
            Crea, activa y desactiva códigos promocionales.
          </p>
        </Link>
      </section>
    </div>
  );
}
