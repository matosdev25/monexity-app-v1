"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createExpense } from "./actions";
import type { ExpenseActionState } from "./types";
import { SubmitButton } from "../../../components/submit-button";
import { PAYMENT_METHODS, type PaymentMethodOptionFull } from "../../../lib/payments";

const initialState: ExpenseActionState = { success: false, message: "" };

const inputClass =
  "h-10 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:scheme-dark dark:focus:border-cyan-400 dark:focus:ring-cyan-500/10";

const labelClass = "mb-1 block text-sm font-medium text-slate-500 dark:text-slate-300";

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
  const formattedInteger = new Intl.NumberFormat("es-PA").format(Number(integerPart || "0"));
  return hasDecimal ? `${formattedInteger}.${decimalPart}` : formattedInteger;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type CreateExpenseFormProps = {
  today: string;
  onSuccess?: () => void;
  paymentMethods?: PaymentMethodOptionFull[];
  canEditManualDates?: boolean;
};

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

export function CreateExpenseForm({
  onSuccess,
  paymentMethods,
  canEditManualDates = false,
}: CreateExpenseFormProps) {
  const methods = paymentMethods && paymentMethods.length > 0
    ? paymentMethods
    : PAYMENT_METHODS.map((m) => ({ id: m.value, type: m.value, label: m.label, details: null }));
  const [state, formAction] = useActionState(createExpense, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rawAmount, setRawAmount] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [expenseDateTime, setExpenseDateTime] = useState(() => getCurrentDateTimeLocal());
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);

  const formattedAmount = useMemo(() => formatAmountInput(rawAmount), [rawAmount]);

  // Revoke object URL on cleanup
  useEffect(() => {
    return () => {
      if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    };
  }, [receiptPreviewUrl]);

  useEffect(() => {
    if (!state.success) return;
    const resetTimer = window.setTimeout(() => {
      formRef.current?.reset();
      setRawAmount("");
      setIsRecurring(false);
      setExpenseDateTime(getCurrentDateTimeLocal());
      if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
      setReceiptFile(null);
      setReceiptPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }, 0);
    if (!onSuccess) return;
    const timer = window.setTimeout(() => { onSuccess(); }, 700);
    return () => {
      window.clearTimeout(resetTimer);
      window.clearTimeout(timer);
    };
  }, [state.success, state.timestamp, onSuccess, receiptPreviewUrl]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    setReceiptFile(file);
    if (file.type.startsWith("image/")) {
      setReceiptPreviewUrl(URL.createObjectURL(file));
    } else {
      setReceiptPreviewUrl(null);
    }
  }

  function clearReceipt() {
    if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    setReceiptFile(null);
    setReceiptPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const isImageFile = receiptFile?.type.startsWith("image/") ?? false;

  return (
    <form ref={formRef} action={formAction} className="space-y-3 pt-1">

      {/* Monto */}
      <div>
        <label htmlFor="amount_display" className={labelClass}>Monto</label>
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
        <input type="hidden" name="amount" value={rawAmount} />
      </div>

      {/* Categoría + Fecha */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className={labelClass}>Categoría</label>
          <select id="category" name="category" required defaultValue="inventory" className={inputClass}>
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
          <label htmlFor="expenseDate" className={labelClass}>Fecha</label>
          <input
            id="expenseDate"
            name={canEditManualDates ? "expenseDate" : undefined}
            type={canEditManualDates ? "datetime-local" : "text"}
            value={canEditManualDates ? expenseDateTime : formatDisplayDate(expenseDateTime)}
            readOnly={!canEditManualDates}
            onChange={(e) => {
              if (canEditManualDates) setExpenseDateTime(e.target.value);
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
              <input type="hidden" name="expenseDate" value={expenseDateTime.slice(0, 10)} />
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                La fecha se asigna automáticamente.
              </p>
            </>
          ) : null}
        </div>
      </div>

      {/* Proveedor */}
      <div>
        <label htmlFor="supplier" className={labelClass}>
          Proveedor <span className="font-normal text-slate-400">(opcional)</span>
        </label>
        <input
          id="supplier"
          name="supplier"
          type="text"
          placeholder="Nombre del proveedor"
          className={inputClass}
        />
      </div>

      {/* Método de pago + Estado */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="paymentMethod" className={labelClass}>Método de pago</label>
          <select id="paymentMethod" name="paymentMethod" defaultValue={methods[0]?.type ?? "cash"} className={inputClass}>
            {methods.map((m) => (
              <option key={m.id} value={m.type}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className={labelClass}>Estado</label>
          <select id="status" name="status" defaultValue="paid" className={inputClass}>
            <option value="paid">Pagado</option>
            <option value="pending">Pendiente</option>
          </select>
        </div>
      </div>

      {/* Comprobante */}
      <div>
        <label className={labelClass}>
          Comprobante <span className="font-normal text-slate-400">(opcional)</span>
        </label>

        {/* File input — always in DOM for form submission */}
        <input
          ref={fileInputRef}
          id="receipt-file-input"
          type="file"
          name="receiptFile"
          accept="image/*,application/pdf"
          className="sr-only"
          onChange={handleFileChange}
        />

        {receiptFile ? (
          /* ── File selected: preview ── */
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/70">
            <div className="flex items-center gap-3">
              {isImageFile && receiptPreviewUrl ? (
                /* Image preview */
                <label
                  htmlFor="receipt-file-input"
                  className="block h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
                  title="Cambiar archivo"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={receiptPreviewUrl}
                    alt="Vista previa"
                    className="h-full w-full object-cover"
                  />
                </label>
              ) : (
                /* PDF / generic icon */
                <label
                  htmlFor="receipt-file-input"
                  className="flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                  title="Cambiar archivo"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-slate-400">
                    <path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm2 6a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7Z" clipRule="evenodd" />
                  </svg>
                </label>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {receiptFile.name}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {formatFileSize(receiptFile.size)} · {isImageFile ? "Imagen" : "PDF"}
                </p>
                <label
                  htmlFor="receipt-file-input"
                  className="mt-1 inline-block cursor-pointer text-xs text-sky-600 hover:text-sky-700 dark:text-cyan-400 dark:hover:text-cyan-300"
                >
                  Cambiar
                </label>
              </div>

              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearReceipt(); }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 dark:border-slate-700 dark:hover:border-rose-400/30 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                title="Quitar archivo"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          /* ── No file: upload prompt ── */
          <label
            htmlFor="receipt-file-input"
            className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center transition hover:border-sky-300 hover:bg-sky-50/50 dark:border-slate-600 dark:bg-slate-950/70 dark:hover:border-cyan-400/50 dark:hover:bg-cyan-950/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-slate-400 dark:text-slate-500">
              <path fillRule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l3 3a1 1 0 0 1-1.414 1.414L11 5.414V11a1 1 0 1 1-2 0V5.414L7.707 6.707a1 1 0 0 1-1.414-1.414l3-3ZM4 13a1 1 0 0 1 1 1v.01a3 3 0 0 0 3 3h4a3 3 0 0 0 3-3V14a1 1 0 1 1 2 0v.01a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V14a1 1 0 0 1 1-1Z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Adjuntar comprobante
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Foto del recibo, imagen o PDF
            </span>
          </label>
        )}

        {/* URL secondary option */}
        {!showUrlInput ? (
          <button
            type="button"
            onClick={() => setShowUrlInput(true)}
            className="mt-2 flex items-center gap-1 text-xs text-slate-400 transition hover:text-sky-600 dark:text-slate-500 dark:hover:text-cyan-400"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M7.702 3.146a1 1 0 0 0-1.414 0L3 6.434l1.418 1.414 1.775-1.775v4.93h2v-4.93l1.775 1.775L11.386 6.434 8.104 3.152a.998.998 0 0 0-.402-.006Z" />
              <path d="M2.5 11a.5.5 0 0 0 0 1h11a.5.5 0 0 0 0-1h-11Z" />
            </svg>
            o pegar URL
          </button>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <input
              name="receiptUrl"
              type="url"
              placeholder="https://..."
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setShowUrlInput(false)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:text-slate-600 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:text-slate-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Nota */}
      <div>
        <label htmlFor="note" className={labelClass}>
          Nota <span className="font-normal text-slate-400">(opcional)</span>
        </label>
        <textarea
          id="note"
          name="note"
          rows={2}
          className={`${inputClass} h-auto min-h-13.5 resize-none py-3`}
          placeholder="Detalle adicional"
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
            <label htmlFor="recurringFrequency" className={labelClass}>Frecuencia</label>
            <select id="recurringFrequency" name="recurringFrequency" defaultValue="monthly" className={inputClass}>
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
        idleText="Guardar gasto"
        pendingText="Guardando..."
        className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-sky-600 px-4 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
      />
    </form>
  );
}
