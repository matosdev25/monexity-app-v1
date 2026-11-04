import { createAdminClient } from "@/lib/supabase/admin";
import { requireGlobalAdmin } from "@/lib/admin-auth";
import { formatShortDate } from "@/lib/date-format";
import {
  ADMIN_PAGE_SIZE,
  AdminEmptyState,
  AdminErrorState,
  AdminPagination,
  adminInputClass,
  adminPrimaryButtonClass,
  parsePage,
  sanitizeSearch,
} from "../admin-ui";

export const metadata = { title: "Admin — Empresas" };
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

const STATUS_FILTERS = ["trialing", "active", "pending", "pending_payment_method", "failed", "cancelled", "expired", "past_due", "inactive"];

type CompanyRow = {
  id: string;
  name: string | null;
  subscription_status: string | null;
  subscription_plan: string | null;
  subscription_billing_cycle: string | null;
  trial_ends_at: string | null;
  current_period_starts_at: string | null;
  current_period_ends_at: string | null;
  created_at: string | null;
  owner_user_id: string | null;
  is_blocked: boolean | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

function cycleLabel(value: string | null) {
  if (value === "annual") return "Anual";
  if (value === "monthly") return "Mensual";
  return "—";
}

export default async function AdminSubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireGlobalAdmin();

  const { q = "", status: rawStatus = "", page: rawPage } = await searchParams;
  const search = sanitizeSearch(q);
  const status = STATUS_FILTERS.includes(rawStatus) ? rawStatus : "";
  const page = parsePage(rawPage);
  const from = (page - 1) * ADMIN_PAGE_SIZE;
  const admin = createAdminClient();

  let loadError = false;

  // Búsqueda por email del dueño: ids de perfiles coincidentes (acotado)
  let ownerIdsBySearch: string[] = [];
  if (search) {
    const { data: matches, error } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", `%${search}%`)
      .limit(100);
    if (error) loadError = true;
    ownerIdsBySearch = (matches ?? []).map((profile) => profile.id as string);
  }

  let query = admin
    .from("companies")
    .select(
      "id, name, subscription_status, subscription_plan, subscription_billing_cycle, trial_ends_at, current_period_starts_at, current_period_ends_at, created_at, owner_user_id, is_blocked",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + ADMIN_PAGE_SIZE - 1);

  if (status) {
    query = status === "cancelled"
      ? query.in("subscription_status", ["cancelled", "canceled"])
      : query.eq("subscription_status", status);
  }
  if (search) {
    const ownerFilter = ownerIdsBySearch.length > 0 ? `,owner_user_id.in.(${ownerIdsBySearch.join(",")})` : "";
    query = query.or(`name.ilike.%${search}%${ownerFilter}`);
  }

  const { data: companiesRaw, count, error: companiesError } = await query;
  if (companiesError) loadError = true;

  const companies = (companiesRaw ?? []) as CompanyRow[];
  const ownerIds = [...new Set(companies.map((company) => company.owner_user_id).filter(Boolean))] as string[];

  const { data: profilesRaw, error: profilesError } = ownerIds.length > 0
    ? await admin.from("profiles").select("id, email, full_name").in("id", ownerIds)
    : { data: [] as ProfileRow[], error: null };
  if (profilesError) loadError = true;

  const owners = new Map(((profilesRaw ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
  const total = count ?? 0;

  return (
    <div className="space-y-5">
      <form className="app-card grid gap-2 rounded-[24px] p-4 sm:grid-cols-[1fr_200px_auto]">
        <label className="sr-only" htmlFor="admin-company-search">Buscar empresas</label>
        <input
          id="admin-company-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Buscar por negocio o email del dueño"
          className={adminInputClass}
        />
        <label className="sr-only" htmlFor="admin-company-status">Estado</label>
        <select id="admin-company-status" name="status" defaultValue={status} className={adminInputClass}>
          <option value="">Todos los estados</option>
          {STATUS_FILTERS.map((value) => (
            <option key={value} value={value}>{STATUS_LABELS[value]}</option>
          ))}
        </select>
        <button type="submit" className={adminPrimaryButtonClass}>
          Filtrar
        </button>
      </form>

      {loadError ? (
        <AdminErrorState message="Revisa la conexión con Supabase y recarga la página." />
      ) : null}

      <section className="app-card overflow-hidden rounded-[28px]">
        <div className="border-b border-app px-4 py-3 text-sm font-semibold text-app">
          {total} empresa(s)
        </div>

        {companies.length === 0 && !loadError ? (
          <div className="p-4">
            <AdminEmptyState
              title="No hay empresas con estos filtros"
              description={search || status ? "Prueba con otra búsqueda o estado." : undefined}
            />
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-soft)]">
            {companies.map((company) => {
              const owner = company.owner_user_id ? owners.get(company.owner_user_id) : null;
              return (
                <div key={company.id} className="grid min-w-0 gap-3 px-4 py-4 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-words font-semibold text-app">{company.name ?? "Sin nombre"}</p>
                      {company.is_blocked ? (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                          Bloqueada
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 break-all text-xs text-app-muted">{owner?.email ?? "Dueño sin email"}</p>
                    {owner?.full_name ? <p className="mt-0.5 text-xs text-app-soft">{owner.full_name}</p> : null}
                  </div>

                  <div className="text-sm">
                    <p className="text-app-muted">Plan</p>
                    <p className="font-medium text-app">
                      {PLAN_LABELS[company.subscription_plan ?? ""] ?? "Sin plan"} · {cycleLabel(company.subscription_billing_cycle)}
                    </p>
                  </div>

                  <div className="text-sm">
                    <p className="text-app-muted">Estado</p>
                    <p className="font-medium text-app">
                      {STATUS_LABELS[company.subscription_status ?? ""] ?? company.subscription_status ?? "Sin estado"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-app-muted sm:grid-cols-4 lg:grid-cols-2">
                    <p>Inicio<br /><span className="font-medium text-app">{formatShortDate(company.current_period_starts_at)}</span></p>
                    <p>Trial<br /><span className="font-medium text-app">{formatShortDate(company.trial_ends_at)}</span></p>
                    <p>Renueva<br /><span className="font-medium text-app">{formatShortDate(company.current_period_ends_at)}</span></p>
                    <p>Creada<br /><span className="font-medium text-app">{formatShortDate(company.created_at)}</span></p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <AdminPagination basePath="/admin/subscribers" params={{ q: search, status }} page={page} total={total} />
    </div>
  );
}
