"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { updateExpense } from "./actions";
import type { ExpenseActionState } from "./types";
import type { Expense } from "./types";
import { SubmitButton } from "../../../components/submit-button";
import { PAYMENT_METHODS, type PaymentMethodOptionFull } from "../../../lib/payments";
import { formatShortDate } from "../../../lib/date-format";

const initialState: ExpenseActionState = { success: false, message: "" };

const inputClass =
  "h-10 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:scheme-dark dark:focus:border-cyan-400 dark:focus:ring-cyan-500/10";

const labelClass = "mb-1 block text-sm font-medium text-slate-500 dark:text-slate-300";

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

export function EditExpenseModal({
  expense,
  paymentMethods,
  canEditManualDates = false,
}: {
  expense: Expense;
  paymentMethods?: PaymentMethodOptionFull[];
  canEditManualDates?: boolean;
}) {
  const methods = paymentMethods && paymentMethods.length > 0
    ? paymentMethods
    : PAYMENT_METHODS.map((m) => ({ id: m.value, type: m.value, label: m.label, details: null }));
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(updateExpense, initialState);
  const [isRecurring, setIsRecurring] = useState(expense.is_recurring ?? false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!state.success) return;
    const timer = window.setTimeout(() => { setOpen(false); }, 700);
    return () => window.clearTimeout(timer);
  }, [state.success, state.timestamp]);

  const modalContent =
    open
      ? createPortal(
          <div className="fixed inset-0 z-999">
            <button
              type="button"
              aria-label="Cerrar modal"
              className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm dark:bg-slate-950/55"
              onClick={() => setOpen(false)}
            />
            <div className="absolute inset-0 overflow-y-auto overscroll-contain p-4">
              <div className="flex min-h-full items-center justify-center">
                <div className="relative my-4 w-full max-w-lg rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-sky-700 dark:text-cyan-300">Edición</p>
                      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                        Editar gasto
                      </h2>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {formatCategoryLabel(expense.category)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100"
                      aria-label="Cerrar modal"
                    >
                      ✕
                    </button>
                  </div>

                  <form action={formAction} className="mt-4 space-y-3">
                    <input type="hidden" name="expenseId" value={expense.id} />

                    {/* Monto */}
                    <div>
                      <label htmlFor={`amount-${expense.id}`} className={labelClass}>Monto</label>
                      <input
                        id={`amount-${expense.id}`}
                        name="amount"
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        defaultValue={Number(expense.amount)}
                        className={inputClass}
                      />
                    </div>

                    {/* Categoría + Fecha */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor={`category-${expense.id}`} className={labelClass}>Categoría</label>
                        <select
                          id={`category-${expense.id}`}
                          name="category"
                          required
                          defaultValue={expense.category ?? "other"}
                          className={inputClass}
                        >
                          <option value="inventory">Inventario</option>
                          <option value="transport">Transporte</option>
                          <option value="services">Servicios</option>
                          <option value="payroll">Planilla</option>
                          <option value="rent">Alquiler</option>
                          <option value="marketing">Marketing</option>
                          <option value="other">Otro</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor={`expenseDate-${expense.id}`} className={labelClass}>Fecha</label>
                        <input
                          id={`expenseDate-${expense.id}`}
                          name={canEditManualDates ? "expenseDate" : undefined}
                          type={canEditManualDates ? "date" : "text"}
                          required
                          readOnly={!canEditManualDates}
                          defaultValue={
                            canEditManualDates
                              ? expense.expense_date
                              : formatShortDate(expense.expense_date)
                          }
                          className={`${inputClass} ${
                            canEditManualDates
                              ? ""
                              : "cursor-not-allowed bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400"
                          }`}
                        />
                        {!canEditManualDates ? (
                          <>
                            <input type="hidden" name="expenseDate" value={expense.expense_date} />
                            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                              La fecha se asigna automáticamente.
                            </p>
                          </>
                        ) : null}
                      </div>
                    </div>

                    {/* Proveedor */}
                    <div>
                      <label htmlFor={`supplier-${expense.id}`} className={labelClass}>
                        Proveedor <span className="font-normal text-slate-400">(opcional)</span>
                      </label>
                      <input
                        id={`supplier-${expense.id}`}
                        name="supplier"
                        type="text"
                        placeholder="Nombre del proveedor"
                        defaultValue={expense.supplier ?? ""}
                        className={inputClass}
                      />
                    </div>

                    {/* Método + Estado */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor={`paymentMethod-${expense.id}`} className={labelClass}>Método de pago</label>
                        <select
                          id={`paymentMethod-${expense.id}`}
                          name="paymentMethod"
                          defaultValue={expense.payment_method ?? methods[0]?.type ?? "cash"}
                          className={inputClass}
                        >
                          {methods.map((m) => (
                            <option key={m.id} value={m.type}>{m.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor={`status-${expense.id}`} className={labelClass}>Estado</label>
                        <select
                          id={`status-${expense.id}`}
                          name="status"
                          defaultValue={expense.status ?? "paid"}
                          className={inputClass}
                        >
                          <option value="paid">Pagado</option>
                          <option value="pending">Pendiente</option>
                        </select>
                      </div>
                    </div>

                    {/* Comprobante */}
                    <div>
                      <label htmlFor={`receiptUrl-${expense.id}`} className={labelClass}>
                        Comprobante <span className="font-normal text-slate-400">(URL opcional)</span>
                      </label>
                      <input
                        id={`receiptUrl-${expense.id}`}
                        name="receiptUrl"
                        type="url"
                        placeholder="https://..."
                        defaultValue={expense.receipt_url ?? ""}
                        className={inputClass}
                      />
                    </div>

                    {/* Nota */}
                    <div>
                      <label htmlFor={`note-${expense.id}`} className={labelClass}>
                        Nota <span className="font-normal text-slate-400">(opcional)</span>
                      </label>
                      <textarea
                        id={`note-${expense.id}`}
                        name="note"
                        rows={2}
                        defaultValue={expense.note ?? ""}
                        className={`${inputClass} h-auto min-h-16 resize-none py-3`}
                      />
                    </div>

                    {/* Switch recurrente */}
                    <div className="space-y-3">
                      <label className="flex cursor-pointer items-center gap-3">
                        <div className="relative inline-flex shrink-0">
                          <input
                            type="checkbox"
                            name="isRecurring"
                            className="peer sr-only"
                            checked={isRecurring}
                            onChange={(e) => setIsRecurring(e.target.checked)}
                          />
                          <div className="h-6 w-11 rounded-full border border-slate-300 bg-slate-100 transition-colors peer-checked:border-sky-500 peer-checked:bg-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:peer-checked:border-cyan-500 dark:peer-checked:bg-cyan-500" />
                          <div className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                        </div>
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-300">
                          Gasto recurrente
                        </span>
                      </label>

                      {isRecurring && (
                        <div>
                          <label htmlFor={`recurringFrequency-${expense.id}`} className={labelClass}>Frecuencia</label>
                          <select
                            id={`recurringFrequency-${expense.id}`}
                            name="recurringFrequency"
                            defaultValue={expense.recurring_frequency ?? "monthly"}
                            className={inputClass}
                          >
                            <option value="weekly">Semanal</option>
                            <option value="monthly">Mensual</option>
                            <option value="yearly">Anual</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {state.message ? (
                      <p className={`text-xs ${state.success ? "text-emerald-600 dark:text-emerald-300" : "text-rose-500 dark:text-rose-300"}`}>
                        {state.message}
                      </p>
                    ) : null}

                    <SubmitButton
                      idleText="Guardar cambios"
                      pendingText="Guardando..."
                      className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-sky-600 px-4 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
                    />
                  </form>
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
        className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition-all duration-150 hover:border-amber-300 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/15 dark:hover:text-amber-200"
      >
        Editar
      </button>
      {modalContent}
    </>
  );
}
