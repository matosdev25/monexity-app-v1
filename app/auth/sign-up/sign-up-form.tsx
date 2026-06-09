"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { signUp } from "../actions";
import type { SignUpState } from "../types";

const initialState: SignUpState = {
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
      className="w-full rounded-3xl bg-slate-900 px-5 py-4 text-[15px] font-semibold tracking-[-0.01em] text-white transition-[background-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-700 active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-70 motion-reduce:transition-none dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
    >
      <span className="flex items-center justify-center gap-2">
        {pending && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" className="opacity-20" stroke="currentColor" strokeWidth="3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
        <span>{pending ? "Creando cuenta..." : "Crear cuenta"}</span>
      </span>
    </button>
  );
}

function formatPanamaPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (!digits) return "";
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

function normalizePanamaPhone(value: string) {
  let digits = value.replace(/\D/g, "");
  digits = digits.slice(0, 8);
  if (!digits) return "";
  if (digits[0] !== "6") digits = `6${digits.slice(1)}`;
  return formatPanamaPhone(digits);
}

export function SignUpForm() {
  const [state, formAction] = useActionState(signUp, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [phoneValue, setPhoneValue] = useState("");

  const getFieldClass = (name: keyof NonNullable<SignUpState["fieldErrors"]>) =>
    state.fieldErrors?.[name] ? errorFieldClass : normalFieldClass;

  const phoneDigits = phoneValue.replace(/\D/g, "");

  return (
    <div className="mx-auto w-full max-w-2xl">
      <form action={formAction}>
        {state.formError && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
            {state.formError}
          </div>
        )}

        <input type="hidden" name="phone" value={phoneValue} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="fullName" className={labelClass}>Nombre completo</label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              minLength={3}
              maxLength={120}
              autoComplete="name"
              className={getFieldClass("fullName")}
              placeholder="Tu nombre completo"
            />
            {state.fieldErrors?.fullName && (
              <p className={errorTextClass}>{state.fieldErrors.fullName}</p>
            )}
          </div>

          <div>
            <label htmlFor="username" className={labelClass}>Nombre de usuario</label>
            <input
              id="username"
              name="username"
              type="text"
              required
              minLength={3}
              maxLength={20}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              className={getFieldClass("username")}
              placeholder="ej. davidmatos"
            />
            {state.fieldErrors?.username && (
              <p className={errorTextClass}>{state.fieldErrors.username}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className={labelClass}>Correo electrónico</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              maxLength={120}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              className={getFieldClass("email")}
              placeholder="correo@ejemplo.com"
            />
            {state.fieldErrors?.email && (
              <p className={errorTextClass}>{state.fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="phone" className={labelClass}>Número de teléfono</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              required
              className={getFieldClass("phone")}
              placeholder="6000-0000"
              value={phoneValue}
              onChange={(e) => setPhoneValue(normalizePanamaPhone(e.target.value))}
              onKeyDown={(e) => {
                const allowed = ["Backspace","Delete","Tab","ArrowLeft","ArrowRight","Home","End"];
                if (allowed.includes(e.key) || /^\d$/.test(e.key)) return;
                e.preventDefault();
              }}
            />
            {phoneDigits.length > 0 && phoneDigits[0] !== "6" && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">En Panamá el número debe empezar con 6.</p>
            )}
            {state.fieldErrors?.phone && (
              <p className={errorTextClass}>{state.fieldErrors.phone}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="password" className={labelClass}>Contraseña</label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                className={`${getFieldClass("password")} pr-12`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-400 transition-[background-color,color] duration-180 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
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
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">8 o más caracteres, mayúscula, minúscula y número.</p>
            {state.fieldErrors?.password && (
              <p className={errorTextClass}>{state.fieldErrors.password}</p>
            )}
          </div>
        </div>

        <div className="mt-6">
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}
