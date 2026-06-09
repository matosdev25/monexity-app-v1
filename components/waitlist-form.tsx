"use client";

import { useState } from "react";

type Method = "email" | "whatsapp";
type State = "idle" | "loading" | "success" | "error";

const WA_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "50760000000";
const WA_MSG = encodeURIComponent(
  "Hola, quiero unirme a la lista de espera de Monexity 🎉"
);

export function WaitlistForm() {
  const [method, setMethod] = useState<Method>("email");
  const [value, setValue] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;

    setState("loading");
    setError("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, value: value.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Algo salió mal. Intenta de nuevo.");
        setState("error");
        return;
      }

      setState("success");

      if (method === "whatsapp") {
        window.open(`https://wa.me/${WA_NUMBER}?text=${WA_MSG}`, "_blank");
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-emerald-600 dark:text-emerald-400" aria-hidden="true">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-base font-semibold text-slate-900 dark:text-white">
          ¡Listo! Ya estás en la lista.
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Te avisamos en cuanto abramos acceso. Tu 25% de descuento está reservado.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Selector de método */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200/70 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/60">
        {(["email", "whatsapp"] as Method[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMethod(m); setValue(""); }}
            className={[
              "flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-[background-color,box-shadow,color] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)]",
              method === m
                ? "bg-white text-slate-900 shadow-[0_1px_6px_rgba(15,23,42,0.10)] dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
            ].join(" ")}
          >
            {m === "email" ? <EmailIcon /> : <WhatsAppIcon />}
            {m === "email" ? "Email" : "WhatsApp"}
          </button>
        ))}
      </div>

      {/* Input */}
      <div>
        <input
          type={method === "email" ? "email" : "tel"}
          inputMode={method === "whatsapp" ? "numeric" : undefined}
          required
          maxLength={120}
          placeholder={method === "email" ? "correo@ejemplo.com" : "6000-0000"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900 outline-none transition-[border-color,box-shadow] duration-180 placeholder:text-slate-400 focus:border-sky-400 focus:shadow-[0_0_0_3px_rgba(14,165,233,0.12)] dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-sky-500"
        />
        {state === "error" && (
          <p className="mt-2 text-sm text-red-500 dark:text-red-400">{error}</p>
        )}
      </div>

      {/* CTA */}
      <button
        type="submit"
        disabled={state === "loading"}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-3xl bg-slate-900 text-sm font-semibold text-white transition-[background-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-60 motion-reduce:transition-none dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
      >
        {state === "loading" ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" className="opacity-20" stroke="currentColor" strokeWidth="3" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            Guardando...
          </>
        ) : (
          <>
            Reservar mi 25% de descuento
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        )}
      </button>

      <p className="text-center text-xs text-slate-400 dark:text-slate-500">
        Sin spam. Te contactamos solo cuando abramos.
      </p>
    </form>
  );
}

function EmailIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 shrink-0" aria-hidden="true">
      <rect x="1.5" y="3" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.5 5.5L7.2 9c.5.3 1.1.3 1.6 0L14.5 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path d="M8 1a7 7 0 0 1 6.07 10.5L15 15l-3.6-.92A7 7 0 1 1 8 1Zm0 1.4A5.6 5.6 0 1 0 11.8 13l.22.06 2.14.55-.56-2.07.07-.21A5.6 5.6 0 0 0 8 2.4Zm-1.9 2.8c.13 0 .27.01.38.04.14.03.3.09.44.44l.54 1.35c.1.24.06.51-.07.72l-.3.45c-.1.15-.1.33-.01.48.3.5.73 1.02 1.2 1.42.46.4.99.72 1.5.9.17.06.36.01.48-.12l.38-.44c.17-.2.43-.28.67-.2l1.39.5c.35.12.44.28.47.43.06.37.06.75-.05 1.09-.18.53-.97.9-1.5.93-.7.04-2.2-.1-4.1-1.88C5.53 9.65 5.1 8.1 5.1 7.35c.03-.52.38-1.3.88-1.46.13-.04.27-.07.41-.07l-.3-.02Z" />
    </svg>
  );
}
