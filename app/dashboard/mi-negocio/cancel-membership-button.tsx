"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelMembership } from "./actions";

export function CancelMembershipButton({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCancel() {
    const confirmed = window.confirm(
      "¿Seguro que quieres cancelar tu membresía? Perderás acceso al finalizar el periodo actual."
    );

    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const result = await cancelMembership(companyId);
      if (!result.success) {
        setError(result.error ?? "No se pudo cancelar la membresía.");
        return;
      }

      router.push("/dashboard/billing");
      router.refresh();
    });
  }

  return (
    <div className="mt-5 border-t border-app pt-5">
      <p className="text-sm font-medium text-app">Cancelar membresía</p>
      <p className="mt-1 text-xs leading-5 text-app-soft">
        Tu negocio, usuarios e historial se conservarán.
      </p>

      {error && (
        <p className="mt-3 rounded-[16px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleCancel}
        disabled={isPending}
        className="mt-3 inline-flex w-full items-center justify-center rounded-[18px] border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition-[background-color,border-color,color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 motion-reduce:transition-none dark:border-rose-500/25 dark:bg-transparent dark:text-rose-300 dark:hover:border-rose-400/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-200 sm:w-auto"
      >
        {isPending ? "Cancelando..." : "Cancelar membresía"}
      </button>
    </div>
  );
}
