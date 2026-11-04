"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { ButtonSpinner } from "@/components/button-spinner";
import { logout } from "@/app/auth/logout/actions";
import { acceptCurrentLegalVersions, type LegalAcceptanceState } from "./actions";

const initialState: LegalAcceptanceState = { success: false, message: "" };

const linkClass =
  "font-medium text-sky-700 underline underline-offset-2 transition-[color,opacity] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-sky-800 active:text-sky-900 active:opacity-80 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 motion-reduce:transition-none dark:text-sky-400 dark:hover:text-sky-300 dark:active:text-sky-200";

function AcceptButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      aria-busy={pending}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 text-sm font-semibold text-white transition-[background-color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-sky-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 focus-visible:ring-offset-2 motion-reduce:transition-none dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400 dark:focus-visible:ring-offset-slate-900"
    >
      {pending ? <ButtonSpinner variant="current" /> : null}
      {pending ? "Guardando..." : "Aceptar y continuar"}
    </button>
  );
}

// Modal obligatorio: sin X, sin Escape, sin cierre por clic fuera. Es lo único que se
// renderiza en la pantalla (el dashboard no se monta), así que no hay navegación detrás.
export function LegalAcceptanceGate() {
  const router = useRouter();
  const [state, formAction] = useActionState(acceptCurrentLegalVersions, initialState);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <main className="h-dvh overflow-hidden text-app">
      <div className="fixed inset-0 bg-slate-950/40 dark:bg-black/60" aria-hidden="true" />
      <div className="relative flex h-full w-full items-end justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="legal-acceptance-title"
          aria-describedby="legal-acceptance-description"
          className="animate-mx-scale-in w-full max-w-md rounded-[28px] border border-app bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.22)] dark:bg-slate-900 dark:shadow-[0_24px_80px_rgba(2,6,23,0.50)] sm:p-6"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700/80 dark:text-cyan-300/80">
            Antes de continuar
          </p>
          <h1
            id="legal-acceptance-title"
            ref={titleRef}
            tabIndex={-1}
            className="mt-1 text-xl font-semibold tracking-tight text-app outline-none"
          >
            Términos y privacidad
          </h1>
          <p id="legal-acceptance-description" className="mt-3 text-sm leading-6 text-app-muted">
            Para seguir usando Monexity necesitamos que aceptes los{" "}
            <a href="/legal/terminos" target="_blank" rel="noopener noreferrer" className={linkClass}>
              Términos de uso
              <span className="sr-only"> (se abre en una pestaña nueva)</span>
            </a>{" "}
            y la{" "}
            <a href="/legal/privacidad" target="_blank" rel="noopener noreferrer" className={linkClass}>
              Política de privacidad
              <span className="sr-only"> (se abre en una pestaña nueva)</span>
            </a>{" "}
            vigentes.
          </p>

          {!state.success && state.message ? (
            <p
              role="alert"
              className="mt-4 rounded-2xl border border-rose-200/80 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
            >
              {state.message}
            </p>
          ) : null}

          <form action={formAction} className="mt-5">
            <AcceptButton />
          </form>

          <form action={logout} className="mt-3 flex justify-center">
            <button
              type="submit"
              className="rounded-full px-3 py-1.5 text-sm font-medium text-app-muted transition-[background-color,color] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-app-soft hover:text-app active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 motion-reduce:transition-none dark:focus-visible:ring-white/20"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
