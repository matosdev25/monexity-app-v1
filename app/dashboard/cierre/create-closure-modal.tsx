"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClosure } from "./actions";
import { SubmitButton } from "../../../components/submit-button";
import type { ClosureActionState } from "./types";

const initialState: ClosureActionState = { success: false, message: "" };

const inputClass =
  "h-10 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:scheme-dark dark:focus:border-cyan-400 dark:focus:ring-cyan-500/10";

const labelClass =
  "mb-1 block text-sm font-medium text-slate-500 dark:text-slate-300";

function getTodayISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Panama",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${d}`;
}

function getFirstDayOfCurrentYear() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Panama",
    year: "numeric",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "2025";
  return `${y}-01-01`;
}

export function CreateClosureModal() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createClosure, initialState);
  const [periodMonths, setPeriodMonths] = useState<3 | 6 | 12>(12);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const periodLabel = {
    3: "3 meses (trimestral)",
    6: "6 meses (semestral)",
    12: "12 meses (anual)",
  };

  const modal =
    open
      ? createPortal(
          <div className="fixed inset-0 z-[999]">
            <button
              type="button"
              aria-label="Cerrar"
              className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm dark:bg-slate-950/55"
              onClick={() => setOpen(false)}
            />
            <div className="absolute inset-0 overflow-y-auto overscroll-contain p-4">
              <div className="flex min-h-full items-center justify-center">
                <div className="relative my-4 w-full max-w-lg rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-sky-700 dark:text-cyan-300">
                        Nuevo cierre
                      </p>
                      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                        Iniciar cierre del período
                      </h2>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Define el rango para documentar tu operación.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
                      aria-label="Cerrar"
                    >
                      ✕
                    </button>
                  </div>

                  <form action={formAction} className="mt-5 space-y-4">
                    {/* Period months */}
                    <div>
                      <label className={labelClass}>Duración del período</label>
                      <div className="grid grid-cols-3 gap-2">
                        {([3, 6, 12] as const).map((m) => (
                          <label
                            key={m}
                            className={[
                              "flex cursor-pointer flex-col items-center justify-center rounded-2xl border px-3 py-3 text-center text-sm font-medium transition",
                              periodMonths === m
                                ? "border-sky-300 bg-sky-50 text-sky-700 dark:border-cyan-400/40 dark:bg-cyan-500/10 dark:text-cyan-200"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300 dark:hover:border-slate-600",
                            ].join(" ")}
                          >
                            <input
                              type="radio"
                              name="period_months"
                              value={m}
                              checked={periodMonths === m}
                              onChange={() => setPeriodMonths(m)}
                              className="sr-only"
                            />
                            <span className="text-xl font-bold leading-none">{m}</span>
                            <span className="mt-1 text-[11px] font-normal opacity-70">
                              meses
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Period start */}
                    <div>
                      <label htmlFor="period_start" className={labelClass}>
                        Fecha de inicio
                      </label>
                      <input
                        id="period_start"
                        name="period_start"
                        type="date"
                        required
                        defaultValue={getFirstDayOfCurrentYear()}
                        max={getTodayISO()}
                        className={inputClass}
                      />
                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                        La fecha de corte se calculará automáticamente.
                      </p>
                    </div>

                    {/* Label (optional) */}
                    <div>
                      <label htmlFor="label" className={labelClass}>
                        Nombre del cierre{" "}
                        <span className="font-normal text-slate-400">
                          (opcional)
                        </span>
                      </label>
                      <input
                        id="label"
                        name="label"
                        type="text"
                        placeholder={`Ej. ${periodLabel[periodMonths]}`}
                        className={inputClass}
                      />
                    </div>

                    {/* Notes (optional) */}
                    <div>
                      <label htmlFor="notes" className={labelClass}>
                        Notas internas{" "}
                        <span className="font-normal text-slate-400">
                          (opcional)
                        </span>
                      </label>
                      <textarea
                        id="notes"
                        name="notes"
                        rows={2}
                        placeholder="Observaciones para el contador..."
                        className={`${inputClass} h-auto min-h-16 resize-none py-3`}
                      />
                    </div>

                    {state.message && !state.success ? (
                      <p className="text-xs text-rose-500 dark:text-rose-300">
                        {state.message}
                      </p>
                    ) : null}

                    <SubmitButton
                      idleText="Crear cierre"
                      pendingText="Creando..."
                      className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-sky-600 px-4 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
                    />
                  </form>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-2xl bg-sky-600 px-5 text-sm font-medium text-white transition hover:bg-sky-700 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            d="M12 5V19M5 12H19"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        Iniciar nuevo cierre
      </button>
      {modal}
    </>
  );
}
