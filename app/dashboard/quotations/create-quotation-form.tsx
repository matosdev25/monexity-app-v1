"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { lockBodyScroll, useModalAccessibility } from "@/components/modal-accessibility";
import { useFormStatus } from "react-dom";
import { ButtonSpinner } from "@/components/button-spinner";
import { formatCurrency } from "@/lib/currency-format";
import { createQuotation } from "./actions";
import type { QuotationActionState } from "./types";
import type { CompanyService } from "../mi-negocio/types";
import {
  getCompanyInitial,
  getCompanyMetadataLines,
  getCompanyName,
  loadPdfLogo,
  type QuotationCompanyInfo,
} from "./pdf-helpers";

const initialState: QuotationActionState = { success: false, message: "" };

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-[border-color,box-shadow,background-color] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:[color-scheme:dark] dark:focus-visible:border-cyan-400 dark:focus-visible:ring-cyan-500/10 dark:disabled:bg-slate-900 dark:disabled:text-slate-400";

const inputErrorClass =
  "w-full rounded-xl border border-rose-400 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-[border-color,box-shadow,background-color] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:border-rose-400 focus-visible:ring-2 focus-visible:ring-rose-100 dark:border-rose-400/70 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:[color-scheme:dark] dark:focus-visible:ring-rose-400/10";

type ItemRow = {
  serviceId: string;
  serviceNameSnapshot: string;
  description: string;
  quantity: string;
  unit_price: string;
};

type Props = {
  today: string;
  services: CompanyService[];
  company: QuotationCompanyInfo;
  // Abrir al montar (shortcut "Nueva cotización" del dashboard → ?nueva=1)
  autoOpen?: boolean;
};

const fieldLabelClass = "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400";
const motionClass =
  "transition-[background-color,border-color,color,box-shadow,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none";

function emptyRow(): ItemRow {
  return {
    serviceId: "",
    serviceNameSnapshot: "",
    description: "",
    quantity: "1",
    unit_price: "",
  };
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function buildPhoneHidden(digits: string): string {
  if (digits.length !== 8) return "";
  return `+507 ${digits.slice(0, 4)}-${digits.slice(4)}`;
}

function parseMoney(v: string) {
  const n = Number(v.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

// Misma regla que el servidor: vacío → 1; cualquier otro valor se toma tal cual
// (0 o inválido NO se convierte en 1: se marca como error).
function parseQuantity(v: string) {
  return v.trim() === "" ? 1 : parseMoney(v);
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
      if (hasDot) {
        if (decimals < maxDecimals) {
          result += ch;
          decimals++;
        }
      } else {
        result += ch;
      }
    } else if (ch === "." && !hasDot && maxDecimals > 0) {
      result += ch;
      hasDot = true;
    }
  }

  return result;
}

function SaveButton({ saved, invalid = false }: { saved: boolean; invalid?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || saved || invalid}
      aria-busy={pending}
      className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl border border-sky-600 bg-sky-600 px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(14,165,233,0.22)] transition-[background-color,border-color,box-shadow,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-sky-700 hover:bg-sky-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 motion-reduce:transition-none dark:border-cyan-500 dark:bg-cyan-500 dark:text-slate-950 dark:shadow-none dark:hover:bg-cyan-400"
    >
      <span className="inline-flex items-center justify-center gap-2">
        {pending ? (
          <>
            <ButtonSpinner />
            Guardando...
          </>
        ) : saved ? (
          "Cotización guardada"
        ) : (
          "Guardar cotización"
        )}
      </span>
    </button>
  );
}

export function CreateQuotationForm({ today, services, company, autoOpen = false }: Props) {
  const [state, formAction] = useActionState(createQuotation, initialState);
  const [open, setOpen] = useState(false);
  const [taxValue, setTaxValue] = useState("");
  const descriptionRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [focusRowIndex, setFocusRowIndex] = useState<number | null>(null);

  // Shortcut del dashboard: abre directo y limpia ?nueva=1 (recargar no reabre)
  useEffect(() => {
    if (!autoOpen) return;
    const timer = window.setTimeout(() => {
      setOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("nueva");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [autoOpen]);

  // Al agregar una línea, el foco va a su descripción
  useEffect(() => {
    if (focusRowIndex === null) return;
    descriptionRefs.current[focusRowIndex]?.focus();
    const timer = window.setTimeout(() => setFocusRowIndex(null), 0);
    return () => window.clearTimeout(timer);
  }, [focusRowIndex]);
  const [formKey, setFormKey] = useState(0);
  const [pdfMessage, setPdfMessage] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [ignoredActionTimestamp, setIgnoredActionTimestamp] = useState<
    number | undefined
  >();

  const [customerName, setCustomerName] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhoneDigits, setCustomerPhoneDigits] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [items, setItems] = useState<ItemRow[]>([emptyRow()]);
  const [discountType, setDiscountType] = useState<"$" | "%">("$");
  const [discountValue, setDiscountValue] = useState("");
  const [emailError, setEmailError] = useState("");

  const actionSaved =
    state.timestamp !== ignoredActionTimestamp && state.success && Boolean(state.quotationId);
  const savedQuotationId = actionSaved ? state.quotationId ?? "" : "";
  const savedQuotationNumber = actionSaved
    ? state.quotationNumber ?? "Cotización guardada"
    : "";
  const saved = Boolean(savedQuotationId);
  const actionMessage =
    state.timestamp === ignoredActionTimestamp ? "" : state.message;

  const subtotal = useMemo(
    () =>
      roundMoney(
        items.reduce((sum, row) => {
          const qty = parseQuantity(row.quantity);
          return sum + qty * parseMoney(row.unit_price);
        }, 0)
      ),
    [items]
  );

  const discountAmt = useMemo(() => {
    const value = parseMoney(discountValue);
    if (discountType === "%") {
      return roundMoney((Math.min(100, Math.max(0, value)) * subtotal) / 100);
    }
    return roundMoney(Math.max(0, value));
  }, [discountType, discountValue, subtotal]);

  const taxAmt = roundMoney(Math.max(0, parseMoney(taxValue)));
  // Misma regla que el servidor: total = subtotal − descuento + impuesto (mínimo 0)
  const total = useMemo(
    () => roundMoney(Math.max(0, subtotal - discountAmt + taxAmt)),
    [subtotal, discountAmt, taxAmt]
  );
  // Aviso solo si el total real (con impuesto) quedaría negativo y el servidor lo lleva a 0
  const totalWouldClamp = subtotal - discountAmt + taxAmt < 0;
  const hasInvalidQuantity = items.some((row) => parseQuantity(row.quantity) <= 0);
  const hasLineWithoutPrice = items.some((row) => row.description.trim() && parseMoney(row.unit_price) <= 0);

  function resetDraft() {
    setFormKey((current) => current + 1);
    setPdfMessage("");
    setPdfBusy(false);
    setIgnoredActionTimestamp(state.timestamp);
    setCustomerName("");
    setCustomerCompany("");
    setCustomerEmail("");
    setCustomerPhoneDigits("");
    setValidUntil("");
    setNotes("");
    setTerms("");
    setItems([emptyRow()]);
    setDiscountType("$");
    setDiscountValue("");
    setTaxValue("");
    setEmailError("");
  }

  function closeAndReset() {
    resetDraft();
    setOpen(false);
  }

  // Foco, Tab confinado, Escape (igual que ✕) y retorno de foco al disparador
  const titleId = useId();
  const panelRef = useModalAccessibility({ open, onClose: closeAndReset });

  // Bloqueo de scroll compartido (body + contenedor del dashboard), como los demás modales
  useEffect(() => {
    if (!open) return;
    return lockBodyScroll();
  }, [open]);

  function updateItem(index: number, updates: Partial<ItemRow>) {
    setItems((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...updates } : row))
    );
  }

  function selectService(index: number, serviceId: string) {
    const service = services.find((s) => s.id === serviceId);
    if (!service) {
      updateItem(index, { serviceId: "", serviceNameSnapshot: "" });
      return;
    }

    updateItem(index, {
      serviceId: service.id,
      serviceNameSnapshot: service.name,
      description: service.name,
      unit_price: service.base_price != null ? String(service.base_price) : "",
    });
  }

  function addRow() {
    if (saved) return;
    setFocusRowIndex(items.length);
    setItems([...items, emptyRow()]);
  }

  function removeRow(index: number) {
    if (saved) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function downloadPdf() {
    if (!savedQuotationId) {
      setPdfMessage("Guarda la cotización antes de descargar el PDF.");
      return;
    }

    setPdfBusy(true);
    setPdfMessage("");

    try {
      const mod = await import("jspdf");
      const JsPDF = mod.default ?? mod.jsPDF;
      const doc = new JsPDF({ unit: "mm", format: "a4", compress: true });
      const quotationNumber = savedQuotationNumber || savedQuotationId;
      const phone = buildPhoneHidden(customerPhoneDigits);
      const companyName = getCompanyName(company);
      const companyDetails = getCompanyMetadataLines(company);
      const logo = await loadPdfLogo(company.logoUrl);

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 16;
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

      function textColor(color: PdfColor) {
        doc.setTextColor(color[0], color[1], color[2]);
      }

      function drawCard(x: number, y: number, w: number, h: number, fill = slate50) {
        doc.setFillColor(fill[0], fill[1], fill[2]);
        doc.setDrawColor(slate200[0], slate200[1], slate200[2]);
        doc.setLineWidth(0.25);
        doc.roundedRect(x, y, w, h, 4, 4, "FD");
      }

      function ensurePage(y: number, needed: number) {
        if (y + needed <= pageHeight - margin) return y;
        doc.addPage();
        return margin;
      }

      function sectionLabel(label: string, x: number, y: number) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        textColor(blue600);
        doc.text(label.toUpperCase(), x, y);
      }

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
      doc.text(quotationNumber, 138, 33);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      textColor(slate500);
      doc.text(`Emitida: ${today}`, 138, 40);
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
      doc.text(validUntil || "Sin fecha", margin + 5, y + 17);

      sectionLabel("Emitida", margin + metaWidth + 9, y + 8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      textColor(slate950);
      doc.text(today, margin + metaWidth + 9, y + 17);

      sectionLabel("Total", margin + (metaWidth + 4) * 2 + 5, y + 8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      textColor(slate950);
      doc.text(formatCurrency(total), margin + (metaWidth + 4) * 2 + 5, y + 17);

      y += 32;
      drawCard(margin, y, contentWidth, 30, [255, 255, 255]);
      sectionLabel("Cliente", margin + 6, y + 9);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      textColor(slate950);
      doc.text(customerName || "Cliente general", margin + 6, y + 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      textColor(slate700);
      const contact = [customerCompany, customerEmail, phone].filter(Boolean).join("  ·  ");
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

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      items.forEach((item, index) => {
        const qty = parseQuantity(item.quantity);
        const price = parseMoney(item.unit_price);
        const lineTotal = roundMoney(qty * price);
        const description = item.description || "Servicio";
        const lines: string[] = doc.splitTextToSize(description, 88);
        const rowHeight = Math.max(12, lines.length * 4.5 + 6);

        y = ensurePage(y, rowHeight + 6);
        if (index % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.roundedRect(margin, y - 2, contentWidth, rowHeight, 2, 2, "F");
        }

        textColor(slate950);
        doc.text(lines, margin + 5, y + 4);
        textColor(slate700);
        doc.text(String(qty), 126, y + 4, { align: "right" });
        doc.text(formatCurrency(price), 156, y + 4, { align: "right" });
        doc.setFont("helvetica", "bold");
        textColor(slate950);
        doc.text(formatCurrency(lineTotal), 190, y + 4, { align: "right" });
        doc.setFont("helvetica", "normal");

        y += rowHeight;
      });

      y = ensurePage(y + 4, 52);
      const summaryX = 118;
      const summaryW = 76;
      // Mismas líneas que la cotización guardada: subtotal, descuento, impuesto y total
      const extraLines = [
        ...(discountAmt > 0 ? [{ label: "Descuento", value: `-${formatCurrency(discountAmt)}`, rose: true }] : []),
        ...(taxAmt > 0 ? [{ label: "Impuesto", value: `+${formatCurrency(taxAmt)}`, rose: false }] : []),
      ];
      const summaryH = 30 + extraLines.length * 9;
      drawCard(summaryX, y, summaryW, summaryH, [255, 255, 255]);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      textColor(slate500);
      doc.text("Subtotal", summaryX + 6, y + 10);
      textColor(slate950);
      doc.text(formatCurrency(subtotal), summaryX + summaryW - 6, y + 10, { align: "right" });
      extraLines.forEach((line, index) => {
        const lineY = y + 19 + index * 9;
        textColor(slate500);
        doc.text(line.label, summaryX + 6, lineY);
        if (line.rose) doc.setTextColor(225, 29, 72);
        else textColor(slate950);
        doc.text(line.value, summaryX + summaryW - 6, lineY, { align: "right" });
      });
      const totalY = y + 20 + extraLines.length * 9;

      doc.setDrawColor(slate200[0], slate200[1], slate200[2]);
      doc.line(summaryX + 6, totalY - 6, summaryX + summaryW - 6, totalY - 6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      textColor(blue900);
      doc.text("Total", summaryX + 6, totalY);
      doc.setFontSize(13);
      doc.text(formatCurrency(total), summaryX + summaryW - 6, totalY, { align: "right" });

      const noteCards = [
        { title: "NOTAS", value: notes.trim() },
        { title: "TÉRMINOS Y CONDICIONES", value: terms.trim() },
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

      doc.save(`cotizacion-${quotationNumber}.pdf`);
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
        className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-sky-600 bg-sky-600 px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(14,165,233,0.22)] transition-[background-color,border-color,box-shadow,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-sky-700 hover:bg-sky-700 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:border-cyan-500 dark:bg-cyan-500 dark:text-slate-950 dark:shadow-none dark:hover:bg-cyan-400 dark:focus-visible:outline-cyan-400 sm:w-auto"
      >
        Nueva cotización
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/50 backdrop-blur-[2px] motion-reduce:backdrop-blur-none sm:items-center sm:px-6 sm:py-4">
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="animate-mx-scale-in flex h-dvh w-full max-w-[920px] flex-col overflow-hidden bg-slate-100 outline-none shadow-[0_24px_80px_rgba(15,23,42,0.28)] sm:h-auto sm:max-h-[90dvh] sm:rounded-[28px] sm:border sm:border-white/70 dark:bg-slate-950 sm:dark:border-slate-800">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-sky-700 dark:text-cyan-300">
                  Nueva cotización
                </p>
                <h2 id={titleId} className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                  {saved ? `Cotización ${savedQuotationNumber}` : "Preparar documento"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeAndReset}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-[background-color,border-color,color,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-900 dark:hover:text-white dark:focus-visible:outline-white"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <form key={formKey} action={formAction} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
                <div className="mx-auto max-w-[820px] rounded-[24px] border border-slate-200 bg-white shadow-[0_14px_44px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900">
                  <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-7 sm:py-5">
                    <input type="hidden" name="issueDate" value={today} readOnly />
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/70">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Número</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {savedQuotationNumber || "Se asigna al guardar"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/70">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Emitida</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{today}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/70">
                        <label htmlFor="quotation-valid-until" className="block text-[11px] uppercase tracking-[0.14em] text-slate-400">Válida hasta</label>
                        <input id="quotation-valid-until" name="validUntil" type="date" min={today} value={validUntil} disabled={saved} onChange={(e) => setValidUntil(e.target.value)} className="mt-1 min-h-6 w-full bg-transparent text-sm font-medium text-slate-900 outline-none disabled:cursor-not-allowed disabled:text-slate-500 dark:text-slate-100 dark:[color-scheme:dark]" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 px-4 py-5 sm:px-7">
                    <section>
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Cliente
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor="quotation-customer-name" className={fieldLabelClass}>Nombre</label>
                          <input id="quotation-customer-name" name="customerName" type="text" autoComplete="off" maxLength={120} value={customerName} disabled={saved} onChange={(e) => setCustomerName(e.target.value)} className={inputClass} placeholder="Cliente general" />
                        </div>
                        <div>
                          <label htmlFor="quotation-customer-company" className={fieldLabelClass}>Empresa (opcional)</label>
                          <input id="quotation-customer-company" name="customerCompany" type="text" autoComplete="off" maxLength={120} value={customerCompany} disabled={saved} onChange={(e) => setCustomerCompany(e.target.value)} className={inputClass} placeholder="Nombre de la empresa" />
                        </div>
                        <div>
                          <label htmlFor="quotation-customer-email" className={fieldLabelClass}>Correo (opcional)</label>
                          <input
                            id="quotation-customer-email"
                            name="customerEmail"
                            type="email"
                            maxLength={120}
                            value={customerEmail}
                            disabled={saved}
                            onChange={(e) => {
                              setCustomerEmail(e.target.value);
                              if (emailError) {
                                const v = e.target.value.trim();
                                setEmailError(v && !isValidEmail(v) ? "Ingresa un email válido." : "");
                              }
                            }}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              setEmailError(v && !isValidEmail(v) ? "Ingresa un email válido." : "");
                            }}
                            className={emailError ? inputErrorClass : inputClass}
                            placeholder="email@ejemplo.com"
                          />
                          {emailError ? (
                            <p role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">{emailError}</p>
                          ) : null}
                        </div>
                        <div>
                          <label htmlFor="quotation-customer-phone" className={fieldLabelClass}>Teléfono (opcional)</label>
                          <input type="hidden" name="customerPhone" value={buildPhoneHidden(customerPhoneDigits)} />
                          <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white transition-[border-color,box-shadow,background-color] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-sky-100 dark:border-slate-700 dark:bg-slate-950/70 dark:focus-within:border-cyan-400 dark:focus-within:ring-cyan-500/10">
                            <span className="select-none pl-4 pr-2 text-sm text-slate-500 dark:text-slate-400">+507</span>
                            <div className="h-4 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
                            <input
                              id="quotation-customer-phone"
                              type="tel"
                              inputMode="numeric"
                              value={customerPhoneDigits.length <= 4 ? customerPhoneDigits : `${customerPhoneDigits.slice(0, 4)}-${customerPhoneDigits.slice(4)}`}
                              disabled={saved}
                              onChange={(e) => setCustomerPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, 8))}
                              placeholder="6000-0000"
                              maxLength={9}
                              className="min-w-0 flex-1 bg-transparent py-2.5 pl-2 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-500 dark:text-slate-100 dark:disabled:text-slate-400"
                            />
                          </div>
                        </div>
                      </div>
                    </section>

                    <section>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Ítems · {items.length}
                        </p>
                      </div>

                      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                        <div className="hidden grid-cols-[minmax(0,1fr)_84px_116px_116px_44px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:border-slate-800 dark:bg-slate-950/70 sm:grid">
                          <span>Descripción</span>
                          <span className="text-center">Cant.</span>
                          <span className="text-right">P. unit.</span>
                          <span className="text-right">Total</span>
                          <span />
                        </div>
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                          {items.map((row, i) => {
                            const lineTotal = roundMoney(parseQuantity(row.quantity) * parseMoney(row.unit_price));
                            const rowLabel = `Ítem ${i + 1}`;
                            const qtyInvalid = parseQuantity(row.quantity) <= 0;
                            const qtyErrorId = `quotation-item-qty-error-${i}`;

                            return (
                              <li key={i} className="bg-white p-3 dark:bg-slate-900" aria-label={rowLabel}>
                                <div className="mb-2 flex items-center justify-between gap-2 sm:hidden">
                                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{rowLabel}</span>
                                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(lineTotal)}</span>
                                </div>

                                {services.length > 0 ? (
                                  <div className="mb-2">
                                    <label htmlFor={`quotation-item-service-${i}`} className="sr-only">Servicio del catálogo ({rowLabel})</label>
                                    <select
                                      id={`quotation-item-service-${i}`}
                                      value={row.serviceId}
                                      disabled={saved}
                                      onChange={(e) => selectService(i, e.target.value)}
                                      className={inputClass}
                                    >
                                      <option value="">Escribir manualmente</option>
                                      {services.map((service) => (
                                        <option key={service.id} value={service.id}>
                                          {service.name}{service.base_price != null ? ` · ${formatCurrency(service.base_price)}` : ""}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                ) : null}

                                <input type="hidden" name="itemServiceId[]" value={row.serviceId} />
                                <input type="hidden" name="itemServiceName[]" value={row.serviceNameSnapshot} />

                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_84px_116px_116px_44px] sm:items-center">
                                  <div className="col-span-2 sm:col-span-1">
                                    <label htmlFor={`quotation-item-desc-${i}`} className={`${fieldLabelClass} sm:sr-only`}>Descripción</label>
                                    <input
                                      id={`quotation-item-desc-${i}`}
                                      ref={(el) => { descriptionRefs.current[i] = el; }}
                                      name="itemDescription[]"
                                      type="text"
                                      required
                                      value={row.description}
                                      disabled={saved}
                                      onChange={(e) => updateItem(i, { description: e.target.value })}
                                      placeholder="Qué vas a cotizar"
                                      className={inputClass}
                                    />
                                  </div>
                                  <div>
                                    <label htmlFor={`quotation-item-qty-${i}`} className={`${fieldLabelClass} sm:sr-only`}>Cantidad</label>
                                    <input
                                      id={`quotation-item-qty-${i}`}
                                      name="itemQuantity[]"
                                      type="text"
                                      inputMode="decimal"
                                      value={row.quantity}
                                      disabled={saved}
                                      onChange={(e) => updateItem(i, { quantity: sanitizeNumeric(e.target.value, 2) })}
                                      placeholder="1"
                                      aria-invalid={qtyInvalid || undefined}
                                      aria-describedby={qtyInvalid ? qtyErrorId : undefined}
                                      className={`${qtyInvalid ? inputErrorClass : inputClass} sm:text-center`}
                                    />
                                    {qtyInvalid ? (
                                      <p id={qtyErrorId} role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                                        Debe ser mayor a 0.
                                      </p>
                                    ) : null}
                                  </div>
                                  <div>
                                    <label htmlFor={`quotation-item-price-${i}`} className={`${fieldLabelClass} sm:sr-only`}>Precio unitario ($)</label>
                                    <input id={`quotation-item-price-${i}`} name="itemUnitPrice[]" type="text" inputMode="decimal" value={row.unit_price} disabled={saved} onChange={(e) => updateItem(i, { unit_price: sanitizeNumeric(e.target.value, 2) })} placeholder="0.00" className={`${inputClass} sm:text-right`} />
                                  </div>
                                  <div className="hidden rounded-xl bg-slate-50 px-3 py-2.5 text-right text-sm font-semibold text-slate-900 dark:bg-slate-950/70 dark:text-slate-100 sm:block" aria-label={`Total ${rowLabel}`}>
                                    {formatCurrency(lineTotal)}
                                  </div>
                                  {items.length > 1 ? (
                                    <button
                                      type="button"
                                      onClick={() => removeRow(i)}
                                      disabled={saved}
                                      className={`col-span-2 flex h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-sm font-medium text-rose-600 ${motionClass} hover:border-rose-300 hover:bg-rose-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 sm:col-span-1 sm:h-11 sm:w-11 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300`}
                                      aria-label={`Eliminar ${rowLabel}`}
                                    >
                                      <span aria-hidden="true">×</span>
                                      <span className="sm:hidden">Quitar línea</span>
                                    </button>
                                  ) : (
                                    <div className="hidden h-11 w-11 sm:block" />
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                        <button
                          type="button"
                          onClick={addRow}
                          disabled={saved}
                          className={`flex h-12 w-full items-center justify-center gap-2 border-t border-dashed border-slate-200 bg-slate-50/70 text-sm font-semibold text-sky-700 ${motionClass} hover:bg-sky-50 active:bg-sky-100 disabled:cursor-not-allowed disabled:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-300 dark:border-slate-700 dark:bg-slate-950/40 dark:text-cyan-300 dark:hover:bg-cyan-500/10`}
                        >
                          <span aria-hidden="true">+</span> Agregar línea
                        </button>
                      </div>
                      {hasLineWithoutPrice ? (
                        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                          Hay líneas sin precio: se guardarán en $ 0.00.
                        </p>
                      ) : null}
                    </section>

                    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                      <div className="space-y-3">
                        <div>
                          <label htmlFor="quotation-notes" className={fieldLabelClass}>Notas para el cliente (opcional)</label>
                          <textarea id="quotation-notes" name="notes" rows={3} value={notes} disabled={saved} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} min-h-20 resize-none`} placeholder="Ej.: incluye instalación" />
                        </div>
                        <div>
                          <label htmlFor="quotation-terms" className={fieldLabelClass}>Términos (opcional)</label>
                          <textarea id="quotation-terms" name="terms" rows={3} value={terms} disabled={saved} onChange={(e) => setTerms(e.target.value)} className={`${inputClass} min-h-20 resize-none`} placeholder="Ej.: 50% de adelanto" />
                        </div>
                      </div>

                      <div className="self-start rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Resumen
                        </p>
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="text-slate-500 dark:text-slate-400">Subtotal</span>
                            <span className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(subtotal)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <label htmlFor="quotation-discount" className="text-sm text-slate-500 dark:text-slate-400">Descuento</label>
                            <div className="flex items-center gap-1.5">
                              <div role="group" aria-label="Tipo de descuento" className="flex overflow-hidden rounded-lg border border-slate-200 text-xs dark:border-slate-700">
                                <button type="button" aria-pressed={discountType === "$"} disabled={saved} onClick={() => { setDiscountType("$"); setDiscountValue(""); }} className={`min-h-9 min-w-9 px-2.5 font-semibold ${motionClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-300 ${discountType === "$" ? "bg-sky-500 text-white dark:bg-cyan-500 dark:text-slate-950" : "text-slate-500 hover:text-slate-700 disabled:text-slate-400 dark:text-slate-400 dark:hover:text-slate-200"}`}>$</button>
                                <button type="button" aria-pressed={discountType === "%"} disabled={saved} onClick={() => { setDiscountType("%"); setDiscountValue(""); }} className={`min-h-9 min-w-9 px-2.5 font-semibold ${motionClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-300 ${discountType === "%" ? "bg-sky-500 text-white dark:bg-cyan-500 dark:text-slate-950" : "text-slate-500 hover:text-slate-700 disabled:text-slate-400 dark:text-slate-400 dark:hover:text-slate-200"}`}>%</button>
                              </div>
                              <input
                                id="quotation-discount"
                                type="text"
                                inputMode="decimal"
                                value={discountValue}
                                disabled={saved}
                                onChange={(e) => {
                                  const value = sanitizeNumeric(e.target.value, 2);
                                  setDiscountValue(discountType === "%" && parseMoney(value) > 100 ? "100" : value);
                                }}
                                placeholder="0"
                                className="h-9 w-24 rounded-xl border border-slate-200 bg-white px-3 text-right text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-[border-color,box-shadow,background-color] duration-[180ms] focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus-visible:border-cyan-400"
                              />
                              <input type="hidden" name="discountAmount" value={String(discountAmt)} />
                            </div>
                          </div>
                          {discountAmt > 0 ? (
                            <p className="text-right text-xs text-rose-500 dark:text-rose-400">
                              −{formatCurrency(discountAmt)}
                              {discountType === "%" ? ` (${discountValue}%)` : ""}
                            </p>
                          ) : null}
                          {totalWouldClamp ? (
                            <p role="alert" className="text-right text-xs text-amber-700 dark:text-amber-300">
                              El descuento supera el subtotal más el impuesto; el total quedará en $ 0.00.
                            </p>
                          ) : null}
                          <div className="flex items-center justify-between gap-3">
                            <label htmlFor="quotation-tax" className="text-sm text-slate-500 dark:text-slate-400">
                              Impuesto ($)
                            </label>
                            <input
                              id="quotation-tax"
                              type="text"
                              inputMode="decimal"
                              value={taxValue}
                              disabled={saved}
                              onChange={(e) => setTaxValue(sanitizeNumeric(e.target.value, 2))}
                              placeholder="0.00"
                              className="h-9 w-24 rounded-xl border border-slate-200 bg-white px-3 text-right text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-[border-color,box-shadow,background-color] duration-[180ms] focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus-visible:border-cyan-400"
                            />
                            <input type="hidden" name="taxAmount" value={String(taxAmt)} />
                          </div>
                          {taxAmt > 0 ? (
                            <p className="text-right text-xs text-slate-500 dark:text-slate-400">+{formatCurrency(taxAmt)}</p>
                          ) : null}
                          <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Total</span>
                            <span className="text-xl font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(total)}</span>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              </div>

              <div className="shrink-0 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:p-4">
                <div className="mx-auto max-w-[820px] rounded-[22px] border border-slate-200 bg-white p-3 shadow-[0_10px_34px_rgba(15,23,42,0.10)] dark:border-slate-800 dark:bg-slate-950 sm:p-4">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Total a cotizar</span>
                    <span className="text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">{formatCurrency(total)}</span>
                  </div>

                  {saved ? (
                    <div role="status" className="mb-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
                      <p className="font-semibold">Cotización {savedQuotationNumber} guardada ✓</p>
                      <p className="mt-0.5 text-emerald-700 dark:text-emerald-300">Ya aparece en tu lista. Descárgala en PDF o crea otra.</p>
                    </div>
                  ) : !state.success && actionMessage ? (
                    <p role="alert" className="mb-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                      {actionMessage}
                    </p>
                  ) : null}
                  {pdfMessage ? (
                    <p role="alert" className="mb-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                      {pdfMessage}
                    </p>
                  ) : null}

                  {saved ? (
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <button
                        type="button"
                        onClick={downloadPdf}
                        disabled={pdfBusy}
                        aria-busy={pdfBusy}
                        className={`inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-sky-600 bg-sky-600 px-4 text-sm font-semibold text-white ${motionClass} hover:bg-sky-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:border-cyan-500 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400`}
                      >
                        {pdfBusy ? <ButtonSpinner variant="current" /> : null}
                        {pdfBusy ? "Generando PDF..." : "Descargar PDF"}
                      </button>
                      <button
                        type="button"
                        onClick={resetDraft}
                        className={`inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 ${motionClass} hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900 dark:focus-visible:outline-white`}
                      >
                        Crear otra
                      </button>
                      <button
                        type="button"
                        onClick={closeAndReset}
                        className={`inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-600 ${motionClass} hover:border-slate-300 hover:bg-white hover:text-slate-950 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-900 dark:focus-visible:outline-white`}
                      >
                        Cerrar
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <SaveButton saved={saved} invalid={hasInvalidQuantity} />
                      <button
                        type="button"
                        onClick={closeAndReset}
                        className={`inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-600 ${motionClass} hover:border-slate-300 hover:bg-white hover:text-slate-950 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-900 dark:focus-visible:outline-white`}
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
