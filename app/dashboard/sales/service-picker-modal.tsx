"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { formatCurrency } from "../../../lib/currency-format";
import type { CompanyService } from "../mi-negocio/types";
import type { LineItem } from "./product-picker-modal";

type Props = {
  open: boolean;
  services: CompanyService[];
  onAdd: (item: LineItem) => void;
  onClose: () => void;
};

const inputClass =
  "h-10 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-cyan-400 dark:focus:ring-cyan-500/10";

function createServiceLineItemUid(serviceId: string) {
  return `svc-${serviceId}-${Date.now()}`;
}

export function ServicePickerModal({ open, services, onAdd, onClose }: Props) {
  const [selectedId, setSelectedId] = useState(() => services[0]?.id ?? "");
  const [customPrice, setCustomPrice] = useState(() =>
    services[0]?.base_price !== null && services[0]?.base_price !== undefined
      ? String(services[0].base_price)
      : ""
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const selectedService = services.find((s) => s.id === selectedId) ?? null;

  function handleServiceChange(id: string) {
    setSelectedId(id);
    setError(null);
    const svc = services.find((s) => s.id === id);
    setCustomPrice(svc?.base_price !== null && svc?.base_price !== undefined ? String(svc.base_price) : "");
  }

  function handleAdd() {
    setError(null);
    if (!selectedService) {
      setError("Selecciona un servicio.");
      return;
    }
    const price = Number(customPrice.replace(/,/g, "").trim());
    if (!Number.isFinite(price) || price < 0) {
      setError("Ingresa un precio válido.");
      return;
    }

    onAdd({
      uid: createServiceLineItemUid(selectedService.id),
      productId: "",
      name: selectedService.name,
      qty: 1,
      unitPrice: price,
      trackInventory: false,
      availableStock: 0,
    });
    onClose();
  }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000]">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-slate-950/45 dark:bg-black/60"
        onClick={onClose}
      />
      <div className="absolute inset-0 overflow-y-auto overscroll-contain p-4">
        <div className="flex min-h-full items-center justify-center">
          <div className="relative my-4 w-full max-w-sm rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-sky-600 dark:text-cyan-400">
                  Servicios
                </p>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                  Agregar servicio
                </h3>
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
              {/* Service select */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-300">
                  Servicio
                </label>
                <select
                  value={selectedId}
                  onChange={(e) => handleServiceChange(e.target.value)}
                  className={inputClass}
                >
                  {(() => {
                    const grouped = new Map<string, CompanyService[]>();
                    for (const svc of services) {
                      const key = (svc.category ?? "").trim() || "__none__";
                      if (!grouped.has(key)) grouped.set(key, []);
                      grouped.get(key)!.push(svc);
                    }
                    const hasCategories = [...grouped.keys()].some((k) => k !== "__none__");
                    if (!hasCategories) {
                      return services.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ));
                    }
                    const sortedKeys = [...grouped.keys()].sort((a, b) => {
                      if (a === "__none__") return 1;
                      if (b === "__none__") return -1;
                      return a.localeCompare(b, "es");
                    });
                    return sortedKeys.map((key) => (
                      <optgroup key={key} label={key === "__none__" ? "Sin categoría" : key}>
                        {grouped.get(key)!.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </optgroup>
                    ));
                  })()}
                </select>
              </div>

              {/* Service description */}
              {selectedService?.description && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedService.description}
                  </p>
                </div>
              )}

              {/* Price (editable) */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-300">
                  Precio
                  {selectedService?.base_price !== null && selectedService?.base_price !== undefined && (
                    <span className="ml-1.5 text-xs font-normal text-slate-400 dark:text-slate-500">
                      (base: {formatCurrency(selectedService.base_price)})
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="$ 0.00"
                  value={customPrice}
                  onChange={(e) => {
                    setCustomPrice(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdd();
                    }
                  }}
                  className={inputClass}
                />
              </div>

              {/* Error */}
              {error && (
                <p className="rounded-[14px] border border-red-400/30 bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
                  {error}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!selectedService}
                  className="h-10 flex-1 rounded-2xl bg-sky-600 px-4 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
                >
                  Agregar
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 rounded-2xl border border-slate-200 px-4 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
