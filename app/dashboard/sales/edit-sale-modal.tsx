"use client";

import { useCallback, useMemo, useRef } from "react";
import { EditSaleForm } from "./edit-sale-form";
import type { Sale } from "./types";
import type { SalePaymentMethodOption } from "./types";

export function EditSaleModal({
  sale,
  paymentMethods,
  canEditManualDates = false,
}: {
  sale: Sale;
  paymentMethods?: SalePaymentMethodOption[];
  canEditManualDates?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const isInstallmentSale = useMemo(() => {
    return String(sale.payment_type ?? "").toLowerCase() === "installment";
  }, [sale.payment_type]);

  const openModal = useCallback(() => {
    if (isInstallmentSale) return;
    dialogRef.current?.showModal();
  }, [isInstallmentSale]);

  const closeModal = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  if (isInstallmentSale) {
    return (
      <button
        type="button"
        disabled
        title="Las ventas con cuotas se editarán en un flujo separado"
        className="cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-400 opacity-90 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-500"
      >
        Editar cuotas
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        aria-haspopup="dialog"
        className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition-all duration-150 hover:border-amber-300 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/15 dark:hover:text-amber-200"
      >
        Editar venta
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`edit-sale-title-${sale.id}`}
        aria-describedby={`edit-sale-description-${sale.id}`}
        onCancel={closeModal}
        className="fixed inset-0 m-0 h-dvh w-screen max-h-none max-w-none overflow-y-auto overscroll-contain bg-transparent p-4 text-slate-900 backdrop:bg-slate-950/40 backdrop:backdrop-blur-sm dark:text-slate-100"
      >
        <div className="flex min-h-full items-start justify-center py-4">
          <div className="w-[min(92vw,680px)] rounded-[28px] border border-slate-200 bg-[rgba(255,255,255,0.94)] p-0 shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:border-slate-800 dark:bg-slate-900/95 dark:shadow-[0_24px_80px_rgba(2,6,23,0.50)]">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/95">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Factura {sale.invoice_number ?? "Sin factura"}
                  </p>
                  <h3
                    id={`edit-sale-title-${sale.id}`}
                    className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50"
                  >
                    Editar venta
                  </h3>
                  <p
                    id={`edit-sale-description-${sale.id}`}
                    className="mt-1 text-sm text-slate-600 dark:text-slate-300"
                  >
                    Actualiza los datos principales de la venta y guarda los cambios.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  aria-label="Cerrar"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-500 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100"
                >
                  ×
                </button>
              </div>

              <EditSaleForm
                sale={sale}
                paymentMethods={paymentMethods}
                canEditManualDates={canEditManualDates}
                onSuccess={closeModal}
              />
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
