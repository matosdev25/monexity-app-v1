"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { lockBodyScroll, useModalAccessibility } from "@/components/modal-accessibility";

type PaymentAction = "approve" | "reject";

const motion =
  "transition-[background-color,border-color,color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none";

export function AdminVerifyButton({ intentId, summary }: { intentId: string; summary: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [pendingAction, setPendingAction] = useState<PaymentAction | null>(null);
  const [confirmAction, setConfirmAction] = useState<PaymentAction | null>(null);
  const [message, setMessage] = useState("");

  const titleId = useId();
  const descriptionId = useId();
  const dialogOpen = confirmAction !== null;
  const panelRef = useModalAccessibility({ open: dialogOpen, onClose: () => setConfirmAction(null) });

  useEffect(() => {
    if (!dialogOpen) return;
    return lockBodyScroll();
  }, [dialogOpen]);

  // Tras resolver, refresca la lista del servidor (el pago sale de "Pendientes")
  useEffect(() => {
    if (state !== "done") return;
    const timer = window.setTimeout(() => router.refresh(), 1200);
    return () => window.clearTimeout(timer);
  }, [state, router]);

  async function submit(nextAction: PaymentAction) {
    setConfirmAction(null);
    setState("loading");
    setPendingAction(nextAction);
    try {
      const res = await fetch(`/api/admin/payments/${intentId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: nextAction }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        // El mensaje refleja el estado real devuelto por el servidor, no la acción pedida:
        // con confirmaciones concurrentes el pago puede haber quedado ya aprobado o rechazado.
        setState("done");
        setMessage(
          data.status === "already_paid"
            ? "Este pago ya estaba aprobado ✓"
            : data.status === "already_rejected"
            ? "Este pago ya estaba rechazado"
            : data.status === "rejected"
            ? "Pago rechazado"
            : "Suscripción activada ✓"
        );
      } else {
        setState("error");
        setMessage(data.error ?? "Error al confirmar");
      }
    } catch {
      setState("error");
      setMessage("Error de conexión");
    } finally {
      setPendingAction(null);
    }
  }

  if (state === "done") {
    return (
      <p role="status" className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">
        {message}
      </p>
    );
  }

  const isApprove = confirmAction === "approve";

  return (
    <div className="flex flex-col gap-1.5 sm:items-end">
      <button
        type="button"
        onClick={() => setConfirmAction("approve")}
        disabled={state === "loading"}
        aria-haspopup="dialog"
        className={`rounded-[16px] bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white ${motion} hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200`}
      >
        {state === "loading" && pendingAction === "approve" ? "Aprobando..." : "Aprobar pago"}
      </button>
      <button
        type="button"
        onClick={() => setConfirmAction("reject")}
        disabled={state === "loading"}
        aria-haspopup="dialog"
        className={`rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 ${motion} hover:bg-rose-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15`}
      >
        {state === "loading" && pendingAction === "reject" ? "Rechazando..." : "Rechazar pago"}
      </button>
      {state === "error" ? (
        <p role="alert" className="max-w-56 text-xs text-rose-600 dark:text-rose-300">{message}</p>
      ) : null}

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={() => setConfirmAction(null)}
          />
          <div
            ref={panelRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="animate-mx-scale-in relative w-full max-w-sm rounded-[28px] border border-app bg-app-panel p-5 text-app outline-none shadow-[0_24px_80px_rgba(15,23,42,0.22)] dark:shadow-[0_24px_80px_rgba(2,6,23,0.50)]"
          >
            <p className="text-[11px] uppercase tracking-[0.18em] text-app-soft">Confirmación</p>
            <h3 id={titleId} className="mt-1 text-xl font-semibold tracking-tight text-app">
              {isApprove ? "¿Aprobar este pago?" : "¿Rechazar este pago?"}
            </h3>
            <div id={descriptionId} className="mt-3 space-y-2 text-sm leading-6 text-app-muted">
              <p className="font-medium text-app">{summary}</p>
              <p>
                {isApprove
                  ? "Verifica en Yappy que el monto exacto fue recibido. Al aprobar se activa la suscripción."
                  : "El pago quedará rechazado y la empresa no recibirá el período."}
              </p>
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className={`rounded-2xl border border-app bg-app-soft px-4 py-2.5 text-sm font-medium text-app-muted ${motion} hover:text-app active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmAction) void submit(confirmAction);
                }}
                className={
                  isApprove
                    ? `rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white ${motion} hover:bg-slate-800 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200`
                    : `rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-2.5 text-sm font-semibold text-rose-600 ${motion} hover:border-rose-300 hover:bg-rose-100 hover:text-rose-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15`
                }
              >
                {isApprove ? "Sí, aprobar" : "Sí, rechazar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
