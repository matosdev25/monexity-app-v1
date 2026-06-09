"use client";

import { useState } from "react";

export function StartPagueloFacilCheckout({
  companyId,
  planId,
  billingCycle,
  discountCode,
}: {
  companyId: string;
  planId: string;
  billingCycle: "monthly" | "annual";
  discountCode?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, planId, billingCycle, discountCode }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "No se pudo iniciar el pago.");
        return;
      }

      if (data.status === "paid") {
        window.location.href = "/dashboard/billing?pf=success";
        return;
      }

      if (!data.checkoutUrl) {
        setError(data.error ?? "No se pudo iniciar el pago.");
        return;
      }

      window.location.href = data.checkoutUrl;
    } catch {
      setError("No se pudo conectar con el checkout. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      {error && (
        <p className="mb-3 rounded-[16px] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleCheckout}
        disabled={loading}
        className="inline-flex w-full items-center justify-center rounded-[24px] bg-white px-5 py-4 text-[15px] font-semibold tracking-[-0.01em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_8px_24px_rgba(255,255,255,0.08)] transition-[background-color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        {loading ? "Abriendo checkout..." : "Pagar con PagueloFácil"}
      </button>
    </div>
  );
}
