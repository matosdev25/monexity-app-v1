"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatShortDate } from "../../../lib/date-format";
import { formatCurrency } from "../../../lib/currency-format";
import type { Expense } from "./types";

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
    default: return "Efectivo";
  }
}

function formatStatusLabel(value: string | null | undefined) {
  switch ((value ?? "paid").toLowerCase()) {
    case "paid": return "Pagado";
    case "pending": return "Pendiente";
    default: return "Pagado";
  }
}

function getStatusClass(value: string | null | undefined) {
  switch ((value ?? "paid").toLowerCase()) {
    case "paid":
      return "text-emerald-700 dark:text-emerald-300";
    case "pending":
      return "text-amber-700 dark:text-amber-300";
    default:
      return "text-slate-700 dark:text-slate-300";
  }
}

export function ExpenseDetailModal({ expense }: { expense: Expense }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const sc = document.querySelector<HTMLElement>("[data-scroll-container]");
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    if (sc) sc.style.overflowY = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      if (sc) sc.style.overflowY = "";
    };
  }, [open]);

  const amount = Number(expense.amount ?? 0);

  const modalContent =
    open
      ? createPortal(
          <div className="fixed inset-0 z-[1000]">
            <button
              type="button"
              aria-label="Cerrar"
              className="absolute inset-0 bg-slate-950/45 dark:bg-black/60"
              onClick={() => setOpen(false)}
            />
            <div className="absolute inset-0 overflow-y-auto overscroll-contain p-4">
              <div className="flex min-h-full items-start justify-center py-8">
                <div className="relative w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">

                  {/* Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        {expense.expense_number ?? formatCategoryLabel(expense.category)}
                      </p>
                      <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                        Detalle de gasto
                      </h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {formatShortDate(expense.expense_date)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-400 transition hover:text-slate-900 dark:border-slate-700 dark:hover:text-slate-100"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Monto + Estado */}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Monto</p>
                      <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(amount)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Estado</p>
                      <p className={`mt-1 text-base font-semibold ${getStatusClass(expense.status)}`}>
                        {formatStatusLabel(expense.status)}
                      </p>
                    </div>
                  </div>

                  {/* Filas de info */}
                  <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                    {expense.expense_number ? (
                      <div className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Número</span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">{expense.expense_number}</span>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Método</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {formatPaymentMethodLabel(expense.payment_method)}
                      </span>
                    </div>

                    {expense.supplier ? (
                      <div className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Proveedor</span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">{expense.supplier}</span>
                      </div>
                    ) : null}

                    {expense.is_recurring ? (
                      <div className="flex items-center justify-between gap-3 py-2 text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Recurrente</span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">Sí</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Nota */}
                  {expense.note ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Nota</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{expense.note}</p>
                    </div>
                  ) : null}

                  {/* Comprobante */}
                  {expense.receipt_url ? (
                    <div className="mt-3">
                      <a
                        href={expense.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/15"
                      >
                        Ver comprobante ↗
                      </a>
                    </div>
                  ) : null}

                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100"
      >
        Ver detalle
      </button>
      {modalContent}
    </>
  );
}
