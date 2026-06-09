"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createPortal } from "react-dom";
import { formatLongDate } from "../../../lib/date-format";
import { formatCurrency } from "../../../lib/currency-format";
import { recordPayment } from "./actions";
import type { SalePaymentMethodOption } from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Company = {
  name: string;
  contactFooter: string;
  logoUrl: string | null;
};

type SaleRef = {
  invoice_number: string | null;
  customer_name: string | null;
};

type RecordPaymentModalProps = {
  saleId: string;
  balanceDue: number;
  today: string;
  paymentMethods?: SalePaymentMethodOption[];
  company?: Company;
  sale?: SaleRef;
};

type ActionState = {
  success: boolean;
  message: string;
  timestamp?: number;
};

type Phase = "form" | "receipt";

export type ReceiptSnapshot = {
  amount: number;
  method: string;
  methodLabel: string;
  paymentDate: string;
  note: string;
  newBalance: number;
  companyName: string;
  contactFooter: string;
  logoUrl: string | null;
  invoiceNumber: string | null;
  customerName: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const initialState: ActionState = { success: false, message: "" };

function fmt$(v: number) { return formatCurrency(v); }

function fmtDate(iso: string) {
  return formatLongDate(iso, iso);
}

function normalizeAmountInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  const integerPart = (parts[0] ?? "").replace(/^0+(?=\d)/, "");
  const decimalPart = parts.slice(1).join("").slice(0, 2);
  return cleaned.includes(".") ? `${integerPart || "0"}.${decimalPart}` : integerPart;
}

// ─── PDF receipt ──────────────────────────────────────────────────────────────

export async function generateReceiptPdf(snap: ReceiptSnapshot): Promise<Blob> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import("jspdf");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const JsPDF: new (opts: any) => any = mod.default ?? mod.jsPDF;

  const M = 14;
  const W = 210;
  const doc = new JsPDF({ unit: "mm", format: "a4", compress: true });

  const dark  = () => doc.setTextColor(15, 23, 42);
  const mid   = () => doc.setTextColor(71, 85, 105);
  const soft  = () => doc.setTextColor(100, 116, 139);
  const hline = (y: number) => {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(M, y, W - M, y);
  };

  let y = M + 4;

  // Logo
  let logoBase64: string | null = null;
  let logoFormat = "PNG";
  if (snap.logoUrl) {
    try {
      const resp = await fetch(snap.logoUrl);
      if (resp.ok) {
        const blob = await resp.blob();
        logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        const m = logoBase64.match(/^data:image\/(\w+);/);
        if (m?.[1]) { logoFormat = m[1].toUpperCase(); if (logoFormat === "JPG") logoFormat = "JPEG"; }
      }
    } catch { /* omit */ }
  }

  const LOGO_SIZE = 14;
  let logoRendered = false;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, logoFormat, M, y, LOGO_SIZE, LOGO_SIZE, undefined, "FAST");
      logoRendered = true;
    } catch { /* omit */ }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  dark();
  if (logoRendered) {
    doc.text(snap.companyName || "Mi negocio", M + LOGO_SIZE + 3, y + 10);
    y += LOGO_SIZE + 3;
  } else {
    doc.text(snap.companyName || "Mi negocio", M, y + 7);
    y += 11;
  }

  // Receipt badge (top-right)
  const bW = 52, bH = 22, bX = W - M - bW;
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.setLineWidth(0.3);
  doc.roundedRect(bX, M - 3, bW, bH, 2, 2, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(22, 163, 74);
  doc.text("COMPROBANTE DE PAGO", bX + bW / 2, M + 3, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(21, 128, 61);
  doc.text(fmt$(snap.amount), bX + bW / 2, M + 11, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(22, 163, 74);
  doc.text(fmtDate(snap.paymentDate), bX + bW / 2, M + 18, { align: "center" });

  // Contact footer
  const footer = snap.contactFooter.trim();
  if (footer) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    soft();
    const lines = footer.split("\n");
    for (const line of lines) {
      doc.text(line.trim(), M, y);
      y += 4;
    }
  }

  y += 4;
  hline(y);
  y += 6;

  // Client / details grid
  const col2X = M + (W - 2 * M) / 2 + 2;
  const rows: [string, string][] = [
    ["Cliente", snap.customerName || "—"],
    ["Factura ref.", snap.invoiceNumber || "—"],
    ["Método de pago", snap.methodLabel],
    ["Fecha de pago", fmtDate(snap.paymentDate)],
  ];
  if (snap.note) rows.push(["Nota", snap.note]);

  for (let i = 0; i < rows.length; i++) {
    const [label, value] = rows[i];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    soft();
    doc.text(label, M, y);
    doc.setFont("helvetica", "bold");
    dark();
    doc.text(value, col2X, y);
    y += 6;
  }

  y += 4;
  hline(y);
  y += 8;

  // Big amount paid box
  const boxH = 28;
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, W - 2 * M, boxH, 3, 3, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(22, 163, 74);
  doc.text("MONTO PAGADO", W / 2, y + 9, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(21, 128, 61);
  doc.text(fmt$(snap.amount), W / 2, y + 21, { align: "center" });
  y += boxH + 8;

  // Remaining balance
  if (snap.newBalance > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    mid();
    doc.text("Saldo restante:", M, y);
    doc.setFont("helvetica", "bold");
    dark();
    doc.text(fmt$(snap.newBalance), M + 40, y);
    y += 10;
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(22, 163, 74);
    doc.text("✓  Saldo completamente pagado", M, y);
    y += 10;
  }

  hline(y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  soft();
  doc.text("Este documento es un comprobante de pago generado por Monexity.", M, y);

  return doc.output("blob") as Blob;
}

// ─── Submit button ─────────────────────────────────────────────────────────────

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 w-full rounded-2xl bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-emerald-500 dark:hover:bg-emerald-400"
    >
      {pending ? "Guardando..." : "Registrar pago"}
    </button>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function RecordPaymentModal({
  saleId,
  balanceDue,
  today,
  paymentMethods,
  company,
  sale,
}: RecordPaymentModalProps) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [receipt, setReceipt] = useState<ReceiptSnapshot | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const [rawAmount, setRawAmount] = useState("");
  const [method, setMethod] = useState(paymentMethods?.[0]?.type ?? "cash");
  const [paymentDate, setPaymentDate] = useState(today);
  const [note, setNote] = useState("");

  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction] = useActionState(recordPayment, initialState);

  useEffect(() => {
    if (!state?.timestamp) return;
    if (state.success) {
      const timer = window.setTimeout(() => {
        const amount = parseFloat(rawAmount) || 0;
        const methodLabel =
          paymentMethods?.find((m) => m.type === method)?.label ?? method;
        const snap: ReceiptSnapshot = {
          amount,
          method,
          methodLabel,
          paymentDate,
          note,
          newBalance: Math.max(0, Math.round((balanceDue - amount) * 100) / 100),
          companyName: company?.name ?? "Mi negocio",
          contactFooter: company?.contactFooter ?? "",
          logoUrl: company?.logoUrl ?? null,
          invoiceNumber: sale?.invoice_number ?? null,
          customerName: sale?.customer_name ?? null,
        };
        setReceipt(snap);
        setPhase("receipt");
      }, 0);
      return () => window.clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.success, state?.timestamp]);

  useEffect(() => {
    if (!open) return;
    const scrollContainer = document.querySelector<HTMLElement>("[data-scroll-container]");
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    if (scrollContainer) scrollContainer.style.overflowY = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      if (scrollContainer) scrollContainer.style.overflowY = "";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleClose() {
    setOpen(false);
    setPhase("form");
    setReceipt(null);
    setRawAmount("");
    setMethod(paymentMethods?.[0]?.type ?? "cash");
    setPaymentDate(today);
    setNote("");
    formRef.current?.reset();
  }

  async function handleDownloadPdf() {
    if (!receipt) return;
    setPdfBusy(true);
    try {
      const blob = await generateReceiptPdf(receipt);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comprobante-pago${receipt.invoiceNumber ? `-${receipt.invoiceNumber}` : ""}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setPdfBusy(false);
    }
  }

  function handleWhatsApp() {
    if (!receipt) return;
    const lines = [
      `*Comprobante de pago — ${receipt.companyName}*`,
      ``,
      receipt.customerName ? `Cliente: ${receipt.customerName}` : null,
      receipt.invoiceNumber ? `Factura ref.: ${receipt.invoiceNumber}` : null,
      `Monto pagado: ${fmt$(receipt.amount)}`,
      `Fecha: ${fmtDate(receipt.paymentDate)}`,
      `Método: ${receipt.methodLabel}`,
      receipt.note ? `Nota: ${receipt.note}` : null,
      receipt.newBalance > 0
        ? `Saldo restante: ${fmt$(receipt.newBalance)}`
        : `✓ Saldo completamente pagado`,
    ].filter(Boolean).join("\n");
    const url = `https://wa.me/?text=${encodeURIComponent(lines)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const modalContent =
    open
      ? createPortal(
          <div className="fixed inset-0 z-[1000]">
            <button
              type="button"
              aria-label="Cerrar"
              className="absolute inset-0 bg-slate-950/45 dark:bg-black/60"
              onClick={handleClose}
            />
            <div className="absolute inset-0 overflow-y-auto overscroll-contain p-4">
              <div className="flex min-h-full items-center justify-center">
                <div className="relative my-4 w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">

                  {phase === "form" && (
                    <>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
                            Abono
                          </p>
                          <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                            Registrar pago
                          </h3>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Saldo pendiente:{" "}
                            <span className="font-medium text-slate-900 dark:text-slate-100">
                              {fmt$(balanceDue)}
                            </span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleClose}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-400 transition hover:text-slate-900 dark:border-slate-700 dark:hover:text-slate-100"
                        >
                          ✕
                        </button>
                      </div>

                      <form ref={formRef} action={formAction} className="mt-4 space-y-3">
                        <input type="hidden" name="saleId" value={saleId} />

                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-slate-500 dark:text-slate-300">
                            Monto recibido
                          </label>
                          <input
                            type="text"
                            name="amount"
                            inputMode="decimal"
                            placeholder="$ 0.00"
                            value={rawAmount}
                            onChange={(e) => setRawAmount(normalizeAmountInput(e.target.value))}
                            className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-500/10"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-slate-500 dark:text-slate-300">
                            Método de pago
                          </label>
                          <select
                            name="paymentMethod"
                            value={method}
                            onChange={(e) => setMethod(e.target.value)}
                            className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:focus:border-emerald-400 dark:focus:ring-emerald-500/10"
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
                          <label className="block text-sm font-medium text-slate-500 dark:text-slate-300">
                            Fecha de pago
                          </label>
                          <input
                            type="date"
                            name="paymentDate"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            className="h-10 w-full rounded-2xl border border-slate-200/70 bg-white/85 px-4 text-[15px] text-slate-900 outline-none backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100/80 dark:border-white/10 dark:bg-white/[0.07] dark:text-slate-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:scheme-dark dark:focus:border-emerald-400/70 dark:focus:ring-emerald-500/10"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-slate-500 dark:text-slate-300">
                            Nota{" "}
                            <span className="text-slate-400">(opcional)</span>
                          </label>
                          <input
                            type="text"
                            name="note"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Referencia, cuota #, etc."
                            className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-500/10"
                          />
                        </div>

                        <SubmitButton />

                        {!state.success && state.message ? (
                          <p className="text-xs text-rose-500 dark:text-rose-300">
                            {state.message}
                          </p>
                        ) : null}
                      </form>
                    </>
                  )}

                  {phase === "receipt" && receipt && (
                    <>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
                            Pago registrado
                          </p>
                          <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                            Comprobante de pago
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={handleClose}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-400 transition hover:text-slate-900 dark:border-slate-700 dark:hover:text-slate-100"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Big amount */}
                      <div className="mt-4 rounded-2xl bg-emerald-50 px-5 py-4 text-center dark:bg-emerald-500/10">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
                          Monto pagado
                        </p>
                        <p className="mt-1 text-3xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
                          {fmt$(receipt.amount)}
                        </p>
                        <p className="mt-1 text-sm text-emerald-600/70 dark:text-emerald-400/70">
                          {fmtDate(receipt.paymentDate)}
                        </p>
                      </div>

                      {/* Details grid */}
                      <dl className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                        {receipt.customerName && (
                          <div className="flex justify-between py-2 text-sm">
                            <dt className="text-slate-500 dark:text-slate-400">Cliente</dt>
                            <dd className="font-medium text-slate-900 dark:text-slate-100">{receipt.customerName}</dd>
                          </div>
                        )}
                        {receipt.invoiceNumber && (
                          <div className="flex justify-between py-2 text-sm">
                            <dt className="text-slate-500 dark:text-slate-400">Factura ref.</dt>
                            <dd className="font-medium text-slate-900 dark:text-slate-100">{receipt.invoiceNumber}</dd>
                          </div>
                        )}
                        <div className="flex justify-between py-2 text-sm">
                          <dt className="text-slate-500 dark:text-slate-400">Método</dt>
                          <dd className="font-medium text-slate-900 dark:text-slate-100">{receipt.methodLabel}</dd>
                        </div>
                        {receipt.note && (
                          <div className="flex justify-between py-2 text-sm">
                            <dt className="text-slate-500 dark:text-slate-400">Nota</dt>
                            <dd className="font-medium text-slate-900 dark:text-slate-100">{receipt.note}</dd>
                          </div>
                        )}
                        <div className="flex justify-between py-2 text-sm">
                          <dt className="text-slate-500 dark:text-slate-400">Saldo restante</dt>
                          <dd className={`font-semibold ${receipt.newBalance <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-slate-100"}`}>
                            {receipt.newBalance <= 0 ? "Pagado ✓" : fmt$(receipt.newBalance)}
                          </dd>
                        </div>
                      </dl>

                      {/* Action buttons */}
                      <div className="mt-4 flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={handleDownloadPdf}
                          disabled={pdfBusy}
                          className="h-10 w-full rounded-2xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                        >
                          {pdfBusy ? "Generando PDF..." : "Descargar comprobante PDF"}
                        </button>
                        <button
                          type="button"
                          onClick={handleWhatsApp}
                          className="h-10 w-full rounded-2xl border border-[#25d366]/40 bg-[#25d366]/10 px-4 text-sm font-medium text-[#128c54] transition hover:bg-[#25d366]/20 dark:border-[#25d366]/30 dark:text-[#25d366] dark:hover:bg-[#25d366]/15"
                        >
                          Compartir por WhatsApp
                        </button>
                        <button
                          type="button"
                          onClick={handleClose}
                          className="h-10 w-full rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          Cerrar
                        </button>
                      </div>
                    </>
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/15"
      >
        Registrar pago
      </button>
      {modalContent}
    </>
  );
}
