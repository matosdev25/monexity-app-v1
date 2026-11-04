"use client";

import { adminPrimaryButtonClass } from "./admin-ui";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-[24px] border border-rose-200 bg-rose-50 p-6 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300"
    >
      <p className="text-base font-semibold">No se pudo cargar esta sección del admin</p>
      <p className="mt-1 text-sm leading-6">
        Ocurrió un error inesperado. Puedes reintentar; si persiste, revisa la conexión con Supabase.
      </p>
      <button type="button" onClick={reset} className={`mt-4 ${adminPrimaryButtonClass}`}>
        Reintentar
      </button>
    </div>
  );
}
