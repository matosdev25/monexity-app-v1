"use client";

import { useState, useEffect, useId, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { formatCurrency } from "../../../lib/currency-format";
import type { Product } from "../inventario/types";

export type LineItem = {
  uid: string;
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  trackInventory: boolean;
  availableStock: number;
};

type Props = {
  open: boolean;
  products: Product[];
  existingItems: LineItem[];
  onAdd: (item: LineItem) => void;
  onClose: () => void;
};

const comboboxInputClass =
  "h-10 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-10 text-[15px] text-slate-900 outline-none transition-[border-color,box-shadow] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100 focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-100 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-cyan-400 dark:focus:ring-cyan-500/10 dark:focus-visible:border-cyan-400 dark:focus-visible:ring-cyan-500/10";

const inputClass =
  "h-10 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] text-slate-900 outline-none transition-[border-color,box-shadow] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-cyan-400 dark:focus:ring-cyan-500/10 dark:[color-scheme:dark]";

function createLineItemUid(selectedId: string) {
  return `${selectedId}-${Date.now()}`;
}

export function ProductPickerModal({
  open,
  products,
  existingItems,
  onAdd,
  onClose,
}: Props) {
  const [selectedId, setSelectedId] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [productListOpen, setProductListOpen] = useState(false);
  const [activeProductIndex, setActiveProductIndex] = useState(0);
  const [rawQty, setRawQty] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const productComboboxId = useId();
  const productListboxId = `${productComboboxId}-listbox`;

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => {
      setSelectedId("");
      setProductQuery("");
      setProductListOpen(false);
      setActiveProductIndex(0);
      setRawQty("1");
      setError(null);
      productInputRef.current?.focus();
    }, 50);

    return () => window.clearTimeout(timer);
  }, [open, products]);

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

  const selectedProduct = products.find((p) => p.id === selectedId) ?? null;

  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    if (!query) return products;

    return products.filter((product) => {
      const name = product.name.toLowerCase();
      const sku = product.sku?.toLowerCase() ?? "";
      return name.includes(query) || sku.includes(query);
    });
  }, [productQuery, products]);

  const safeActiveProductIndex = Math.min(
    activeProductIndex,
    Math.max(filteredProducts.length - 1, 0)
  );

  // Stock already committed for this product in the current line items
  const alreadyAdded = existingItems
    .filter((i) => i.productId === selectedId)
    .reduce((sum, i) => sum + i.qty, 0);

  const effectiveStock = selectedProduct
    ? Math.max(0, selectedProduct.stock - alreadyAdded)
    : 0;

  const isLowStock =
    selectedProduct?.track_inventory &&
    effectiveStock <= (selectedProduct.min_stock ?? 0);

  function selectProduct(product: Product) {
    setSelectedId(product.id);
    setProductQuery(product.name);
    setProductListOpen(false);
    setActiveProductIndex(0);
    setRawQty("1");
    setError(null);
  }

  function handleAdd() {
    setError(null);
    if (!selectedProduct) {
      setError("Selecciona un producto.");
      return;
    }
    const qty = Math.floor(Number(rawQty));
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("La cantidad debe ser un número entero mayor a 0.");
      return;
    }
    if (selectedProduct.track_inventory && qty > effectiveStock) {
      setError(
        effectiveStock <= 0
          ? "No hay stock disponible para este producto."
          : `Stock disponible: ${effectiveStock} unidad${effectiveStock !== 1 ? "es" : ""}.`
      );
      return;
    }
    onAdd({
      uid: createLineItemUid(selectedId),
      productId: selectedId,
      name: selectedProduct.name,
      qty,
      unitPrice: selectedProduct.price,
      trackInventory: selectedProduct.track_inventory,
      availableStock: effectiveStock,
    });
    // Reset for next add without closing
    setRawQty("1");
    setError(null);
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
                  Inventario
                </p>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                  Agregar producto
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
              {/* Product combobox */}
              <div className="space-y-1">
                <label
                  htmlFor={productComboboxId}
                  className="block text-sm font-medium text-slate-500 dark:text-slate-300"
                >
                  Producto
                </label>
                <div className="relative">
                  <input
                    ref={productInputRef}
                    id={productComboboxId}
                    type="text"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={productListOpen}
                    aria-controls={productListboxId}
                    aria-activedescendant={
                      productListOpen && filteredProducts[safeActiveProductIndex]
                        ? `${productListboxId}-${filteredProducts[safeActiveProductIndex].id}`
                        : undefined
                    }
                    value={productQuery}
                    placeholder="Buscar producto por nombre o SKU"
                    onFocus={(event) => {
                      setProductListOpen(true);
                      event.currentTarget.select();
                    }}
                    onClick={() => setProductListOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => {
                        setProductListOpen(false);
                        if (selectedProduct) {
                          setProductQuery(selectedProduct.name);
                        }
                      }, 120);
                    }}
                    onChange={(event) => {
                      setProductQuery(event.target.value);
                      setSelectedId("");
                      setProductListOpen(true);
                      setActiveProductIndex(0);
                      setError(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setProductListOpen(true);
                        setActiveProductIndex((current) =>
                          Math.min(current + 1, Math.max(filteredProducts.length - 1, 0))
                        );
                      }

                      if (event.key === "ArrowUp") {
                        event.preventDefault();
                        setActiveProductIndex((current) => Math.max(current - 1, 0));
                      }

                      if (event.key === "Enter" && productListOpen) {
                        event.preventDefault();
                        const product = filteredProducts[safeActiveProductIndex];
                        if (product) selectProduct(product);
                      }

                      if (event.key === "Escape" && productListOpen) {
                        event.preventDefault();
                        event.stopPropagation();
                        event.nativeEvent.stopImmediatePropagation();
                        setProductListOpen(false);
                        setProductQuery(selectedProduct?.name ?? "");
                      }
                    }}
                    className={comboboxInputClass}
                  />
                  <button
                    type="button"
                    aria-label="Mostrar productos"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setProductListOpen(true);
                      productInputRef.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition-[background-color,color] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-100 hover:text-slate-700 active:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-100 motion-reduce:transition-none dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200 dark:active:bg-slate-700 dark:focus-visible:ring-cyan-500/10"
                  >
                    <span aria-hidden="true" className="text-xs">
                      ▾
                    </span>
                  </button>

                  {productListOpen ? (
                    <div
                      id={productListboxId}
                      role="listbox"
                      className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-[min(18rem,42vh)] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-1 shadow-[0_18px_40px_rgba(15,23,42,0.16)] dark:border-slate-700 dark:bg-slate-950 dark:shadow-[0_18px_40px_rgba(0,0,0,0.42)]"
                    >
                      {filteredProducts.length > 0 ? (
                        filteredProducts.map((product, index) => (
                          <button
                            key={product.id}
                            id={`${productListboxId}-${product.id}`}
                            type="button"
                            role="option"
                            aria-selected={product.id === selectedId}
                            onMouseDown={(event) => event.preventDefault()}
                            onMouseEnter={() => setActiveProductIndex(index)}
                            onClick={() => selectProduct(product)}
                            className={[
                              "flex w-full flex-col rounded-xl px-3 py-2 text-left transition-[background-color,color] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-sky-50 active:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-100 motion-reduce:transition-none dark:hover:bg-cyan-500/10 dark:active:bg-cyan-500/15 dark:focus-visible:ring-cyan-500/10",
                              index === safeActiveProductIndex
                                ? "bg-sky-50 dark:bg-cyan-500/10"
                                : "",
                            ].join(" ")}
                          >
                            <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                              {product.name}
                            </span>
                            {product.sku ? (
                              <span className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                                SKU: {product.sku}
                              </span>
                            ) : null}
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">
                          No encontramos productos.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Product info card */}
              {selectedProduct ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">
                      Precio unitario
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(selectedProduct.price)}
                    </span>
                  </div>
                  {selectedProduct.track_inventory ? (
                    <div className="mt-1.5 flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        Disponible
                      </span>
                      <span
                        className={[
                          "font-medium",
                          isLowStock
                            ? "text-rose-600 dark:text-rose-300"
                            : "text-emerald-700 dark:text-emerald-300",
                        ].join(" ")}
                      >
                        {effectiveStock} unidad{effectiveStock !== 1 ? "es" : ""}
                      </span>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      Sin control de stock
                    </p>
                  )}
                </div>
              ) : null}

              {/* Qty */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-300">
                  Cantidad
                </label>
                <input
                  ref={qtyRef}
                  type="number"
                  min="1"
                  max={
                    selectedProduct?.track_inventory ? effectiveStock : undefined
                  }
                  step="1"
                  value={rawQty}
                  onChange={(e) => {
                    setRawQty(e.target.value);
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

              {/* Subtotal preview */}
              {selectedProduct && Number(rawQty) > 0 ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">
                    Subtotal
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {formatCurrency(
                      selectedProduct.price * (Math.max(0, Number(rawQty)) || 0)
                    )}
                  </span>
                </div>
              ) : null}

              {/* Error */}
              {error ? (
                <p className="rounded-[14px] border border-red-400/30 bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
                  {error}
                </p>
              ) : null}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!selectedProduct || !rawQty}
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
