import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "../../../lib/supabase/server";
import { deleteExpense } from "./actions";
import { fetchActivePaymentMethods } from "../sales/actions";
import { ConfirmSubmitButton } from "../../../components/confirm-submit-button";
import { CreateExpenseForm } from "./create-expense-form";
import { EditExpenseModal } from "./edit-expense-modal";
import { ExpenseDetailModal } from "./expense-detail-modal";
import { ExpensesHistoryModal } from "./expenses-history-modal";
import { formatShortDate } from "../../../lib/date-format";
import { formatCurrency } from "../../../lib/currency-format";
import {
  SPECIAL_ADMIN_RELATED_ID,
  canEditManualTransactionDates,
} from "../../../lib/admin-auth";
import type { AmountRow, Expense } from "./types";

function sumAmount(items: AmountRow[]) {
  return items.reduce((total, item) => total + Number(item.amount ?? 0), 0);
}

function getPanamaDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Panama",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return {
    year,
    month,
    day,
    iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

function getMonthStart() {
  const { year, month } = getPanamaDateParts();
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function formatCategoryLabel(value: string | null | undefined) {
  switch ((value ?? "").toLowerCase()) {
    case "inventory": return "Inventario";
    case "transport": return "Transporte";
    case "services": return "Servicios";
    case "payroll": return "Planilla";
    case "rent": return "Alquiler";
    case "marketing": return "Marketing";
    case "other": return "Otro";
    default: return value || "Sin categoría";
  }
}

function formatPaymentMethodLabel(value: string | null | undefined) {
  switch ((value ?? "").toLowerCase()) {
    case "cash": return "Efectivo";
    case "card": return "Tarjeta";
    case "transfer": return "Transferencia";
    case "yappy": return "Yappy";
    case "other": return "Otro";
    default: return value || "Efectivo";
  }
}

function formatStatusLabel(value: string | null | undefined) {
  return (value ?? "paid").toLowerCase() === "pending" ? "Pendiente" : "Pagado";
}

function getStatusBadgeClass(value: string | null | undefined) {
  return (value ?? "paid").toLowerCase() === "pending"
    ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-200"
    : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200";
}

const shellClass =
  "min-h-full px-2 py-2 text-app sm:px-3 sm:py-3";

const containerClass =
  "mx-auto flex w-full max-w-7xl flex-col gap-3";

const heroClass =
  "app-card rounded-[24px] px-5 py-4";

const panelClass =
  "app-card rounded-[24px] p-4";

const statCardClass =
  "rounded-[20px] border border-slate-200 bg-white px-5 py-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)] dark:border-slate-700 dark:bg-slate-950/70 dark:shadow-none";

const expenseCardClass =
  "rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition-colors hover:border-sky-200/80 dark:border-slate-700 dark:bg-slate-950/70 dark:shadow-none dark:hover:border-cyan-400/30";

export default async function ExpensesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const cookieStore = await cookies();
  const activeCompanyId = cookieStore.get("active_company_id")?.value ?? null;

  const membershipQuery = supabase
    .from("memberships")
    .select("company_id, role, companies(owner_user_id)")
    .eq("user_id", user.id);

  const { data: membership } = await (
    activeCompanyId
      ? membershipQuery.eq("company_id", activeCompanyId)
      : membershipQuery.limit(1)
  ).maybeSingle();

  if (!membership) redirect("/onboarding");
  const role = String(membership.role ?? "").toLowerCase();
  const canManageRecords = ["owner", "admin"].includes(role);

  const { data: specialAdminMembership } = await supabase
    .from("memberships")
    .select("company_id")
    .eq("company_id", membership.company_id)
    .eq("user_id", SPECIAL_ADMIN_RELATED_ID)
    .maybeSingle();
  const canEditManualDates = canEditManualTransactionDates({
    email: user.email,
    userId: user.id,
    companyId: membership.company_id,
    companyOwnerUserId:
      (membership.companies as { owner_user_id?: string | null } | null)?.owner_user_id ?? null,
    hasSpecialAdminMembership: Boolean(specialAdminMembership?.company_id),
  });

  const today = getPanamaDateParts().iso;
  const monthStart = getMonthStart();

  const [{ data: monthlyExpenses }, { data }, paymentMethods] = await Promise.all([
    supabase
      .from("expenses")
      .select("amount")
      .eq("company_id", membership.company_id)
      .gte("expense_date", monthStart)
      .lte("expense_date", today),
    supabase
      .from("expenses")
      .select("*")
      .eq("company_id", membership.company_id)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
    fetchActivePaymentMethods(membership.company_id),
  ]);

  const expenses: Expense[] = (data ?? []) as Expense[];
  const totalMonth = sumAmount((monthlyExpenses ?? []) as AmountRow[]);
  const recentExpenses = expenses.slice(0, 5);

  return (
    <div className={shellClass}>
      <div className={containerClass}>

        {/* Hero */}
        <section className={heroClass}>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-sky-700 dark:text-cyan-300">
                Módulo de gastos
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50 md:text-3xl">
                Registra y consulta tus gastos
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Lleva control de cada egreso, con categoría, proveedor y método de pago.
              </p>
            </div>

            <div className={statCardClass}>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Total del mes
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                {formatCurrency(totalMonth)}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Gastos acumulados este mes.
              </p>
            </div>
          </div>
        </section>

        {/* Columns */}
        <section className="grid gap-3 xl:grid-cols-[440px_minmax(0,1fr)] xl:items-start">

          {/* Create form */}
          <div className={`${panelClass} self-start`}>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Registrar gasto
            </h2>
            <div className="mt-1 [&_label]:text-sm">
              <CreateExpenseForm
                today={today}
                paymentMethods={paymentMethods}
                canEditManualDates={canEditManualDates}
              />
            </div>
          </div>

          {/* Activity panel */}
          <div className={`${panelClass} flex min-h-80 flex-col overflow-hidden`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-sky-700 dark:text-cyan-300">
                  Gastos recientes
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                  Actividad
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Últimos 5 gastos registrados.
                </p>
              </div>

              <ExpensesHistoryModal
                expenses={expenses}
                from={monthStart}
                to={today}
                deleteExpenseAction={deleteExpense}
                canEditManualDates={canEditManualDates}
                canManageRecords={canManageRecords}
              />
            </div>

            {/* Expense cards */}
            <div className="mt-3 flex-1 overflow-y-auto pr-1">
              <div className="grid gap-3">
                {recentExpenses.length > 0 ? (
                  recentExpenses.map((expense) => {
                    const amount = Number(expense.amount ?? 0);
                    return (
                      <div key={expense.id} className={expenseCardClass}>
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-sky-700/70 dark:text-cyan-300/80">
                              {expense.expense_number ?? formatCategoryLabel(expense.category)}
                            </p>
                            <p className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                              {formatCurrency(amount)}
                            </p>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                              {expense.supplier?.trim() ? expense.supplier : "Sin proveedor"}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                              {formatPaymentMethodLabel(expense.payment_method)}
                            </span>
                            <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${getStatusBadgeClass(expense.status)}`}>
                              {formatStatusLabel(expense.status)}
                            </span>
                            {expense.is_recurring ? (
                              <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-violet-700 dark:border-violet-400/25 dark:bg-violet-500/10 dark:text-violet-200">
                                Recurrente
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                          Fecha: {formatShortDate(expense.expense_date)}
                        </p>

                        {expense.note ? (
                          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                            {expense.note}
                          </p>
                        ) : null}

                        <div className="mt-3 flex flex-wrap gap-3">
                          <ExpenseDetailModal expense={expense} />
                          {canManageRecords && (
                            <>
                              <EditExpenseModal
                                expense={expense}
                                paymentMethods={paymentMethods}
                                canEditManualDates={canEditManualDates}
                              />
                              <form action={deleteExpense}>
                                <input type="hidden" name="expenseId" value={expense.id} />
                                <ConfirmSubmitButton
                                  label="Eliminar"
                                  confirmMessage="¿Seguro que quieres eliminar este gasto?"
                                  className="rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-2 text-sm text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 hover:text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15 dark:hover:text-rose-200"
                                />
                              </form>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={expenseCardClass}>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Aún no hay gastos registrados.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
