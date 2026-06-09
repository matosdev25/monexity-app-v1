"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { signIn } from "../actions";
import type { SignInState } from "../types";

const initialState: SignInState = {
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

function SubmitButton({ redirecting }: { redirecting: boolean }) {
  const { pending } = useFormStatus();
  const isBusy = pending || redirecting;

  return (
    <button
      type="submit"
      disabled={isBusy}
      className="w-full rounded-3xl bg-slate-900 px-5 py-4 text-[15px] font-semibold tracking-[-0.01em] text-white transition-[background-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-700 active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-70 motion-reduce:transition-none dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
    >
      <span className="flex items-center justify-center gap-2">
        {isBusy && (
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="9"
              className="opacity-20"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              d="M21 12a9 9 0 0 0-9-9"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        )}
        <span>{isBusy ? "Entrando..." : "Iniciar sesión"}</span>
      </span>
    </button>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [state, formAction] = useActionState(signIn, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const redirecting = Boolean(state.success && state.redirectTo);

  useEffect(() => {
    if (!state.success || !state.redirectTo) return;

    router.replace(state.redirectTo);
    router.refresh();

    const fallbackId = window.setTimeout(() => {
      window.location.assign(state.redirectTo as string);
    }, 250);

    return () => window.clearTimeout(fallbackId);
  }, [router, state.redirectTo, state.success]);

  const touch = (name: string) =>
    setTouched((prev) => ({ ...prev, [name]: true }));

  const getFieldClass = (name: "identifier" | "password") =>
    touched[name] && state.fieldErrors?.[name]
      ? errorFieldClass
      : normalFieldClass;

  return (
    <div className="max-w-lg">
      <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
            ¿Primera vez en Monexity?
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Crea tu cuenta en unos segundos.
          </p>
        </div>

        <Link
          href="/auth/sign-up"
          className="shrink-0 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-[background-color,border-color] duration-180 hover:border-slate-300 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
        >
          Crear cuenta
        </Link>
      </div>

      <form action={formAction}>
        {state.formError && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
            {state.formError}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="identifier" className={labelClass}>
              Correo o nombre de usuario
            </label>
            <input
              id="identifier"
              name="identifier"
              type="text"
              required
              maxLength={120}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              className={getFieldClass("identifier")}
              placeholder="correo@ejemplo.com o davidmatos"
              onBlur={() => touch("identifier")}
            />
            {touched.identifier && state.fieldErrors?.identifier && (
              <p className={errorTextClass}>{state.fieldErrors.identifier}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className={labelClass}>
              Contraseña
            </label>

            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                maxLength={72}
                autoComplete="current-password"
                className={`${getFieldClass("password")} pr-12`}
                placeholder="••••••••"
                onBlur={() => touch("password")}
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                aria-pressed={showPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-400 transition-[background-color,color] duration-180 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              >
                {showPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.88 5.09A10.94 10.94 0 0112 5c5 0 9.27 3.11 11 7-1.01 2.27-2.77 4.2-5 5.38M6.61 6.61C4.62 7.79 3.06 9.61 2 12c.69 1.55 1.74 2.94 3.06 4.06"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
                    />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            {touched.password && state.fieldErrors?.password && (
              <p className={errorTextClass}>{state.fieldErrors.password}</p>
            )}
          </div>
        </div>

        <div className="mt-6">
          <SubmitButton redirecting={redirecting} />
        </div>

        <div className="mt-4 text-center">
          <Link
            href="/auth/forgot-password"
            className="text-sm font-medium text-sky-600 transition-colors duration-180 hover:text-sky-700 active:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:text-sky-400 dark:hover:text-sky-300 dark:active:text-sky-200 dark:focus-visible:ring-offset-slate-900"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <span>¿Aún no tienes cuenta?</span>
          <Link
            href="/auth/sign-up"
            className="font-medium text-sky-600 transition-colors duration-180 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
          >
            Crear cuenta
          </Link>
        </div>
      </form>
    </div>
  );
}
