import { createAdminClient } from "@/lib/supabase/admin";
import { requireGlobalAdmin } from "@/lib/admin-auth";
import { formatShortDate } from "@/lib/date-format";

export const metadata = { title: "Admin — Suscriptores" };
export const dynamic = "force-dynamic";

const PLAN_LABELS: Record<string, string> = {
  emprende: "Emprende",
  control: "Control",
  equipo: "Equipo",
};

const STATUS_LABELS: Record<string, string> = {
  trialing: "Prueba",
  active: "Activa",
  pending: "Pendiente",
  pending_payment_method: "Pago pendiente",
  failed: "Fallida",
  cancelled: "Cancelada",
  canceled: "Cancelada",
  expired: "Expirada",
  past_due: "Vencida",
  inactive: "Inactiva",
};

const inputClass =
  "rounded-[18px] border border-app bg-app-soft px-4 py-3 text-sm text-app outline-none transition-[background-color,border-color,box-shadow] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] placeholder:text-app-soft focus:border-app-strong focus:bg-white focus-visible:ring-2 focus-visible:ring-sky-400/30 dark:focus:bg-white/[0.08]";

type CompanyRow = {
  id: string;
  name: string | null;
  subscription_status: string | null;
  subscription_plan: string | null;
  trial_ends_at: string | null;
  current_period_starts_at: string | null;
  current_period_ends_at: string | null;
  created_at: string | null;
  owner_user_id: string | null;
};

type MembershipRow = {
  company_id: string;
  user_id: string;
  role: string | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type PaymentIntentRow = {
  company_id: string;
  billing_cycle: string | null;
  status: string | null;
  created_at: string | null;
};

function formatDate(value: string | null) {
  return formatShortDate(value);
}

export default async function AdminSubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireGlobalAdmin();

  const { q = "", status = "" } = await searchParams;
  const query = q.trim().toLowerCase();
  const admin = createAdminClient();

  const [{ data: companiesRaw }, { data: membershipsRaw }, { data: paymentsRaw }] = await Promise.all([
    admin
      .from("companies")
      .select("id, name, subscription_status, subscription_plan, trial_ends_at, current_period_starts_at, current_period_ends_at, created_at, owner_user_id")
      .order("created_at", { ascending: false }),
    admin
      .from("memberships")
      .select("company_id, user_id, role")
      .eq("role", "owner"),
    admin
      .from("payment_intents")
      .select("company_id, billing_cycle, status, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const companies = (companiesRaw ?? []) as CompanyRow[];
  const memberships = (membershipsRaw ?? []) as MembershipRow[];
  const payments = (paymentsRaw ?? []) as PaymentIntentRow[];
  const ownerIds = [...new Set(memberships.map((m) => m.user_id))];

  const { data: profilesRaw } = ownerIds.length > 0
    ? await admin.from("profiles").select("id, email, full_name").in("id", ownerIds)
    : { data: [] };

  const profiles = new Map((profilesRaw ?? []).map((p) => [p.id, p as ProfileRow]));
  const owners = new Map(memberships.map((m) => [m.company_id, profiles.get(m.user_id) ?? null]));
  const latestPayment = new Map<string, PaymentIntentRow>();
  for (const payment of payments) {
    if (!latestPayment.has(payment.company_id)) latestPayment.set(payment.company_id, payment);
  }

  const rows = companies.filter((company) => {
    const owner = owners.get(company.id);
    const matchesQuery = !query
      || String(company.name ?? "").toLowerCase().includes(query)
      || String(owner?.email ?? "").toLowerCase().includes(query);
    const matchesStatus = !status || company.subscription_status === status;
    return matchesQuery && matchesStatus;
  });

  return (
    <div className="space-y-5">
      <form className="app-card grid gap-2 rounded-[24px] p-4 sm:grid-cols-[1fr_180px_auto]">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por negocio o email"
          className={inputClass}
        />
        <select
          name="status"
          defaultValue={status}
          className={inputClass}
        >
          <option value="">Todos</option>
          <option value="trialing">Prueba</option>
          <option value="active">Activa</option>
          <option value="pending">Pendiente</option>
          <option value="pending_payment_method">Pago pendiente</option>
          <option value="failed">Fallida</option>
          <option value="cancelled">Cancelada</option>
          <option value="expired">Expirada</option>
        </select>
        <button
          type="submit"
          className="rounded-[18px] bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-[background-color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-800 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          Filtrar
        </button>
      </form>

      <div className="app-card overflow-hidden rounded-[28px]">
        <div className="border-b border-app px-4 py-3 text-sm font-semibold text-app">
          {rows.length} suscriptor(es)
        </div>

        <div className="divide-y divide-[var(--border-soft)]">
          {rows.map((company) => {
            const owner = owners.get(company.id);
            const payment = latestPayment.get(company.id);
            return (
              <div key={company.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
                <div>
                  <p className="font-semibold text-app">{company.name ?? "Sin nombre"}</p>
                  <p className="mt-1 text-xs text-app-muted">
                    {owner?.email ?? "Dueño sin email"}
                  </p>
                  {owner?.full_name && (
                    <p className="mt-0.5 text-xs text-app-soft">{owner.full_name}</p>
                  )}
                </div>

                <div className="text-sm">
                  <p className="text-app-muted">Plan</p>
                  <p className="font-medium text-app">
                    {PLAN_LABELS[company.subscription_plan ?? ""] ?? "Sin plan"} ·{" "}
                    {payment?.billing_cycle === "annual" ? "Anual" : payment?.billing_cycle === "monthly" ? "Mensual" : "—"}
                  </p>
                </div>

                <div className="text-sm">
                  <p className="text-app-muted">Estado</p>
                  <p className="font-medium text-app">
                    {STATUS_LABELS[company.subscription_status ?? ""] ?? company.subscription_status ?? "Sin estado"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-app-muted sm:grid-cols-4 lg:grid-cols-2">
                  <p>Inicio<br /><span className="font-medium text-app">{formatDate(company.current_period_starts_at)}</span></p>
                  <p>Trial<br /><span className="font-medium text-app">{formatDate(company.trial_ends_at)}</span></p>
                  <p>Renueva<br /><span className="font-medium text-app">{formatDate(company.current_period_ends_at)}</span></p>
                  <p>Creada<br /><span className="font-medium text-app">{formatDate(company.created_at)}</span></p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
