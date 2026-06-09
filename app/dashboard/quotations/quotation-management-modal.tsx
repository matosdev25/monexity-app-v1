"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ButtonSpinner } from "@/components/button-spinner";
import { formatShortDate } from "@/lib/date-format";
import { formatCurrency } from "@/lib/currency-format";
import { changeQuotationStatus } from "./actions";
import { ConvertSection, EditQuotationForm } from "./[quotationId]/edit-quotation-form";
import type { CompanyService } from "../mi-negocio/types";
import type { SalePaymentMethodOption } from "../sales/types";
import type { Quotation, QuotationItem } from "./types";
import {
  getCompanyInitial,
  getCompanyMetadataLines,
  getCompanyName,
  loadPdfLogo,
  type QuotationCompanyInfo,
} from "./pdf-helpers";

type Props = {
  quotation: Quotation;
  items: QuotationItem[];
  services: CompanyService[];
  paymentMethods: SalePaymentMethodOption[];
  today: string;
  company: QuotationCompanyInfo;
};

const STATUS_TRANSITIONS: { status: string; label: string }[] = [
  { status: "draft", label: "Borrador" },
  { status: "sent", label: "Enviada" },
  { status: "accepted", label: "Aceptada" },
  { status: "rejected", label: "Rechazada" },
];

function buildPhoneHidden(phone: string | null): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("507")) {
    return `+507 ${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 8) return `+507 ${digits.slice(0, 4)}-${digits.slice(4)}`;
  return "";
}

export function QuotationManagementModal({
  quotation,
  items,
  services,
  paymentMethods,
  today,
  company,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfMessage, setPdfMessage] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);

  const isConverted = quotation.status === "converted";
  const canConvert = !isConverted && quotation.status !== "rejected";
  const transitions = useMemo(
    () => STATUS_TRANSITIONS.filter((item) => item.status !== quotation.status),
    [quotation.status]
  );
  const editFormId = `quotation-edit-${quotation.id}`;
  const quotationTotal = Number(quotation.total ?? 0);

  const closeModal = useCallback(() => setOpen(false), []);
  const refreshQuotation = useCallback(() => router.refresh(), [router]);

  async function downloadPdf() {
    setPdfBusy(true);
    setPdfMessage("");

    try {
      const mod = await import("jspdf");
      const JsPDF = mod.default ?? mod.jsPDF;
      const doc = new JsPDF({ unit: "mm", format: "a4", compress: true });
      const companyName = getCompanyName(company);
      const companyDetails = getCompanyMetadataLines(company);
      const logo = await loadPdfLogo(company.logoUrl);
      const margin = 16;
      const pageWidth = 210;
      const pageHeight = 297;
      const contentWidth = pageWidth - margin * 2;
      type PdfColor = readonly [number, number, number];
      const slate950: PdfColor = [15, 23, 42];
      const slate700: PdfColor = [51, 65, 85];
      const slate500: PdfColor = [100, 116, 139];
      const slate200: PdfColor = [226, 232, 240];
      const slate50: PdfColor = [248, 250, 252];
      const blue900: PdfColor = [30, 58, 138];
      const blue600: PdfColor = [37, 99, 235];
      const sky50: PdfColor = [240, 249, 255];

      const textColor = (color: PdfColor) =>
        doc.setTextColor(color[0], color[1], color[2]);
      const drawCard = (x: number, y: number, w: number, h: number, fill = slate50) => {
        doc.setFillColor(fill[0], fill[1], fill[2]);
        doc.setDrawColor(slate200[0], slate200[1], slate200[2]);
        doc.setLineWidth(0.25);
        doc.roundedRect(x, y, w, h, 4, 4, "FD");
      };
      const sectionLabel = (label: string, x: number, y: number) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        textColor(blue600);
        doc.text(label.toUpperCase(), x, y);
      };
      const ensurePage = (currentY: number, needed: number) => {
        if (currentY + needed <= pageHeight - margin) return currentY;
        doc.addPage();
        return margin;
      };

      let y = 14;
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 0, pageWidth, 58, "F");

      const logoSize = 24;
      const headerDividerY = 56;
      let companyTextX = margin + logoSize + 8;
      let logoRendered = false;
      if (logo) {
        try {
          doc.addImage(logo.dataUrl, logo.format, margin, y, logoSize, logoSize, undefined, "FAST");
          logoRendered = true;
        } catch {
          companyTextX = margin + logoSize + 8;
        }
      }
      if (!logoRendered) {
        doc.setFillColor(slate950[0], slate950[1], slate950[2]);
        doc.roundedRect(margin, y, logoSize, logoSize, 5, 5, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.text(getCompanyInitial(company), margin + logoSize / 2, y + 15.5, { align: "center" });
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      textColor(slate950);
      doc.text(companyName, companyTextX, y + 7);
      if (companyDetails.length > 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        textColor(slate500);
        doc.text(doc.splitTextToSize(companyDetails[0] ?? "", 78), companyTextX, y + 14);
        if (companyDetails[1]) {
          doc.text(doc.splitTextToSize(companyDetails[1], 78), companyTextX, y + 19);
        }
      }

      drawCard(132, 15, 62, 31, [239, 246, 255]);
      sectionLabel("Cotización", 138, 24);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      textColor(blue900);
      doc.text(quotation.quotation_number ?? quotation.id, 138, 33);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      textColor(slate500);
      doc.text(`Emitida: ${formatShortDate(quotation.issue_date)}`, 138, 40);
      doc.setDrawColor(slate200[0], slate200[1], slate200[2]);
      doc.setLineWidth(0.25);
      doc.line(margin, headerDividerY, pageWidth - margin, headerDividerY);

      y = 64;
      const metaWidth = (contentWidth - 8) / 3;
      drawCard(margin, y, metaWidth, 24, [255, 255, 255]);
      drawCard(margin + metaWidth + 4, y, metaWidth, 24, [255, 255, 255]);
      drawCard(margin + (metaWidth + 4) * 2, y, metaWidth, 24, sky50);
      sectionLabel("Vigencia", margin + 5, y + 8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      textColor(slate950);
      doc.text(formatShortDate(quotation.valid_until, "Sin fecha"), margin + 5, y + 17);
      sectionLabel("Emitida", margin + metaWidth + 9, y + 8);
      doc.text(formatShortDate(quotation.issue_date), margin + metaWidth + 9, y + 17);
      sectionLabel("Total", margin + (metaWidth + 4) * 2 + 5, y + 8);
      doc.setFontSize(13);
      doc.text(formatCurrency(Number(quotation.total ?? 0)), margin + (metaWidth + 4) * 2 + 5, y + 17);

      y += 32;
      drawCard(margin, y, contentWidth, 30, [255, 255, 255]);
      sectionLabel("Cliente", margin + 6, y + 9);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      textColor(slate950);
      doc.text(quotation.customer_name || "Cliente general", margin + 6, y + 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      textColor(slate700);
      const contact = [
        quotation.customer_company,
        quotation.customer_email,
        buildPhoneHidden(quotation.customer_phone),
      ].filter(Boolean).join("  ·  ");
      doc.text(contact || "Sin datos adicionales", margin + 6, y + 25);

      y += 40;
      sectionLabel("Ítems", margin, y);
      y += 5;
      doc.setFillColor(blue900[0], blue900[1], blue900[2]);
      doc.roundedRect(margin, y, contentWidth, 10, 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text("Descripción", margin + 5, y + 6.5);
      doc.text("Cant.", 126, y + 6.5, { align: "right" });
      doc.text("P. unit.", 156, y + 6.5, { align: "right" });
      doc.text("Total", 190, y + 6.5, { align: "right" });
      y += 12;

      items.forEach((item, index) => {
        if (index % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.roundedRect(margin, y - 2, contentWidth, 12, 2, 2, "F");
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        textColor(slate950);
        doc.text(String(item.description).slice(0, 58), margin + 5, y + 4);
        textColor(slate700);
        doc.text(String(item.quantity), 126, y + 4, { align: "right" });
        doc.text(formatCurrency(Number(item.unit_price)), 156, y + 4, { align: "right" });
        doc.setFont("helvetica", "bold");
        textColor(slate950);
        doc.text(formatCurrency(Number(item.line_total)), 190, y + 4, { align: "right" });
        y += 12;
      });

      y += 4;
      const summaryX = 118;
      const summaryW = 76;
      const discountAmount = Number(quotation.discount_amount ?? 0);
      const summaryH = discountAmount > 0 ? 38 : 30;
      y = ensurePage(y, summaryH + 4);
      drawCard(summaryX, y, summaryW, summaryH, [255, 255, 255]);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      textColor(slate500);
      doc.text("Subtotal", summaryX + 6, y + 10);
      textColor(slate950);
      doc.text(formatCurrency(Number(quotation.subtotal ?? 0)), summaryX + summaryW - 6, y + 10, { align: "right" });
      let totalY = y + 20;
      if (discountAmount > 0) {
        textColor(slate500);
        doc.text("Descuento", summaryX + 6, y + 19);
        doc.setTextColor(225, 29, 72);
        doc.text(`-${formatCurrency(discountAmount)}`, summaryX + summaryW - 6, y + 19, { align: "right" });
        totalY = y + 29;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      textColor(blue900);
      doc.text("Total", summaryX + 6, totalY);
      doc.text(formatCurrency(Number(quotation.total ?? 0)), summaryX + summaryW - 6, totalY, { align: "right" });

      const noteCards = [
        { title: "NOTAS", value: quotation.notes?.trim() ?? "" },
        { title: "TÉRMINOS Y CONDICIONES", value: quotation.terms?.trim() ?? "" },
      ].filter((section) => section.value);

      if (noteCards.length > 0) {
        doc.addPage();
        y = margin;
        noteCards.forEach((section) => {
          const lines = doc.splitTextToSize(section.value, contentWidth - 12) as string[];
          const cardHeight = Math.max(32, lines.length * 4.6 + 22);
          y = ensurePage(y, cardHeight + 8);
          drawCard(margin, y, contentWidth, cardHeight, [255, 255, 255]);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
          textColor(blue600);
          doc.text(section.title, margin + 6, y + 11);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          textColor(slate700);
          doc.text(lines, margin + 6, y + 21);
          y += cardHeight + 8;
        });
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      textColor(slate500);
      doc.text(`Cotización emitida por ${companyName}`, margin, 285);
      doc.save(`cotizacion-${quotation.quotation_number ?? quotation.id}.pdf`);
    } catch {
      setPdfMessage("No se pudo generar el PDF.");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition-[background-color,border-color,color,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-amber-300 hover:bg-amber-100 hover:text-amber-800 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/15 dark:hover:text-amber-200"
      >
        Ver / Editar
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-3 py-4 backdrop-blur-[2px] motion-reduce:backdrop-blur-none sm:px-6">
          <div className="flex max-h-[90dvh] w-full max-w-[980px] flex-col overflow-hidden rounded-[28px] border border-white/70 bg-slate-100 shadow-[0_24px_80px_rgba(15,23,42,0.28)] dark:border-slate-800 dark:bg-slate-950">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-sky-700 dark:text-cyan-300">
                  Gestionar cotización
                </p>
                <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                  {quotation.quotation_number ?? "Sin número"} · {quotation.customer_name?.trim() || "Cliente general"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-[background-color,border-color,color,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-900 dark:hover:text-white dark:focus-visible:outline-white"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
              <div className="mx-auto grid max-w-[900px] gap-4">
                <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3 sm:p-5">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Estado</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{quotation.status}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Emitida</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{formatShortDate(quotation.issue_date)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Total</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(quotationTotal)}</p>
                  </div>
                </div>

                {!isConverted ? (
                  <EditQuotationForm
                    quotation={quotation}
                    items={items}
                    services={services}
                    embedded
                    formId={editFormId}
                    hideSubmit
                    onSavingChange={setSaveBusy}
                    onSuccess={refreshQuotation}
                  />
                ) : (
                  <div className="rounded-2xl border border-violet-200/70 bg-violet-50/60 px-4 py-3 dark:border-violet-500/20 dark:bg-violet-500/5">
                    <p className="text-sm font-medium text-violet-800 dark:text-violet-300">
                      Esta cotización ya fue convertida a venta.
                    </p>
                  </div>
                )}

                {!isConverted ? (
                  <div className="rounded-[24px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Estado</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {transitions.map(({ status, label }) => (
                        <form action={changeQuotationStatus} key={status}>
                          <input type="hidden" name="quotationId" value={quotation.id} />
                          <input type="hidden" name="status" value={status} />
                          <button
                            type="submit"
                            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 transition-[background-color,border-color,color,transform] duration-[180ms] hover:border-slate-300 hover:bg-white hover:text-slate-900 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100"
                          >
                            {label}
                          </button>
                        </form>
                      ))}
                    </div>
                  </div>
                ) : null}

                {canConvert ? (
                  <ConvertSection
                    quotationId={quotation.id}
                    paymentMethods={paymentMethods}
                    today={today}
                    quotationTotal={quotationTotal}
                  />
                ) : null}
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white/95 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:p-4">
              <div className="mx-auto grid max-w-[900px] gap-2 rounded-[22px] border border-slate-200 bg-white p-3 shadow-[0_10px_34px_rgba(15,23,42,0.10)] dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-[1fr_1fr_auto] sm:p-4">
                {pdfMessage ? (
                  <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300 sm:col-span-3">
                    {pdfMessage}
                  </p>
                ) : null}
                {!isConverted ? (
                  <button
                    type="submit"
                    form={editFormId}
                    disabled={saveBusy}
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-sky-600 bg-sky-600 px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(14,165,233,0.18)] transition-[background-color,border-color,box-shadow,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-sky-700 hover:bg-sky-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:border-cyan-500 dark:bg-cyan-500 dark:text-slate-950 dark:shadow-none dark:hover:bg-cyan-400"
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      {saveBusy ? (
                        <>
                          <ButtonSpinner />
                          Guardando...
                        </>
                      ) : (
                        "Guardar cambios"
                      )}
                    </span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={downloadPdf}
                  disabled={pdfBusy}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-[background-color,border-color,color,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-900 dark:hover:text-white"
                >
                  {pdfBusy ? "Generando PDF..." : "Descargar cotización en PDF"}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-600 transition-[background-color,border-color,color,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-slate-300 hover:bg-white hover:text-slate-950 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-900 dark:hover:text-white"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
