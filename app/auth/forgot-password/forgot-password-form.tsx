"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { requestPasswordReset } from "../actions";
import type { ForgotPasswordState } from "../types";

const initialState: ForgotPasswordState = {
  success: false,
  fieldErrors: {},
};

const labelClass =
  "mb-2 block text-sm font-medium tracking-[-0.01em] text-slate-700 dark:text-slate-300";

const baseFieldClass =
  "w-full rounded-2xl border bg-white px-4 py-3 text-[15px] text-slate-900 outline-none transition-[border-color,box-shadow] duration-180 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500";

const normalFieldClass = `${baseFieldClass} border-slate-200 focus:border-sky-400 focus:shadow-[0_0_0_3px_rgba(14,165,233,0.12)] dark:border-slate-700 dark:focus:border-sky-500`;
const errorFieldClass = `${baseFieldClass} border-red-400 focus:border-red-400 focus:shadow-[0_0_0_3px_rgba(248,113,113,0.14)] dark:border-red-500`;
const errorTextClass = "mt-2 text-sm text-red-500 dark:text-red-400";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-3xl bg-slate-900 px-5 py-4 text-[15px] font-semibold tracking-[-0.01em] text-white transition-[background-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-700 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 motion-reduce:transition-none dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 dark:focus-visible:ring-offset-slate-900"
    >
      <span className="flex items-center justify-center gap-2">
        {pending && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" className="opacity-20" stroke="currentColor" strokeWidth="3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
        <span>{pending ? "Enviando..." : "Enviar enlace"}</span>
      </span>
    </button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, initialState);
  const [touched, setTouched] = useState(false);
  const fieldClass = touched && state.fieldErrors?.email ? errorFieldClass : normalFieldClass;

  return (
    <div className="max-w-lg">
      <form action={formAction}>
        {state.success && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
            Si el correo está registrado, recibirás un enlace para cambiar tu contraseña.
          </div>
        )}

        {state.formError && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
            {state.formError}
          </div>
        )}

        <div>
          <label htmlFor="email" className={labelClass}>
            Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            maxLength={120}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            className={fieldClass}
            placeholder="correo@ejemplo.com"
            onBlur={() => setTouched(true)}
          />
          {touched && state.fieldErrors?.email && (
            <p className={errorTextClass}>{state.fieldErrors.email}</p>
          )}
        </div>

        <div className="mt-6">
          <SubmitButton />
        </div>

        <div className="mt-4 text-center">
          <Link
            href="/auth/login"
            className="text-sm font-medium text-sky-600 transition-colors duration-180 hover:text-sky-700 active:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:text-sky-400 dark:hover:text-sky-300 dark:active:text-sky-200 dark:focus-visible:ring-offset-slate-900"
          >
            Volver a iniciar sesión
          </Link>
        </div>
      </form>
    </div>
  );
}
