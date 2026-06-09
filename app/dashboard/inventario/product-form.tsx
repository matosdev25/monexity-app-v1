"use client";

import { useTransition, useState, useRef } from "react";
import { createProduct, updateProduct, generateSkuAction } from "./actions";
import type { Product } from "./types";
import { ButtonSpinner } from "@/components/button-spinner";

const inputClass =
  "h-9 w-full rounded-[14px] border border-app bg-white px-3 text-sm text-app outline-none transition placeholder:text-app-soft focus:border-app-strong dark:bg-white/[0.06] dark:[color-scheme:dark]";

const labelClass = "mb-1 block text-xs font-medium text-app-muted";

type Props = {
  companyId: string;
  product?: Product;
  onDone: () => void;
  onCancel: () => void;
};

export function ProductForm({ companyId, product, onDone, onCancel }: Props) {
  const isEdit = Boolean(product);
  const [isPending, startTransition] = useTransition();
  const [isGenerating, startGenerateTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [trackInventory, setTrackInventory] = useState(
    product?.track_inventory ?? false
  );
  const [skuValue, setSkuValue] = useState(product?.sku ?? "");
  const nameRef = useRef<HTMLInputElement>(null);

  function handleGenerate() {
    const name = nameRef.current?.value.trim() ?? "";
    startGenerateTransition(async () => {
      const generated = await generateSkuAction(companyId, name || "PRD");
      setSkuValue(generated);
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("track_inventory", String(trackInventory));
    // SKU controlado — aseguramos que el valor actual vaya en el FormData
    fd.set("sku", skuValue.trim());
    if (isEdit && product) fd.set("id", product.id);

    startTransition(async () => {
      const result = isEdit
        ? await updateProduct(fd)
        : await createProduct(fd);
      if (!result.success) {
        setError(result.error ?? "No se pudo guardar.");
      } else {
        onDone();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input type="hidden" name="companyId" value={companyId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass}>Nombre del producto</label>
          <input
            ref={nameRef}
            name="name"
            type="text"
            defaultValue={product?.name ?? ""}
            placeholder="Ej. Camiseta talla M"
            className={inputClass}
            required
            autoFocus
          />
        </div>

        <div>
          <label className={labelClass}>Precio ($)</label>
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            defaultValue={product?.price ?? ""}
            placeholder="$ 0.00"
            className={inputClass}
            required
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className={labelClass.replace("mb-1 ", "")}>SKU</label>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || isPending}
              className="rounded-[8px] border border-app px-2 py-0.5 text-[10px] font-medium text-app-muted transition hover:border-app-strong hover:text-app disabled:opacity-40"
            >
              {isGenerating ? "..." : "Generar"}
            </button>
          </div>
          <input
            name="sku"
            type="text"
            value={skuValue}
            onChange={(e) => setSkuValue(e.target.value.toUpperCase())}
            placeholder="Ej. CAM-001"
            spellCheck={false}
            className={`${inputClass} font-mono tracking-[0.04em]`}
          />
          {!isEdit && (
            <p className="mt-1 text-[11px] text-app-soft">
              Se genera automáticamente si lo dejas vacío.
            </p>
          )}
        </div>

        <div className="flex items-end sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-2.5">
            <button
              type="button"
              role="switch"
              aria-checked={trackInventory}
              onClick={() => setTrackInventory((v) => !v)}
              className={[
                "inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                trackInventory ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
                  trackInventory ? "translate-x-[19px]" : "translate-x-[3px]",
                ].join(" ")}
              />
            </button>
            <span className="text-sm text-app-muted">Controlar stock</span>
          </label>
        </div>
      </div>

      {trackInventory ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Stock actual</label>
            <input
              name="stock"
              type="number"
              min="0"
              step="1"
              defaultValue={product?.stock ?? 0}
              placeholder="0"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              Stock mínimo{" "}
              <span className="font-normal text-app-soft">(opcional)</span>
            </label>
            <input
              name="min_stock"
              type="number"
              min="0"
              step="1"
              defaultValue={product?.min_stock ?? ""}
              placeholder="—"
              className={inputClass}
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-[12px] border border-red-400/30 bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending || isGenerating}
          className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-sky-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-sky-700 disabled:opacity-50 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
        >
          {isPending ? (
            <>
              <ButtonSpinner />
              Guardando...
            </>
          ) : isEdit ? "Guardar cambios" : "Crear producto"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[12px] border border-app px-4 py-2 text-xs text-app-muted transition hover:text-app"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
