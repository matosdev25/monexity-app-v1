"use client";

import { useTransition, useState } from "react";
import {
  createPaymentMethod,
  updatePaymentMethod,
  togglePaymentMethod,
  deletePaymentMethod,
  movePaymentMethod,
} from "./actions";
import type { CompanyPaymentMethod } from "./types";

const TYPE_LABELS: Record<string, string> = {
  cash: "Efectivo",
  yappy: "Yappy",
  transfer: "Transferencia",
  card: "Tarjeta",
  other: "Otro",
};

const TYPE_CHIP: Record<string, string> = {
  cash: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300",
  card: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-300",
  transfer:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300",
  yappy:
    "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/25 dark:bg-fuchsia-500/10 dark:text-fuchsia-300",
  other:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

const inputClass =
  "h-8 w-full rounded-xl border border-app bg-white px-3 text-sm text-app outline-none transition placeholder:text-app-soft focus:border-app-strong dark:bg-white/[0.06] dark:[color-scheme:dark]";

// Switch dimensions: track h-5 (20px) w-9 (36px), thumb h-3.5 (14px) w-3.5 (14px)
// inline-flex items-center centra el thumb verticalmente sin absolute.
// Off: translate-x-[3px]  On: 36 - 14 - 3 = translate-x-[19px]
function Toggle({
  checked,
  onChange,
  title,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      title={title}
      className={[
        "inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors",
        checked ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[19px]" : "translate-x-[3px]",
        ].join(" ")}
      />
    </button>
  );
}

type Props = {
  methods: CompanyPaymentMethod[];
  companyId: string;
  canEdit: boolean;
};

export function PaymentMethodsSection({ methods, companyId, canEdit }: Props) {
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDetails, setEditDetails] = useState("");
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState("cash");
  const [newLabel, setNewLabel] = useState(TYPE_LABELS.cash ?? "");
  const [newDetails, setNewDetails] = useState("");
  const [error, setError] = useState<string | null>(null);

  function startEdit(m: CompanyPaymentMethod) {
    setEditingId(m.id);
    setEditLabel(m.label);
    setEditDetails(m.details ?? "");
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  function handleNewTypeChange(type: string) {
    const prevDefault = TYPE_LABELS[newType] ?? "";
    setNewType(type);
    if (!newLabel || newLabel === prevDefault) {
      setNewLabel(TYPE_LABELS[type] ?? "");
    }
  }

  function handleToggle(id: string) {
    if (!canEdit) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("companyId", companyId);
      await togglePaymentMethod(fd);
    });
  }

  function handleDelete(id: string) {
    if (!canEdit) return;
    if (!confirm("¿Eliminar este método de pago? Esta acción no se puede deshacer."))
      return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("companyId", companyId);
      await deletePaymentMethod(fd);
    });
  }

  function handleMove(id: string, direction: "up" | "down") {
    if (!canEdit) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("companyId", companyId);
      fd.set("direction", direction);
      await movePaymentMethod(fd);
    });
  }

  function handleSaveEdit() {
    if (!editingId || !editLabel.trim()) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", editingId);
      fd.set("companyId", companyId);
      fd.set("label", editLabel.trim());
      fd.set("details", editDetails.trim());
      const result = await updatePaymentMethod(fd);
      if (!result.success) {
        setError(result.error ?? "No se pudo guardar.");
      } else {
        setEditingId(null);
      }
    });
  }

  function handleCreate() {
    if (!newLabel.trim()) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("companyId", companyId);
      fd.set("type", newType);
      fd.set("label", newLabel.trim());
      fd.set("details", newDetails.trim());
      const result = await createPaymentMethod(fd);
      if (!result.success) {
        setError(result.error ?? "No se pudo crear.");
      } else {
        setAdding(false);
        setNewType("cash");
        setNewLabel(TYPE_LABELS.cash ?? "");
        setNewDetails("");
      }
    });
  }

  return (
    <section className="rounded-[28px] border border-app bg-app-soft p-4 sm:p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-[-0.02em] text-app">
            Métodos de pago
          </h2>
          <p className="mt-0.5 text-sm text-app-soft">
            Métodos disponibles al registrar ventas.
          </p>
        </div>
        {canEdit && !adding && (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setError(null);
            }}
            className="shrink-0 rounded-[14px] border border-app bg-white px-3 py-1.5 text-xs font-medium text-app transition hover:border-app-strong dark:bg-white/[0.06] dark:hover:bg-white/[0.08]"
          >
            + Agregar
          </button>
        )}
      </div>

      {/* Error */}
      {error ? (
        <p className="mb-3 rounded-[14px] border border-red-400/30 bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {/* Lista */}
      <div className={`space-y-1.5 ${isPending ? "pointer-events-none opacity-60" : ""}`}>
        {methods.length === 0 && !adding ? (
          <p className="text-sm text-app-soft">
            No hay métodos de pago configurados.
          </p>
        ) : null}

        {methods.map((m, index) => {
          const isEditing = editingId === m.id;
          const chip = TYPE_CHIP[m.type] ?? TYPE_CHIP.other;
          const isFirst = index === 0;
          const isLast = index === methods.length - 1;

          return (
            <div
              key={m.id}
              className={[
                "rounded-[16px] border border-app bg-white px-3 py-2 transition dark:bg-white/[0.03]",
                !m.is_active ? "opacity-50" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {isEditing ? (
                /* ── Modo edición ─────────────────────────── */
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] ${chip}`}
                    >
                      {TYPE_LABELS[m.type] ?? m.type}
                    </span>
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder="Nombre del método"
                      className={`${inputClass} flex-1`}
                      autoFocus
                    />
                  </div>
                  <input
                    type="text"
                    value={editDetails}
                    onChange={(e) => setEditDetails(e.target.value)}
                    placeholder="Detalles opcionales (ej. número de cuenta)"
                    className={inputClass}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      disabled={!editLabel.trim()}
                      className="rounded-[10px] bg-sky-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-700 disabled:opacity-50 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-[10px] border border-app px-3 py-1.5 text-xs text-app-muted transition hover:text-app"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Vista normal ─────────────────────────── */
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] ${chip}`}
                      >
                        {TYPE_LABELS[m.type] ?? m.type}
                      </span>
                      <span className="truncate text-sm font-medium text-app">
                        {m.label}
                      </span>
                      {!m.is_active ? (
                        <span className="shrink-0 text-xs text-app-soft">
                          (Inactivo)
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Acciones */}
                  {canEdit ? (
                    <div className="flex items-center gap-2 sm:shrink-0">
                      {/* Toggle */}
                      <Toggle
                        checked={m.is_active}
                        onChange={() => handleToggle(m.id)}
                        title={m.is_active ? "Desactivar" : "Activar"}
                      />

                      {/* Flechas */}
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleMove(m.id, "up")}
                          disabled={isFirst}
                          title="Mover arriba"
                          className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-app text-[11px] text-app-muted transition hover:text-app disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMove(m.id, "down")}
                          disabled={isLast}
                          title="Mover abajo"
                          className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-app text-[11px] text-app-muted transition hover:text-app disabled:opacity-30"
                        >
                          ↓
                        </button>
                      </div>

                      {/* Editar / Eliminar */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(m)}
                          className="rounded-[8px] border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700 transition-all duration-150 hover:border-amber-300 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/15 dark:hover:text-amber-200"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(m.id)}
                          className="rounded-[8px] border border-rose-200/80 bg-rose-50/80 px-2.5 py-1.5 text-[11px] text-rose-600 transition hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}

        {/* Formulario agregar */}
        {adding && canEdit ? (
          <div className="rounded-[16px] border border-app bg-white p-3 dark:bg-white/[0.03]">
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-app-soft">Tipo</label>
                  <select
                    value={newType}
                    onChange={(e) => handleNewTypeChange(e.target.value)}
                    className={inputClass}
                  >
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-app-soft">Nombre</label>
                  <input
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Ej. Yappy Personal"
                    className={inputClass}
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-app-soft">
                  Detalles{" "}
                  <span className="font-normal text-app-soft">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={newDetails}
                  onChange={(e) => setNewDetails(e.target.value)}
                  placeholder="Ej. +507 6000-0000"
                  className={inputClass}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!newLabel.trim()}
                  className="rounded-[10px] bg-sky-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-700 disabled:opacity-50 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
                >
                  Agregar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setError(null);
                  }}
                  className="rounded-[10px] border border-app px-3 py-1.5 text-xs text-app-muted transition hover:text-app"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
