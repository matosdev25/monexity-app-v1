"use client";

import { useEffect, useMemo, useState, useDeferredValue, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { formatShortDate } from "../../../lib/date-format";
import { formatCurrency } from "../../../lib/currency-format";
import type { Quotation } from "./types";

const STATUS_TABS = [
  { value: "all", label: "Todas" },
  { value: "draft", label: "Borrador" },
  { value: "sent", label: "Enviadas" },
  { value: "accepted", label: "Aceptadas" },
  { value: "rejected", label: "Rechazadas" },
  { value: "converted", label: "Convertidas" },
] as const;

type StatusTab = (typeof STATUS_TABS)[number]["value"];

function getStatusLabel(status: string) {
  switch (status) {
    case "draft": return "Borrador";
    case "sent": return "Enviada";
    case "accepted": return "Aceptada";
    case "rejected": return "Rechazada";
    case "expired": return "Vencida";
    case "converted": return "Convertida";
    default: return status;
  }
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "draft":
      return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
    case "sent":
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-200";
    case "accepted":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200";
    case "rejected":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-200";
    case "expired":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-200";
    case "converted":
      return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/25 dark:bg-violet-500/10 dark:text-violet-200";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
}

function isExpired(validUntil: string | null, status: string) {
  if (!validUntil || status === "converted" || status === "expired") return false;
  return validUntil < new Date().toISOString().slice(0, 10);
}

const panelClass =
  "rounded-[28px] border border-slate-200/90 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-900/95 dark:shadow-[0_24px_80px_rgba(2,6,23,0.50)]";

const cardClass =
  "rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)] transition-colors hover:border-sky-200/80 dark:border-slate-700 dark:bg-slate-950/70 dark:shadow-none dark:hover:border-cyan-400/25";

const defaultTriggerClass =
  "rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition-colors duration-150 hover:border-sky-300 hover:bg-sky-100 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-200 dark:hover:bg-cyan-400/15";

const labelClass =
  "mb-1 block text-xs font-medium text-slate-500 dark:text-slate-300";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 transition-all duration-150 focus:border-sky-200 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:[color-scheme:dark] dark:focus:border-cyan-400 dark:focus:ring-cyan-500/10";

const primaryButtonClass =
  "rounded-xl border border-sky-600 bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-sky-700 dark:border-cyan-500 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400";

const secondaryButtonClass =
  "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-100";

const dateInputClass =
  "w-full rounded-xl border border-slate-200/70 bg-white/85 px-4 py-2.5 text-slate-900 outline-none backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] placeholder:text-slate-400 transition-all duration-150 focus:border-sky-300 focus:ring-2 focus:ring-sky-100/80 dark:border-white/10 dark:bg-white/[0.07] dark:text-slate-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:placeholder:text-slate-500 dark:[color-scheme:dark] dark:focus:border-cyan-400/60 dark:focus:ring-cyan-500/10";

type Props = {
  quotations: Quotation[];
  from?: string;
  to?: string;
  trigger?: ReactNode;
};

export function QuotationsHistoryModal({ quotations, from = "", to = "", trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [appliedFrom, setAppliedFrom] = useState(from);
  const [appliedTo, setAppliedTo] = useState(to);
  const [statusFilter, setStatusFilter] = useState<StatusTab>("all");

  function openModal() {
    setSearch("");
    setDraftFrom(from);
    setDraftTo(to);
    setAppliedFrom(from);
    setAppliedTo(to);
    setStatusFilter("all");
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const scrollContainer = document.querySelector<HTMLElement>("[data-scroll-container]");
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    if (scrollContainer) scrollContainer.style.overflowY = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      if (scrollContainer) scrollContainer.style.overflowY = "";
    };
  }, [open]);

  const closeModal = () => setOpen(false);

  const handleApplyFilters = () => {
    setAppliedFrom(draftFrom);
    setAppliedTo(draftTo);
  };

  const handleClearFilters = () => {
    setSearch("");
    setDraftFrom("");
    setDraftTo("");
    setAppliedFrom("");
    setAppliedTo("");
  };

  const filtered = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    return quotations.filter((q) => {
      const matchesFrom = !appliedFrom || (q.issue_date ?? "") >= appliedFrom;
      const matchesTo = !appliedTo || (q.issue_date ?? "") <= appliedTo;

      const matchesStatus =
        statusFilter === "all" || (q.status ?? "").toLowerCase() === statusFilter;

      const searchableText = [
        q.quotation_number ?? "",
        q.customer_name ?? "",
        q.customer_company ?? "",
        q.issue_date ?? "",
        q.valid_until ?? "",
        getStatusLabel(q.status ?? ""),
      ].join(" ").toLowerCase();

      return matchesFrom && matchesTo && matchesStatus && (!query || searchableText.includes(query));
    });
  }, [quotations, deferredSearch, appliedFrom, appliedTo, statusFilter]);

  const rangeLabel = useMemo(() => {
    if (appliedFrom && appliedTo) return `Rango: ${appliedFrom} a ${appliedTo}`;
    if (appliedFrom) return `Desde: ${appliedFrom}`;
    if (appliedTo) return `Hasta: ${appliedTo}`;
    return "Mostrando todas las cotizaciones";
  }, [appliedFrom, appliedTo]);

  const modal =
    open
      ? createPortal(
          <div className="fixed inset-0 z-[999]">
            <button
              type="button"
              aria-label="Cerrar historial"
              className="absolute inset-0 bg-white/30 backdrop-blur-[2px] dark:bg-slate-950/75 dark:backdrop-blur-sm"
              onClick={closeModal}
            />

            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className={`${panelClass} relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden`}>

                {/* Header con filtros */}
                <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-sky-700 dark:text-cyan-300">
                        Historial completo
                      </p>
                      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                        Cotizaciones
                      </h2>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {rangeLabel}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-colors duration-150 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100"
                      aria-label="Cerrar"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Filtros */}
                  <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_170px_170px_auto_auto]">
                    <div>
                      <label className={labelClass}>Buscar</label>
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cliente, empresa, número..."
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Desde</label>
                      <input
                        type="date"
                        value={draftFrom}
                        onChange={(e) => setDraftFrom(e.target.value)}
                        className={dateInputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Hasta</label>
                      <input
                        type="date"
                        value={draftTo}
                        onChange={(e) => setDraftTo(e.target.value)}
                        className={dateInputClass}
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleApplyFilters}
                        className={`${primaryButtonClass} w-full`}
                      >
                        Aplicar filtros
                      </button>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className={`${secondaryButtonClass} w-full`}
                      >
                        Limpiar
                      </button>
                    </div>
                  </div>

                  {/* Tabs de estado */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {STATUS_TABS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setStatusFilter(value)}
                        className={[
                          "rounded-xl border px-3 py-1.5 text-xs font-medium transition",
                          statusFilter === value
                            ? "border-sky-500 bg-sky-500 text-white dark:border-cyan-500 dark:bg-cyan-500 dark:text-slate-950"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
                        ].join(" ")}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lista */}
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                  {filtered.length === 0 ? (
                    <div className={cardClass}>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        No se encontraron cotizaciones con esos filtros.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {filtered.map((q) => {
                        const expired = isExpired(q.valid_until, q.status);
                        const displayStatus = expired ? "expired" : q.status;

                        return (
                          <div key={q.id} className={cardClass}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-sky-700/70 dark:text-cyan-300/80">
                                  {q.quotation_number ?? "Sin número"}
                                </p>
                                <p className="mt-0.5 text-base font-semibold text-slate-950 dark:text-slate-50">
                                  {q.customer_name?.trim() || "Cliente general"}
                                </p>
                                {q.customer_company ? (
                                  <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {q.customer_company}
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-flex rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.14em] ${getStatusBadgeClass(displayStatus)}`}
                                >
                                  {getStatusLabel(displayStatus)}
                                </span>
                                <span className="text-base font-semibold text-slate-950 dark:text-slate-50">
                                  {formatCurrency(Number(q.total ?? 0))}
                                </span>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                Emitida: {formatShortDate(q.issue_date)}
                                {q.valid_until ? ` · Vigente hasta: ${formatShortDate(q.valid_until)}` : ""}
                              </p>
                              <Link
                                href={`/dashboard/quotations/${q.id}`}
                                onClick={closeModal}
                                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100"
                              >
                                Ver detalle
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
      {trigger ? (
        <div
          role="button"
          tabIndex={0}
          className="cursor-pointer"
          onClick={openModal}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openModal(); }
          }}
        >
          {trigger}
        </div>
      ) : (
        <button type="button" onClick={openModal} className={defaultTriggerClass}>
          Ver historial
        </button>
      )}
      {modal}
    </>
  );
}
