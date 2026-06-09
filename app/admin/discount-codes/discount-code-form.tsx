"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createDiscountCode } from "../actions";

const initialState = { success: false, message: "" };

export function DiscountCodeForm() {
  const [state, formAction, pending] = useActionState(createDiscountCode, initialState);
  const [discountType, setDiscountType] = useState("percentage");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="app-card rounded-[28px] p-5">
      <div>
        <p className="text-lg font-semibold text-app">Crear código</p>
        <p className="mt-1 text-sm text-app-muted">
          Los códigos se validan en servidor. El total final nunca puede ser menor a $ 1.50.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input name="code" placeholder="LANZAMIENTO25" className={inputClass} required />
        <input name="description" placeholder="Descripción interna" className={inputClass} />

        <select
          name="discountType"
          className={inputClass}
          value={discountType}
          onChange={(event) => setDiscountType(event.target.value)}
        >
          <option value="percentage">Porcentaje</option>
          <option value="fixed">Monto fijo</option>
        </select>

        <input
          name="discountValue"
          type="number"
          min="0.01"
          max={discountType === "percentage" ? "99.99" : undefined}
          step="0.01"
          placeholder="Valor"
          className={inputClass}
          required
        />

        <select name="appliesTo" className={inputClass} defaultValue="both">
          <option value="both">Mensual y anual</option>
          <option value="monthly">Solo mensual</option>
          <option value="yearly">Solo anual</option>
        </select>

        <input name="maxUses" type="number" min="0" step="1" placeholder="Límite de usos opcional" className={inputClass} />

        <div>
          <label className="mb-1.5 block text-xs font-medium text-app-muted">Inicio</label>
          <input name="startsAt" type="datetime-local" className={inputClass} />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-app-muted">Expiración</label>
          <input name="expiresAt" type="datetime-local" className={inputClass} />
        </div>
      </div>

      {state.message && (
        <p className={`mt-3 text-sm ${state.success ? "text-emerald-600" : "text-rose-600"}`}>
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 w-full rounded-[20px] bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-[background-color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-800 active:scale-[0.99] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 sm:w-auto"
      >
        {pending ? "Creando..." : "Crear código"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-[18px] border border-app bg-app-soft px-4 py-3 text-sm text-app outline-none transition-[background-color,border-color,box-shadow] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] placeholder:text-app-soft focus:border-app-strong focus:bg-white focus-visible:ring-2 focus-visible:ring-sky-400/30 dark:focus:bg-white/[0.08]";
