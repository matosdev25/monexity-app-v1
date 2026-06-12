"use client";

import { Fragment, useActionState, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createSale } from "./actions";
import type { SalePaymentMethodOption } from "./types";
import { ButtonSpinner } from "@/components/button-spinner";
import {
  InstallmentPlanModal,
  defaultPlanData,
  type InstallmentPlanData,
} from "./installment-plan-modal";
import { ProductPickerModal, type LineItem } from "./product-picker-modal";
import { ServicePickerModal } from "./service-picker-modal";
import { formatCurrency } from "../../../lib/currency-format";
import type { Product } from "../inventario/types";
import type { CompanyService } from "../mi-negocio/types";

type CreateSaleFormProps = {
  today: string;
  paymentMethods?: SalePaymentMethodOption[];
  products?: Product[];
  services?: CompanyService[];
  canEditManualDates?: boolean;
  onSuccess?: () => void;
};

type ActionState = {
  success: boolean;
  message: string;
  timestamp?: number;
};

const initialState: ActionState = {
  success: false,
  message: "",
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
  const formattedInteger = new Intl.NumberFormat("es-PA").format(
    Number(integerPart || "0")
  );
  if (hasDecimal) {
    return `${formattedInteger}.${decimalPart}`;
  }
  return formattedInteger;
}

function parseMoney(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function formatDisplayDate(value: string) {
  const [date] = value.split("T");
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function getCurrentDateTimeLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const inputClass =
  "h-10 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-cyan-400 dark:focus:ring-cyan-500/10";

function SubmitButton({
  success,
  disabled,
}: {
  success: boolean;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
    >
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
          Guardada
        </>
      ) : (
        "Guardar venta"
      )}
    </button>
  );
}

export function CreateSaleForm({
  today,
  paymentMethods,
  products,
  services,
  canEditManualDates = false,
  onSuccess,
}: CreateSaleFormProps) {
  const [state, formAction] = useActionState(createSale, initialState);
  const [showSuccess, setShowSuccess] = useState(false);

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [rawAmount, setRawAmount] = useState("");
  const [rawDiscount, setRawDiscount] = useState("");
  const [rawPaidAmount, setRawPaidAmount] = useState("");
  const [paymentType, setPaymentType] = useState("full");
  const [note, setNote] = useState("");
  const [saleDateTime, setSaleDateTime] = useState(() => getCurrentDateTimeLocal());

  // Installment plan data (populated from modal)
  const [planData, setPlanData] = useState<InstallmentPlanData>({
    ...defaultPlanData,
    startDate: today,
  });
  const [showPlanModal, setShowPlanModal] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);

  const isFull = paymentType === "full";
  const isPartial = paymentType === "partial";
  const isInstallment = paymentType === "installment";

  // Derived from planData for installment
  const installmentAmountValue = useMemo(
    () => parseMoney(planData.rawInstallmentAmount),
    [planData.rawInstallmentAmount]
  );
  const installmentsCountValue = useMemo(() => {
    const parsed = Number(planData.installmentsCount);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
  }, [planData.installmentsCount]);

  const formattedAmount = useMemo(() => formatAmountInput(rawAmount), [rawAmount]);

  const discountAmount = useMemo(() => Math.max(0, parseMoney(rawDiscount)), [rawDiscount]);
  const subtotalAmount = useMemo(() => parseMoney(rawAmount), [rawAmount]);
  const totalAmount = useMemo(
    () => roundMoney(Math.max(0, subtotalAmount - discountAmount)),
    [subtotalAmount, discountAmount]
  );

  const rawFinalAmount = useMemo(() => String(totalAmount), [totalAmount]);

  const effectivePaidAmount = useMemo(() => {
    if (isFull) return rawFinalAmount;
    if (isPartial) return rawPaidAmount;
    if (isInstallment) return planData.rawPaidAmount;
    return "";
  }, [isFull, isPartial, isInstallment, rawFinalAmount, rawPaidAmount, planData.rawPaidAmount]);

  const formattedPaidAmount = useMemo(
    () => formatAmountInput(effectivePaidAmount),
    [effectivePaidAmount]
  );

  const paidAmount = useMemo(() => parseMoney(effectivePaidAmount), [effectivePaidAmount]);

  const remainingBalance = useMemo(
    () => Math.max(0, roundMoney(totalAmount - paidAmount)),
    [totalAmount, paidAmount]
  );

  const estimatedPlanTotal = useMemo(() => {
    if (!installmentsCountValue || installmentAmountValue <= 0) return 0;
    return roundMoney(installmentAmountValue * installmentsCountValue);
  }, [installmentsCountValue, installmentAmountValue]);

  const estimatedDifference = useMemo(() => {
    if (!remainingBalance || !estimatedPlanTotal) return 0;
    return roundMoney(estimatedPlanTotal - remainingBalance);
  }, [estimatedPlanTotal, remainingBalance]);

  const deferredNote = useDeferredValue(note);
  const itemDescription = useMemo(() => deferredNote.trim() || "Venta registrada", [deferredNote]);

  const isPlanConfigured = useMemo(
    () =>
      isInstallment &&
      Boolean(planData.rawInstallmentAmount && planData.installmentsCount && planData.startDate),
    [isInstallment, planData.rawInstallmentAmount, planData.installmentsCount, planData.startDate]
  );

  const clientError = useMemo(() => {
    if (subtotalAmount <= 0) return "Ingresa un monto mayor a 0.";
    if (discountAmount > 0 && discountAmount >= subtotalAmount) return "El descuento debe ser menor al monto.";
    if (paidAmount > totalAmount) return "El monto pagado no puede ser mayor que el total.";

    if (isPartial) {
      if (paidAmount <= 0) return "Debes indicar un abono mayor a 0.";
      if (paidAmount >= totalAmount) return "Si el cliente pagó todo, usa tipo de pago Completo.";
    }
    if (isInstallment) {
      if (!isPlanConfigured) return "Configura el plan de cuotas antes de guardar.";
      if (installmentAmountValue <= 0) return "El monto por cuota debe ser mayor a 0.";
      if (!installmentsCountValue) return "Indica la cantidad de cuotas.";
      if (!planData.startDate) return "Indica la fecha de inicio del plan.";
    }
    return "";
  }, [
    subtotalAmount,
    discountAmount,
    totalAmount,
    paidAmount,
    isPartial,
    isInstallment,
    isPlanConfigured,
    installmentAmountValue,
    installmentsCountValue,
    planData.startDate,
  ]);

  const installmentWarning = useMemo(() => {
    if (!isInstallment || !isPlanConfigured) return "";
    if (!remainingBalance || !estimatedPlanTotal || estimatedDifference === 0) return "";
    return `La suma estimada de cuotas difiere del saldo por ${formatCurrency(Math.abs(estimatedDifference))}.`;
  }, [isInstallment, isPlanConfigured, remainingBalance, estimatedPlanTotal, estimatedDifference]);

  const handlePlanConfirm = useCallback((data: InstallmentPlanData) => {
    setPlanData(data);
    setRawPaidAmount(data.rawPaidAmount);
  }, []);

  const syncLineItems = useCallback((items: LineItem[]) => {
    setLineItems(items);
    if (items.length === 0) return;
    const total = roundMoney(items.reduce((s, i) => s + i.qty * i.unitPrice, 0));
    setRawAmount(String(total));
    setNote(items.map((i) => i.name).join(", "));
  }, []);

  const handlePaymentTypeChange = useCallback((nextPaymentType: string) => {
    setPaymentType(nextPaymentType);
    if (nextPaymentType === "full") {
      setRawPaidAmount("");
      setPlanData({ ...defaultPlanData, startDate: today });
      return;
    }
    if (nextPaymentType === "partial") {
      setPlanData({ ...defaultPlanData, startDate: today });
      return;
    }
    if (nextPaymentType === "installment") {
      setPlanData((prev) => ({ ...prev, startDate: prev.startDate || today }));
    }
  }, [today]);

  const hasProducts = (products ?? []).length > 0;
  const hasServices = (services ?? []).length > 0;
  const hasLineItems = lineItems.length > 0;

  // Success reset
  useEffect(() => {
    if (!state?.timestamp) return;
    if (state.success) {
      const resetTimer = window.setTimeout(() => {
        setShowSuccess(true);
        setLineItems([]);
        setRawAmount("");
        setRawDiscount("");
        setRawPaidAmount("");
        setPaymentType("full");
        setNote("");
        setPlanData({ ...defaultPlanData, startDate: today });
        setSaleDateTime(getCurrentDateTimeLocal());
        formRef.current?.reset();
      }, 0);

      if (onSuccess) {
        const closeTimer = window.setTimeout(() => onSuccess(), 700);
        return () => {
          window.clearTimeout(resetTimer);
          window.clearTimeout(closeTimer);
        };
      }
      const timer = window.setTimeout(() => setShowSuccess(false), 4000);
      return () => {
        window.clearTimeout(resetTimer);
        window.clearTimeout(timer);
      };
    }
    const timer = window.setTimeout(() => setShowSuccess(false), 0);
    return () => window.clearTimeout(timer);
  }, [state?.success, state?.timestamp, onSuccess, today]);

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        className="space-y-3 pt-1"
        onSubmit={(e) => {
          if (clientError) e.preventDefault();
        }}
      >
        {/* Line items — productos y/o servicios */}
        {(hasProducts || hasServices) ? (
          <div className="space-y-2">
            {lineItems.length > 0 ? (
              <div className="space-y-1.5">
                {lineItems.map((item) => (
                  <div
                    key={item.uid}
                    className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.qty} × {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(item.qty * item.unitPrice)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        syncLineItems(lineItems.filter((i) => i.uid !== item.uid));
                      }}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className={hasProducts && hasServices ? "grid grid-cols-2 gap-2" : ""}>
              {hasProducts && (
                <button
                  type="button"
                  onClick={() => setShowProductPicker(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-sky-300 bg-sky-50/60 px-4 py-2.5 text-sm font-medium text-sky-700 transition hover:bg-sky-50 dark:border-sky-700 dark:bg-sky-950/30 dark:text-sky-300 dark:hover:bg-sky-900/30"
                >
                  <span className="text-base leading-none">+</span>
                  <span>Producto</span>
                </button>
              )}
              {hasServices && (
                <button
                  type="button"
                  onClick={() => setShowServicePicker(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-violet-300 bg-violet-50/60 px-4 py-2.5 text-sm font-medium text-violet-700 transition hover:bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-300 dark:hover:bg-violet-900/30"
                >
                  <span className="text-base leading-none">+</span>
                  <span>Servicio</span>
                </button>
              )}
            </div>
          </div>
        ) : null}

        {/* Hidden fields always included */}
        <input type="hidden" name="paymentDate" value={saleDateTime.slice(0, 10)} />
        <input type="hidden" name="invoiceNotes" value={deferredNote} />
        {hasLineItems ? (
          lineItems.map((item) => (
            <Fragment key={item.uid}>
              <input type="hidden" name="itemDescription[]" value={item.name} />
              <input type="hidden" name="itemQuantity[]" value={String(item.qty)} />
              <input type="hidden" name="itemUnitPrice[]" value={String(item.unitPrice)} />
              <input type="hidden" name="productId[]" value={item.productId} />
              <input type="hidden" name="qty[]" value={String(item.qty)} />
            </Fragment>
          ))
        ) : (
          <>
            <input type="hidden" name="itemDescription[]" value={itemDescription} />
            <input type="hidden" name="itemQuantity[]" value="1" />
            <input type="hidden" name="itemUnitPrice[]" value={rawAmount} />
          </>
        )}
        <input type="hidden" name="paidAmount" value={effectivePaidAmount} />
        <input type="hidden" name="discountAmount" value={rawDiscount || "0"} />

        {/* Hidden fields for installment plan */}
        {isInstallment ? (
          <>
            <input type="hidden" name="customerPhone" value={planData.customerPhone} />
            <input type="hidden" name="installmentAmount" value={planData.rawInstallmentAmount} />
            <input type="hidden" name="installmentsCount" value={planData.installmentsCount} />
            <input type="hidden" name="frequency" value={planData.frequency} />
            <input type="hidden" name="startDate" value={planData.startDate || today} />
            <input type="hidden" name="planName" value={planData.planName} />
            <input type="hidden" name="planNotes" value={planData.planNotes} />
          </>
        ) : null}

        {/* Customer name + company */}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <label
              htmlFor="customerName"
              className="block text-sm font-medium text-slate-500 dark:text-slate-300"
            >
              Cliente{isInstallment ? "" : " (opcional)"}
              {isInstallment ? (
                <span className="ml-1 text-rose-400">*</span>
              ) : null}
            </label>
            <input
              id="customerName"
              name="customerName"
              type="text"
              placeholder={
                isInstallment
                  ? "Nombre del cliente (requerido)"
                  : "Nombre del cliente"
              }
              required={isInstallment}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="customerCompany"
              className="block text-sm font-medium text-slate-500 dark:text-slate-300"
            >
              Empresa (opcional)
            </label>
            <input
              id="customerCompany"
              name="customerCompany"
              type="text"
              placeholder="Empresa del cliente"
              className={inputClass}
            />
          </div>
        </div>

        {/* Amount */}
        <div className="space-y-1">
          <label
            htmlFor="amount_display"
            className="block text-sm font-medium text-slate-500 dark:text-slate-300"
          >
            Monto
          </label>
          {hasLineItems ? (
            <div className="flex h-10 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[15px] font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100">
              {formatCurrency(subtotalAmount)}
            </div>
          ) : (
            <input
              id="amount_display"
              type="text"
              inputMode="decimal"
              placeholder="$ 1,234.56"
              value={formattedAmount}
              onChange={(e) => setRawAmount(normalizeAmountInput(e.target.value))}
              className={inputClass}
              required
            />
          )}
          <input type="hidden" name="amount" value={rawAmount} />
        </div>

        {/* Discount */}
        <div className="space-y-1">
          <label
            htmlFor="discount_display"
            className="block text-sm font-medium text-slate-500 dark:text-slate-300"
          >
            Descuento (opcional)
          </label>
          <input
            id="discount_display"
            type="text"
            inputMode="decimal"
            placeholder="$ 0.00"
            value={rawDiscount ? formatAmountInput(rawDiscount) : ""}
            onChange={(e) => setRawDiscount(normalizeAmountInput(e.target.value))}
            className={inputClass}
          />
          {discountAmount > 0 && subtotalAmount > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex items-center justify-between gap-3 py-0.5 text-slate-500 dark:text-slate-400">
                <span>Subtotal</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(subtotalAmount)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 py-0.5 text-rose-500 dark:text-rose-400">
                <span>Descuento</span>
                <span className="font-medium">−{formatCurrency(discountAmount)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 py-0.5 font-semibold text-slate-900 dark:text-slate-100">
                <span>Total</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Payment method + type */}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <label
              htmlFor="paymentMethod"
              className="block text-sm font-medium text-slate-500 dark:text-slate-300"
            >
              Método de pago
            </label>
            <select
              id="paymentMethod"
              name="paymentMethod"
              defaultValue="cash"
              className={inputClass}
              required
            >
              {(paymentMethods ?? []).map((m) => (
                <option key={m.id} value={m.type}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="paymentType"
              className="block text-sm font-medium text-slate-500 dark:text-slate-300"
            >
              Tipo de pago
            </label>
            <select
              id="paymentType"
              name="paymentType"
              value={paymentType}
              onChange={(e) => handlePaymentTypeChange(e.target.value)}
              className={inputClass}
              required
            >
              <option value="full">Completo</option>
              <option value="installment">Cuotas</option>
            </select>
          </div>
        </div>

        {/* Partial: paid amount */}
        {isPartial ? (
          <div className="space-y-1">
            <label
              htmlFor="paidAmount_display"
              className="block text-sm font-medium text-slate-500 dark:text-slate-300"
            >
              Abono recibido
            </label>
            <input
              id="paidAmount_display"
              type="text"
              inputMode="decimal"
              placeholder="$ 1,234.56"
              value={formattedPaidAmount}
              onChange={(e) => setRawPaidAmount(normalizeAmountInput(e.target.value))}
              className={inputClass}
            />
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs dark:border-slate-800 dark:bg-slate-900/60">
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Total</p>
                  <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(totalAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Abonado</p>
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
              </div>
            </div>
          </div>
        ) : null}

        {/* Installment: trigger / summary */}
        {isInstallment ? (
          <div>
            {!isPlanConfigured ? (
              <button
                type="button"
                onClick={() => setShowPlanModal(true)}
                className="flex w-full items-center justify-between rounded-2xl border border-dashed border-indigo-300 bg-indigo-50/60 px-4 py-3 text-sm font-medium text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:border-indigo-500"
              >
                <span>Configurar plan de cuotas</span>
                <span className="text-indigo-400">→</span>
              </button>
            ) : (
              <div className="rounded-3xl border border-indigo-200 bg-indigo-50/60 p-3 dark:border-indigo-800 dark:bg-indigo-950/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                      Plan de cuotas configurado
                    </p>
                    <p className="text-xs text-indigo-700 dark:text-indigo-300">
                      {planData.installmentsCount} cuotas de{" "}
                      {formatCurrency(installmentAmountValue)} ·{" "}
                      {planData.frequency === "weekly"
                        ? "Semanal"
                        : planData.frequency === "biweekly"
                          ? "Quincenal"
                          : "Mensual"}
                    </p>
                    {paidAmount > 0 ? (
                      <p className="text-xs text-indigo-600 dark:text-indigo-400">
                        Pago inicial: {formatCurrency(paidAmount)}
                      </p>
                    ) : null}
                    {planData.startDate ? (
                      <p className="text-xs text-indigo-500 dark:text-indigo-400">
                        Primera cuota: {planData.startDate}
                      </p>
                    ) : null}
                    {planData.customerPhone ? (
                      <p className="text-xs text-indigo-500 dark:text-indigo-400">
                        Tel: {planData.customerPhone}
                      </p>
                    ) : null}
                    {installmentWarning ? (
                      <p className="pt-1 text-xs text-amber-600 dark:text-amber-300">
                        {installmentWarning}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPlanModal(true)}
                    className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-all duration-150 hover:border-amber-300 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/15 dark:hover:text-amber-200"
                  >
                    Editar
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Fecha de venta */}
        <div className="space-y-1">
          <label
            htmlFor="saleDate"
            className="block text-sm font-medium text-slate-500 dark:text-slate-300"
          >
            Fecha de venta
          </label>
          <input
            id="saleDate"
            name={canEditManualDates ? "saleDate" : undefined}
            type={canEditManualDates ? "datetime-local" : "text"}
            value={canEditManualDates ? saleDateTime : formatDisplayDate(saleDateTime)}
            readOnly={!canEditManualDates}
            onChange={(e) => {
              if (canEditManualDates) setSaleDateTime(e.target.value);
            }}
            className={`${inputClass} ${
              canEditManualDates
                ? ""
                : "cursor-not-allowed bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400"
            }`}
            required
          />
          {!canEditManualDates ? (
            <>
              <input type="hidden" name="saleDate" value={saleDateTime.slice(0, 10)} />
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                La fecha se asigna automáticamente.
              </p>
            </>
          ) : null}
        </div>

        {/* Note */}
        <div className="space-y-1">
          <label
            htmlFor="note"
            className="block text-sm font-medium text-slate-500 dark:text-slate-300"
          >
            Detalles
          </label>
          <textarea
            id="note"
            name="note"
            placeholder="Agrega un detalle (opcional)"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-[54px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-cyan-400 dark:focus:ring-cyan-500/10"
          />
        </div>

        <SubmitButton success={showSuccess} disabled={Boolean(clientError)} />

        {clientError ? (
          <p className="text-xs text-rose-500 dark:text-rose-300">{clientError}</p>
        ) : null}

        {!state.success && state.message ? (
          <p className="text-xs text-rose-500 dark:text-rose-300">{state.message}</p>
        ) : null}
      </form>

      {isInstallment && showPlanModal && (
        <InstallmentPlanModal
          open={showPlanModal}
          onClose={() => setShowPlanModal(false)}
          onConfirm={handlePlanConfirm}
          initialData={planData}
          totalAmount={totalAmount}
          today={today}
        />
      )}

      {hasProducts && showProductPicker && (
        <ProductPickerModal
          open={showProductPicker}
          products={products ?? []}
          existingItems={lineItems}
          onAdd={(item) => syncLineItems([...lineItems, item])}
          onClose={() => setShowProductPicker(false)}
        />
      )}

      {hasServices && showServicePicker && (
        <ServicePickerModal
          open={showServicePicker}
          services={services ?? []}
          onAdd={(item) => syncLineItems([...lineItems, item])}
          onClose={() => setShowServicePicker(false)}
        />
      )}
    </>
  );
}
