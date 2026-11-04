"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type VerifyState = "verifying" | "paid" | "failed" | "pending" | "review" | "error";

const AUTO_RETRIES = 3;
const AUTO_RETRY_DELAY_MS = 4000;

const COPY: Record<VerifyState, { title: string; body: string; tone: "info" | "success" | "warning" | "danger" }> = {
  verifying: {
    title: "Verificando pago",
    body: "Estamos confirmando tu pago directamente con Tilopay. No cierres esta pantalla.",
    tone: "info",
  },
  paid: {
    title: "Pago confirmado",
    body: "Tilopay confirmó tu pago. Tu membresía fue actualizada.",
    tone: "success",
  },
  failed: {
    title: "Pago rechazado",
    body: "El banco o Tilopay no aprobó el pago. No se realizó ningún cargo. Puedes intentarlo de nuevo o pagar por Yappy.",
    tone: "danger",
  },
  pending: {
    title: "Pago pendiente de verificación",
    body: "Aún no podemos confirmar el pago con Tilopay. No vuelvas a pagar; vuelve a verificar en unos minutos.",
    tone: "warning",
  },
  review: {
    title: "Pago en revisión",
    body: "Recibimos un cobro que requiere revisión manual. No vuelvas a pagar; te contactaremos.",
    tone: "warning",
  },
  error: {
    title: "No pudimos verificar el pago",
    body: "Hubo un problema temporal al consultar Tilopay. Tu pago no se pierde: vuelve a verificar.",
    tone: "danger",
  },
};

const TONE_CLASSES = {
  info: "border-sky-200 bg-sky-50 text-sky-800 dark:border-cyan-500/25 dark:bg-cyan-500/10 dark:text-cyan-200",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
  warning: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200",
  danger: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300",
};

function toState(status: unknown): VerifyState {
  switch (status) {
    case "paid":
    case "failed":
    case "review":
      return status;
    case "pending":
    case "not_found":
      return "pending";
    default:
      return "error";
  }
}

// El éxito solo se muestra cuando el servidor confirmó el cobro con
// POST /api/v1/consult; volver de Tilopay no basta.
export function TilopayReturnStatus({ intentId }: { intentId: string }) {
  const router = useRouter();
  const [state, setState] = useState<VerifyState>("verifying");
  const attempts = useRef(0);
  const refreshed = useRef(false);

  const verify = useCallback(async () => {
    attempts.current += 1;
    try {
      const res = await fetch("/api/payments/tilopay/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentId }),
      });
      const data = await res.json().catch(() => null);
      const next = res.status === 404 ? "error" : toState(data?.status);
      setState(next);
      return next;
    } catch {
      setState("error");
      return "error" as const;
    }
  }, [intentId]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function run() {
      const next = await verify();
      if (cancelled) return;
      if ((next === "pending" || next === "error") && attempts.current < AUTO_RETRIES) {
        timer = window.setTimeout(() => {
          setState("verifying");
          void run();
        }, AUTO_RETRY_DELAY_MS);
      }
    }

    void run();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [verify]);

  useEffect(() => {
    if (state === "paid" && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [state, router]);

  const copy = COPY[state];
  const canRetry = state === "pending" || state === "error";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-[22px] border px-4 py-3 text-sm leading-6 ${TONE_CLASSES[copy.tone]}`}
    >
      <p className="font-semibold">{copy.title}</p>
      <p>{copy.body}</p>
      {canRetry && (
        <button
          type="button"
          onClick={() => {
            attempts.current = 0;
            setState("verifying");
            void verify();
          }}
          className="mt-3 rounded-[16px] border border-current/30 px-3 py-2 text-xs font-semibold transition-[background-color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white/60 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 motion-reduce:transition-none dark:hover:bg-white/10"
        >
          Verificar de nuevo
        </button>
      )}
    </div>
  );
}
