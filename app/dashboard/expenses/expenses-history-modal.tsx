"use client";

import { useEffect, useMemo, useState, useDeferredValue, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ConfirmSubmitButton } from "../../../components/confirm-submit-button";
import { EditExpenseModal } from "./edit-expense-modal";
import { ExpenseDetailModal } from "./expense-detail-modal";
import { formatShortDate, formatTime } from "../../../lib/date-format";
import { formatCurrency } from "../../../lib/currency-format";
import type { Expense } from "./types";

type ExpensesHistoryModalProps = {
  expenses: Expense[];
  from: string;
  to: string;
  deleteExpenseAction: (formData: FormData) => void | Promise<void>;
  canEditManualDates?: boolean;
  canManageRecords?: boolean;
  trigger?: ReactNode;
};

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
    default: return value || "Efectivo";
  }
}

function formatStatusLabel(value: string | null | undefined) {
  return (value ?? "paid").toLowerCase() === "pending" ? "Pendiente" : "Pagado";
}

function formatExpenseTime(value: string | null | undefined) {
  return formatTime(value, "");
}

function getPaymentMethodChipClass(value: string | null | undefined) {
  switch ((value ?? "").toLowerCase()) {
    case "cash":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300";
    case "card":
      return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-300";
    case "transfer":
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300";
    case "yappy":
      return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/25 dark:bg-fuchsia-500/10 dark:text-fuchsia-300";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";
  }
}

function getCategoryChipClass(value: string | null | undefined) {
  switch ((value ?? "").toLowerCase()) {
    case "inventory":
      return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-300";
    case "transport":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300";
    case "services":
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300";
    case "payroll":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300";
    case "rent":
      return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300";
    case "marketing":
      return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/25 dark:bg-fuchsia-500/10 dark:text-fuchsia-300";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";
  }
}

function getStatusChipClass(value: string | null | undefined) {
  return (value ?? "paid").toLowerCase() === "pending"
    ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-200"
    : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200";
}

const panelClass =
  "rounded-[28px] border border-slate-200/90 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-900/95 dark:shadow-[0_24px_80px_rgba(2,6,23,0.50)]";

const cardClass =
  "rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)] transition-colors hover:border-sky-200/80 dark:border-slate-700 dark:bg-slate-950/70 dark:shadow-none dark:hover:border-cyan-400/25";

const chipBase =
  "inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em]";

const defaultTriggerClass =
  "rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition-colors duration-150 hover:border-sky-300 hover:bg-sky-100 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-200 dark:hover:bg-cyan-400/15";

const labelClass =
  "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-300";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 transition-all duration-150 focus:border-sky-200 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:[color-scheme:dark] dark:focus:border-cyan-400 dark:focus:ring-cyan-500/10";

const primaryButtonClass =
  "rounded-xl border border-sky-600 bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-sky-700 dark:border-cyan-500 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400";

const secondaryButtonClass =
  "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-100";

const dateInputClass =
  "w-full rounded-xl border border-slate-200/70 bg-white/85 px-4 py-2.5 text-slate-900 outline-none backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] placeholder:text-slate-400 transition-all duration-150 focus:border-sky-300 focus:ring-2 focus:ring-sky-100/80 dark:border-white/10 dark:bg-white/[0.07] dark:text-slate-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:placeholder:text-slate-500 dark:[color-scheme:dark] dark:focus:border-cyan-400/60 dark:focus:ring-cyan-500/10";

export function ExpensesHistoryModal({
  expenses,
  from,
  to,
  deleteExpenseAction,
  canEditManualDates = false,
  canManageRecords = true,
  trigger,
}: ExpensesHistoryModalProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [draftFrom, setDraftFrom] = useState(from ?? "");
  const [draftTo, setDraftTo] = useState(to ?? "");
  const [appliedFrom, setAppliedFrom] = useState(from ?? "");
  const [appliedTo, setAppliedTo] = useState(to ?? "");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending">("all");

  function openModal() {
    setSearch("");
    setDraftFrom(from ?? "");
    setDraftTo(to ?? "");
    setAppliedFrom(from ?? "");
    setAppliedTo(to ?? "");
    setStatusFilter("all");
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const scrollContainer = document.querySelector<HTMLElement>("[data-scroll-container]");

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    if (scrollContainer) scrollContainer.style.overflowY = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      if (scrollContainer) scrollContainer.style.overflowY = "";
    };
  }, [open]);

  const closeModal = () => setOpen(false);

  const handleApplyFilters = () => {
    setAppliedFrom(draftFrom);
    setAppliedTo(draftTo);
  };

  const handleClearFilters = () => {
    setSearch("");
    setDraftFrom("");
    setDraftTo("");
    setAppliedFrom("");
    setAppliedTo("");
  };

  const filteredExpenses = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    return expenses.filter((expense) => {
      const expenseDate = expense.expense_date ?? "";
      const matchesFrom = !appliedFrom || expenseDate >= appliedFrom;
      const matchesTo = !appliedTo || expenseDate <= appliedTo;
      const matchesStatus =
        statusFilter === "all" || (expense.status ?? "paid").toLowerCase() === statusFilter;

      const searchableText = [
        expense.expense_date,
        expense.expense_number ?? "",
        expense.supplier ?? "",
        expense.note ?? "",
        formatCategoryLabel(expense.category),
        formatPaymentMethodLabel(expense.payment_method),
        formatStatusLabel(expense.status),
      ].join(" ").toLowerCase();

      return matchesFrom && matchesTo && matchesStatus && (!query || searchableText.includes(query));
    });
  }, [expenses, deferredSearch, appliedFrom, appliedTo, statusFilter]);

  const rangeLabel = useMemo(() => {
    if (appliedFrom && appliedTo) return `Rango: ${appliedFrom} a ${appliedTo}`;
    if (appliedFrom) return `Desde: ${appliedFrom}`;
    if (appliedTo) return `Hasta: ${appliedTo}`;
    return "Mostrando todos los gastos";
  }, [appliedFrom, appliedTo]);

  const modalContent =
    open
      ? createPortal(
          <div className="fixed inset-0 z-[999]">
            <button
              type="button"
              aria-label="Cerrar modal"
              className="absolute inset-0 bg-white/30 backdrop-blur-[2px] dark:bg-slate-950/75 dark:backdrop-blur-sm"
              onClick={closeModal}
            />

            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className={`${panelClass} relative flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden`}>

                {/* Header */}
                <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-sky-700 dark:text-cyan-300">
                        Historial completo
                      </p>
                      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                        Gastos
                      </h2>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {rangeLabel}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={closeModal}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-colors duration-150 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100"
                      aria-label="Cerrar historial"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Filtros */}
                  <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_170px_170px_auto_auto]">
                    <div>
                      <label className={labelClass}>Buscar</label>
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Proveedor, categoría, nota..."
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Desde</label>
                      <input
                        type="date"
                        value={draftFrom}
                        onChange={(e) => setDraftFrom(e.target.value)}
                        className={dateInputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Hasta</label>
                      <input
                        type="date"
                        value={draftTo}
                        onChange={(e) => setDraftTo(e.target.value)}
                        className={dateInputClass}
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleApplyFilters}
                        className={`${primaryButtonClass} w-full`}
                      >
                        Aplicar filtros
                      </button>
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className={`${secondaryButtonClass} w-full`}
                      >
                        Limpiar
                      </button>
                    </div>
                  </div>

                  {/* Filtro de estado */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(["all", "paid", "pending"] as const).map((s) => {
                      const labels = { all: "Todos", paid: "Pagados", pending: "Pendientes" };
                      const active = statusFilter === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStatusFilter(s)}
                          className={[
                            "rounded-xl border px-3 py-1.5 text-xs font-medium transition",
                            active
                              ? "border-sky-500 bg-sky-500 text-white dark:border-cyan-500 dark:bg-cyan-500 dark:text-slate-950"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
                          ].join(" ")}
                        >
                          {labels[s]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Lista */}
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                  {filteredExpenses.length > 0 ? (
                    <div className="grid gap-3">
                      {filteredExpenses.map((expense) => {
                        const amount = Number(expense.amount ?? 0);
                        const timeStr = formatExpenseTime(expense.created_at);

                        return (
                          <div key={expense.id} className={cardClass}>
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-sky-700/70 dark:text-cyan-300/70">
                                  {expense.expense_number ?? formatCategoryLabel(expense.category)}
                                </p>

                                <p className="mt-1 text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                                  {formatCurrency(amount)}
                                </p>

                                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                  {expense.supplier?.trim() ? expense.supplier : "Sin proveedor"}
                                </p>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {expense.payment_method && (
                                  <span className={`${chipBase} ${getPaymentMethodChipClass(expense.payment_method)}`}>
                                    {formatPaymentMethodLabel(expense.payment_method)}
                                  </span>
                                )}

                                <span className={`${chipBase} ${getCategoryChipClass(expense.category)}`}>
                                  {formatCategoryLabel(expense.category)}
                                </span>

                                <span className={`${chipBase} ${getStatusChipClass(expense.status)}`}>
                                  {formatStatusLabel(expense.status)}
                                </span>

                                {expense.is_recurring ? (
                                  <span className={`${chipBase} border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-300`}>
                                    Recurrente
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                              Fecha: {formatShortDate(expense.expense_date)}
                              {timeStr ? ` · Hora: ${timeStr}` : ""}
                            </p>

                            {expense.note ? (
                              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                {expense.note}
                              </p>
                            ) : null}

                            <div className="mt-3 flex flex-wrap gap-3">
                              <ExpenseDetailModal expense={expense} />
                              {canManageRecords && (
                                <>
                                  <EditExpenseModal
                                    expense={expense}
                                    canEditManualDates={canEditManualDates}
                                  />
                                  <form action={deleteExpenseAction}>
                                    <input type="hidden" name="expenseId" value={expense.id} />
                                    <ConfirmSubmitButton
                                      label="Eliminar"
                                      title="Eliminar gasto"
                                      confirmMessage="¿Seguro que quieres eliminar este gasto? Esta acción no se puede deshacer."
                                      confirmLabel="Sí, eliminar"
                                      className="rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-2 text-sm text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 hover:text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15 dark:hover:text-rose-200"
                                    />
                                  </form>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={cardClass}>
                      <p className="text-slate-600 dark:text-slate-300">
                        No se encontraron gastos con esos filtros.
                      </p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {trigger ? (
        <div
          role="button"
          tabIndex={0}
          className="cursor-pointer"
          onClick={openModal}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openModal(); }
          }}
        >
          {trigger}
        </div>
      ) : (
        <button type="button" onClick={openModal} className={defaultTriggerClass}>
          Ver historial
        </button>
      )}
      {modalContent}
    </>
  );
}
