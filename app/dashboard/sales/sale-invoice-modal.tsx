"use client";

import React, {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Sale, SaleItem } from "./types";
import { fetchSaleItems, fetchSalePlan, type SalePlanSummary } from "./actions";
import { createClient } from "../../../lib/supabase/client";
import { formatLongDate, formatTime } from "../../../lib/date-format";
import { formatCurrency } from "../../../lib/currency-format";

// ─── Types ────────────────────────────────────────────────────────────────────
type CompanyInvoice = {
  name: string;
  contactFooter: string;
  logoUrl: string | null;
  companyId: string;
};

type SaleInvoiceModalProps = {
  sale: Sale;
  company: CompanyInvoice;
};

type ComputedData = {
  total: number;
  discountAmount: number;
  paidAmount: number;
  balanceDue: number;
  paymentStatus: string;
  hasPaymentPlan: boolean;
  description: string;
};

type PreviewProps = {
  sale: Sale;
  company: CompanyInvoice;
  customerName: string;
  paymentMethod: string;
  saleItems: SaleItem[];
  computed: ComputedData;
  planSummary: SalePlanSummary | null;
};

function fmtFrequency(v: string) {
  switch (v) {
    case "weekly": return "Semanal";
    case "biweekly": return "Quincenal";
    case "monthly": return "Mensual";
    default: return v || "—";
  }
}
function parseMoney(v: string | number | null | undefined) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function roundMoney(v: number) {
  return Math.round(v * 100) / 100;
}
function fmt$(v: number) {
  return formatCurrency(v);
}
function fmtMethod(v: string | null | undefined) {
  switch ((v ?? "").toLowerCase()) {
    case "cash": return "Efectivo";
    case "card": return "Tarjeta";
    case "transfer": return "Transferencia";
    case "yappy": return "Yappy";
    case "other": return "Otro";
    default: return v || "Sin método";
  }
}
function fmtType(v: string | null | undefined) {
  switch ((v ?? "").toLowerCase()) {
    case "full": return "Completo";
    case "partial": return "Abono";
    case "installment": return "Cuotas";
    default: return v || "Sin tipo";
  }
}
function fmtStatus(v: string | null | undefined) {
  switch ((v ?? "").toLowerCase()) {
    case "paid": return "Pagada";
    case "partial": return "Abonada";
    case "pending": return "Pendiente";
    case "overdue": return "Vencida";
    default: return "Sin estado";
  }
}
function fmtLongDate(v: string | null | undefined) {
  return formatLongDate(v, "Sin fecha");
}
function fmtDateTime(saleDate: string | null | undefined, createdAt: string | null | undefined) {
  const date = saleDate ? fmtLongDate(saleDate) : "Sin fecha";
  const time = formatTime(createdAt, "");
  return time ? `${date} · ${time}` : date;
}
function normalizePhone(raw: string) {
  const d = raw.replace(/\D/g, "");
  return d.length === 8 ? `507${d}` : d;
}

// ─── PDF data type ────────────────────────────────────────────────────────────
type PdfData = {
  companyName: string;
  contactFooter: string;
  logoUrl: string | null;
  invoiceNumber: string | null;
  saleDate: string | null;
  dateTimeStr: string;
  customerName: string;
  customerCompany?: string | null;
  methodStr: string;
  typeStr: string;
  statusStr: string;
  items: Array<{ description: string; qty: number; unitPrice: number; lineTotal: number }>;
  fallbackDescription: string;
  total: number;
  discountAmount: number;
  paidAmount: number;
  balanceDue: number;
  hasPaymentPlan: boolean;
  planSummary: SalePlanSummary | null;
  note: string | null;
};

// ─── PDF generation — pure jsPDF, no html2canvas, no DOM rendering ────────────
// Generates directly from structured data. 100% reliable across all browsers.
async function generatePdfBlob(data: PdfData): Promise<Blob> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import("jspdf");
  // jsPDF v4 exports as { default: jsPDF } via ESM
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const JsPDF: new (opts: any) => any = mod.default ?? mod.jsPDF;

  const M = 14;        // page margin mm
  const W = 210;       // A4 width mm
  const PH = 297;      // A4 height mm
  const CW = W - 2 * M; // content width

  const doc = new JsPDF({ unit: "mm", format: "a4", compress: true });

  // ── colour helpers ──────────────────────────────────────────────────────────
  const dark  = () => doc.setTextColor(15, 23, 42);    // slate-950
  const mid   = () => doc.setTextColor(71, 85, 105);   // slate-600
  const soft  = () => doc.setTextColor(100, 116, 139); // slate-500
  const hline = (y: number, x1 = M, x2 = W - M) => {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(x1, y, x2, y);
  };
  const ensurePage = (y: number, need: number): number => {
    if (y + need > PH - M) { doc.addPage(); return M + 4; }
    return y;
  };

  let y = M + 4;

  // ── Logo (si existe) ─────────────────────────────────────────────────────────
  let logoBase64: string | null = null;
  let logoFormat = "PNG";
  if (data.logoUrl) {
    try {
      const resp = await fetch(data.logoUrl);
      if (resp.ok) {
        const imgBlob = await resp.blob();
        logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(imgBlob);
        });
        const mimeMatch = logoBase64.match(/^data:image\/(\w+);/);
        if (mimeMatch?.[1]) {
          logoFormat = mimeMatch[1].toUpperCase();
          if (logoFormat === "JPG") logoFormat = "JPEG";
        }
      }
    } catch {
      // Logo no disponible — se omite del PDF
    }
  }

  // ── Company name (con o sin logo) ───────────────────────────────────────────
  const LOGO_SIZE = 14;
  let logoRendered = false;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, logoFormat, M, y, LOGO_SIZE, LOGO_SIZE, undefined, "FAST");
      logoRendered = true;
    } catch {
      // Formato de imagen no soportado — se omite
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  dark();
  if (logoRendered) {
    doc.text(data.companyName || "Mi negocio", M + LOGO_SIZE + 3, y + 10);
    y += LOGO_SIZE + 3;
  } else {
    doc.text(data.companyName || "Mi negocio", M, y + 7);
    y += 11;
  }

  // ── Invoice box (top-right) ─────────────────────────────────────────────────
  const bW = 52, bH = 22, bX = W - M - bW;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(bX, M - 3, bW, bH, 2, 2, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  soft();
  doc.text("FACTURA NO.", bX + bW / 2, M + 3, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  dark();
  doc.text(data.invoiceNumber ?? "S/F", bX + bW / 2, M + 11, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  soft();
  doc.text(fmtLongDate(data.saleDate), bX + bW / 2, M + 18, { align: "center" });

  // ── Contact footer ──────────────────────────────────────────────────────────
  const footer = data.contactFooter.trim();
  if (footer) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    mid();
    const cfLines: string[] = doc.splitTextToSize(footer, CW - bW - 6);
    doc.text(cfLines, M, y);
    y += (cfLines.length * 4) + 1;
  }
  y = Math.max(y + 3, M - 3 + bH + 5);
  hline(y);
  y += 8;

  // ── Cliente + Detalles (2 columns) ──────────────────────────────────────────
  const col = (CW - 5) / 2;
  const boxH = 24;

  doc.setFillColor(250, 252, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, col, boxH, 2, 2, "FD");
  doc.setFontSize(7.5);
  soft();
  doc.text("CLIENTE", M + 4, y + 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  dark();
  const cLines: string[] = doc.splitTextToSize(data.customerName || "Consumidor final", col - 8);
  doc.text(cLines, M + 4, y + 10);
  if (data.customerCompany) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    soft();
    doc.text(data.customerCompany, M + 4, y + 10 + cLines.length * 4.5, { maxWidth: col - 8 });
  }

  const d2x = M + col + 5;
  doc.setFont("helvetica", "normal");
  doc.setFillColor(250, 252, 255);
  doc.roundedRect(d2x, y, col, boxH, 2, 2, "FD");

  const dRows: [string, string][] = [
    ["Fecha",  data.dateTimeStr],
    ["Método", data.methodStr],
    ["Tipo",   data.typeStr],
    ["Estado", data.statusStr],
  ];
  let dy = y + 5.5;
  for (const [label, val] of dRows) {
    doc.setFontSize(7.5);
    soft();
    doc.text(label + ":", d2x + 4, dy);
    dark();
    doc.text(String(val), d2x + 26, dy);
    dy += 4.2;
  }
  y += boxH + 4;

  // ── Items table ─────────────────────────────────────────────────────────────
  y = ensurePage(y, 18);

  // Header row
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(M, y, CW, 7, 1, 1, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  soft();
  doc.text("DESCRIPCIÓN",                     M + 4,            y + 4.5);
  doc.text("CANT.",  M + CW * 0.63,           y + 4.5, { align: "center" });
  doc.text("PRECIO", M + CW * 0.80,           y + 4.5, { align: "center" });
  doc.text("TOTAL",  W - M - 2,               y + 4.5, { align: "right"  });
  y += 8;

  const itemSubtotal = data.total + data.discountAmount;
  const rows =
    data.items.length > 0
      ? data.items
      : [{ description: data.fallbackDescription, qty: 1, unitPrice: itemSubtotal, lineTotal: itemSubtotal }];

  doc.setFont("helvetica", "normal");
  for (const item of rows) {
    const descLines: string[] = doc.splitTextToSize(item.description, CW * 0.57);
    const rowH = Math.max(7, descLines.length * 4.5 + 2);
    y = ensurePage(y, rowH + 2);

    hline(y);
    doc.setFontSize(9);
    dark();
    doc.text(descLines, M + 4, y + 4.5);
    soft();
    doc.setFontSize(9);
    doc.text(String(item.qty),         M + CW * 0.63, y + 4.5, { align: "center" });
    doc.text(fmt$(item.unitPrice),     M + CW * 0.80, y + 4.5, { align: "center" });
    doc.setFont("helvetica", "bold");
    dark();
    doc.text(fmt$(item.lineTotal),     W - M - 2,     y + 4.5, { align: "right"  });
    doc.setFont("helvetica", "normal");
    y += rowH;
  }
  hline(y);
  y += 8;

  // ── Summary box ─────────────────────────────────────────────────────────────
  const sRows: [string, string][] = [
    ...(data.discountAmount > 0
      ? [
          ["Subtotal", fmt$(data.total + data.discountAmount)] as [string, string],
          ["Descuento", `−${fmt$(data.discountAmount)}`] as [string, string],
        ]
      : []),
    ["Pagado",  fmt$(data.paidAmount)],
    ["Saldo",   fmt$(data.balanceDue)],
    ["Estado",  data.statusStr],
  ];
  const sumW = 72, sumH = 6 + sRows.length * 5.5 + 18, sumX = W - M - sumW;
  y = ensurePage(y, sumH + 10);

  doc.setFillColor(240, 249, 255);
  doc.setDrawColor(186, 230, 253);
  doc.setLineWidth(0.3);
  doc.roundedRect(sumX, y, sumW, sumH, 3, 3, "FD");
  let sy = y + 6;
  for (const [label, val] of sRows) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    soft();
    doc.text(label,  sumX + 4,      sy);
    dark();
    doc.text(String(val), sumX + sumW - 3, sy, { align: "right" });
    sy += 5.5;
  }
  doc.setDrawColor(186, 230, 253);
  doc.setLineWidth(0.3);
  doc.line(sumX + 3, sy - 1, sumX + sumW - 3, sy - 1);
  sy += 3;
  doc.setFontSize(7.5);
  soft();
  doc.text("TOTAL FACTURA", sumX + 4, sy);
  sy += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  dark();
  doc.text(fmt$(data.total), sumX + sumW - 3, sy, { align: "right" });

  // ── Plan de cuotas ─────────────────────────────────────────────────────────
  if (data.hasPaymentPlan) {
    const ps = data.planSummary;
    if (ps && ps.pending_count > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(99, 102, 241);
      doc.text("PLAN DE CUOTAS", M, y + 3);
      const planRows: [string, string][] = [
        ["Frecuencia", fmtFrequency(ps.frequency)],
        ["Por cuota", fmt$(ps.installment_amount)],
        ["Restantes", String(ps.pending_count)],
      ];
      if (ps.next_due_date) planRows.push(["Proxima cuota", fmtLongDate(ps.next_due_date)]);
      let py = y + 9;
      for (const [label, val] of planRows) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        soft();
        doc.text(label + ":", M, py);
        dark();
        doc.text(val, M + 32, py);
        py += 5;
      }
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(99, 102, 241);
      doc.text("Plan de cuotas activo", M, y + 2);
    }
  }

  // ── Note ────────────────────────────────────────────────────────────────────
  if (data.note?.trim()) {
    const noteY = Math.max(y + sumH - 8, sy + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    soft();
    doc.text("NOTA", M, noteY);
    doc.setFontSize(9);
    dark();
    const noteLines: string[] = doc.splitTextToSize(data.note.trim(), CW - sumW - 6);
    doc.text(noteLines, M, noteY + 5);
  }

  return doc.output("blob") as Blob;
}

// ─── Invoice preview (memoized — re-renders only when its own props change) ───
const InvoicePreview = React.memo(
  React.forwardRef<HTMLDivElement, PreviewProps>(function InvoicePreview(
    { sale, company, customerName, paymentMethod, saleItems, computed, planSummary },
    ref
  ) {
    const methodStr = fmtMethod(paymentMethod);
    const typeStr = fmtType(sale.payment_type);
    const statusStr = fmtStatus(computed.paymentStatus);
    const dateTimeStr = fmtDateTime(sale.sale_date, sale.created_at);

    return (
      <div
        ref={ref}
        className="invoice-sheet mx-auto max-w-198.5 bg-white p-8 text-slate-900"
      >
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-5 border-b border-slate-200 pb-5">
          <div className="flex items-start gap-4">
            {company.logoUrl ? (
              <img
                src={company.logoUrl}
                alt={company.name}
                crossOrigin="anonymous"
                className="h-17 w-17 rounded-2xl border border-slate-200 object-cover"
              />
            ) : null}
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                Factura
              </p>
              <h2 className="mt-1.5 text-[26px] font-extrabold tracking-tight text-slate-950">
                {company.name || "Mi negocio"}
              </h2>
              <p className="mt-2 max-w-110 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {company.contactFooter || ""}
              </p>
            </div>
          </div>
          <div className="min-w-50 rounded-[18px] border border-slate-200 px-4 py-3.5 text-right">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Factura No.
            </p>
            <p className="mt-1.5 text-[26px] font-extrabold tracking-tight text-slate-950">
              {sale.invoice_number ?? "S/F"}
            </p>
            <p className="mt-1.5 text-sm text-slate-600">
              {fmtLongDate(sale.sale_date)}
            </p>
          </div>
        </div>

        {/* Cliente + Detalles */}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Cliente
            </p>
            <p className="mt-2 text-sm leading-7 text-slate-800">
              {customerName || "Consumidor final"}
            </p>
            {sale.customer_company ? (
              <p className="text-xs text-slate-500">{sale.customer_company}</p>
            ) : null}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Detalles
            </p>
            <div className="mt-2 space-y-1">
              <p className="text-sm text-slate-800">
                <span className="text-slate-500">Fecha:</span> {dateTimeStr}
              </p>
              <p className="text-sm text-slate-800">
                <span className="text-slate-500">Método:</span> {methodStr}
              </p>
              <p className="text-sm text-slate-800">
                <span className="text-slate-500">Tipo:</span> {typeStr}
              </p>
              <p className="text-sm text-slate-800">
                <span className="text-slate-500">Estado:</span> {statusStr}
              </p>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  Descripción
                </th>
                <th className="px-4 py-3 text-center text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  Cantidad
                </th>
                <th className="px-4 py-3 text-right text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  Precio
                </th>
                <th className="px-4 py-3 text-right text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {saleItems.length > 0 ? (
                saleItems.map((item) => {
                  const lineTotal = roundMoney(
                    parseMoney(item.unit_price) * item.quantity
                  );
                  return (
                    <tr key={item.id} className="border-t border-slate-200">
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                        {item.description}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-slate-700">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-700">
                        {fmt$(parseMoney(item.unit_price))}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                        {fmt$(lineTotal)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr className="border-t border-slate-200">
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                    {computed.description}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-slate-700">
                    1
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">
                    {fmt$(computed.total + computed.discountAmount)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                    {fmt$(computed.total + computed.discountAmount)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom */}
        <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Datos de pago
              </p>
              <div className="mt-2 space-y-1">
                <p className="text-sm text-slate-800">
                  <span className="text-slate-500">Método:</span> {methodStr}
                </p>
                <p className="text-sm text-slate-800">
                  <span className="text-slate-500">Tipo:</span> {typeStr}
                </p>
                <p className="text-sm text-slate-800">
                  <span className="text-slate-500">Estado:</span> {statusStr}
                </p>
                <p className="text-sm text-slate-800">
                  <span className="text-slate-500">Pagado:</span>{" "}
                  {fmt$(computed.paidAmount)}
                </p>
                <p className="text-sm text-slate-800">
                  <span className="text-slate-500">Saldo:</span>{" "}
                  {fmt$(computed.balanceDue)}
                </p>
                {computed.hasPaymentPlan ? (
                  <>
                    <p className="text-sm text-slate-800">
                      <span className="text-slate-500">Plan de cuotas:</span> Sí
                    </p>
                    {planSummary && planSummary.pending_count > 0 ? (
                      <div className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-400">
                          Cuotas pendientes
                        </p>
                        <div className="mt-1 space-y-0.5">
                          <p className="text-sm text-slate-800">
                            <span className="text-slate-500">Frecuencia:</span>{" "}
                            {fmtFrequency(planSummary.frequency)}
                          </p>
                          <p className="text-sm text-slate-800">
                            <span className="text-slate-500">Por cuota:</span>{" "}
                            {fmt$(planSummary.installment_amount)}
                          </p>
                          <p className="text-sm text-slate-800">
                            <span className="text-slate-500">Restantes:</span>{" "}
                            {planSummary.pending_count}
                          </p>
                          {planSummary.next_due_date ? (
                            <p className="text-sm text-slate-800">
                              <span className="text-slate-500">Próxima:</span>{" "}
                              {fmtLongDate(planSummary.next_due_date)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
            {sale.note ? (
              <div className="border-t border-slate-200 pt-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  Nota
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {sale.note}
                </p>
              </div>
            ) : null}
          </div>

          <div className="rounded-[20px] border border-sky-100 bg-linear-to-b from-sky-50 to-indigo-50/80 p-4">
            {computed.discountAmount > 0 ? (
              <>
                <div className="flex items-center justify-between gap-3 py-1.5 text-sm text-slate-700">
                  <span>Subtotal</span>
                  <span>{fmt$(computed.total + computed.discountAmount)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5 text-sm text-rose-600">
                  <span>Descuento</span>
                  <span>−{fmt$(computed.discountAmount)}</span>
                </div>
              </>
            ) : null}
            {[
              ["Pagado", fmt$(computed.paidAmount)],
              ["Saldo", fmt$(computed.balanceDue)],
              ["Estado", statusStr],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 py-1.5 text-sm text-slate-700"
              >
                <span>{label}</span>
                <span>{value}</span>
              </div>
            ))}
            <div className="mt-3 flex items-end justify-between gap-3 border-t border-sky-200 pt-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Total factura
              </p>
              <p className="text-[30px] font-extrabold tracking-tight text-slate-950">
                {fmt$(computed.total)}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  })
);

// ─── UI class constants ───────────────────────────────────────────────────────
const labelCls =
  "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-300";
const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 transition focus:border-sky-200 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-cyan-400 dark:focus:ring-cyan-500/10";
const roCls = `${inputCls} cursor-not-allowed opacity-70`;

// ─── Main component ───────────────────────────────────────────────────────────
export function SaleInvoiceModal({ sale, company }: SaleInvoiceModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const pendingBlobRef = useRef<Blob | null>(null);

  const [open, setOpen] = useState(false);
  // Two-phase render: show modal shell first, render heavy invoice preview after 2 rAFs
  const [ready, setReady] = useState(false);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [planSummary, setPlanSummary] = useState<SalePlanSummary | null>(null);
  const [customerName, setCustomerName] = useState(
    sale.customer_name?.trim() || "Consumidor final"
  );
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<"pdf" | "wa" | null>(null);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");

  // Deferred value: typing in the customer field won't trigger InvoicePreview re-render each keystroke
  const deferredName = useDeferredValue(customerName);
  const invoicePaymentMethod = sale.payment_method ?? "cash";

  const computed = useMemo<ComputedData>(() => {
    const total = roundMoney(parseMoney(sale.amount));
    const discountAmount = roundMoney(parseMoney(sale.discount_amount));
    const hasPaid =
      sale.paid_amount != null && String(sale.paid_amount) !== "";
    const hasBal =
      sale.balance_due != null && String(sale.balance_due) !== "";
    const paidRaw = roundMoney(parseMoney(sale.paid_amount));
    const balRaw = roundMoney(parseMoney(sale.balance_due));
    const paidAmount = hasPaid
      ? paidRaw
      : roundMoney(Math.max(0, total - balRaw));
    const balanceDue = hasBal
      ? balRaw
      : roundMoney(Math.max(0, total - paidAmount));
    const derived =
      balanceDue <= 0 ? "paid" : paidAmount > 0 ? "partial" : "pending";
    return {
      total,
      discountAmount,
      paidAmount,
      balanceDue,
      paymentStatus:
        String(sale.payment_status ?? "").toLowerCase() || derived,
      hasPaymentPlan: Boolean(sale.has_payment_plan),
      description:
        sale.invoice_notes?.trim() ||
        sale.note?.trim() ||
        "Servicio",
    };
  }, [
    sale.amount,
    sale.discount_amount,
    sale.balance_due,
    sale.has_payment_plan,
    sale.invoice_notes,
    sale.note,
    sale.paid_amount,
    sale.payment_status,
  ]);

  // Phase 2: render invoice preview after modal shell has painted
  useEffect(() => {
    if (!open) return;
    let id2: number;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(id1);
      if (id2) cancelAnimationFrame(id2);
    };
  }, [open]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const openModal = () => {
    setReady(false);
    setPdfError(null);
    setOpen(true);
    fetchSaleItems(sale.id).then(setSaleItems).catch(() => {});
    if (sale.has_payment_plan) {
      fetchSalePlan(sale.id).then(setPlanSummary).catch(() => {});
    }
  };

  const closeModal = () => {
    setReady(false);
    setOpen(false);
    setSaleItems([]);
    setPlanSummary(null);
    setPdfError(null);
    pendingBlobRef.current = null;
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const invoiceLabel = () =>
    sale.invoice_number ? `factura ${sale.invoice_number}` : "tu factura";

  const waMessage = (pdfUrl?: string) => {
    const base = `Hola ${deferredName}, te comparto ${invoiceLabel()} por ${fmt$(computed.total)}.`;
    return pdfUrl ? `${base}\n${pdfUrl}` : base;
  };

  const openWA = (phone: string, pdfUrl?: string) => {
    const msg = waMessage(pdfUrl);
    const normalized = normalizePhone(phone);
    const url = normalized
      ? `https://wa.me/${normalized}?text=${encodeURIComponent(msg)}`
      : `https://web.whatsapp.com/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const downloadBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `factura-${sale.invoice_number ?? sale.id}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  // Try to upload to Storage for a persistent link.
  // If upload fails, falls back to: download PDF locally + open WA with text only.
  const shareViaWA = async (blob: Blob, phone: string) => {
    const supabase = createClient();
    const path = `companies/${company.companyId}/invoices/${sale.id}.pdf`;
    const { error } = await supabase.storage
      .from("company-assets")
      .upload(path, blob, { contentType: "application/pdf", upsert: true });

    if (!error) {
      const { data: signed } = await supabase.storage
        .from("company-assets")
        .createSignedUrl(path, 7 * 24 * 3600);
      if (signed?.signedUrl) {
        openWA(phone, signed.signedUrl);
      } else {
        downloadBlob(blob);
        openWA(phone);
      }
    } else {
      // Storage unavailable: download the PDF and open WA with text
      downloadBlob(blob);
      openWA(phone);
    }
  };

  // ── Build PDF data from current component state ──────────────────────────────
  const buildPdfData = (): PdfData => ({
    companyName:         company.name,
    contactFooter:       company.contactFooter,
    logoUrl:             company.logoUrl,
    invoiceNumber:       sale.invoice_number,
    saleDate:            sale.sale_date,
    dateTimeStr:         fmtDateTime(sale.sale_date, sale.created_at),
    customerName:        deferredName,
    customerCompany:     sale.customer_company,
    methodStr:           fmtMethod(invoicePaymentMethod),
    typeStr:             fmtType(sale.payment_type),
    statusStr:           fmtStatus(computed.paymentStatus),
    items: saleItems.map((item) => ({
      description: item.description,
      qty:         item.quantity,
      unitPrice:   parseMoney(item.unit_price),
      lineTotal:   roundMoney(parseMoney(item.unit_price) * item.quantity),
    })),
    fallbackDescription: computed.description,
    total:           computed.total,
    discountAmount:  computed.discountAmount,
    paidAmount:      computed.paidAmount,
    balanceDue:      computed.balanceDue,
    hasPaymentPlan:  computed.hasPaymentPlan,
    planSummary:     planSummary,
    note:            sale.note,
  });

  // ── Export PDF ───────────────────────────────────────────────────────────────
  const handleExportPdf = async () => {
    if (processing) return;
    setPdfError(null);
    setProcessing("pdf");
    try {
      const blob = await generatePdfBlob(buildPdfData());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `factura-${sale.invoice_number ?? sale.id}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      console.error("[PDF export]", err);
      setPdfError("No se pudo generar el PDF.");
    } finally {
      setProcessing(null);
    }
  };

  // ── WhatsApp ─────────────────────────────────────────────────────────────────
  const handleWhatsApp = async () => {
    if (processing) return;
    setPdfError(null);
    setProcessing("wa");
    try {
      const blob = await generatePdfBlob(buildPdfData());
      const fileName = `factura-${sale.invoice_number ?? sale.id}.pdf`;

      // 1. Native OS share with file — iOS 15+, Android Chrome 89+
      if (typeof navigator !== "undefined") {
        const file = new File([blob], fileName, { type: "application/pdf" });
        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: fileName });
            return;
          } catch (e) {
            if (e instanceof Error && e.name === "AbortError") return;
            // share API exists but failed → fall through to WA link
          }
        }
      }

      // 2. Desktop / browser sin native share → WA Web con link
      const phone = sale.customer_phone?.trim() ?? "";
      if (!phone) {
        // Need phone for wa.me; store blob and show modal
        pendingBlobRef.current = blob;
        setPhoneInput("");
        setShowPhoneModal(true);
        // processing cleared here — phone modal has its own spinner
        setProcessing(null);
        return;
      }

      await shareViaWA(blob, phone);
    } catch (err) {
      console.error("[PDF WhatsApp]", err);
      setPdfError("No se pudo preparar el PDF.");
    } finally {
      setProcessing(null);
    }
  };

  const handleSendFromPhoneModal = async () => {
    const phone = phoneInput.trim();
    const blob = pendingBlobRef.current;
    if (!phone || !blob) return;
    setProcessing("wa");
    try {
      await shareViaWA(blob, phone);
      pendingBlobRef.current = null;
      setShowPhoneModal(false);
    } catch (err) {
      console.error("[PDF WA modal]", err);
      setPdfError("No se pudo enviar. Intenta de nuevo.");
    } finally {
      setProcessing(null);
    }
  };

  const isPending = processing !== null;

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={openModal}
        className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-200 dark:hover:bg-cyan-400/15"
      >
        Ver factura
      </button>

      {/* Phone modal (z-60 — above invoice modal) */}
      {showPhoneModal ? (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/50"
            onClick={() => {
              if (!processing) setShowPhoneModal(false);
            }}
          />
          <div className="relative w-full max-w-95 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.16)] dark:border-slate-800 dark:bg-slate-900">
            <h4 className="text-base font-semibold text-slate-950 dark:text-slate-50">
              Número de WhatsApp
            </h4>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              El cliente no tiene teléfono registrado. Ingresa el número para enviar.
            </p>
            <div className="mt-4">
              <label className={labelCls}>Teléfono</label>
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendFromPhoneModal();
                }}
                placeholder="6000-0000"
                autoFocus
                className={inputCls}
              />
              <p className="mt-1 text-xs text-slate-400">
                8 dígitos → se agrega +507 automáticamente.
              </p>
            </div>
            {pdfError ? (
              <p className="mt-3 rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                {pdfError}
              </p>
            ) : null}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                disabled={!phoneInput.trim() || processing === "wa"}
                onClick={handleSendFromPhoneModal}
                className="flex-1 rounded-xl border border-green-600 bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50 dark:border-green-500 dark:bg-green-500 dark:text-slate-950"
              >
                {processing === "wa" ? "Enviando…" : "Enviar"}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setShowPhoneModal(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Invoice modal */}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop — no blur for performance */}
          <div
            className="absolute inset-0 bg-slate-950/50"
            onClick={closeModal}
          />

          <div
            aria-modal="true"
            role="dialog"
            aria-labelledby={`inv-title-${sale.id}`}
            className="relative flex max-h-[90dvh] w-full max-w-295 flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:border-slate-800 dark:bg-slate-900/95"
          >
            <div
              className={[
                "overflow-y-auto rounded-[28px] bg-white p-5 dark:bg-slate-900",
                isPending ? "pointer-events-none opacity-60" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-sky-700/70 dark:text-cyan-300/70">
                    Factura {sale.invoice_number ?? "Sin factura"}
                  </p>
                  <h3
                    id={`inv-title-${sale.id}`}
                    className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50"
                  >
                    Vista de factura
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Revisa la factura antes de exportarla o compartirla.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  aria-label="Cerrar"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-500 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300"
                >
                  ×
                </button>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
                {/* Controls */}
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Empresa</label>
                    <input value={company.name} readOnly className={roCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Contacto / pie</label>
                    <textarea
                      value={company.contactFooter}
                      readOnly
                      rows={3}
                      className={`${roCls} min-h-20 resize-none`}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Cliente</label>
                    <input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Fecha registrada</label>
                    <input
                      value={fmtDateTime(sale.sale_date, sale.created_at)}
                      readOnly
                      className={roCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Método de pago</label>
                    <input
                      value={fmtMethod(invoicePaymentMethod)}
                      readOnly
                      className={roCls}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>Tipo</label>
                      <input
                        value={fmtType(sale.payment_type)}
                        readOnly
                        className={roCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Estado</label>
                      <input
                        value={fmtStatus(computed.paymentStatus)}
                        readOnly
                        className={roCls}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>Total</label>
                      <input
                        value={fmt$(computed.total)}
                        readOnly
                        className={roCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Pagado</label>
                      <input
                        value={fmt$(computed.paidAmount)}
                        readOnly
                        className={roCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Saldo pendiente</label>
                    <input
                      value={fmt$(computed.balanceDue)}
                      readOnly
                      className={roCls}
                    />
                  </div>
                  {computed.hasPaymentPlan ? (
                    <div className="rounded-2xl border border-indigo-200/60 bg-indigo-50/60 p-3 dark:border-indigo-800 dark:bg-indigo-950/30">
                      <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                        Plan de cuotas activo
                      </p>
                    </div>
                  ) : null}

                  {pdfError ? (
                    <p className="rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                      {pdfError}
                    </p>
                  ) : null}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleExportPdf}
                      disabled={isPending}
                      className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                    >
                      {processing === "pdf" ? "Generando…" : "Exportar PDF"}
                    </button>
                    <button
                      type="button"
                      onClick={handleWhatsApp}
                      disabled={isPending}
                      className="rounded-2xl border border-green-200/80 bg-green-50/80 px-4 py-2 text-sm font-medium text-green-700 transition hover:border-green-300 hover:bg-green-100 disabled:opacity-50 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-300"
                    >
                      {processing === "wa" ? "Preparando…" : "WhatsApp"}
                    </button>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>

                {/* Invoice preview */}
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                  {ready ? (
                    <InvoicePreview
                      ref={printRef}
                      sale={sale}
                      company={company}
                      customerName={deferredName}
                      paymentMethod={invoicePaymentMethod}
                      saleItems={saleItems}
                      computed={computed}
                      planSummary={planSummary}
                    />
                  ) : (
                    // Skeleton shown while phase-2 renders
                    <div className="mx-auto max-w-198.5 space-y-4 bg-white p-8">
                      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-5">
                        <div className="space-y-2">
                          <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" />
                          <div className="h-7 w-40 animate-pulse rounded-xl bg-slate-200" />
                        </div>
                        <div className="h-20 w-36 animate-pulse rounded-[18px] bg-slate-200" />
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
                        <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
                      </div>
                      <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
                      <div className="h-24 animate-pulse rounded-[20px] bg-sky-50/60" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
