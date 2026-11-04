"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ButtonSpinner } from "@/components/button-spinner";
import { deleteAccount, type DeleteAccountState } from "./delete-account-actions";
import { DELETE_ACCOUNT_CONFIRMATION } from "./delete-account-constants";

const initialState: DeleteAccountState = { success: false, message: "" };

const motion =
  "transition-[background-color,border-color,color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none";

const inputClass =
  "w-full rounded-[14px] border border-app bg-app-soft px-3 py-2 text-sm text-app outline-none transition-[border-color,box-shadow] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] placeholder:text-app-soft focus:border-rose-400 focus-visible:ring-2 focus-visible:ring-rose-400/30 motion-reduce:transition-none";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;
  return (
    <button
      type="submit"
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={pending}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-[18px] bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white ${motion} hover:bg-rose-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 sm:w-auto`}
    >
      {pending ? <ButtonSpinner variant="current" /> : null}
      {pending ? "Eliminando..." : "Eliminar mi cuenta definitivamente"}
    </button>
  );
}

export function DeleteAccountForm() {
  const [state, formAction] = useActionState(deleteAccount, initialState);
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const confirmed = confirmation.trim() === DELETE_ACCOUNT_CONFIRMATION;

  return (
    <div className="app-card rounded-[24px] border border-rose-200/70 p-5 dark:border-rose-500/20">
      <p className="text-sm font-semibold text-app">Eliminar cuenta y datos</p>
      <p className="mt-1 text-xs leading-5 text-app-soft">
        A diferencia de cancelar la membresía, esto es permanente y no se puede deshacer.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`mt-3 inline-flex w-full items-center justify-center rounded-[18px] border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 ${motion} hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 sm:w-auto dark:border-rose-500/25 dark:bg-transparent dark:text-rose-300 dark:hover:border-rose-400/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-200`}
        >
          Eliminar mi cuenta
        </button>
      ) : (
        <form action={formAction} className="mt-4 space-y-3">
          <ul className="space-y-1.5 rounded-[18px] border border-rose-200 bg-rose-50 p-4 text-xs leading-5 text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200">
            <li>Se eliminan tu usuario, tu perfil y tus accesos.</li>
            <li>
              Si eres dueño de un negocio, se eliminan sus ventas, gastos, cotizaciones, productos,
              servicios, cierres, logo y comprobantes.
            </li>
            <li>
              Por obligaciones contables se conserva un registro mínimo de los pagos de tu
              suscripción a Monexity (monto, fecha, plan y referencia del proveedor de pago), sin tu
              nombre, correo ni negocio, durante el plazo legal aplicable.
            </li>
            <li>Si tu negocio tiene otros miembros, primero debes quitarlos del equipo.</li>
          </ul>

          <div>
            <label htmlFor="delete-password" className="mb-1.5 block text-xs font-medium text-app-muted">
              Contraseña actual
            </label>
            <input
              id="delete-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="delete-confirmation" className="mb-1.5 block text-xs font-medium text-app-muted">
              Escribe <span className="font-semibold text-app">{DELETE_ACCOUNT_CONFIRMATION}</span> para confirmar
            </label>
            <input
              id="delete-confirmation"
              name="confirmation"
              type="text"
              autoComplete="off"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className={inputClass}
            />
          </div>

          {!state.success && state.message ? (
            <p
              role="alert"
              className="rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
            >
              {state.message}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <SubmitButton disabled={!confirmed} />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmation("");
              }}
              className={`inline-flex w-full items-center justify-center rounded-[18px] border border-app px-4 py-2.5 text-sm font-medium text-app-muted ${motion} hover:text-app active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 sm:w-auto dark:focus-visible:ring-white/20`}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
