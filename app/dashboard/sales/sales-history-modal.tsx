"use client";

import { useEffect, useMemo, useState, useDeferredValue, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ConfirmSubmitButton } from "../../../components/confirm-submit-button";
import { EditSaleModal } from "./edit-sale-modal";
import { SaleInvoiceModal } from "./sale-invoice-modal";
import { RecordPaymentModal } from "./record-payment-modal";
import { SaleDetailModal } from "./sale-detail-modal";
import { formatShortDate, formatTime } from "../../../lib/date-format";
import { formatCurrency } from "../../../lib/currency-format";
import type { Sale } from "./types";
import type { SalePaymentMethodOption } from "./types";

type CompanyInvoice = {
  name: string;
  contactFooter: string;
  logoUrl: string | null;
  companyId: string;
};

type SalesHistoryModalProps = {
  sales: Sale[];
  from: string;
  to: string;
  company: CompanyInvoice;
  deleteSaleAction: (formData: FormData) => void | Promise<void>;
  paymentMethods?: SalePaymentMethodOption[];
  canEditManualDates?: boolean;
  canManageRecords?: boolean;
  trigger?: ReactNode;
};

function formatPaymentMethodLabel(value: string | null | undefined) {
  switch ((value ?? "").toLowerCase()) {
    case "cash":
      return "Efectivo";
    case "card":
      return "Tarjeta";
    case "transfer":
      return "Transferencia";
    case "yappy":
      return "Yappy";
    case "other":
      return "Otro";
    default:
      return value || "Sin método";
  }
}

function formatPaymentTypeLabel(value: string | null | undefined) {
  switch ((value ?? "").toLowerCase()) {
    case "full":
      return "Completo";
    case "partial":
      return "Abono";
    case "installment":
      return "Cuotas";
    default:
      return value || "Sin tipo";
  }
}

function formatPaymentStatusLabel(value: string | null | undefined) {
  switch ((value ?? "").toLowerCase()) {
    case "paid":
      return "Pagada";
    case "partial":
      return "Abonada";
    case "pending":
      return "Pendiente";
    case "overdue":
      return "Vencida";
    default:
      return "Sin estado";
  }
}

function formatSaleTime(value: string | null | undefined) {
  return formatTime(value, "Sin hora");
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

function getPaymentTypeChipClass(value: string | null | undefined) {
  switch ((value ?? "").toLowerCase()) {
    case "full":
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-200";
    case "partial":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-200";
    case "installment":
      return "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-200";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";
  }
}

function getPaymentStatusChipClass(value: string | null | undefined) {
  switch ((value ?? "").toLowerCase()) {
    case "paid":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200";
    case "partial":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-200";
    case "pending":
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";
    case "overdue":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-200";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";
  }
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

export function SalesHistoryModal({
  sales,
  from,
  to,
  company,
  deleteSaleAction,
  paymentMethods,
  canEditManualDates = false,
  canManageRecords = true,
  trigger,
}: SalesHistoryModalProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [draftFrom, setDraftFrom] = useState(from ?? "");
  const [draftTo, setDraftTo] = useState(to ?? "");
  const [appliedFrom, setAppliedFrom] = useState(from ?? "");
  const [appliedTo, setAppliedTo] = useState(to ?? "");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "partial" | "paid">("all");

  function openModal() {
    setSearch("");
    setDraftFrom(from ?? "");
    setDraftTo(to ?? "");
    setAppliedFrom(from ?? "");
    setAppliedTo(to ?? "");
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

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

  const filteredSales = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    return sales.filter((sale) => {
      const saleDate = sale.sale_date ?? "";

      const matchesFrom = !appliedFrom || saleDate >= appliedFrom;
      const matchesTo = !appliedTo || saleDate <= appliedTo;

      const status = (sale.payment_status ?? "").toLowerCase();
      const matchesStatus =
        statusFilter === "all" ||
        status === statusFilter;

      const searchableText = [
        sale.invoice_number ?? "",
        sale.customer_name ?? "",
        sale.customer_email ?? "",
        sale.customer_phone ?? "",
        sale.note ?? "",
        sale.invoice_notes ?? "",
        sale.sale_date ?? "",
        formatSaleTime(sale.created_at),
        formatPaymentMethodLabel(sale.payment_method),
        formatPaymentTypeLabel(sale.payment_type),
        formatPaymentStatusLabel(sale.payment_status),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchableText.includes(query);

      return matchesFrom && matchesTo && matchesStatus && matchesSearch;
    });
  }, [sales, deferredSearch, appliedFrom, appliedTo, statusFilter]);

  const rangeLabel = useMemo(() => {
    if (appliedFrom && appliedTo) return `Rango: ${appliedFrom} a ${appliedTo}`;
    if (appliedFrom) return `Desde: ${appliedFrom}`;
    if (appliedTo) return `Hasta: ${appliedTo}`;
    return "Mostrando todas las ventas";
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
              <div
                className={`${panelClass} relative flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden`}
              >
                <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-sky-700 dark:text-cyan-300">
                        Historial completo
                      </p>
                      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                        Ventas
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

                  <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_170px_170px_auto_auto]">
                    <div>
                      <label className={labelClass}>Buscar</label>
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cliente, factura, nota o método"
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
                    {(["all", "pending", "partial", "paid"] as const).map((s) => {
                      const labels = { all: "Todas", pending: "Pendientes", partial: "Abonadas", paid: "Pagadas" };
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

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                  {filteredSales.length > 0 ? (
                    <div className="grid gap-3">
                      {filteredSales.map((sale) => {
                        const amount = Number(sale.amount ?? 0);
                        const paidAmount = Number(sale.paid_amount ?? 0);
                        const balanceDue = Number(sale.balance_due ?? 0);
                        const noteText = sale.invoice_notes || sale.note;
                        const isInstallment =
                          String(sale.payment_type ?? "").toLowerCase() ===
                          "installment";

                        return (
                          <div key={sale.id} className={cardClass}>
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-sky-700/70 dark:text-cyan-300/70">
                                  Factura {sale.invoice_number ?? "Sin factura"}
                                </p>

                                <p className="mt-1 text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                                  {formatCurrency(amount)}
                                </p>

                                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                  {sale.customer_name?.trim()
                                    ? sale.customer_name
                                    : "Cliente general"}
                                </p>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <span
                                  className={`${chipBase} ${getPaymentMethodChipClass(
                                    sale.payment_method
                                  )}`}
                                >
                                  {formatPaymentMethodLabel(sale.payment_method)}
                                </span>

                                <span
                                  className={`${chipBase} ${getPaymentTypeChipClass(
                                    sale.payment_type
                                  )}`}
                                >
                                  {formatPaymentTypeLabel(sale.payment_type)}
                                </span>

                                <span
                                  className={`${chipBase} ${getPaymentStatusChipClass(
                                    sale.payment_status
                                  )}`}
                                >
                                  {formatPaymentStatusLabel(sale.payment_status)}
                                </span>

                                {sale.has_payment_plan ? (
                                  <span className={`${chipBase} border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-200`}>
                                    Con plan
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                              Fecha: {formatShortDate(sale.sale_date)} · Hora:{" "}
                              {formatSaleTime(sale.created_at)}
                            </p>

                            {(sale.payment_type === "partial" || isInstallment) ? (
                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
                                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                    Abonado
                                  </p>
                                  <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                                    {formatCurrency(paidAmount)}
                                  </p>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
                                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                    Saldo
                                  </p>
                                  <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                                    {formatCurrency(balanceDue)}
                                  </p>
                                </div>
                              </div>
                            ) : null}

                            {noteText ? (
                              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                {noteText}
                              </p>
                            ) : null}

                            <div className="mt-3 flex flex-wrap gap-3">
                              {canManageRecords ? (
                                <EditSaleModal
                                  sale={sale}
                                  paymentMethods={paymentMethods}
                                  canEditManualDates={canEditManualDates}
                                />
                              ) : null}

                              {(sale.payment_status === "pending" ||
                                sale.payment_status === "partial" ||
                                sale.payment_status === "overdue") &&
                              balanceDue > 0 && canManageRecords ? (
                                <RecordPaymentModal
                                  saleId={sale.id}
                                  balanceDue={balanceDue}
                                  today={new Date().toISOString().slice(0, 10)}
                                  paymentMethods={paymentMethods}
                                  company={company}
                                  sale={sale}
                                />
                              ) : null}

                              <SaleDetailModal
                                sale={sale}
                                company={company}
                                canManagePayments={canManageRecords}
                              />

                              <SaleInvoiceModal sale={sale} company={company} />

                              {canManageRecords && (
                                <form action={deleteSaleAction}>
                                  <input type="hidden" name="saleId" value={sale.id} />
                                  <ConfirmSubmitButton
                                    label="Eliminar"
                                    title="Eliminar factura"
                                    confirmMessage="Esta acción eliminará la venta y devolverá las existencias al inventario."
                                    confirmLabel="Sí, eliminar"
                                    className="rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-2 text-sm text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 hover:text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15 dark:hover:text-rose-200"
                                  />
                                </form>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={cardClass}>
                      <p className="text-slate-600 dark:text-slate-300">
                        No se encontraron ventas con esos filtros.
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
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openModal();
            }
          }}
        >
          {trigger}
        </div>
      ) : (
        <button
          type="button"
          onClick={openModal}
          className={defaultTriggerClass}
        >
          Ver historial
        </button>
      )}

      {modalContent}
    </>
  );
}
