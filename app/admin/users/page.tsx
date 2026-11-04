import { createAdminClient } from "@/lib/supabase/admin";
import { isGlobalAdminEmail, requireGlobalAdmin } from "@/lib/admin-auth";
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

export const metadata = { title: "Admin — Usuarios" };
export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  owner: "Dueño",
  admin: "Admin",
  seller: "Vendedor",
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  username: string | null;
  phone: string | null;
  created_at: string | null;
};

type MembershipRow = {
  user_id: string;
  role: string | null;
  companies: { name: string | null } | { name: string | null }[] | null;
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireGlobalAdmin();

  const { q = "", page: rawPage } = await searchParams;
  const search = sanitizeSearch(q);
  const page = parsePage(rawPage);
  const from = (page - 1) * ADMIN_PAGE_SIZE;
  const admin = createAdminClient();

  let query = admin
    .from("profiles")
    .select("id, full_name, email, username, phone, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + ADMIN_PAGE_SIZE - 1);

  if (search) {
    query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%,username.ilike.%${search}%`);
  }

  const { data: profilesRaw, count, error: profilesError } = await query;
  const profiles = (profilesRaw ?? []) as ProfileRow[];
  const userIds = profiles.map((profile) => profile.id);

  // Membresías solo de los usuarios de esta página
  const { data: membershipsRaw, error: membershipsError } = userIds.length > 0
    ? await admin.from("memberships").select("user_id, role, companies(name)").in("user_id", userIds)
    : { data: [] as MembershipRow[], error: null };

  const membershipsByUser = new Map<string, { role: string; company: string }[]>();
  for (const membership of (membershipsRaw ?? []) as unknown as MembershipRow[]) {
    const company = Array.isArray(membership.companies) ? membership.companies[0] : membership.companies;
    const list = membershipsByUser.get(membership.user_id) ?? [];
    list.push({
      role: String(membership.role ?? "").toLowerCase(),
      company: company?.name ?? "Empresa sin nombre",
    });
    membershipsByUser.set(membership.user_id, list);
  }

  const total = count ?? 0;
  const loadError = Boolean(profilesError || membershipsError);

  return (
    <div className="space-y-5">
      <form className="app-card grid gap-2 rounded-[24px] p-4 sm:grid-cols-[1fr_auto]">
        <label className="sr-only" htmlFor="admin-user-search">Buscar usuarios</label>
        <input
          id="admin-user-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Buscar por email, nombre o usuario"
          className={adminInputClass}
        />
        <button type="submit" className={adminPrimaryButtonClass}>
          Buscar
        </button>
      </form>

      {loadError ? (
        <AdminErrorState message="Revisa la conexión con Supabase y recarga la página." />
      ) : null}

      <section className="app-card overflow-hidden rounded-[28px]">
        <div className="border-b border-app px-4 py-3 text-sm font-semibold text-app">
          {total} usuario(s)
        </div>

        {profiles.length === 0 && !loadError ? (
          <div className="p-4">
            <AdminEmptyState
              title="No hay usuarios con esta búsqueda"
              description={search ? "Prueba con otro email, nombre o usuario." : undefined}
            />
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-soft)]">
            {profiles.map((profile) => {
              const memberships = membershipsByUser.get(profile.id) ?? [];
              return (
                <div key={profile.id} className="grid min-w-0 gap-3 px-4 py-4 lg:grid-cols-[1.3fr_1.4fr_0.6fr]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-words font-semibold text-app">{profile.full_name || "Sin nombre"}</p>
                      {isGlobalAdminEmail(profile.email) ? (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-cyan-500/15 dark:text-cyan-300">
                          Admin global
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 break-all text-xs text-app-muted">{profile.email ?? "Sin email"}</p>
                    <p className="mt-0.5 text-xs text-app-soft">
                      {profile.username ? `@${profile.username}` : "Sin usuario"}
                      {profile.phone ? ` · ${profile.phone}` : ""}
                    </p>
                  </div>

                  <div className="min-w-0 text-sm">
                    <p className="text-app-muted">Negocios</p>
                    {memberships.length === 0 ? (
                      <p className="font-medium text-amber-600 dark:text-amber-300">Sin negocio (registro incompleto)</p>
                    ) : (
                      <ul className="mt-0.5 space-y-0.5">
                        {memberships.map((membership, index) => (
                          <li key={`${membership.company}-${index}`} className="break-words font-medium text-app">
                            {membership.company}{" "}
                            <span className="text-xs font-normal text-app-muted">
                              · {ROLE_LABELS[membership.role] ?? (membership.role || "Sin rol")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="text-xs text-app-muted">
                    <p>Registro<br /><span className="font-medium text-app">{formatShortDate(profile.created_at)}</span></p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <AdminPagination basePath="/admin/users" params={{ q: search }} page={page} total={total} />
    </div>
  );
}
