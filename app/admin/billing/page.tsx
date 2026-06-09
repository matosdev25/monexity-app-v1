import { createAdminClient } from "@/lib/supabase/admin";
import { requireGlobalAdmin } from "@/lib/admin-auth";
import { formatDateTime } from "@/lib/date-format";
import { formatCurrency } from "@/lib/currency-format";
import { AdminVerifyButton } from "./verify-button";

export const metadata = { title: "Admin — Pagos pendientes" };
export const dynamic = "force-dynamic";

const PLAN_LABELS: Record<string, string> = {
  emprende: "Emprende",
  control:  "Control",
  equipo:   "Equipo",
};

function readYappyMetadata(raw: unknown) {
  const data = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return {
    senderName: String(data.sender_name ?? "—"),
    senderPhone: String(data.sender_phone ?? "—"),
  };
}

export default async function AdminBillingPage() {
  await requireGlobalAdmin();

  const admin = createAdminClient();
  const { data: intents } = await admin
    .from("payment_intents")
    .select(`
      id, company_id, user_id, plan_id, billing_cycle,
      exact_amount, status, claimed_at, expires_at, created_at, raw_response, provider,
      companies ( name )
    `)
    .in("provider", ["manual", "yappy_manual"])
    .in("status", ["claimed", "awaiting_verification", "pending", "manual_review"])
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });

  const rows = intents ?? [];
  const userIds = [...new Set(rows.map((intent) => intent.user_id).filter(Boolean))];
  const { data: profiles } = userIds.length > 0
      ? await admin
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds)
    : { data: [] };
  const profileByUser = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile])
  );

  return (
    <div className="space-y-5">
      <section className="app-card rounded-[24px] p-5">
        <p className="section-label text-[11px] uppercase tracking-[0.18em]">
          Verificación manual
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-app">
          Pagos Yappy pendientes
        </h2>
        <p className="mt-2 text-sm leading-6 text-app-muted">
          Confirma solo pagos revisados contra el movimiento real recibido.
        </p>
      </section>

      {rows.length === 0 ? (
        <div className="app-card rounded-[24px] border-dashed p-8 text-center">
          <p className="text-sm font-medium text-app-muted">
            No hay pagos pendientes de verificación.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((intent) => {
            const companiesRaw = intent.companies as { name: string } | { name: string }[] | null;
            const company = Array.isArray(companiesRaw) ? companiesRaw[0] : companiesRaw;
            const profile = profileByUser.get(intent.user_id);
            const yappy = readYappyMetadata(intent.raw_response);
            const claimedAt = intent.claimed_at
              ? formatDateTime(intent.claimed_at)
              : "—";
            const createdAt = formatDateTime(intent.created_at);
            const expiresAt = formatDateTime(intent.expires_at);

            return (
              <div
                key={intent.id}
                className="app-card grid gap-4 rounded-[24px] p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-2xl font-semibold tracking-tight text-app">
                      {formatCurrency(intent.exact_amount)}
                    </span>
                    <span className="rounded-full border border-app bg-app-soft px-2.5 py-1 text-xs font-medium text-app-muted">
                      Plan {PLAN_LABELS[intent.plan_id] ?? intent.plan_id} ·{" "}
                      {intent.billing_cycle === "monthly" ? "Mensual" : "Anual"}
                    </span>
                    <span
                      className={[
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        intent.status === "claimed"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200"
                          : intent.status === "manual_review"
                            ? "bg-sky-100 text-sky-700 dark:bg-cyan-500/15 dark:text-cyan-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
                      ].join(" ")}
                    >
                      {intent.status === "manual_review" ? "Pendiente" : intent.status}
                    </span>
                  </div>

                  <p className="mt-2 text-sm font-semibold text-app">
                    {company?.name ?? "Empresa desconocida"}
                  </p>
                  <div className="mt-2 grid gap-1 text-xs text-app-muted sm:grid-cols-2">
                    <p>Usuario: <span className="font-medium text-app">{profile?.full_name || profile?.email || intent.user_id}</span></p>
                    <p>Proveedor: <span className="font-medium text-app">{intent.provider === "yappy_manual" ? "Yappy manual" : "Manual"}</span></p>
                    <p>Remitente Yappy: <span className="font-medium text-app">{yappy.senderName}</span></p>
                    <p>Número Yappy: <span className="font-medium text-app">{yappy.senderPhone}</span></p>
                    <p>Solicitud: <span className="font-medium text-app">{createdAt}</span></p>
                    <p>Reclamado: <span className="font-medium text-app">{claimedAt}</span></p>
                    <p>Vence: <span className="font-medium text-app">{expiresAt}</span></p>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-app-soft">
                    {intent.id}
                  </p>
                </div>

                <AdminVerifyButton intentId={intent.id} />
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-app-soft">
        Recarga la página para ver cambios · {rows.length} intento(s) pendiente(s)
      </p>
    </div>
  );
}
