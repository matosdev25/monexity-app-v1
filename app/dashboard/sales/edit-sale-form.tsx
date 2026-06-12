"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { ButtonSpinner } from "@/components/button-spinner";
import { formatShortDate, formatTime } from "@/lib/date-format";
import { formatCurrency } from "@/lib/currency-format";
import { updateSale } from "./actions";
import type { Sale } from "./types";
import type { SalePaymentMethodOption } from "./types";

type ActionState = {
  success: boolean;
  message: string;
  timestamp?: number;
};

const initialState: ActionState = {
  success: false,
  message: "",
};

const labelClass =
  "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-300";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 transition-all duration-150 focus:border-sky-200 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:[color-scheme:dark] dark:focus:border-cyan-400 dark:focus:ring-cyan-500/10";

const buttonClass =
  "w-full rounded-xl border border-sky-600 bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 shadow-[0_10px_24px_rgba(14,165,233,0.22)] hover:bg-sky-700 disabled:opacity-60 dark:border-cyan-500 dark:bg-cyan-500 dark:text-slate-950 dark:shadow-none dark:hover:bg-cyan-400";

type EditSaleFormProps = {
  sale: Sale;
  paymentMethods?: SalePaymentMethodOption[];
  canEditManualDates?: boolean;
  onSuccess?: () => void;
};

function normalizeAmountInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");

  const integerPart = parts[0] ?? "";
  const decimalPart = parts.slice(1).join("").slice(0, 2);
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, "");

  if (cleaned.includes(".")) {
    return `${normalizedInteger || "0"}.${decimalPart}`;
  }

  return normalizedInteger;
}

function formatAmountInput(value: string) {
  if (!value) return "";

  const hasDecimal = value.includes(".");
  const [integerPart = "0", decimalPart = ""] = value.split(".");

  const formattedInteger = new Intl.NumberFormat("en-US").format(
    Number(integerPart || "0")
  );

  if (hasDecimal) {
    return `${formattedInteger}.${decimalPart}`;
  }

  return formattedInteger;
}

function parseMoney(value: string | number | null | undefined) {
  const normalized = String(value ?? "")
    .replace(/,/g, "")
    .trim();

  if (!normalized) return 0;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function formatSaleTime(value: string | null | undefined) {
  return formatTime(value, "Sin hora");
}

function formatDisplayDate(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  return formatShortDate(value);
}

function EditSubmitButton({ success }: { success: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={buttonClass}>
      <span className="inline-flex items-center justify-center gap-2">
        {pending ? (
          <>
            <ButtonSpinner />
            Guardando...
          </>
        ) : success ? (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M16.704 5.29a1 1 0 0 1 .006 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4A1 1 0 1 1 4.71 9.29L8 12.586l7.296-7.296a1 1 0 0 1 1.408 0Z"
                clipRule="evenodd"
              />
            </svg>
            Guardado
          </>
        ) : (
          "Guardar cambios"
        )}
      </span>
    </button>
  );
}

export function EditSaleForm({
  sale,
  paymentMethods,
  canEditManualDates = false,
  onSuccess,
}: EditSaleFormProps) {
  const [state, formAction] = useActionState(updateSale, initialState);
  const [showSuccess, setShowSuccess] = useState(false);
  const [saleDate, setSaleDate] = useState(sale.sale_date ?? "");
  const isInstallmentSale = String(sale.payment_type ?? "").toLowerCase() === "installment";

  const initialAmount = useMemo(() => {
    const total = roundMoney(parseMoney(sale.amount));
    const discount = roundMoney(parseMoney(sale.discount_amount));
    return String(roundMoney(total + discount));
  }, [sale.amount, sale.discount_amount]);

  const initialPaidAmount = useMemo(() => {
    const salePaymentType = String(sale.payment_type ?? "").toLowerCase();
    if (salePaymentType === "full") {
      return String(roundMoney(parseMoney(sale.amount)));
    }
    return String(roundMoney(parseMoney(sale.paid_amount)));
  }, [sale.payment_type, sale.paid_amount, sale.amount]);

  const [rawAmount, setRawAmount] = useState(initialAmount);
  const [rawDiscount, setRawDiscount] = useState(
    () => String(roundMoney(parseMoney(sale.discount_amount)))
  );
  const [paymentType, setPaymentType] = useState(
    isInstallmentSale
      ? "installment"
      : String(sale.payment_type ?? "full").toLowerCase() === "partial"
      ? "partial"
      : "full"
  );
  const [rawPaidAmount, setRawPaidAmount] = useState(initialPaidAmount);

  const formattedAmount = useMemo(() => {
    return formatAmountInput(rawAmount);
  }, [rawAmount]);

  const numericDiscount = useMemo(() => Math.max(0, parseMoney(rawDiscount)), [rawDiscount]);
  const numericSubtotal = useMemo(() => parseMoney(rawAmount), [rawAmount]);
  const numericAmount = useMemo(
    () => Math.max(0, roundMoney(numericSubtotal - numericDiscount)),
    [numericSubtotal, numericDiscount]
  );

  const rawFinalAmount = useMemo(() => String(numericAmount), [numericAmount]);

  const effectivePaidAmount = useMemo(() => {
    if (paymentType === "full") return rawFinalAmount;
    return rawPaidAmount;
  }, [paymentType, rawFinalAmount, rawPaidAmount]);

  const formattedPaidAmount = useMemo(() => {
    return formatAmountInput(effectivePaidAmount);
  }, [effectivePaidAmount]);

  const numericPaidAmount = useMemo(
    () => parseMoney(effectivePaidAmount),
    [effectivePaidAmount]
  );
  const numericBalance = useMemo(() => {
    return Math.max(0, roundMoney(numericAmount - numericPaidAmount));
  }, [numericAmount, numericPaidAmount]);

  useEffect(() => {
    if (!state.success) return;

    const showTimer = window.setTimeout(() => {
      setShowSuccess(true);
    }, 0);

    const successTimer = window.setTimeout(() => {
      setShowSuccess(false);
    }, 4000);

    const closeTimer = window.setTimeout(() => {
      onSuccess?.();
    }, 800);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(successTimer);
      window.clearTimeout(closeTimer);
    };
  }, [state.success, state.timestamp, onSuccess]);

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <input type="hidden" name="saleId" value={sale.id} />
      <input type="hidden" name="invoiceNotes" value={sale.invoice_notes ?? ""} />
      {!canEditManualDates ? (
        <input type="hidden" name="saleDate" value={sale.sale_date ?? ""} />
      ) : null}
      <input
        type="hidden"
        name="paymentDate"
        value={canEditManualDates ? saleDate : sale.payment_date ?? sale.sale_date ?? ""}
      />
      <input
        type="hidden"
        name="itemDescription[]"
        value={sale.note?.trim() || sale.invoice_notes?.trim() || "Venta registrada"}
      />
      <input type="hidden" name="itemQuantity[]" value="1" />
      <input type="hidden" name="itemUnitPrice[]" value={rawAmount} />
      <input type="hidden" name="discountAmount" value={rawDiscount || "0"} />
      {isInstallmentSale ? (
        <>
          <input type="hidden" name="amount" value={rawAmount} />
          <input type="hidden" name="paidAmount" value={effectivePaidAmount} />
          <input type="hidden" name="paymentType" value="installment" />
        </>
      ) : null}

      <div className="rounded-2xl border border-amber-100 bg-amber-50/80 px-3 py-2 dark:border-amber-500/20 dark:bg-amber-500/10">
        <p className="text-[11px] uppercase tracking-[0.18em] text-amber-700/80 dark:text-amber-300/80">
          Venta registrada
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Fecha: {formatShortDate(sale.sale_date)} · Hora: {formatSaleTime(sale.created_at)}
        </p>
      </div>

      <div>
        <label htmlFor={`saleDate-${sale.id}`} className={labelClass}>
          Fecha de venta
        </label>
        <input
          id={`saleDate-${sale.id}`}
          name={canEditManualDates ? "saleDate" : undefined}
          type={canEditManualDates ? "date" : "text"}
          required
          readOnly={!canEditManualDates}
          value={canEditManualDates ? saleDate : formatDisplayDate(sale.sale_date)}
          onChange={(e) => {
            if (canEditManualDates) setSaleDate(e.target.value);
          }}
          className={`${inputClass} ${
            canEditManualDates
              ? ""
              : "cursor-not-allowed bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400"
          }`}
        />
        {!canEditManualDates ? (
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            La fecha se asigna automáticamente.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`customerName-${sale.id}`} className={labelClass}>
            Cliente
          </label>
          <input
            id={`customerName-${sale.id}`}
            name="customerName"
            type="text"
            maxLength={120}
            defaultValue={sale.customer_name ?? ""}
            className={inputClass}
            placeholder="Nombre del cliente (opcional)"
          />
        </div>
        <div>
          <label htmlFor={`customerCompany-${sale.id}`} className={labelClass}>
            Empresa (opcional)
          </label>
          <input
            id={`customerCompany-${sale.id}`}
            name="customerCompany"
            type="text"
            maxLength={120}
            defaultValue={sale.customer_company ?? ""}
            className={inputClass}
            placeholder="Empresa del cliente"
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label htmlFor={`amount-display-${sale.id}`} className={labelClass}>
            Monto
          </label>
          <input
            id={`amount-display-${sale.id}`}
            type="text"
            inputMode="decimal"
            required
            value={formattedAmount}
            onChange={(e) => {
              const normalized = normalizeAmountInput(e.target.value);
              setRawAmount(normalized);
            }}
            readOnly={isInstallmentSale}
            className={`${inputClass} ${
              isInstallmentSale
                ? "cursor-not-allowed bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400"
                : ""
            }`}
            placeholder="$ 0.00"
          />
          {!isInstallmentSale ? <input type="hidden" name="amount" value={rawAmount} /> : null}
          {numericDiscount > 0 && numericSubtotal > 0 ? (
            <div className="mt-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex items-center justify-between gap-3 py-0.5 text-slate-500 dark:text-slate-400">
                <span>Subtotal</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(numericSubtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 py-0.5 text-rose-500 dark:text-rose-400">
                <span>Descuento</span>
                <span className="font-medium">−{formatCurrency(numericDiscount)}</span>
              </div>
            </div>
          ) : null}
        </div>

        <div>
          <label htmlFor={`discountAmount-display-${sale.id}`} className={labelClass}>
            Descuento (opcional)
          </label>
          <input
            id={`discountAmount-display-${sale.id}`}
            type="text"
            inputMode="decimal"
            value={rawDiscount ? formatAmountInput(rawDiscount) : ""}
            onChange={(e) => setRawDiscount(normalizeAmountInput(e.target.value))}
            readOnly={isInstallmentSale}
            className={`${inputClass} ${
              isInstallmentSale
                ? "cursor-not-allowed bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400"
                : ""
            }`}
            placeholder="$ 0.00"
          />
        </div>

        <div>
          <label htmlFor={`paymentMethod-${sale.id}`} className={labelClass}>
            Método de pago
          </label>
          <select
            id={`paymentMethod-${sale.id}`}
            name="paymentMethod"
            required
            defaultValue={sale.payment_method ?? "cash"}
            className={inputClass}
          >
            {(paymentMethods ?? []).map((m) => (
              <option key={m.id} value={m.type}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`paymentType-${sale.id}`} className={labelClass}>
            Tipo de pago
          </label>
          <select
            id={`paymentType-${sale.id}`}
            name={isInstallmentSale ? undefined : "paymentType"}
            required
            value={paymentType}
            onChange={(e) => {
              if (!isInstallmentSale) setPaymentType(e.target.value);
            }}
            disabled={isInstallmentSale}
            className={`${inputClass} ${
              isInstallmentSale
                ? "cursor-not-allowed bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400"
                : ""
            }`}
          >
            <option value="full">Completo</option>
            <option value="partial">Abono</option>
            {isInstallmentSale ? <option value="installment">Cuotas</option> : null}
          </select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label htmlFor={`paidAmount-display-${sale.id}`} className={labelClass}>
            {paymentType === "full" ? "Monto pagado" : "Abono recibido"}
          </label>
          <input
            id={`paidAmount-display-${sale.id}`}
            type="text"
            inputMode="decimal"
            value={formattedPaidAmount}
            onChange={(e) => {
              const normalized = normalizeAmountInput(e.target.value);
              setRawPaidAmount(normalized);
            }}
            disabled={paymentType === "full" || isInstallmentSale}
            className={`${inputClass} ${
              paymentType === "full" || isInstallmentSale
                ? "cursor-not-allowed bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400"
                : ""
            }`}
            placeholder="$ 0.00"
          />
          {!isInstallmentSale ? (
            <input type="hidden" name="paidAmount" value={effectivePaidAmount} />
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Resumen
          </p>
          <div className="mt-2 grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500 dark:text-slate-400">Total</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {formatCurrency(numericAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500 dark:text-slate-400">Abonado</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {formatCurrency(numericPaidAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500 dark:text-slate-400">Saldo</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {formatCurrency(numericBalance)}
              </span>
            </div>
          </div>
          {numericDiscount > 0 ? (
            <p className="mt-2 text-xs text-rose-500 dark:text-rose-400">
              Descuento aplicado: −{formatCurrency(numericDiscount)}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor={`note-${sale.id}`} className={labelClass}>
          Nota
        </label>
        <textarea
          id={`note-${sale.id}`}
          name="note"
          rows={3}
          defaultValue={sale.note ?? ""}
          className={`${inputClass} min-h-24 resize-none`}
          placeholder="Agrega un detalle opcional"
        />
      </div>

      {!state.success && state.message ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
          {state.message}
        </div>
      ) : null}

      <EditSubmitButton success={showSuccess} />
    </form>
  );
}
