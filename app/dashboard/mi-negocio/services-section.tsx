"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ButtonSpinner } from "@/components/button-spinner";
import { formatCurrency as formatMoney } from "@/lib/currency-format";
import {
  createService,
  updateService,
  toggleServiceActive,
  deleteService,
} from "./services-actions";
import type { CompanyService } from "./types";

type Props = {
  services: CompanyService[];
  companyId: string;
  canEdit: boolean;
};

type ActionResult = { success: boolean; error?: string };
const initialState: ActionResult = { success: false };

const inputClass =
  "h-10 w-full rounded-2xl border border-app bg-app-soft px-3 text-sm text-app outline-none transition placeholder:text-app-soft focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:focus:border-cyan-500 dark:focus:ring-cyan-500/10";

const textareaClass =
  "w-full resize-none rounded-2xl border border-app bg-app-soft px-3 py-2 text-sm text-app outline-none transition placeholder:text-app-soft focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:focus:border-cyan-500 dark:focus:ring-cyan-500/10";

function formatCurrency(value: number | null) {
  if (value === null) return "—";
  return formatMoney(value);
}

const CATEGORY_PALETTE = [
  "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
];

function buildColorMap(categories: string[]): Map<string, string> {
  const sorted = [...categories].sort((a, b) => a.localeCompare(b, "es"));
  const map = new Map<string, string>();
  sorted.forEach((cat, i) => {
    map.set(cat, CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]!);
  });
  return map;
}

function nextFreeColor(colorMap: Map<string, string>): string {
  const used = new Set(colorMap.values());
  return CATEGORY_PALETTE.find((c) => !used.has(c)) ?? CATEGORY_PALETTE[0]!;
}

function CategoryCombobox({
  existingCategories,
  colorMap,
  newCategoryColor,
  defaultValue,
}: {
  existingCategories: string[];
  colorMap: Map<string, string>;
  newCategoryColor: string;
  defaultValue?: string | null;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);

  const query = value.trim().toLowerCase();
  const filtered = existingCategories.filter((c) =>
    c.toLowerCase().includes(query)
  );
  const exactMatch = existingCategories.some(
    (c) => c.toLowerCase() === query
  );
  const showCreate = query.length > 0 && !exactMatch;
  const suggestions = filtered.length > 0 || showCreate;

  return (
    <div className="relative">
      <input
        name="category"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder="Ej: Diseño, Tecnología..."
        autoComplete="off"
        className={inputClass}
      />
      {open && suggestions && (
        <ul
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-2xl border border-app bg-white py-1 shadow-lg dark:bg-[#111726]"
        >
          {filtered.map((cat) => (
            <li key={cat}>
              <button
                type="button"
                onClick={() => {
                  setValue(cat);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-app transition hover:bg-app-soft"
              >
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${colorMap.get(cat) ?? newCategoryColor}`}
                >
                  {cat}
                </span>
              </button>
            </li>
          ))}
          {showCreate && (
            <li>
              <button
                type="button"
                onClick={() => {
                  setValue(value.trim());
                  setOpen(false);
                }}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm transition hover:bg-app-soft"
              >
                <span className="text-app-muted">Crear:</span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${newCategoryColor}`}
                >
                  {value.trim()}
                </span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function ServiceForm({
  companyId,
  initial,
  existingCategories,
  colorMap,
  newCategoryColor,
  onDone,
}: {
  companyId: string;
  initial?: CompanyService;
  existingCategories: string[];
  colorMap: Map<string, string>;
  newCategoryColor: string;
  onDone: () => void;
}) {
  const action = initial ? updateService : createService;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <form action={formAction} className="space-y-3">
      {initial && <input type="hidden" name="serviceId" value={initial.id} />}
      <input type="hidden" name="companyId" value={companyId} />

      <div className="space-y-1">
        <label className="block text-xs font-medium text-app-muted">
          Nombre del servicio <span className="text-rose-400">*</span>
        </label>
        <input
          name="name"
          required
          autoFocus
          placeholder="Ej: Consultoría, Diseño gráfico..."
          defaultValue={initial?.name ?? ""}
          className={inputClass}
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-app-muted">
          Categoría <span className="text-app-soft">(opcional)</span>
        </label>
        <CategoryCombobox
          existingCategories={existingCategories}
          colorMap={colorMap}
          newCategoryColor={newCategoryColor}
          defaultValue={initial?.category}
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-app-muted">
          Descripción <span className="text-app-soft">(opcional)</span>
        </label>
        <textarea
          name="description"
          rows={2}
          placeholder="Descripción del servicio..."
          defaultValue={initial?.description ?? ""}
          className={textareaClass}
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-app-muted">
          Precio base <span className="text-app-soft">(opcional)</span>
        </label>
        <input
          name="base_price"
          type="number"
          min="0"
          step="0.01"
          placeholder="$ 0.00"
          defaultValue={initial?.base_price ?? ""}
          className={inputClass}
        />
      </div>

      {state.error && (
        <p className="rounded-[14px] border border-red-400/30 bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {state.error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 text-sm font-medium text-white transition hover:bg-sky-700 disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
        >
          {pending ? (
            <>
              <ButtonSpinner />
              Guardando...
            </>
          ) : initial ? "Guardar cambios" : "Guardar servicio"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="h-10 rounded-2xl border border-app px-4 text-sm text-app-muted transition hover:text-app"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function ServiceModal({
  open,
  companyId,
  initial,
  existingCategories,
  colorMap,
  newCategoryColor,
  onClose,
}: {
  open: boolean;
  companyId: string;
  initial?: CompanyService;
  existingCategories: string[];
  colorMap: Map<string, string>;
  newCategoryColor: string;
  onClose: () => void;
}) {
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

  if (!open) return null;

  const title = initial ? "Editar servicio" : "Nuevo servicio";

  return createPortal(
    <div className="fixed inset-0 z-[1000]">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-slate-950/45 dark:bg-black/60"
        onClick={onClose}
      />

      {/* Scroll container */}
      <div className="absolute inset-0 overflow-y-auto overscroll-contain p-4">
        <div className="flex min-h-full items-center justify-center">
          <div className="relative my-4 w-full max-w-sm overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:border-slate-700/60 dark:bg-[#111726] dark:shadow-[0_24px_80px_rgba(0,0,0,0.50)]">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 pb-4 pt-5 dark:border-slate-700/50">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-sky-600 dark:text-cyan-400">
                  Servicios
                </p>
                <h3 className="mt-0.5 text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-slate-50">
                  {title}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition hover:text-slate-900 dark:border-slate-700 dark:text-slate-500 dark:hover:text-slate-100"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="px-5 pb-5 pt-4">
              <ServiceForm
                companyId={companyId}
                initial={initial}
                existingCategories={existingCategories}
                colorMap={colorMap}
                newCategoryColor={newCategoryColor}
                onDone={onClose}
              />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ServiceCard({
  svc,
  companyId,
  canEdit,
  colorMap,
  onEdit,
}: {
  svc: CompanyService;
  companyId: string;
  canEdit: boolean;
  colorMap: Map<string, string>;
  onEdit: () => void;
}) {
  return (
    <div
      className={[
        "app-card min-w-0 flex flex-col rounded-[24px] p-4",
        !svc.is_active ? "opacity-50" : "",
      ].join(" ")}
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-app">{svc.name}</p>
          {!svc.is_active && (
            <span className="shrink-0 inline-flex items-center rounded-full bg-slate-500/10 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-400/10 dark:text-slate-400">
              Inactivo
            </span>
          )}
        </div>
        {svc.category && (
          <span
            className={`mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${colorMap.get(svc.category) ?? CATEGORY_PALETTE[0]}`}
          >
            {svc.category}
          </span>
        )}
        {svc.description && (
          <p className="mt-1 line-clamp-2 text-xs text-app-muted">{svc.description}</p>
        )}
        <p className="mt-2 text-sm font-semibold text-sky-700 dark:text-cyan-300">
          {formatCurrency(svc.base_price)}
        </p>
      </div>

      {canEdit && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-app/60 pt-3">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-all duration-150 hover:border-amber-300 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/15 dark:hover:text-amber-200"
          >
            Editar
          </button>

          <form action={toggleServiceActive}>
            <input type="hidden" name="serviceId" value={svc.id} />
            <input type="hidden" name="companyId" value={companyId} />
            <input type="hidden" name="is_active" value={svc.is_active ? "false" : "true"} />
            <button
              type="submit"
              className="rounded-xl border border-app bg-app-soft px-3 py-1.5 text-xs font-medium text-app-muted transition hover:text-app"
            >
              {svc.is_active ? "Desactivar" : "Activar"}
            </button>
          </form>

          <form action={deleteService}>
            <input type="hidden" name="serviceId" value={svc.id} />
            <input type="hidden" name="companyId" value={companyId} />
            <button
              type="submit"
              className="rounded-xl border border-red-200/70 bg-red-50/70 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
              onClick={(e) => {
                if (!confirm(`¿Eliminar "${svc.name}"?`)) e.preventDefault();
              }}
            >
              Eliminar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function ServicesSection({ services, companyId, canEdit }: Props) {
  const [modal, setModal] = useState<{ open: boolean; initial?: CompanyService }>({
    open: false,
  });

  function openCreate() {
    setModal({ open: true });
  }

  function openEdit(svc: CompanyService) {
    setModal({ open: true, initial: svc });
  }

  function closeModal() {
    setModal({ open: false });
  }

  const existingCategories = [
    ...new Set(
      services.map((s) => (s.category ?? "").trim()).filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b, "es"));

  const colorMap = buildColorMap(existingCategories);
  const newColor = nextFreeColor(colorMap);

  // Agrupar por categoría
  const grouped = new Map<string, CompanyService[]>();
  for (const svc of services) {
    const key = (svc.category ?? "").trim();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(svc);
  }
  const hasCategories = [...grouped.keys()].some((k) => k !== "");
  const sortedKeys = hasCategories
    ? [...grouped.keys()].sort((a, b) => {
        if (a === "") return 1;
        if (b === "") return -1;
        return a.localeCompare(b, "es");
      })
    : [""];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-[-0.02em] text-app">
            Servicios del negocio
          </h2>
          <p className="mt-0.5 text-sm text-app-soft">
            Los servicios activos estarán disponibles al registrar ventas.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={openCreate}
            className="shrink-0 self-start rounded-[14px] bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 active:scale-[0.97] dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            + Agregar servicio
          </button>
        )}
      </div>

      {/* Cuerpo */}
      {services.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-app bg-app-soft p-4">
          <p className="text-sm text-app-muted">
            No hay servicios registrados. Agrega uno para poder seleccionarlos al registrar ventas.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {sortedKeys.map((key) => {
            const svcs = grouped.get(key) ?? [];
            if (svcs.length === 0) return null;
            return (
              <div key={key || "__uncategorized__"}>
                {hasCategories && (
                  <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-app-soft">
                    {key || "Sin categoría"}
                  </p>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {svcs.map((svc) => (
                    <ServiceCard
                      key={svc.id}
                      svc={svc}
                      companyId={companyId}
                      canEdit={canEdit}
                      colorMap={colorMap}
                      onEdit={() => openEdit(svc)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal unificado: crear y editar */}
      <ServiceModal
        open={modal.open}
        companyId={companyId}
        initial={modal.initial}
        existingCategories={existingCategories}
        colorMap={colorMap}
        newCategoryColor={newColor}
        onClose={closeModal}
      />
    </div>
  );
}
