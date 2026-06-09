"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatCurrency } from "../../../lib/currency-format";

function formatPhoneDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 8);
  return d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d;
}

function parsePhoneToDisplay(stored: string): string {
  // acepta "+507 6666-6666", "66666666", "6666-6666", etc.
  const digits = stored.replace(/\D/g, "").replace(/^507/, "").slice(0, 8);
  return formatPhoneDisplay(digits);
}

function normalizeAmountInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  const integerPart = (parts[0] ?? "").replace(/^0+(?=\d)/, "");
  const decimalPart = parts.slice(1).join("").slice(0, 2);
  return cleaned.includes(".") ? `${integerPart || "0"}.${decimalPart}` : integerPart;
}

function formatAmountInput(value: string) {
  if (!value) return "";
  const hasDecimal = value.includes(".");
  const [integerPart = "0", decimalPart = ""] = value.split(".");
  const formatted = new Intl.NumberFormat("es-PA").format(Number(integerPart || "0"));
  return hasDecimal ? `${formatted}.${decimalPart}` : formatted;
}

function parseMoney(value: string) {
  const n = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(v: number) {
  return Math.round(v * 100) / 100;
}

export type InstallmentPlanData = {
  customerPhone: string;
  rawPaidAmount: string;
  rawInstallmentAmount: string;
  installmentsCount: string;
  frequency: string;
  startDate: string;
  planName: string;
  planNotes: string;
};

export const defaultPlanData: InstallmentPlanData = {
  customerPhone: "",
  rawPaidAmount: "",
  rawInstallmentAmount: "",
  installmentsCount: "",
  frequency: "monthly",
  startDate: "",
  planName: "",
  planNotes: "",
};

const inputClass =
  "h-10 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:[color-scheme:dark] dark:focus:border-indigo-400 dark:focus:ring-indigo-500/10";

const dateInputClass =
  "h-10 w-full rounded-2xl border border-slate-200/70 bg-white/85 px-4 text-[15px] text-slate-900 outline-none backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100/80 dark:border-white/10 dark:bg-white/[0.07] dark:text-slate-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:scheme-dark dark:focus:border-indigo-400/70 dark:focus:ring-indigo-500/10";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: InstallmentPlanData) => void;
  initialData: InstallmentPlanData;
  totalAmount: number;
  today: string;
};

export function InstallmentPlanModal({
  open,
  onClose,
  onConfirm,
  initialData,
  totalAmount,
  today,
}: Props) {
  const [data, setData] = useState<InstallmentPlanData>(() => ({
    ...initialData,
    startDate: initialData.startDate || today,
    customerPhone: parsePhoneToDisplay(initialData.customerPhone),
  }));
  // "amount" = user last typed installmentAmount → count is derived
  // "count"  = user last typed installmentsCount  → amount is derived
  const [anchor, setAnchor] = useState<"amount" | "count" | null>(null);

  useEffect(() => {
    if (!open) return;
    const sc = document.querySelector<HTMLElement>("[data-scroll-container]");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    if (sc) sc.style.overflowY = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      if (sc) sc.style.overflowY = "";
    };
  }, [open, onClose]);

  const paidAmount = parseMoney(data.rawPaidAmount);
  const installmentAmountValue = parseMoney(data.rawInstallmentAmount);
  const installmentsCountValue = Math.max(0, parseInt(data.installmentsCount, 10) || 0);
  const remainingBalance = roundMoney(Math.max(0, totalAmount - paidAmount));

  // Auto-calc: monto por cuota cambia → derivar cantidad
  function handleAmountChange(raw: string) {
    const amountValue = parseMoney(raw);
    let newCount = "";
    if (amountValue > 0 && remainingBalance > 0) {
      newCount = String(Math.ceil(remainingBalance / amountValue));
    }
    setAnchor("amount");
    setData((prev) => ({ ...prev, rawInstallmentAmount: raw, installmentsCount: newCount }));
  }

  // Auto-calc: cantidad cambia → derivar monto por cuota
  function handleCountChange(count: string) {
    const countValue = parseInt(count, 10);
    let newAmount = "";
    if (countValue > 0 && remainingBalance > 0) {
      newAmount = String(roundMoney(remainingBalance / countValue));
    }
    setAnchor("count");
    setData((prev) => ({ ...prev, installmentsCount: count, rawInstallmentAmount: newAmount }));
  }

  // Cuando cambia el abono inicial, recalcular el campo no-ancla con el nuevo saldo
  function handleDownPaymentChange(raw: string) {
    const newPaid = parseMoney(raw);
    const newBalance = roundMoney(Math.max(0, totalAmount - newPaid));
    const updates: Partial<InstallmentPlanData> = { rawPaidAmount: raw };

    if (anchor === "amount") {
      const amountValue = parseMoney(data.rawInstallmentAmount);
      if (amountValue > 0 && newBalance > 0) {
        updates.installmentsCount = String(Math.ceil(newBalance / amountValue));
      }
    } else if (anchor === "count") {
      const countValue = parseInt(data.installmentsCount, 10);
      if (countValue > 0 && newBalance > 0) {
        updates.rawInstallmentAmount = String(roundMoney(newBalance / countValue));
      }
    }

    setData((prev) => ({ ...prev, ...updates }));
  }

  // Nota de última cuota cuando no divide exacto
  const lastInstallmentNote = (() => {
    if (installmentAmountValue <= 0 || installmentsCountValue <= 0 || remainingBalance <= 0) {
      return null;
    }
    const regularTotal = roundMoney(installmentAmountValue * (installmentsCountValue - 1));
    const lastInstallment = roundMoney(remainingBalance - regularTotal);
    if (lastInstallment === installmentAmountValue) return null;
    if (lastInstallment <= 0) return null;
    return `La última cuota será de ${formatCurrency(lastInstallment)}.`;
  })();

  const estimatedPlanTotal =
    installmentsCountValue > 0 && installmentAmountValue > 0
      ? roundMoney(installmentAmountValue * installmentsCountValue)
      : 0;

  const canConfirm =
    installmentAmountValue > 0 && installmentsCountValue > 0 && Boolean(data.startDate);

  const set = (key: keyof InstallmentPlanData, value: string) =>
    setData((prev) => ({ ...prev, [key]: value }));

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1001]">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-slate-950/45 dark:bg-black/60"
        onClick={onClose}
      />
      <div className="absolute inset-0 overflow-y-auto overscroll-contain p-4">
        <div className="flex min-h-full items-center justify-center">
          <div className="relative my-4 w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">
                  Cuotas
                </p>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                  Plan de cuotas
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Total de la venta:{" "}
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(totalAmount)}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-400 transition hover:text-slate-900 dark:border-slate-700 dark:hover:text-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {/* Phone */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-300">
                  Teléfono del cliente{" "}
                  <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <div className="flex h-10 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white transition-[border-color,box-shadow] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950/70 dark:focus-within:border-indigo-400 dark:focus-within:ring-indigo-500/10">
                  <span className="flex select-none items-center border-r border-slate-200 bg-slate-50 px-3 text-[15px] text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                    +507
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="6666-6666"
                    value={data.customerPhone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                      set("customerPhone", formatPhoneDisplay(digits));
                    }}
                    className="h-full flex-1 bg-transparent px-3 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              {/* Plan name */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-300">
                  Nombre del plan{" "}
                  <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej. Plan mensual cliente"
                  value={data.planName}
                  onChange={(e) => set("planName", e.target.value)}
                  className={inputClass}
                />
              </div>

              {/* Down payment + Frequency */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-300">
                    Pago inicial
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="$ 0.00"
                    value={formatAmountInput(data.rawPaidAmount)}
                    onChange={(e) => handleDownPaymentChange(normalizeAmountInput(e.target.value))}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-300">
                    Frecuencia
                  </label>
                  <select
                    value={data.frequency}
                    onChange={(e) => set("frequency", e.target.value)}
                    className={inputClass}
                  >
                    <option value="weekly">Semanal</option>
                    <option value="biweekly">Quincenal</option>
                    <option value="monthly">Mensual</option>
                  </select>
                </div>
              </div>

              {/* Installment amount + count */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-300">
                    Monto por cuota
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="$ 100.00"
                    value={formatAmountInput(data.rawInstallmentAmount)}
                    onChange={(e) =>
                      handleAmountChange(normalizeAmountInput(e.target.value))
                    }
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-300">
                    Cantidad de cuotas
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    placeholder="Ej. 6"
                    value={data.installmentsCount}
                    onChange={(e) => handleCountChange(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Start date + plan notes */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-300">
                    Primera cuota
                  </label>
                  <input
                    type="date"
                    value={data.startDate}
                    onChange={(e) => set("startDate", e.target.value)}
                    className={dateInputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-300">
                    Nota del plan{" "}
                    <span className="font-normal text-slate-400">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={data.planNotes}
                    onChange={(e) => set("planNotes", e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Summary card */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="grid gap-2 text-xs sm:grid-cols-4">
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Total</p>
                    <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(totalAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Inicial</p>
                    <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(paidAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Saldo</p>
                    <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(remainingBalance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Total cuotas</p>
                    <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                      {estimatedPlanTotal > 0 ? formatCurrency(estimatedPlanTotal) : "—"}
                    </p>
                  </div>
                </div>
                {lastInstallmentNote ? (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                    {lastInstallmentNote}
                  </p>
                ) : null}
              </div>

              {/* Confirm */}
              <button
                type="button"
                disabled={!canConfirm}
                onClick={() => {
                  const phone = data.customerPhone;
                  onConfirm({
                    ...data,
                    customerPhone: phone ? `+507 ${phone}` : "",
                  });
                  onClose();
                }}
                className="h-11 w-full rounded-2xl bg-indigo-600 px-4 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
              >
                Confirmar plan
              </button>

              {!canConfirm && (
                <p className="text-center text-xs text-slate-400 dark:text-slate-500">
                  Completa monto por cuota, cantidad y fecha de inicio.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
