import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "../../../lib/supabase/server";
import { CreateClosureModal } from "./create-closure-modal";
import { formatShortDate } from "../../../lib/date-format";
import { formatCurrency } from "../../../lib/currency-format";
import type { PeriodClosure, ClosureStatus } from "./types";

function formatDate(iso: string) {
  return formatShortDate(iso);
}

function periodLabel(c: PeriodClosure) {
  if (c.label) return c.label;
  const s = new Date(c.period_start + "T12:00:00");
  const e = new Date(c.period_end + "T12:00:00");
  const fmt = (d: Date) =>
    d.toLocaleDateString("es-PA", { month: "short", year: "numeric", timeZone: "America/Panama" });
  return `${fmt(s)} – ${fmt(e)}`;
}

const STATUS_MAP: Record<ClosureStatus, { label: string; dot: string; chip: string }> = {
  draft: {
    label: "Nuevo",
    dot: "bg-slate-400",
    chip: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  in_review: {
    label: "Casi listo",
    dot: "bg-sky-500",
    chip: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/25 dark:bg-sky-500/10 dark:text-sky-200",
  },
  has_issues: {
    label: "Con pendientes",
    dot: "bg-amber-500",
    chip: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-200",
  },
  ready_for_accountant: {
    label: "Listo para contador",
    dot: "bg-emerald-500",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200",
  },
  closed: {
    label: "Cerrado",
    dot: "bg-violet-500",
    chip: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/25 dark:bg-violet-500/10 dark:text-violet-200",
  },
};

const shellClass =
  "min-h-full bg-[radial-gradient(circle_at_top,_rgba(125,211,252,0.12),_transparent_28%),linear-gradient(180deg,#f8fbff_0%,#f6f8fc_100%)] px-2 py-2 text-slate-900 dark:bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.08),_transparent_24%),linear-gradient(180deg,#020617_0%,#0b1220_100%)] dark:text-slate-100 sm:px-3 sm:py-3";
const containerClass = "mx-auto flex w-full max-w-3xl flex-col gap-3";

export default async function CierrePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const cookieStore = await cookies();
  const activeCompanyId = cookieStore.get("active_company_id")?.value ?? null;

  const membershipQuery = supabase
    .from("memberships")
    .select("company_id, role")
    .eq("user_id", user.id);

  const { data: membership } = await (
    activeCompanyId
      ? membershipQuery.eq("company_id", activeCompanyId)
      : membershipQuery.limit(1)
  ).maybeSingle();

  if (!membership?.company_id) redirect("/onboarding");

  const canManage = ["owner", "admin"].includes(
    String(membership.role ?? "").toLowerCase()
  );

  const { data } = await supabase
    .from("period_closures")
    .select("*")
    .eq("company_id", membership.company_id)
    .order("created_at", { ascending: false })
    .limit(20);

  const closures: PeriodClosure[] = (data ?? []) as PeriodClosure[];

  return (
    <div className={shellClass}>
      <div className={containerClass}>
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-1 pt-1">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
              Cierre del período
            </h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Prepara tu información para el contador
            </p>
          </div>
          {canManage && <CreateClosureModal />}
        </div>

        {closures.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center dark:border-slate-700 dark:bg-slate-950/30">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-slate-400 dark:text-slate-500" aria-hidden="true">
                <rect x="4" y="5" width="16" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
                <path d="M8 3V6M16 3V6M4 10H20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-[15px] font-medium text-slate-700 dark:text-slate-200">
              Aún no tienes períodos registrados
            </p>
            <p className="mt-1.5 text-sm text-slate-400 dark:text-slate-500">
              {canManage
                ? "Inicia un período para documentar tus ventas y gastos."
                : "El administrador puede crear el primer período."}
            </p>
            {canManage && (
              <div className="mt-5 flex justify-center">
                <CreateClosureModal />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {closures.map((closure) => {
              const snap = closure.snapshot;
              const { label: statusLabel, dot, chip } = STATUS_MAP[closure.status];
              return (
                <Link
                  key={closure.id}
                  href={`/dashboard/cierre/${closure.id}`}
                  className="group flex flex-col rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.07)] dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                        {closure.period_months} meses · {formatDate(closure.period_start)} – {formatDate(closure.period_end)}
                      </p>
                      <p className="mt-1 truncate text-[15px] font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                        {periodLabel(closure)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${chip}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                      {statusLabel}
                    </span>
                  </div>

                  {snap ? (
                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 sm:gap-3 dark:border-slate-800">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          Ventas
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {formatCurrency(snap.totals.sales)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          Gastos
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {formatCurrency(snap.totals.expenses)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          Neto
                        </p>
                        <p
                          className={`mt-0.5 text-sm font-semibold ${snap.totals.net >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
                        >
                          {formatCurrency(snap.totals.net)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2.5 border-t border-slate-100 pt-2.5 text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
                      Aún no revisado
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
