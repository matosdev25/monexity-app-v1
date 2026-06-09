"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { reopenPeriod } from "../actions";
import { SubmitButton } from "../../../../components/submit-button";
import type { ClosureActionState } from "../types";

const initialState: ClosureActionState = { success: false, message: "" };

export function ReopenModal({ closureId }: { closureId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(reopenPeriod, initialState);

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

  useEffect(() => {
    if (state.success) {
      const t = setTimeout(() => setOpen(false), 600);
      return () => clearTimeout(t);
    }
  }, [state.success, state.timestamp]);

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
                <div className="relative my-4 w-full max-w-md rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                        Reapertura
                      </p>
                      <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
                        Reabrir período
                      </h2>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        El cierre volverá a estado borrador para correcciones.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
                    >
                      ✕
                    </button>
                  </div>

                  <form action={formAction} className="mt-4 space-y-4">
                    <input type="hidden" name="closureId" value={closureId} />

                    <div>
                      <label
                        htmlFor="reopen-reason"
                        className="mb-1 block text-sm font-medium text-slate-500 dark:text-slate-300"
                      >
                        Motivo de reapertura{" "}
                        <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        id="reopen-reason"
                        name="reason"
                        rows={3}
                        required
                        placeholder="Ej. Corrección de gastos de enero, cuotas faltantes..."
                        className="h-auto min-h-20 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-300 focus:ring-2 focus:ring-amber-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-amber-500/50 dark:focus:ring-amber-500/10"
                      />
                    </div>

                    {state.message ? (
                      <p
                        className={`text-xs ${state.success ? "text-emerald-600 dark:text-emerald-300" : "text-rose-500 dark:text-rose-300"}`}
                      >
                        {state.message}
                      </p>
                    ) : null}

                    <SubmitButton
                      idleText="Reabrir período"
                      pendingText="Reabriendo..."
                      className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-medium text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20"
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
        className="inline-flex h-10 items-center rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 text-sm font-medium text-amber-700 transition hover:border-amber-300 hover:bg-amber-100 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20"
      >
        Reabrir período
      </button>
      {modal}
    </>
  );
}
