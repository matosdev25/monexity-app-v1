"use client";

import { useTransition, useState, useMemo } from "react";
import { toggleProductActive, adjustStock, deleteProduct } from "./actions";
import { ProductForm } from "./product-form";
import { formatCurrency } from "../../../lib/currency-format";
import type { Product } from "./types";

type Props = {
  products: Product[];
  companyId: string;
  canEdit: boolean;
};

export function ProductsList({ products, companyId, canEdit }: Props) {
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q)
    );
  }, [products, query]);

  function handleToggle(id: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("companyId", companyId);
      await toggleProductActive(fd);
    });
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar este producto? Esta acción no se puede deshacer.")) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("companyId", companyId);
      await deleteProduct(fd);
    });
  }

  function handleAdjust(id: string) {
    const delta = Number(adjustDelta);
    if (!Number.isFinite(delta) || delta === 0) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("companyId", companyId);
      fd.set("delta", String(delta));
      const result = await adjustStock(fd);
      if (!result.success) {
        setError(result.error ?? "No se pudo ajustar el stock.");
      } else {
        setAdjustingId(null);
        setAdjustDelta("");
      }
    });
  }

  return (
    <div className={isPending ? "pointer-events-none opacity-60" : ""}>
      {/* Búsqueda */}
      {products.length > 0 && (
        <div className="mb-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o SKU"
            className="h-9 w-full rounded-[14px] border border-app bg-white px-3 text-sm text-app outline-none transition placeholder:text-app-soft focus:border-app-strong dark:bg-white/[0.06] dark:[color-scheme:dark]"
          />
        </div>
      )}

      {/* Error global */}
      {error ? (
        <p className="mb-3 rounded-[14px] border border-red-400/30 bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        {products.length === 0 && !adding ? (
          <div className="rounded-[20px] border border-app bg-white px-4 py-6 text-center dark:bg-white/[0.03]">
            <p className="text-sm text-app-soft">
              No hay productos registrados todavía.
            </p>
            {canEdit ? (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="mt-3 rounded-[12px] border border-app px-4 py-2 text-xs font-medium text-app-muted transition hover:border-app-strong hover:text-app"
              >
                + Crear primer producto
              </button>
            ) : null}
          </div>
        ) : null}

        {filtered.length === 0 && query && !adding ? (
          <div className="rounded-[20px] border border-app bg-white px-4 py-5 text-center dark:bg-white/[0.03]">
            <p className="text-sm text-app-soft">
              Sin resultados para <span className="font-medium text-app-muted">&quot;{query}&quot;</span>.
            </p>
          </div>
        ) : null}

        {filtered.map((p) => {
          const isEditing = editingId === p.id;
          const isAdjusting = adjustingId === p.id;
          const isLowStock =
            p.track_inventory &&
            p.min_stock != null &&
            p.stock <= p.min_stock;

          return (
            <div
              key={p.id}
              className={[
                "rounded-[20px] border border-app bg-white px-4 py-3 transition dark:bg-white/[0.03]",
                !p.is_active ? "opacity-50" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {isEditing ? (
                <ProductForm
                  companyId={companyId}
                  product={p}
                  onDone={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-start gap-3">
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    {/* Nombre */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-app">
                        {p.name}
                      </span>
                      {!p.is_active ? (
                        <span className="text-xs text-app-soft">(Inactivo)</span>
                      ) : null}
                    </div>

                    {/* Precio y SKU */}
                    <p className="mt-0.5 text-sm text-app-muted">
                      {formatCurrency(p.price)}
                      {p.sku ? (
                        <span className="ml-2 font-mono text-xs tracking-[0.06em] text-app-soft">
                          · {p.sku}
                        </span>
                      ) : (
                        <span className="ml-2 text-xs text-app-soft/60">· Sin SKU</span>
                      )}
                    </p>

                    {/* Stock — línea propia con contexto claro */}
                    {p.track_inventory ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span
                          className={[
                            "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em]",
                            isLowStock
                              ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300",
                          ].join(" ")}
                        >
                          {isLowStock ? "Stock bajo" : "En stock"}
                        </span>
                        <span className={[
                          "text-xs font-medium",
                          isLowStock ? "text-rose-600 dark:text-rose-400" : "text-app-muted",
                        ].join(" ")}>
                          {p.stock} {p.stock === 1 ? "unidad" : "unidades"}
                        </span>
                        {p.min_stock != null ? (
                          <span className="text-xs text-app-soft">
                            · Mín: {p.min_stock}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Ajustar stock inline */}
                    {isAdjusting ? (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          step="1"
                          value={adjustDelta}
                          onChange={(e) => setAdjustDelta(e.target.value)}
                          placeholder="+5 o -3"
                          autoFocus
                          className="h-8 w-28 rounded-xl border border-app bg-white px-3 text-sm text-app outline-none focus:border-app-strong dark:bg-white/[0.06] dark:[color-scheme:dark]"
                        />
                        <button
                          type="button"
                          onClick={() => handleAdjust(p.id)}
                          className="rounded-[10px] bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
                        >
                          Aplicar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustingId(null);
                            setAdjustDelta("");
                          }}
                          className="rounded-[10px] border border-app px-3 py-1.5 text-xs text-app-muted transition hover:text-app"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {/* Acciones */}
                  {canEdit ? (
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {/* Toggle activo */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={p.is_active}
                        onClick={() => handleToggle(p.id)}
                        title={p.is_active ? "Desactivar" : "Activar"}
                        className={[
                          "inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                          p.is_active
                            ? "bg-emerald-500"
                            : "bg-slate-300 dark:bg-slate-600",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
                            p.is_active ? "translate-x-[19px]" : "translate-x-[3px]",
                          ].join(" ")}
                        />
                      </button>

                      {p.track_inventory && !isAdjusting ? (
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustingId(p.id);
                            setAdjustDelta("");
                          }}
                          className="rounded-[10px] border border-app px-2 py-1 text-[11px] text-app-muted transition hover:text-app"
                        >
                          Ajustar
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => setEditingId(p.id)}
                        className="rounded-[10px] border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 transition-all duration-150 hover:border-amber-300 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/15 dark:hover:text-amber-200"
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        className="rounded-[10px] border border-rose-200/80 bg-rose-50/80 px-2 py-1 text-[11px] text-rose-600 transition hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15"
                      >
                        Eliminar
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}

        {/* Formulario agregar */}
        {adding ? (
          <div className="rounded-[20px] border border-app bg-white p-4 dark:bg-white/[0.03]">
            <ProductForm
              companyId={companyId}
              onDone={() => setAdding(false)}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : null}
      </div>

      {/* Botón agregar (si ya hay productos) */}
      {canEdit && !adding && products.length > 0 ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 rounded-[14px] border border-app bg-white px-4 py-2 text-xs font-medium text-app transition hover:border-app-strong dark:bg-white/[0.06] dark:hover:bg-white/[0.08]"
        >
          + Agregar producto
        </button>
      ) : null}
    </div>
  );
}
