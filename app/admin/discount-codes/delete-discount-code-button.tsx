"use client";

import { useActionState, useRef, useState } from "react";
import { deleteDiscountCode } from "../actions";

const initialState = { success: false, message: "" };

export function DeleteDiscountCodeButton({ codeId }: { codeId: string }) {
  const [state, formAction, pending] = useActionState(deleteDiscountCode, initialState);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <form ref={formRef} action={formAction} className="w-full">
        <input type="hidden" name="id" value={codeId} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={pending}
          className="w-full rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition-[background-color,border-color,color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-rose-300 hover:bg-rose-100 hover:text-rose-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15 dark:hover:text-rose-200"
        >
          {pending ? "Eliminando..." : "Eliminar"}
        </button>
      </form>

      {state.message ? (
        <p className={`mt-2 text-xs ${state.success ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"}`}>
          {state.message}
        </p>
      ) : null}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Cancelar eliminación"
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-115 overflow-hidden rounded-[28px] border border-app bg-[rgba(255,255,255,0.92)] text-app shadow-[0_24px_80px_rgba(15,23,42,0.22)] dark:bg-[rgba(15,23,42,0.92)] dark:text-white">
            <div className="rounded-[28px] border border-app bg-app-panel p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-rose-500/80 dark:text-rose-300/80">
                Confirmación
              </p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-app">
                Eliminar código
              </h3>
              <p className="mt-3 text-sm leading-6 text-app-muted">
                ¿Seguro que deseas eliminar este código? Esta acción no se puede deshacer.
              </p>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-2xl border border-app bg-app-soft px-4 py-2 text-sm font-medium text-app-muted transition-[color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-app active:scale-[0.97] active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    formRef.current?.requestSubmit();
                  }}
                  className="rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-2 text-sm font-medium text-rose-600 transition-[background-color,border-color,color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-rose-300 hover:bg-rose-100 hover:text-rose-700 active:scale-[0.97] active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15 dark:hover:text-rose-200"
                >
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
