"use client";

import { useState } from "react";

export function AdminVerifyButton({ intentId }: { intentId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [message, setMessage] = useState("");

  async function submit(nextAction: "approve" | "reject") {
    const text =
      nextAction === "approve"
        ? "¿Aprobar este pago?\n\nVerifica en Yappy que el monto fue recibido antes de aprobar."
        : "¿Rechazar este pago?";
    if (!window.confirm(text)) return;

    setState("loading");
    setAction(nextAction);
    try {
      const res = await fetch(`/api/admin/payments/${intentId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: nextAction }),
      });
      const data = await res.json();
      if (res.ok) {
        setState("done");
        setMessage(nextAction === "approve" ? "Suscripción activada ✓" : "Pago rechazado");
      } else {
        setState("error");
        setMessage(data.error ?? "Error al confirmar");
      }
    } catch {
      setState("error");
      setMessage("Error de conexión");
    } finally {
      setAction(null);
    }
  }

  if (state === "done") {
    return (
      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">
        {message}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 sm:items-end">
      <button
        type="button"
        onClick={() => submit("approve")}
        disabled={state === "loading"}
        className="rounded-[16px] bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-[background-color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
      >
        {state === "loading" && action === "approve" ? "Aprobando..." : "Aprobar pago"}
      </button>
      <button
        type="button"
        onClick={() => submit("reject")}
        disabled={state === "loading"}
        className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition-[background-color,border-color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-rose-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15"
      >
        {state === "loading" && action === "reject" ? "Rechazando..." : "Rechazar pago"}
      </button>
      {state === "error" && (
        <span className="text-xs text-rose-600 dark:text-rose-300">{message}</span>
      )}
    </div>
  );
}
