"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,72}$/;

const labelClass =
  "mb-2 block text-sm font-medium tracking-[-0.01em] text-slate-700 dark:text-slate-300";

const baseFieldClass =
  "w-full rounded-2xl border bg-white px-4 py-3 text-[15px] text-slate-900 outline-none transition-[border-color,box-shadow] duration-180 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500";

const normalFieldClass = `${baseFieldClass} border-slate-200 focus:border-sky-400 focus:shadow-[0_0_0_3px_rgba(14,165,233,0.12)] dark:border-slate-700 dark:focus:border-sky-500`;
const errorFieldClass = `${baseFieldClass} border-red-400 focus:border-red-400 focus:shadow-[0_0_0_3px_rgba(248,113,113,0.14)] dark:border-red-500`;
const errorTextClass = "mt-2 text-sm text-red-500 dark:text-red-400";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [isReady, setIsReady] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        setLinkError("El enlace expiró o no es válido. Solicita uno nuevo.");
      }
      setIsReady(true);
    });

    return () => {
      mounted = false;
    };
  }, [supabase]);

  const passwordError =
    password && !PASSWORD_REGEX.test(password)
      ? "Debe incluir una mayúscula, una minúscula y un número."
      : "";
  const confirmError =
    confirmPassword && password !== confirmPassword
      ? "Las contraseñas no coinciden."
      : "";
  const isBusy = isPending || success;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!PASSWORD_REGEX.test(password)) {
      setFormError("La contraseña debe tener entre 8 y 72 caracteres e incluir una mayúscula, una minúscula y un número.");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Las contraseñas no coinciden.");
      return;
    }

    startTransition(async () => {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setFormError("No se pudo cambiar la contraseña. Solicita un nuevo enlace e inténtalo nuevamente.");
        return;
      }

      setSuccess(true);
      window.setTimeout(() => {
        router.replace("/auth/login");
        router.refresh();
      }, 900);
    });
  }

  if (!isReady) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
        Validando enlace...
      </div>
    );
  }

  if (linkError) {
    return (
      <div>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
          {linkError}
        </div>

        <div className="mt-4 text-center">
          <Link
            href="/auth/forgot-password"
            className="text-sm font-medium text-sky-600 transition-colors duration-180 hover:text-sky-700 active:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:text-sky-400 dark:hover:text-sky-300 dark:active:text-sky-200 dark:focus-visible:ring-offset-slate-900"
          >
            Solicitar otro enlace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {success && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
          Contraseña actualizada. Te llevaremos al login.
        </div>
      )}

      {formError && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
          {formError}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="password" className={labelClass}>
            Nueva contraseña
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={`${passwordError ? errorFieldClass : normalFieldClass} pr-12`}
              placeholder="••••••••"
              disabled={isBusy}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-400 transition-[background-color,color] duration-180 hover:bg-slate-100 hover:text-slate-700 active:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300 dark:active:text-white"
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.88 5.09A10.94 10.94 0 0112 5c5 0 9.27 3.11 11 7-1.01 2.27-2.77 4.2-5 5.38M6.61 6.61C4.62 7.79 3.06 9.61 2 12c.69 1.55 1.74 2.94 3.06 4.06" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            8 o más caracteres, mayúscula, minúscula y número.
          </p>
          {passwordError && <p className={errorTextClass}>{passwordError}</p>}
        </div>

        <div>
          <label htmlFor="confirmPassword" className={labelClass}>
            Confirmar contraseña
          </label>
          <input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className={confirmError ? errorFieldClass : normalFieldClass}
            placeholder="••••••••"
            disabled={isBusy}
          />
          {confirmError && <p className={errorTextClass}>{confirmError}</p>}
        </div>
      </div>

      <div className="mt-6">
        <button
          type="submit"
          disabled={isBusy}
          className="w-full rounded-3xl bg-slate-900 px-5 py-4 text-[15px] font-semibold tracking-[-0.01em] text-white transition-[background-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-700 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 motion-reduce:transition-none dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 dark:focus-visible:ring-offset-slate-900"
        >
          <span className="flex items-center justify-center gap-2">
            {isBusy && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" className="opacity-20" stroke="currentColor" strokeWidth="3" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            <span>{isBusy ? "Guardando..." : "Cambiar contraseña"}</span>
          </span>
        </button>
      </div>
    </form>
  );
}
