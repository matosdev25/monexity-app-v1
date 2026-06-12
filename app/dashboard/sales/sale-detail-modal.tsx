"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ButtonSpinner } from "@/components/button-spinner";
import { formatShortDate } from "@/lib/date-format";
import { formatCurrency } from "@/lib/currency-format";
import { fetchSalePayments, editPayment, deletePayment } from "./actions";
import type { Sale } from "./types";
import { generateReceiptPdf } from "./record-payment-modal";
import type { ReceiptSnapshot } from "./record-payment-modal";
import { PAYMENT_METHODS } from "../../../lib/payments";
import { calculateSalePaymentSummary } from "./payment-summary";

type PaymentRow = {
  id: string;
  amount: number;
  payment_method: string | null;
  payment_date: string;
  note: string | null;
  created_at: string | null;
  is_initial_down_payment?: boolean;
};

type Company = {
  name: string;
  contactFooter: string;
  logoUrl: string | null;
};

type RowMode = "idle" | "editing" | "confirm-delete";

function fmt$(v: number) { return formatCurrency(v); }

function fmtMethod(value: string | null) {
  switch ((value ?? "").toLowerCase()) {
    case "cash": return "Efectivo";
    case "card": return "Tarjeta";
    case "transfer": return "Transferencia";
    case "yappy": return "Yappy";
    default: return value || "Otro";
  }
}

function fmtStatus(value: string | null) {
  switch ((value ?? "").toLowerCase()) {
    case "paid": return "Pagada";
    case "partial": return "Abonada";
    case "pending": return "Pendiente";
    case "overdue": return "Vencida";
    default: return value || "—";
  }
}

function statusClass(value: string | null) {
  switch ((value ?? "").toLowerCase()) {
    case "paid": return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-300";
    case "partial": return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-300";
    case "overdue": return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-300";
    default: return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
}

function normalizeAmount(v: string) {
  const c = v.replace(/[^\d.]/g, "");
  const parts = c.split(".");
  const int = (parts[0] ?? "").replace(/^0+(?=\d)/, "");
  const dec = parts.slice(1).join("").slice(0, 2);
  return c.includes(".") ? `${int || "0"}.${dec}` : int;
}

type Props = {
  sale: Sale;
  company?: Company;
  canManagePayments?: boolean;
};

const initialActionState = { success: false, message: "", timestamp: 0 };

export function SaleDetailModal({ sale, company, canManagePayments = true }: Props) {
  const [open, setOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [isPending, startTransition] = useTransition();

  // Per-row state
  const [rowModes, setRowModes] = useState<Record<string, RowMode>>({});
  const [editValues, setEditValues] = useState<Record<string, {
    amount: string; method: string; date: string; note: string;
  }>>({});
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  // PDF busy
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);

  const editFormRefs = useRef<Record<string, HTMLFormElement | null>>({});

  function loadPayments() {
    startTransition(async () => {
      const data = await fetchSalePayments(sale.id);
      setPayments(data);
    });
  }

  useEffect(() => {
    if (!open) {
      const timer = window.setTimeout(() => setPayments([]), 0);
      return () => window.clearTimeout(timer);
    }
    loadPayments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sale.id]);

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

  function openEdit(p: PaymentRow) {
    setEditValues((prev) => ({
      ...prev,
      [p.id]: {
        amount: String(p.amount),
        method: p.payment_method ?? "cash",
        date: p.payment_date,
        note: p.note ?? "",
      },
    }));
    setActionErrors((prev) => ({ ...prev, [p.id]: "" }));
    setRowModes((prev) => ({ ...prev, [p.id]: "editing" }));
  }

  function cancelRow(id: string) {
    setRowModes((prev) => ({ ...prev, [id]: "idle" }));
    setActionErrors((prev) => ({ ...prev, [id]: "" }));
  }

  async function handleSaveEdit(paymentId: string) {
    const vals = editValues[paymentId];
    if (!vals) return;
    setActionBusy(paymentId);
    setActionErrors((prev) => ({ ...prev, [paymentId]: "" }));
    const fd = new FormData();
    fd.set("paymentId", paymentId);
    fd.set("saleId", sale.id);
    fd.set("amount", vals.amount);
    fd.set("paymentMethod", vals.method);
    fd.set("paymentDate", vals.date);
    fd.set("note", vals.note);
    const result = await editPayment(initialActionState, fd);
    if (result.success) {
      setRowModes((prev) => ({ ...prev, [paymentId]: "idle" }));
      loadPayments();
    } else {
      setActionErrors((prev) => ({ ...prev, [paymentId]: result.message }));
    }
    setActionBusy(null);
  }

  async function handleDelete(paymentId: string) {
    setActionBusy(paymentId);
    setActionErrors((prev) => ({ ...prev, [paymentId]: "" }));
    const fd = new FormData();
    fd.set("paymentId", paymentId);
    fd.set("saleId", sale.id);
    const result = await deletePayment(initialActionState, fd);
    if (result.success) {
      setRowModes((prev) => ({ ...prev, [paymentId]: "idle" }));
      loadPayments();
    } else {
      setActionErrors((prev) => ({ ...prev, [paymentId]: result.message }));
      setActionBusy(null);
    }
    setActionBusy(null);
  }

  async function handleDownloadPdf(payment: PaymentRow) {
    if (pdfBusy) return;
    setPdfBusy(payment.id);
    try {
      const snap: ReceiptSnapshot = {
        amount: payment.amount,
        method: payment.payment_method ?? "",
        methodLabel: fmtMethod(payment.payment_method),
        paymentDate: payment.payment_date,
        note: payment.note ?? "",
        newBalance: liveBalance,
        companyName: company?.name ?? "Mi negocio",
        contactFooter: company?.contactFooter ?? "",
        logoUrl: company?.logoUrl ?? null,
        invoiceNumber: sale.invoice_number ?? null,
        customerName: sale.customer_name ?? null,
      };
      const blob = await generateReceiptPdf(snap);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comprobante${sale.invoice_number ? `-${sale.invoice_number}` : ""}-${payment.payment_date}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setPdfBusy(null);
    }
  }

  const paymentSummary = calculateSalePaymentSummary({
    sale,
    paymentsAmount: payments.reduce(
      (sum, payment) => sum + (payment.is_initial_down_payment ? 0 : Number(payment.amount ?? 0)),
      0
    ),
    downPaymentAmount:
      payments.find((payment) => payment.is_initial_down_payment)?.amount ?? 0,
  });
  const gross = paymentSummary.total;
  const livePaid = paymentSummary.collectedAmount;
  const liveBalance = paymentSummary.pendingBalance;

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
                <div className="relative w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">

                  {/* Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-sky-700/70 dark:text-cyan-300/70">
                        Factura {sale.invoice_number ?? "Sin factura"}
                      </p>
                      <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                        Detalle de venta
                      </h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {sale.customer_name?.trim() || "Cliente general"}
                        {sale.customer_company ? ` · ${sale.customer_company}` : ""}
                        {sale.customer_phone ? ` · ${sale.customer_phone}` : ""}
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

                  {/* Summary */}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Total</p>
                      <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">{fmt$(gross)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Pagado</p>
                      <p className="mt-1 text-base font-semibold text-emerald-700 dark:text-emerald-300">{fmt$(livePaid)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Saldo</p>
                      <p className={`mt-1 text-base font-semibold ${liveBalance > 0 ? "text-amber-700 dark:text-amber-300" : "text-slate-400 dark:text-slate-500"}`}>
                        {fmt$(liveBalance)}
                      </p>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusClass(sale.payment_status)}`}>
                      {fmtStatus(sale.payment_status)}
                    </span>
                    {sale.has_payment_plan ? (
                      <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-200">
                        Con plan de cuotas
                      </span>
                    ) : null}
                    {sale.sale_date ? (
                      <span className="text-xs text-slate-400 dark:text-slate-500">{formatShortDate(sale.sale_date)}</span>
                    ) : null}
                  </div>

                  {/* Payment history */}
                  <div className="mt-5">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Historial de pagos</p>

                    {isPending ? (
                      <div className="mt-3 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <ButtonSpinner variant="neutral" />
                        Cargando...
                      </div>
                    ) : payments.length === 0 ? (
                      <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-900/40">
                        <p className="text-sm text-slate-500 dark:text-slate-400">No hay pagos registrados aún.</p>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {payments.map((payment) => {
                          const mode = rowModes[payment.id] ?? "idle";
                          const ev = editValues[payment.id];
                          const busy = actionBusy === payment.id;
                          const err = actionErrors[payment.id] ?? "";
                          const canEditThisPayment =
                            canManagePayments && !payment.is_initial_down_payment;

                          return (
                            <div
                              key={payment.id}
                              className="rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60"
                            >
                              {/* Row */}
                              <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {fmt$(payment.amount)}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {fmtMethod(payment.payment_method)} · {formatShortDate(payment.payment_date)}
                                  </p>
                                  {payment.note ? (
                                    <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                                      {payment.note}
                                    </p>
                                  ) : null}
                                </div>

                                {/* Action buttons */}
                                {mode === "idle" && (
                                  <div className="flex shrink-0 items-center gap-1.5">
                                    {/* PDF */}
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadPdf(payment)}
                                      disabled={pdfBusy === payment.id}
                                      title="Descargar comprobante PDF"
                                      className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-[background-color,border-color,color] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-100"
                                    >
                                      {pdfBusy === payment.id ? (
                                        <ButtonSpinner variant="neutral" />
                                      ) : (
                                        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                                          <path d="M8 2v8m0 0-2.5-2.5M8 10l2.5-2.5M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      )}
                                      PDF
                                    </button>

                                    {canEditThisPayment && (
                                      <>
                                        {/* Edit */}
                                        <button
                                          type="button"
                                          onClick={() => openEdit(payment)}
                                          title="Editar pago"
                                          className="flex h-[30px] w-[30px] items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 transition-all duration-150 hover:border-amber-300 hover:bg-amber-100 hover:text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/15 dark:hover:text-amber-300"
                                        >
                                          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                                            <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H3v-2L11.5 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                                          </svg>
                                        </button>

                                        {/* Delete */}
                                        <button
                                          type="button"
                                          onClick={() => setRowModes((prev) => ({ ...prev, [payment.id]: "confirm-delete" }))}
                                          title="Eliminar pago"
                                          className="flex h-[30px] w-[30px] items-center justify-center rounded-xl border border-rose-200/80 bg-rose-50/80 text-rose-400 transition-[background-color,border-color,color] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-rose-300 hover:text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-500 dark:hover:border-rose-500/40 dark:hover:text-rose-300"
                                        >
                                          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                                            <path d="M3 4h10M6 4V3h4v1M7 7v4M9 7v4M4 4l.7 8.5A1 1 0 0 0 5.7 13h4.6a1 1 0 0 0 1-.95L12 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                          </svg>
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}

                                {/* Confirm delete */}
                                {mode === "confirm-delete" && (
                                  <div className="flex shrink-0 items-center gap-2">
                                    <span className="text-xs text-rose-600 dark:text-rose-400">¿Eliminar?</span>
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(payment.id)}
                                      disabled={busy}
                                      className="flex h-[30px] items-center gap-1 rounded-xl bg-rose-600 px-2.5 text-xs font-medium text-white transition hover:bg-rose-700 disabled:opacity-60 dark:bg-rose-500 dark:hover:bg-rose-400"
                                    >
                                      {busy ? <ButtonSpinner variant="neutral" /> : null}
                                      Sí
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => cancelRow(payment.id)}
                                      disabled={busy}
                                      className="flex h-[30px] items-center rounded-xl border border-slate-200 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                    >
                                      No
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Inline edit form */}
                              {mode === "editing" && ev && (
                                <div className="border-t border-slate-200 px-3 pb-3 pt-2.5 dark:border-slate-800">
                                  <form
                                    ref={(el) => { editFormRefs.current[payment.id] = el; }}
                                    onSubmit={(e) => { e.preventDefault(); handleSaveEdit(payment.id); }}
                                    className="space-y-2"
                                  >
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Monto</label>
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          value={ev.amount}
                                          onChange={(e) => setEditValues((prev) => ({ ...prev, [payment.id]: { ...ev, amount: normalizeAmount(e.target.value) } }))}
                                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:focus:border-emerald-400 dark:focus:ring-emerald-500/10"
                                          required
                                        />
                                      </div>
                                      <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Método</label>
                                        <select
                                          value={ev.method}
                                          onChange={(e) => setEditValues((prev) => ({ ...prev, [payment.id]: { ...ev, method: e.target.value } }))}
                                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:focus:border-emerald-400 dark:focus:ring-emerald-500/10"
                                        >
                                          {PAYMENT_METHODS.map((m) => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Fecha</label>
                                        <input
                                          type="date"
                                          value={ev.date}
                                          onChange={(e) => setEditValues((prev) => ({ ...prev, [payment.id]: { ...ev, date: e.target.value } }))}
                                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-white/[0.07] dark:text-slate-100 dark:focus:border-emerald-400 dark:focus:ring-emerald-500/10"
                                          required
                                        />
                                      </div>
                                      <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Nota</label>
                                        <input
                                          type="text"
                                          value={ev.note}
                                          onChange={(e) => setEditValues((prev) => ({ ...prev, [payment.id]: { ...ev, note: e.target.value } }))}
                                          placeholder="Opcional"
                                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-500/10"
                                        />
                                      </div>
                                    </div>

                                    {err ? (
                                      <p className="text-xs text-rose-500 dark:text-rose-400">{err}</p>
                                    ) : null}

                                    <div className="flex gap-2 pt-0.5">
                                      <button
                                        type="submit"
                                        disabled={busy}
                                        className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 text-xs font-medium text-white transition hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                                      >
                                        {busy ? <ButtonSpinner variant="neutral" /> : null}
                                        Guardar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => cancelRow(payment.id)}
                                        disabled={busy}
                                        className="flex h-8 flex-1 items-center justify-center rounded-xl border border-slate-200 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </form>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        <div className="flex items-center justify-between border-t border-slate-200 pt-2 dark:border-slate-700">
                          <span className="text-sm text-slate-500 dark:text-slate-400">Total registrado</span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{fmt$(livePaid)}</span>
                        </div>
                      </div>
                    )}
                  </div>
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
