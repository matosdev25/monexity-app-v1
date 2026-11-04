import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGlobalAdmin } from "@/lib/admin-auth";
import { formatDateTime } from "@/lib/date-format";
import { formatCurrency } from "@/lib/currency-format";
import { AdminVerifyButton } from "./verify-button";
import { AdminEmptyState, AdminErrorState, adminMotion } from "../admin-ui";
import { MANUAL_PAYMENT_PROVIDERS, RESOLVED_PAYMENT_STATUSES, pendingPaymentsFilter } from "./constants";

export const metadata = { title: "Admin — Pagos" };
export const dynamic = "force-dynamic";

const HISTORY_LIMIT = 30;

const PLAN_LABELS: Record<string, string> = {
  emprende: "Emprende",
  control: "Control",
  equipo: "Equipo",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  claimed: "Reclamado",
  awaiting_verification: "Por verificar",
  manual_review: "En revisión",
  paid: "Aprobado",
  failed: "Rechazado",
  expired: "Expirado",
  cancelled: "Cancelado",
};

function statusClass(status: string | null) {
  if (status === "paid") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  if (status === "failed") return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
  if (status === "expired" || status === "cancelled") return "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300";
  if (status === "claimed") return "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200";
  return "bg-sky-100 text-sky-700 dark:bg-cyan-500/15 dark:text-cyan-300";
}

function readYappyMetadata(raw: unknown) {
  const data = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return {
    senderName: String(data.sender_name ?? "—"),
    senderPhone: String(data.sender_phone ?? "—"),
  };
}

type IntentRow = {
  id: string;
  company_id: string;
  user_id: string;
  plan_id: string;
  billing_cycle: string;
  exact_amount: number | string;
  status: string | null;
  claimed_at: string | null;
  expires_at: string | null;
  created_at: string | null;
  verified_at: string | null;
  verified_by_email: string | null;
  raw_response: unknown;
  provider: string | null;
  companies: { name: string } | { name: string }[] | null;
};

const INTENT_COLUMNS = `
  id, company_id, user_id, plan_id, billing_cycle,
  exact_amount, status, claimed_at, expires_at, created_at, verified_at, verified_by_email,
  raw_response, provider,
  companies ( name )
`;

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await requireGlobalAdmin();

  const { view: rawView } = await searchParams;
  const view = rawView === "history" ? "history" : "pending";
  const admin = createAdminClient();

  const { data: intents, error } = view === "pending"
    ? await admin
        .from("payment_intents")
        .select(INTENT_COLUMNS)
        .in("provider", MANUAL_PAYMENT_PROVIDERS)
        .or(pendingPaymentsFilter(new Date().toISOString()))
        .order("created_at", { ascending: true })
    : await admin
        .from("payment_intents")
        .select(INTENT_COLUMNS)
        .in("provider", MANUAL_PAYMENT_PROVIDERS)
        .in("status", RESOLVED_PAYMENT_STATUSES)
        .order("updated_at", { ascending: false })
        .limit(HISTORY_LIMIT);

  const rows = (intents ?? []) as unknown as IntentRow[];
  const userIds = [...new Set(rows.map((intent) => intent.user_id).filter(Boolean))];
  const { data: profiles, error: profilesError } = userIds.length > 0
    ? await admin.from("profiles").select("id, email, full_name").in("id", userIds)
    : { data: [] as { id: string; email: string | null; full_name: string | null }[], error: null };
  const profileByUser = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  const tabClass = (active: boolean) =>
    [
      "whitespace-nowrap rounded-[18px] px-3 py-2 text-sm font-medium",
      adminMotion,
      "active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50",
      active
        ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
        : "text-app-muted hover:bg-white hover:text-app dark:hover:bg-white/10",
    ].join(" ");

  return (
    <div className="space-y-5">
      <section className="app-card flex flex-col gap-4 rounded-[24px] p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-label text-[11px] uppercase tracking-[0.18em]">Verificación manual</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-app">Pagos Yappy</h2>
          <p className="mt-2 text-sm leading-6 text-app-muted">
            Confirma solo pagos revisados contra el movimiento real recibido.
          </p>
        </div>
        <nav aria-label="Vista de pagos" className="flex w-fit gap-1 rounded-[22px] border border-app bg-app-soft p-1">
          <Link href="/admin/billing" aria-current={view === "pending" ? "page" : undefined} className={tabClass(view === "pending")}>
            Pendientes
          </Link>
          <Link href="/admin/billing?view=history" aria-current={view === "history" ? "page" : undefined} className={tabClass(view === "history")}>
            Historial
          </Link>
        </nav>
      </section>

      {error || profilesError ? (
        <AdminErrorState message="No se pudieron consultar los pagos. Recarga la página para intentarlo de nuevo." />
      ) : null}

      {rows.length === 0 && !error ? (
        <AdminEmptyState
          title={view === "pending" ? "No hay pagos pendientes de verificación." : "Aún no hay pagos manuales resueltos."}
          description={view === "pending" ? "Los pagos nuevos aparecerán aquí automáticamente al recargar." : undefined}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((intent) => {
            const company = Array.isArray(intent.companies) ? intent.companies[0] : intent.companies;
            const profile = profileByUser.get(intent.user_id);
            const yappy = readYappyMetadata(intent.raw_response);
            const status = intent.status ?? "";

            return (
              <div
                key={intent.id}
                className="app-card grid min-w-0 gap-4 rounded-[24px] p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-2xl font-semibold tracking-tight text-app">
                      {formatCurrency(intent.exact_amount)}
                    </span>
                    <span className="rounded-full border border-app bg-app-soft px-2.5 py-1 text-xs font-medium text-app-muted">
                      Plan {PLAN_LABELS[intent.plan_id] ?? intent.plan_id} · {intent.billing_cycle === "monthly" ? "Mensual" : "Anual"}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(intent.status)}`}>
                      {STATUS_LABELS[status] ?? status}
                    </span>
                  </div>

                  <p className="mt-2 break-words text-sm font-semibold text-app">
                    {company?.name ?? "Empresa desconocida"}
                  </p>
                  <div className="mt-2 grid gap-1 text-xs text-app-muted sm:grid-cols-2">
                    <p className="break-all">Usuario: <span className="font-medium text-app">{profile?.full_name || profile?.email || intent.user_id}</span></p>
                    <p>Proveedor: <span className="font-medium text-app">{intent.provider === "yappy_manual" ? "Yappy manual" : "Manual"}</span></p>
                    <p>Remitente Yappy: <span className="font-medium text-app">{yappy.senderName}</span></p>
                    <p>Número Yappy: <span className="font-medium text-app">{yappy.senderPhone}</span></p>
                    <p>Solicitud: <span className="font-medium text-app">{formatDateTime(intent.created_at)}</span></p>
                    {view === "pending" ? (
                      <>
                        <p>Reclamado: <span className="font-medium text-app">{intent.claimed_at ? formatDateTime(intent.claimed_at) : "—"}</span></p>
                        <p>Vence: <span className="font-medium text-app">{formatDateTime(intent.expires_at)}</span></p>
                      </>
                    ) : (
                      <>
                        <p>Resuelto: <span className="font-medium text-app">{intent.verified_at ? formatDateTime(intent.verified_at) : "—"}</span></p>
                        <p className="break-all">Por: <span className="font-medium text-app">{intent.verified_by_email ?? "Sistema"}</span></p>
                      </>
                    )}
                  </div>
                  <p className="mt-1 break-all font-mono text-[11px] text-app-soft">{intent.id}</p>
                </div>

                {view === "pending" ? (
                  <AdminVerifyButton
                    intentId={intent.id}
                    summary={`${formatCurrency(intent.exact_amount)} · ${company?.name ?? "Empresa desconocida"}`}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-app-soft">
        {view === "pending"
          ? `${rows.length} intento(s) pendiente(s) · la lista se actualiza al aprobar o rechazar`
          : `Últimos ${HISTORY_LIMIT} pagos manuales resueltos`}
      </p>
    </div>
  );
}
