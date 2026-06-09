"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { ButtonSpinner } from "@/components/button-spinner";
import { formatCurrency } from "@/lib/currency-format";
import { updateQuotation, convertQuotationToSale } from "../actions";
import type { Quotation, QuotationItem, QuotationActionState } from "../types";
import type { SalePaymentMethodOption } from "../../sales/types";
import type { CompanyService } from "../../mi-negocio/types";
import {
  InstallmentPlanModal,
  defaultPlanData,
  type InstallmentPlanData,
} from "../../sales/installment-plan-modal";

const initialState: QuotationActionState = { success: false, message: "" };

const labelClass =
  "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-300";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 transition-all duration-150 focus:border-sky-200 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:[color-scheme:dark] dark:focus:border-cyan-400 dark:focus:ring-cyan-500/10";

const inputErrorClass =
  "w-full rounded-xl border border-rose-400 bg-white px-4 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 transition-all duration-150 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 dark:border-rose-400/70 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:[color-scheme:dark] dark:focus:border-rose-400 dark:focus:ring-rose-400/10";

const documentTextareaClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 transition-[border-color,box-shadow,background-color] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:[color-scheme:dark] dark:focus-visible:border-cyan-400 dark:focus-visible:ring-cyan-500/10";

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function extractPanamaDigits(stored: string): string {
  const digits = stored.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("507")) return digits.slice(3);
  if (digits.length === 8) return digits;
  return "";
}

function buildPhoneHidden(digits: string): string {
  if (digits.length !== 8) return "";
  return `+507 ${digits.slice(0, 4)}-${digits.slice(4)}`;
}

const buttonPrimaryClass =
  "w-full rounded-xl border border-sky-600 bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 shadow-[0_10px_24px_rgba(14,165,233,0.22)] hover:bg-sky-700 disabled:opacity-60 dark:border-cyan-500 dark:bg-cyan-500 dark:text-slate-950 dark:shadow-none dark:hover:bg-cyan-400";

type ItemRow = {
  serviceId: string;
  serviceNameSnapshot: string;
  description: string;
  quantity: string;
  unit_price: string;
};

function parseMoney(v: string) {
  const n = Number(v.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(v: number) {
  return Math.round(v * 100) / 100;
}

function sanitizeNumeric(v: string, maxDecimals = 2): string {
  let result = "";
  let hasDot = false;
  let decimals = 0;
  for (const ch of v) {
    if (ch >= "0" && ch <= "9") {
      if (hasDot) { if (decimals < maxDecimals) { result += ch; decimals++; } }
      else result += ch;
    } else if (ch === "." && !hasDot && maxDecimals > 0) {
      result += ch; hasDot = true;
    }
  }
  return result;
}

function EditSubmitButton({ success }: { success: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonPrimaryClass}>
      <span className="inline-flex items-center justify-center gap-2">
        {pending ? (
          <>
            <ButtonSpinner />
            Guardando...
          </>
        ) : success ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4A1 1 0 1 1 4.71 9.29L8 12.586l7.296-7.296a1 1 0 0 1 1.408 0Z" clipRule="evenodd" />
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

function ConvertSubmitButton({ disabled: extraDisabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || extraDisabled}
      className="w-full rounded-xl border border-emerald-600 bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60 dark:border-emerald-500 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
    >
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <ButtonSpinner />
          Convirtiendo...
        </span>
      ) : (
        "Convertir a venta"
      )}
    </button>
  );
}

// ── Convert section ────────────────────────────────────────────────────────────

type ConvertSectionProps = {
  quotationId: string;
  paymentMethods: SalePaymentMethodOption[];
  today: string;
  quotationTotal: number;
};

export function ConvertSection({
  quotationId,
  paymentMethods,
  today,
  quotationTotal,
}: ConvertSectionProps) {
  const [state, formAction] = useActionState(convertQuotationToSale, initialState);
  const [paymentType, setPaymentType] = useState<"full" | "installment">("full");
  const [planData, setPlanData] = useState<InstallmentPlanData | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);

  const canSubmit = paymentType === "full" || planData !== null;

  return (
    <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
        Convertir a venta
      </p>
      <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-400/80">
        Se creará una venta con los datos de esta cotización. La cotización quedará marcada como convertida.
      </p>

      <form action={formAction} className="mt-3 space-y-3">
        <input type="hidden" name="quotationId" value={quotationId} />
        <input type="hidden" name="paymentType" value={paymentType} />

        {planData ? (
          <>
            <input type="hidden" name="planName" value={planData.planName} />
            <input type="hidden" name="frequency" value={planData.frequency} />
            <input type="hidden" name="installmentAmount" value={planData.rawInstallmentAmount} />
            <input type="hidden" name="installmentsCount" value={planData.installmentsCount} />
            <input type="hidden" name="startDate" value={planData.startDate} />
            <input type="hidden" name="planNotes" value={planData.planNotes} />
            <input type="hidden" name="paidAmount" value={planData.rawPaidAmount} />
            <input type="hidden" name="customerPhone" value={planData.customerPhone} />
          </>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Método de pago</label>
            <select name="paymentMethod" className={inputClass}>
              {paymentMethods.map((m) => (
                <option key={m.id} value={m.type}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Tipo de pago</label>
            <div className="flex gap-2">
              {(["full", "installment"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setPaymentType(t);
                    if (t === "full") setPlanData(null);
                  }}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-[180ms] ${
                    paymentType === t
                      ? "border-emerald-500 bg-emerald-500 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-slate-950"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100"
                  }`}
                >
                  {t === "full" ? "Completa" : "Cuotas"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {paymentType === "installment" ? (
          planData ? (
            <div className="rounded-2xl border border-indigo-200/70 bg-indigo-50/60 px-4 py-3 dark:border-indigo-500/20 dark:bg-indigo-500/10">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-200">
                    {planData.planName || "Plan de cuotas"}
                  </p>
                  <p className="mt-0.5 text-xs text-indigo-700/80 dark:text-indigo-300/80">
                    {planData.installmentsCount} cuotas ·{" "}
                    {planData.frequency === "monthly"
                      ? "mensual"
                      : planData.frequency === "biweekly"
                      ? "quincenal"
                      : "semanal"}{" "}
                    · desde {planData.startDate}
                  </p>
                  {planData.rawPaidAmount && Number(planData.rawPaidAmount) > 0 ? (
                    <p className="mt-0.5 text-xs text-indigo-600/70 dark:text-indigo-400/70">
                      Inicial: {formatCurrency(Number(planData.rawPaidAmount))}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setShowPlanModal(true)}
                  className="shrink-0 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 transition-all duration-[180ms] hover:border-indigo-300 hover:bg-indigo-50 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
                >
                  Editar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowPlanModal(true)}
              className="w-full rounded-xl border border-dashed border-indigo-300 bg-indigo-50/40 px-4 py-3 text-sm font-medium text-indigo-700 transition-all duration-[180ms] hover:border-indigo-400 hover:bg-indigo-50 dark:border-indigo-500/30 dark:bg-indigo-500/5 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
            >
              Configurar plan de cuotas
            </button>
          )
        ) : null}

        {state.message && !state.success ? (
          <p className="text-xs text-rose-600 dark:text-rose-300">{state.message}</p>
        ) : null}

        <ConvertSubmitButton disabled={!canSubmit} />
      </form>

      {showPlanModal ? (
        <InstallmentPlanModal
          open={showPlanModal}
          onClose={() => setShowPlanModal(false)}
          onConfirm={(data) => {
            setPlanData(data);
            setShowPlanModal(false);
          }}
          initialData={planData ?? defaultPlanData}
          totalAmount={quotationTotal}
          today={today}
        />
      ) : null}
    </div>
  );
}

// ── Edit form ─────────────────────────────────────────────────────────────────

type EditQuotationFormProps = {
  quotation: Quotation;
  items: QuotationItem[];
  services: CompanyService[];
  onSuccess?: () => void;
  embedded?: boolean;
  formId?: string;
  hideSubmit?: boolean;
  onSavingChange?: (saving: boolean) => void;
};

export function EditQuotationForm({
  quotation,
  items: initialItems,
  services,
  onSuccess,
  embedded = false,
  formId,
  hideSubmit = false,
  onSavingChange,
}: EditQuotationFormProps) {
  const [state, formAction] = useActionState(updateQuotation, initialState);
  const [showSuccess, setShowSuccess] = useState(false);
  const [open, setOpen] = useState(embedded);
  const [emailError, setEmailError] = useState("");
  const [phoneDigits, setPhoneDigits] = useState(() => extractPanamaDigits(quotation.customer_phone ?? ""));

  const [rows, setRows] = useState<ItemRow[]>(
    initialItems.length > 0
      ? initialItems.map((it) => ({
          serviceId: it.service_id ?? "",
          serviceNameSnapshot: it.service_name_snapshot ?? "",
          description: it.description,
          quantity: String(it.quantity),
          unit_price: String(it.unit_price),
        }))
      : [{ serviceId: "", serviceNameSnapshot: "", description: "", quantity: "1", unit_price: "" }]
  );
  const [discountType, setDiscountType] = useState<"$" | "%">("$");
  const [discountValue, setDiscountValue] = useState(
    () => (quotation.discount_amount && Number(quotation.discount_amount) > 0
      ? String(Number(quotation.discount_amount))
      : "")
  );

  useEffect(() => {
    if (!state.success) return;
    const t0 = window.setTimeout(() => setShowSuccess(true), 0);
    const t1 = window.setTimeout(() => setShowSuccess(false), 4000);
    const t2 = window.setTimeout(() => {
      onSuccess?.();
      if (!embedded) setOpen(false);
    }, 800);
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [embedded, state.success, state.timestamp, onSuccess]);

  useEffect(() => {
    if (!state.timestamp) return;
    onSavingChange?.(false);
  }, [onSavingChange, state.timestamp]);

  const subtotal = useMemo(
    () => roundMoney(rows.reduce((sum, row) => {
      const qty = parseMoney(row.quantity) || 1;
      return sum + qty * parseMoney(row.unit_price);
    }, 0)),
    [rows]
  );

  const discountAmt = useMemo(() => {
    const v = parseMoney(discountValue);
    if (discountType === "%") return roundMoney(Math.min(100, Math.max(0, v)) * subtotal / 100);
    return roundMoney(Math.max(0, v));
  }, [discountType, discountValue, subtotal]);
  const total = useMemo(() => roundMoney(Math.max(0, subtotal - discountAmt)), [subtotal, discountAmt]);

  function updateRow(index: number, updates: Partial<ItemRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...updates } : row)));
  }

  function selectService(index: number, serviceId: string) {
    const service = services.find((s) => s.id === serviceId);
    if (service) {
      updateRow(index, {
        serviceId: service.id,
        serviceNameSnapshot: service.name,
        description: service.name,
        unit_price: service.base_price != null ? String(service.base_price) : "",
      });
    } else {
      updateRow(index, { serviceId: "", serviceNameSnapshot: "" });
    }
  }

  function addRow() {
    setRows((prev) => [...prev, { serviceId: "", serviceNameSnapshot: "", description: "", quantity: "1", unit_price: "" }]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  if (!open && !embedded) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700 transition-all duration-150 hover:border-amber-300 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/15 dark:hover:text-amber-200"
      >
        Editar cotización
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Editar cotización</h3>
        {!embedded ? (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Cancelar
          </button>
        ) : null}
      </div>

      <form
        id={formId}
        action={formAction}
        onSubmit={() => onSavingChange?.(true)}
        className="mt-4 space-y-4"
      >
        <input type="hidden" name="quotationId" value={quotation.id} />

        {/* Cliente */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Cliente</label>
            <input name="customerName" type="text" maxLength={120} defaultValue={quotation.customer_name ?? ""} className={inputClass} placeholder="Nombre del cliente" />
          </div>
          <div>
            <label className={labelClass}>Empresa (opcional)</label>
            <input name="customerCompany" type="text" maxLength={120} defaultValue={quotation.customer_company ?? ""} className={inputClass} placeholder="Empresa" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Email (opcional)</label>
            <input
              name="customerEmail"
              type="email"
              maxLength={120}
              defaultValue={quotation.customer_email ?? ""}
              className={emailError ? inputErrorClass : inputClass}
              onBlur={(e) => {
                const v = e.target.value.trim();
                setEmailError(v && !isValidEmail(v) ? "Ingresa un email válido." : "");
              }}
              onChange={(e) => {
                if (emailError) {
                  const v = e.target.value.trim();
                  setEmailError(v && !isValidEmail(v) ? "Ingresa un email válido." : "");
                }
              }}
            />
            {emailError && (
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{emailError}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Teléfono (opcional)</label>
            <input type="hidden" name="customerPhone" value={buildPhoneHidden(phoneDigits)} />
            <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-150 focus-within:border-sky-200 focus-within:ring-2 focus-within:ring-sky-100 dark:border-slate-700 dark:bg-slate-950/70 dark:focus-within:border-cyan-400 dark:focus-within:ring-cyan-500/10">
              <span className="select-none pl-4 pr-2 text-sm text-slate-500 dark:text-slate-400">+507</span>
              <div className="h-4 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
              <input
                type="tel"
                inputMode="numeric"
                value={phoneDigits.length <= 4 ? phoneDigits : `${phoneDigits.slice(0, 4)}-${phoneDigits.slice(4)}`}
                onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="6000-0000"
                maxLength={9}
                className="min-w-0 flex-1 bg-transparent py-2.5 pl-2 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Fechas */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Fecha de emisión</label>
            <input type="hidden" name="issueDate" value={quotation.issue_date} readOnly />
            <input
              type="text"
              value={quotation.issue_date}
              readOnly
              tabIndex={-1}
              className={`${inputClass} cursor-default select-none opacity-70`}
              aria-hidden="true"
            />
          </div>
          <div>
            <label className={labelClass}>Válida hasta (opcional)</label>
            <input name="validUntil" type="date" defaultValue={quotation.valid_until ?? ""} className={inputClass} />
          </div>
        </div>

        {/* Ítems */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className={labelClass}>Ítems</span>
            <button type="button" onClick={addRow} className="text-xs font-medium text-sky-600 hover:text-sky-700 dark:text-cyan-400 dark:hover:text-cyan-300">
              + Agregar línea
            </button>
          </div>

          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950/70">
                {/* Service selector */}
                {services.length > 0 && (
                  <div className="mb-2">
                    <select
                      value={row.serviceId}
                      onChange={(e) => selectService(i, e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-200 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300 dark:focus:border-cyan-400"
                    >
                      <option value="">— Línea manual —</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}{s.base_price != null ? ` (${formatCurrency(s.base_price)})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <input type="hidden" name="itemServiceId[]" value={row.serviceId} />
                <input type="hidden" name="itemServiceName[]" value={row.serviceNameSnapshot} />

                <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_72px_96px_32px] sm:items-center">
                  <input
                    name="itemDescription[]"
                    type="text"
                    required
                    value={row.description}
                    onChange={(e) => updateRow(i, { description: e.target.value })}
                    placeholder="Descripción"
                    className={inputClass}
                  />
                  <input
                    name="itemQuantity[]"
                    type="text"
                    inputMode="numeric"
                    value={row.quantity}
                    onChange={(e) => updateRow(i, { quantity: sanitizeNumeric(e.target.value, 2) })}
                    placeholder="1"
                    className={`${inputClass} sm:text-center`}
                  />
                  <input
                    name="itemUnitPrice[]"
                    type="text"
                    inputMode="decimal"
                    value={row.unit_price}
                    onChange={(e) => updateRow(i, { unit_price: sanitizeNumeric(e.target.value, 2) })}
                    placeholder="$ 0.00"
                    className={inputClass}
                  />
                  {rows.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-200/80 bg-rose-50/80 text-rose-500 transition hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
                    >
                      ✕
                    </button>
                  ) : (
                    <div className="h-9 w-9 shrink-0" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resumen */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Resumen</p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm text-slate-500 dark:text-slate-400">Descuento</label>
              <div className="flex items-center gap-1.5">
                <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => { setDiscountType("$"); setDiscountValue(""); }}
                    className={`px-2.5 py-1.5 font-semibold transition-colors duration-150 ${discountType === "$" ? "bg-sky-500 text-white dark:bg-cyan-500 dark:text-slate-950" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}
                  >$</button>
                  <button
                    type="button"
                    onClick={() => { setDiscountType("%"); setDiscountValue(""); }}
                    className={`px-2.5 py-1.5 font-semibold transition-colors duration-150 ${discountType === "%" ? "bg-sky-500 text-white dark:bg-cyan-500 dark:text-slate-950" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}
                  >%</button>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={discountValue}
                  onChange={(e) => {
                    const v = sanitizeNumeric(e.target.value, 2);
                    setDiscountValue(discountType === "%" && parseMoney(v) > 100 ? "100" : v);
                  }}
                  placeholder="0"
                  className="w-20 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-right text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-200 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-cyan-400"
                />
                <input type="hidden" name="discountAmount" value={String(discountAmt)} />
                <input type="hidden" name="taxAmount" value="0" />
              </div>
            </div>
            {discountAmt > 0 ? (
              <p className="text-right text-xs text-rose-500 dark:text-rose-400">
                −{formatCurrency(discountAmt)}
                {discountType === "%" ? ` (${discountValue}%)` : ""}
              </p>
            ) : null}
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2 dark:border-slate-700">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Total</span>
              <span className="text-base font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Notas y términos */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/50 sm:p-5">
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr))]">
            <div>
              <label className={labelClass}>Notas (opcional)</label>
              <textarea name="notes" rows={5} defaultValue={quotation.notes ?? ""} className={`${documentTextareaClass} min-h-40 resize-y`} placeholder="Notas para el cliente" />
            </div>
            <div>
              <label className={labelClass}>Términos y condiciones (opcional)</label>
              <textarea name="terms" rows={5} defaultValue={quotation.terms ?? ""} className={`${documentTextareaClass} min-h-40 resize-y`} />
            </div>
          </div>
        </section>

        {!state.success && state.message ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
            {state.message}
          </div>
        ) : null}

        {!hideSubmit ? <EditSubmitButton success={showSuccess} /> : null}
      </form>
    </div>
  );
}
