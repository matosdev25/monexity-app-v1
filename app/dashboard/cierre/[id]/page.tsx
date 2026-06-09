import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "../../../../lib/supabase/server";
import { ReopenModal } from "./reopen-modal";
import { ConfirmSubmitButton } from "../../../../components/confirm-submit-button";
import { formatShortDate } from "../../../../lib/date-format";
import { formatCurrency } from "../../../../lib/currency-format";
import {
  validateClosure,
  resolveIssue,
  ignoreIssue,
  markReadyForAccountant,
  closePeriod,
} from "../actions";
import type { PeriodClosure, ClosureIssue, ClosureStatus } from "../types";

function formatDate(iso: string) {
  return formatShortDate(iso);
}

function periodLabel(c: PeriodClosure) {
  if (c.label) return c.label;
  const s = new Date(c.period_start + "T12:00:00");
  const e = new Date(c.period_end + "T12:00:00");
  const fmt = (d: Date) =>
    d.toLocaleDateString("es-PA", {
      month: "short",
      year: "numeric",
      timeZone: "America/Panama",
    });
  return `${fmt(s)} – ${fmt(e)}`;
}

function formatCategoryLabel(v: string | null) {
  const map: Record<string, string> = {
    inventory: "Inventario",
    transport: "Transporte",
    services: "Servicios",
    payroll: "Planilla",
    rent: "Alquiler",
    marketing: "Marketing",
    other: "Otro",
  };
  return v ? (map[v] ?? v) : "Sin categoría";
}

// ─── Status copy ──────────────────────────────────────────────────────────────

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

const STATUS_HEADLINE: Record<ClosureStatus, string> = {
  draft: "Período sin revisar",
  in_review: "Tu período ya casi está listo",
  has_issues: "Hay cosas que corregir",
  ready_for_accountant: "¡Todo listo para tu contador!",
  closed: "Período cerrado",
};

const STATUS_SUB: Record<ClosureStatus, string> = {
  draft: "Revísalo para ver si falta algo antes de cerrar.",
  in_review: "Sin errores. Verifica los detalles y márcalo como listo.",
  has_issues: "Corrige estos puntos para poder continuar.",
  ready_for_accountant: "Puedes cerrar este período cuando quieras.",
  closed: "Este período ya está archivado y no acepta cambios.",
};

// ─── Shared classes ───────────────────────────────────────────────────────────

const shellClass =
  "min-h-full bg-[radial-gradient(circle_at_top,_rgba(125,211,252,0.12),_transparent_28%),linear-gradient(180deg,#f8fbff_0%,#f6f8fc_100%)] px-2 py-2 pb-24 text-slate-900 dark:bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.08),_transparent_24%),linear-gradient(180deg,#020617_0%,#0b1220_100%)] dark:text-slate-100 sm:px-3 sm:py-3 sm:pb-3";
const containerClass = "mx-auto flex w-full max-w-3xl flex-col gap-4";
const cardClass =
  "rounded-[24px] border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-900";
const sectionTitleClass =
  "mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500";

// ─── Page ─────────────────────────────────────────────────────────────────────

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CierreDetailPage({ params }: Props) {
  const { id } = await params;

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

  const { data: closureRaw } = await supabase
    .from("period_closures")
    .select("*")
    .eq("id", id)
    .eq("company_id", membership.company_id)
    .maybeSingle();

  if (!closureRaw) notFound();

  const closure = closureRaw as PeriodClosure;
  const snap = closure.snapshot;
  const cid = membership.company_id;
  const isReadOnly = closure.status === "closed";

  const { data: company } = await supabase
    .from("companies")
    .select("name, needs_inventory")
    .eq("id", cid)
    .maybeSingle();

  const needsInventory = Boolean(company?.needs_inventory);

  // ── Load all data in parallel ───────────────────────────────────────────────

  const [
    { data: issuesRaw },
    { data: salesData },
    { data: expensesData },
    { data: productsData },
  ] = await Promise.all([
    supabase
      .from("period_closure_issues")
      .select("*")
      .eq("closure_id", id)
      .is("resolved_at", null)
      .is("ignored_at", null)
      .order("severity", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("sales")
      .select(
        "id, customer_name, sale_date, amount, paid_amount, balance_due, payment_status, payment_type"
      )
      .eq("company_id", cid)
      .gte("sale_date", closure.period_start)
      .lte("sale_date", closure.period_end)
      .order("sale_date", { ascending: false }),
    supabase
      .from("expenses")
      .select("id, expense_date, amount, category, supplier, status, receipt_url")
      .eq("company_id", cid)
      .gte("expense_date", closure.period_start)
      .lte("expense_date", closure.period_end)
      .order("expense_date", { ascending: false }),
    needsInventory
      ? supabase
          .from("products")
          .select("id, name, stock, min_stock, price, track_inventory")
          .eq("company_id", cid)
          .eq("track_inventory", true)
          .order("stock", { ascending: true })
      : Promise.resolve({ data: [] as unknown as null }),
  ]);

  type SaleRow = {
    id: string;
    customer_name: string | null;
    sale_date: string;
    amount: string | number | null;
    paid_amount: string | number | null;
    balance_due: string | number | null;
    payment_status: string | null;
    payment_type: string | null;
  };
  type ExpenseRow = {
    id: string;
    expense_date: string;
    amount: string | number | null;
    category: string | null;
    supplier: string | null;
    status: string | null;
    receipt_url: string | null;
  };
  type ProductRow = {
    id: string;
    name: string;
    stock: number;
    min_stock: number | null;
    price: number;
    track_inventory: boolean;
  };

  const issues: ClosureIssue[] = (issuesRaw ?? []) as ClosureIssue[];
  const sales: SaleRow[] = (salesData ?? []) as SaleRow[];
  const expenses: ExpenseRow[] = (expensesData ?? []) as ExpenseRow[];
  const products: ProductRow[] = (productsData ?? []) as ProductRow[];

  const openReceivables = sales.filter((s) =>
    ["pending", "partial", "overdue"].includes(s.payment_status ?? "")
  );
  const expensesNoReceipt = expenses.filter((e) => !e.receipt_url);

  const activeErrors = issues.filter((i) => i.severity === "error");
  const hasBlockingErrors = activeErrors.length > 0;
  const { label: statusLabel, dot, chip } = STATUS_MAP[closure.status];

  // ── Primary CTA for sticky bar ──────────────────────────────────────────────

  let stickyAction: "validate" | "mark_ready" | "close" | null = null;
  let stickyLabel = "";
  if (canManage && !isReadOnly) {
    if (closure.status === "draft" || closure.status === "has_issues") {
      stickyAction = "validate";
      stickyLabel = closure.status === "draft" ? "Revisar período" : "Volver a revisar";
    } else if (closure.status === "in_review" && !hasBlockingErrors) {
      stickyAction = "mark_ready";
      stickyLabel = "Marcar como listo";
    } else if (closure.status === "ready_for_accountant") {
      stickyAction = "close";
      stickyLabel = "Cerrar período";
    }
  }

  return (
    <div className={shellClass}>
      <div className={containerClass}>
        {/* Back link */}
        <Link
          href="/dashboard/cierre"
          className="inline-flex w-fit items-center gap-1.5 text-[13px] text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Todos los cierres
        </Link>

        {/* Header card */}
        <div className={cardClass}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${chip}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                {statusLabel}
              </span>
              <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50 sm:text-2xl">
                {periodLabel(closure)}
              </h1>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {formatDate(closure.period_start)} – {formatDate(closure.period_end)} · {closure.period_months} meses
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
            <p
              className={`text-[15px] font-semibold ${
                closure.status === "has_issues"
                  ? "text-amber-700 dark:text-amber-300"
                  : closure.status === "ready_for_accountant"
                    ? "text-emerald-700 dark:text-emerald-400"
                    : closure.status === "in_review"
                      ? "text-sky-700 dark:text-sky-300"
                      : "text-slate-700 dark:text-slate-200"
              }`}
            >
              {STATUS_HEADLINE[closure.status]}
            </p>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {STATUS_SUB[closure.status]}
            </p>
          </div>

          {closure.reopen_reason && (
            <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
              Reabierto: {closure.reopen_reason}
            </p>
          )}
        </div>

        {/* KPI cards */}
        {snap && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                Ventas
              </p>
              <p className="mt-1 text-lg font-bold tracking-tight text-slate-950 dark:text-slate-50">
                {formatCurrency(snap.totals.sales)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                {snap.counts.sales_total} registros
              </p>
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                Gastos
              </p>
              <p className="mt-1 text-lg font-bold tracking-tight text-slate-950 dark:text-slate-50">
                {formatCurrency(snap.totals.expenses)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                {snap.counts.expenses_total} registros
              </p>
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                Neto
              </p>
              <p
                className={`mt-1 text-lg font-bold tracking-tight ${snap.totals.net >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
              >
                {formatCurrency(snap.totals.net)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                ventas − gastos
              </p>
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                Por cobrar
              </p>
              <p className="mt-1 text-lg font-bold tracking-tight text-slate-950 dark:text-slate-50">
                {formatCurrency(snap.totals.receivables_open)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                {snap.counts.sales_pending} sin cobrar
              </p>
            </div>
          </div>
        )}

        {/* Issues checklist */}
        {issues.length > 0 && (
          <div className={cardClass}>
            <p className={sectionTitleClass}>
              {activeErrors.length > 0
                ? `${activeErrors.length} error${activeErrors.length > 1 ? "es" : ""} que bloquean el cierre`
                : "Advertencias"}
            </p>
            <div className="flex flex-col gap-2">
              {issues.map((issue) => {
                const isError = issue.severity === "error";
                return (
                  <div
                    key={issue.id}
                    className={`rounded-2xl border p-4 ${
                      isError
                        ? "border-rose-200 bg-rose-50 dark:border-rose-400/20 dark:bg-rose-500/10"
                        : "border-amber-200 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-500/10"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          isError
                            ? "bg-rose-500 text-white"
                            : "bg-amber-500 text-white"
                        }`}
                      >
                        {isError ? "!" : "~"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium ${isError ? "text-rose-800 dark:text-rose-200" : "text-amber-800 dark:text-amber-200"}`}
                        >
                          {issue.message}
                        </p>
                        {canManage && !isReadOnly && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <form action={resolveIssue} className="inline">
                              <input type="hidden" name="issueId" value={issue.id} />
                              <input type="hidden" name="closureId" value={id} />
                              <button
                                type="submit"
                                className="inline-flex h-7 items-center rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-slate-100"
                              >
                                Ya lo corregí
                              </button>
                            </form>
                            {!isError && (
                              <form action={ignoreIssue} className="inline">
                                <input type="hidden" name="issueId" value={issue.id} />
                                <input type="hidden" name="closureId" value={id} />
                                <button
                                  type="submit"
                                  className="inline-flex h-7 items-center rounded-xl border border-transparent px-3 text-[12px] text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                                >
                                  Ignorar
                                </button>
                              </form>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Validate / mark ready / close actions — inline for desktop */}
        {canManage && !isReadOnly && (
          <div className={`hidden sm:block ${cardClass}`}>
            <p className={sectionTitleClass}>Acciones</p>
            <div className="flex flex-wrap gap-2">
              {(closure.status === "draft" || closure.status === "has_issues" || closure.status === "in_review") && (
                <form action={validateClosure}>
                  <input type="hidden" name="closureId" value={id} />
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center rounded-2xl bg-sky-600 px-5 text-sm font-medium text-white transition hover:bg-sky-700 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
                  >
                    {closure.status === "draft" ? "Revisar período" : "Volver a revisar"}
                  </button>
                </form>
              )}
              {closure.status === "in_review" && !hasBlockingErrors && (
                <form action={markReadyForAccountant}>
                  <input type="hidden" name="closureId" value={id} />
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center rounded-2xl border border-emerald-200 bg-emerald-50 px-5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
                  >
                    Marcar como listo para contador
                  </button>
                </form>
              )}
              {closure.status === "ready_for_accountant" && (
                <>
                  <form action={closePeriod}>
                    <input type="hidden" name="closureId" value={id} />
                    <ConfirmSubmitButton
                      label="Cerrar período"
                      pendingLabel="Cerrando..."
                      confirmMessage="¿Confirmas que quieres cerrar este período? Esta acción archivará los datos."
                      className="inline-flex h-10 items-center rounded-2xl bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                    />
                  </form>
                  <ReopenModal closureId={id} />
                </>
              )}
            </div>
          </div>
        )}

        {canManage && isReadOnly && (
          <div className={`hidden sm:flex items-center gap-3 ${cardClass}`}>
            <p className="flex-1 text-sm text-slate-500 dark:text-slate-400">
              Período archivado.{" "}
              {closure.closed_at
                ? `Cerrado el ${formatDate(closure.closed_at.split("T")[0])}.`
                : ""}
            </p>
            <ReopenModal closureId={id} />
          </div>
        )}

        {/* Ventas del período */}
        <div className={cardClass}>
          <p className={sectionTitleClass}>
            Ventas del período{snap ? ` · ${snap.counts.sales_total} registros` : ""}
          </p>
          {sales.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">
              No hay ventas registradas en este período.
            </p>
          ) : (
            <>
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                {sales.slice(0, 15).map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-slate-800 dark:text-slate-200">
                        {s.customer_name ?? "Sin cliente"}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        {formatDate(s.sale_date)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">
                        {formatCurrency(s.amount)}
                      </p>
                      <p
                        className={`text-[11px] ${
                          s.payment_status === "paid"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : s.payment_status === "overdue"
                              ? "text-rose-500 dark:text-rose-400"
                              : "text-amber-500 dark:text-amber-400"
                        }`}
                      >
                        {s.payment_status === "paid"
                          ? "Pagada"
                          : s.payment_status === "partial"
                            ? "Abonada"
                            : s.payment_status === "overdue"
                              ? "Vencida"
                              : "Pendiente"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {sales.length > 15 && (
                <p className="mt-2 text-center text-xs text-slate-400 dark:text-slate-500">
                  +{sales.length - 15} ventas más
                </p>
              )}
              {snap && (
                <div className="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-2.5 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total ventas</p>
                  <p className="text-sm font-bold text-slate-950 dark:text-slate-50">
                    {formatCurrency(snap.totals.sales)}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Gastos del período */}
        <div className={cardClass}>
          <p className={sectionTitleClass}>
            Gastos del período{snap ? ` · ${snap.counts.expenses_total} registros` : ""}
          </p>
          {expenses.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">
              No hay gastos registrados en este período.
            </p>
          ) : (
            <>
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                {expenses.slice(0, 15).map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-slate-800 dark:text-slate-200">
                        {e.supplier ?? "Sin proveedor"}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        {formatDate(e.expense_date)} · {formatCategoryLabel(e.category)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">
                        {formatCurrency(e.amount)}
                      </p>
                      {!e.receipt_url && (
                        <p className="text-[11px] text-amber-500 dark:text-amber-400">
                          Sin comprobante
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {expenses.length > 15 && (
                <p className="mt-2 text-center text-xs text-slate-400 dark:text-slate-500">
                  +{expenses.length - 15} gastos más
                </p>
              )}
              {snap && (
                <div className="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-2.5 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total gastos</p>
                  <p className="text-sm font-bold text-slate-950 dark:text-slate-50">
                    {formatCurrency(snap.totals.expenses)}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Cobros pendientes */}
        {openReceivables.length > 0 && (
          <div className={cardClass}>
            <p className={sectionTitleClass}>
              Por cobrar · {openReceivables.length} venta{openReceivables.length > 1 ? "s" : ""}
            </p>
            <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              {openReceivables.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-slate-800 dark:text-slate-200">
                      {s.customer_name ?? "Sin cliente"}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {formatDate(s.sale_date)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[13px] font-semibold text-rose-600 dark:text-rose-400">
                      {formatCurrency(s.balance_due)}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">pendiente</p>
                  </div>
                </div>
              ))}
            </div>
            {snap && (
              <div className="mt-3 flex items-center justify-between rounded-2xl bg-rose-50 px-4 py-2.5 dark:bg-rose-500/10">
                <p className="text-xs text-rose-600 dark:text-rose-400">Total por cobrar</p>
                <p className="text-sm font-bold text-rose-700 dark:text-rose-300">
                  {formatCurrency(snap.totals.receivables_open)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Gastos sin comprobante */}
        {expensesNoReceipt.length > 0 && (
          <div className={cardClass}>
            <p className={sectionTitleClass}>
              Gastos sin comprobante · {expensesNoReceipt.length}
            </p>
            <p className="mb-3 text-sm text-amber-700 dark:text-amber-300">
              Estos gastos no tienen archivo adjunto. Tu contador puede pedirlos.
            </p>
            <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              {expensesNoReceipt.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-slate-800 dark:text-slate-200">
                      {e.supplier ?? "Sin proveedor"}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {formatDate(e.expense_date)} · {formatCategoryLabel(e.category)}
                    </p>
                  </div>
                  <p className="shrink-0 text-[13px] font-semibold text-slate-700 dark:text-slate-300">
                    {formatCurrency(e.amount)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inventario — solo si aplica */}
        {needsInventory && products.length > 0 && (
          <div className={cardClass}>
            <p className={sectionTitleClass}>Inventario · {products.length} productos</p>
            <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              {products.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <p
                    className={`truncate text-[13px] font-medium ${p.stock < 0 ? "text-rose-700 dark:text-rose-400" : "text-slate-800 dark:text-slate-200"}`}
                  >
                    {p.name}
                  </p>
                  <p
                    className={`shrink-0 text-[13px] font-semibold ${p.stock < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-300"}`}
                  >
                    {p.stock} uds
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Exportar */}
        {snap && (
          <div className={cardClass}>
            <p className={sectionTitleClass}>Exportar</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                { href: `/api/cierre/${id}/export?type=pdf_summary`, label: "Resumen PDF" },
                { href: `/api/cierre/${id}/export?type=csv_sales`, label: "Ventas CSV" },
                { href: `/api/cierre/${id}/export?type=csv_expenses`, label: "Gastos CSV" },
                ...(openReceivables.length > 0
                  ? [{ href: `/api/cierre/${id}/export?type=csv_receivables`, label: "Cobros CSV" }]
                  : []),
                ...(needsInventory
                  ? [{ href: `/api/cierre/${id}/export?type=csv_inventory`, label: "Inventario CSV" }]
                  : []),
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden="true">
                    <path d="M12 3V15M12 15L8 11M12 15L16 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 18H20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Reopen — mobile, read-only */}
        {canManage && isReadOnly && (
          <div className="sm:hidden flex items-center justify-between gap-3 rounded-[24px] border border-slate-200/80 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">Período archivado.</p>
            <ReopenModal closureId={id} />
          </div>
        )}
      </div>

      {/* Sticky bottom CTA — mobile only */}
      {stickyAction && canManage && (
        <div className="sticky bottom-0 sm:hidden">
          <div className="mx-2 mb-2 rounded-[20px] border border-slate-200 bg-white/95 p-3 shadow-[0_-4px_24px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)]">
            {stickyAction === "validate" && (
              <form action={validateClosure}>
                <input type="hidden" name="closureId" value={id} />
                <button
                  type="submit"
                  className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-sky-600 text-sm font-semibold text-white transition active:scale-[0.98] dark:bg-cyan-500 dark:text-slate-950"
                >
                  {stickyLabel}
                </button>
              </form>
            )}
            {stickyAction === "mark_ready" && (
              <form action={markReadyForAccountant}>
                <input type="hidden" name="closureId" value={id} />
                <button
                  type="submit"
                  className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-emerald-600 text-sm font-semibold text-white transition active:scale-[0.98]"
                >
                  {stickyLabel}
                </button>
              </form>
            )}
            {stickyAction === "close" && (
              <form action={closePeriod}>
                <input type="hidden" name="closureId" value={id} />
                <ConfirmSubmitButton
                  label={stickyLabel}
                  pendingLabel="Cerrando..."
                  confirmMessage="¿Confirmas que quieres cerrar este período? Esta acción archivará los datos."
                  className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white transition active:scale-[0.98] dark:bg-white dark:text-slate-950"
                />
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
