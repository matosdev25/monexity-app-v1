"use client";

import { useEffect, useState, useTransition } from "react";
import { CreditCard } from "lucide-react";
import { PLANS } from "@/lib/plans/plans";
import { MINIMUM_DISCOUNTED_PAYMENT } from "@/lib/discounts/constants";
import {
  cancelScheduledSubscriptionChange,
  createYappyManualPayment,
  validateDiscountCode,
  type DiscountValidationResult,
} from "./actions";
import { formatShortDate } from "@/lib/date-format";
import { formatCurrency } from "@/lib/currency-format";

type BillingCycle = "monthly" | "annual";
type DiscountStatus = "empty" | "validating" | "applied" | "invalid";

type IntentData = {
  id: string;
  status: string;
  exactAmount: number;
  expiresAt: string;
  planId: string;
  billingCycle: BillingCycle;
  intentType?: "subscription_payment" | "plan_upgrade";
  checkoutUrl?: string | null;
};

type Props = {
  companyId: string;
  canManage: boolean;
  currentPlanId: string | null;
  currentBillingCycle: BillingCycle | null;
  currentStatus: string;
  renewalDate: string | null;
  scheduledChange: {
    planId: string;
    billingCycle: BillingCycle;
    changeAt: string | null;
  } | null;
  existingIntent: IntentData | null;
  pendingYappyIntent: IntentData | null;
};

const PLAN_LEVELS: Record<string, number> = {
  emprende: 1,
  control: 2,
  equipo: 3,
};

function formatDate(value: string | null) {
  if (!value) return "fecha pendiente";
  return formatShortDate(value, "fecha pendiente");
}

function getYappyPhoneDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

function formatYappyPhone(value: string) {
  const digits = getYappyPhoneDigits(value);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

function getYappyPhoneError(value: string) {
  const digits = getYappyPhoneDigits(value);
  if (digits.length > 0 && !digits.startsWith("6")) {
    return "El número debe empezar por 6.";
  }
  if (digits.length > 0 && digits.length < 8) {
    return "Ingresa un número válido de 8 dígitos.";
  }
  if (digits.length === 8 && !/^6\d{7}$/.test(digits)) {
    return "Ingresa un número válido de 8 dígitos.";
  }
  return "";
}

export function PaymentFlow({
  companyId,
  canManage,
  currentPlanId,
  currentBillingCycle,
  currentStatus,
  renewalDate,
  scheduledChange,
  existingIntent,
  pendingYappyIntent,
}: Props) {
  const [selectedPlan, setSelectedPlan] = useState<string>(
    currentPlanId ?? "control"
  );
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    currentBillingCycle ?? "monthly"
  );
  const [scheduled, setScheduled] = useState(scheduledChange);
  const [discountCode, setDiscountCode] = useState("");
  const [discountStatus, setDiscountStatus] = useState<DiscountStatus>("empty");
  const [discountResult, setDiscountResult] = useState<DiscountValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancellingSchedule, startScheduleTransition] = useTransition();
  const [validatingDiscount, startDiscountTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [yappySenderName, setYappySenderName] = useState("");
  const [yappySenderPhone, setYappySenderPhone] = useState("");
  const [yappyLoading, setYappyLoading] = useState(false);
  const [yappyModalOpen, setYappyModalOpen] = useState(false);
  const [yappyFormError, setYappyFormError] = useState("");
  const [localYappyIntent, setLocalYappyIntent] = useState<IntentData | null>(pendingYappyIntent);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!yappyModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setYappyModalOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [yappyModalOpen]);

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          planId: selectedPlan,
          billingCycle,
          discountCode: discountResult?.ok ? discountResult.code : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.status === "scheduled") {
        setScheduled({
          planId: selectedPlan,
          billingCycle,
          changeAt: renewalDate,
        });
        setMessage(data.message);
        return;
      }

      if (res.ok && data.status === "updated") {
        const billingUrl = new URL("/dashboard/billing", window.location.origin);
        billingUrl.searchParams.set("trialPlanUpdated", data.planId ?? selectedPlan);
        window.location.href = billingUrl.toString();
        return;
      }

      if (res.ok && data.status === "paid") {
        window.location.reload();
        return;
      }

      if (!res.ok || !data.checkoutUrl) {
        setError(data.error ?? "No se pudo iniciar el pago.");
        return;
      }

      window.location.href = data.checkoutUrl;
    } catch {
      setError("Error de conexión. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleYappyPayment() {
    const phoneError = getYappyPhoneError(yappySenderPhone);
    if (!yappySenderName.trim() || !yappySenderPhone || phoneError) {
      setYappyFormError(phoneError || "Completa el nombre y número para registrar el pago.");
      return;
    }

    setYappyLoading(true);
    setError(null);
    setMessage(null);
    setYappyFormError("");

    try {
      const result = await createYappyManualPayment(
        companyId,
        yappySenderName.trim(),
        yappySenderPhone,
        discountResult?.ok ? discountResult.code : undefined
      );

      if (!result.success) {
        setError(result.error);
        return;
      }

      setLocalYappyIntent({
        id: result.intent.id,
        status: "manual_review",
        exactAmount: result.intent.exactAmount,
        expiresAt: "",
        planId: result.intent.planId,
        billingCycle: result.intent.billingCycle,
      });
      setMessage(result.message);
      setYappyModalOpen(false);
    } catch {
      setError("Error de conexión. Intenta nuevamente.");
    } finally {
      setYappyLoading(false);
    }
  }

  const isActive = ["active", "paid"].includes(currentStatus);
  const isTrialing = currentStatus === "trialing";
  const hasValidTrial = Boolean(
    isTrialing && renewalDate && new Date(renewalDate).getTime() > now
  );
  const isPlanChange = Boolean(
    currentPlanId && (selectedPlan !== currentPlanId || billingCycle !== currentBillingCycle)
  );
  const isUpgrade = Boolean(
    currentPlanId && PLAN_LEVELS[selectedPlan] > PLAN_LEVELS[currentPlanId]
  );
  const daysRemaining = renewalDate
    ? (new Date(renewalDate).getTime() - now) / 86_400_000
    : null;
  const shouldSchedule =
    isPlanChange &&
    isActive &&
    (
      currentBillingCycle !== billingCycle ||
      !isUpgrade ||
      daysRemaining === null ||
      daysRemaining <= 5
    );
  const needsInitialPayment = !isActive && !hasValidTrial;
  const pendingIntentMatchesSelection = Boolean(
    !hasValidTrial &&
    existingIntent?.checkoutUrl &&
    existingIntent.status === "pending" &&
    existingIntent.planId === selectedPlan &&
    existingIntent.billingCycle === billingCycle &&
    (
      existingIntent.intentType === "plan_upgrade"
        ? isPlanChange && isUpgrade && !shouldSchedule
        : needsInitialPayment && selectedPlan === currentPlanId
    )
  );
  const yappyIntentMatchesSelection = Boolean(
    localYappyIntent &&
    localYappyIntent.planId === selectedPlan &&
    localYappyIntent.billingCycle === billingCycle
  );
  const yappyPhoneError = getYappyPhoneError(yappySenderPhone);
  const isYappyFormReady = Boolean(
    yappySenderName.trim() &&
    yappySenderPhone &&
    !yappyPhoneError
  );
  const normalizedDiscountCode = discountCode.trim().toUpperCase();
  const showPrimaryAction = needsInitialPayment || isPlanChange;
  const paymentPlanLocked = needsInitialPayment && Boolean(currentPlanId);
  const selectedPlanConfig = PLANS.find((plan) => plan.id === selectedPlan) ?? null;
  const baseAmount = selectedPlanConfig
    ? Number(
        (billingCycle === "annual"
          ? selectedPlanConfig.priceAnnual
          : selectedPlanConfig.priceMonthly
        ).replace(/[^0-9.]/g, "")
      )
    : 0;
  const displayedDiscountAmount = discountResult?.ok ? discountResult.discountAmount : 0;
  const displayedFinalAmount = discountResult?.ok ? discountResult.finalAmount : baseAmount;
  const hasCheckoutMinimumIssue = displayedFinalAmount < MINIMUM_DISCOUNTED_PAYMENT;
  const buttonLabel = isPlanChange
    ? hasValidTrial
      ? "Cambiar ahora"
      : shouldSchedule
      ? "Programar cambio"
      : "Cambiar ahora"
    : "Pagar y continuar";

  function resetDiscount() {
    setDiscountCode("");
    setDiscountStatus("empty");
    setDiscountResult(null);
  }

  function handleBillingCycleChange(cycle: BillingCycle) {
    if (paymentPlanLocked) return;
    setBillingCycle(cycle);
    resetDiscount();
  }

  function handlePlanChange(planId: string) {
    if (paymentPlanLocked) return;
    setSelectedPlan(planId);
    resetDiscount();
  }

  function handleDiscountChange(value: string) {
    setDiscountCode(value.toUpperCase());
    setDiscountStatus("empty");
    setDiscountResult(null);
  }

  function handleApplyDiscount() {
    if (!normalizedDiscountCode) {
      setDiscountStatus("empty");
      return;
    }

    setDiscountStatus("validating");
    startDiscountTransition(async () => {
      const result = await validateDiscountCode(companyId, billingCycle, normalizedDiscountCode);
      setDiscountResult(result);
      setDiscountStatus(result.ok ? "applied" : "invalid");
    });
  }

  function handleCancelSchedule() {
    setError(null);
    setMessage(null);
    startScheduleTransition(async () => {
      const result = await cancelScheduledSubscriptionChange(companyId);
      if (!result.success) {
        setError(result.error ?? "No se pudo cancelar el cambio programado.");
        return;
      }
      setScheduled(null);
      setSelectedPlan(currentPlanId ?? "control");
      setBillingCycle(currentBillingCycle ?? "monthly");
      setMessage("Cambio programado cancelado.");
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-app-muted">
          {isActive || isTrialing ? "Cambiar plan" : "Elige tu plan"}
        </p>
        <p className="mt-1 text-xs leading-5 text-app-soft">
          {hasValidTrial
            ? "Durante tu prueba puedes cambiar de plan sin costo. La fecha de finalización se mantiene."
            : "Cuando corresponda, podrás pagar de forma segura con PagueloFácil."}
        </p>
      </div>

      {scheduled && (
        <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="font-semibold">Cambio programado</p>
          <p className="mt-1 leading-5">
            Tu plan cambiará a {PLANS.find((plan) => plan.id === scheduled.planId)?.name ?? scheduled.planId}{" "}
            ({scheduled.billingCycle === "annual" ? "anual" : "mensual"}) el {formatDate(scheduled.changeAt)}.
          </p>
          {canManage && (
            <button
              type="button"
              onClick={handleCancelSchedule}
              disabled={cancellingSchedule}
              className="mt-3 rounded-[16px] border border-amber-300 px-3 py-2 text-xs font-semibold transition-[background-color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-amber-100 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 dark:border-amber-500/40 dark:hover:bg-amber-500/15"
            >
              {cancellingSchedule ? "Cancelando..." : "Cancelar cambio programado"}
            </button>
          )}
        </div>
      )}

      {pendingIntentMatchesSelection && existingIntent?.checkoutUrl && (
        <a
          href={existingIntent.checkoutUrl ?? "#"}
          className="block rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700 transition-[background-color,border-color,color,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-sky-100 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300 dark:hover:bg-cyan-500/15"
        >
          Continuar pago pendiente de ${existingIntent.exactAmount.toFixed(2)}
        </a>
      )}

      {yappyIntentMatchesSelection && localYappyIntent && (
        <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="font-semibold">Pago por Yappy pendiente de revisión.</p>
          <p>Cuando el pago sea confirmado, activaremos tu membresía.</p>
          <p className="mt-1 text-xs">
            Monto reportado: {formatCurrency(localYappyIntent.exactAmount)}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {(["monthly", "annual"] as const).map((cycle) => (
          <button
            key={cycle}
            type="button"
            onClick={() => handleBillingCycleChange(cycle)}
            disabled={paymentPlanLocked}
            className={[
              "rounded-[18px] border px-4 py-2.5 text-sm font-medium transition-[background-color,border-color,color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50",
              billingCycle === cycle
                ? "border-sky-400 bg-sky-50 text-sky-700 dark:border-cyan-500 dark:bg-cyan-500/10 dark:text-cyan-300"
                : "border-app bg-app-soft text-app-muted hover:text-app active:scale-[0.99]",
            ].join(" ")}
          >
            {cycle === "monthly" ? "Mensual" : "Anual"}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {PLANS.map((plan) => {
          const price = billingCycle === "monthly" ? plan.priceMonthly : plan.priceAnnual;
          const selected = selectedPlan === plan.id;
          const isCurrentPlan = currentPlanId === plan.id;

          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => handlePlanChange(plan.id)}
              disabled={paymentPlanLocked}
              className={[
                "w-full rounded-[22px] border p-4 text-left transition-[background-color,border-color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50",
                selected || isCurrentPlan
                  ? "border-sky-400 bg-sky-50 dark:border-cyan-500 dark:bg-cyan-500/10"
                  : "border-app bg-app-soft hover:border-app-strong active:scale-[0.99]",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-app">{plan.name}</p>
                  <p className="mt-0.5 text-xs text-app-muted">{plan.tagline}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold text-app">{price}</p>
                  <p className="text-[11px] text-app-soft">
                    {billingCycle === "monthly" ? "/mes" : "/año"}
                  </p>
                </div>
              </div>
              {isCurrentPlan && (
                <span className="mt-2 inline-block rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-cyan-500/15 dark:text-cyan-300">
                  Plan actual
                </span>
              )}
              {plan.highlight && (
                <span className="mt-2 ml-2 inline-block rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-cyan-500/15 dark:text-cyan-300">
                  Más popular
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!isActive && !hasValidTrial && (
      <div className="rounded-[24px] border border-app bg-app-soft p-4">
        <div className="mb-4 rounded-[18px] border border-app bg-white/70 p-4 text-sm dark:bg-white/[0.04]">
          <div className="flex items-center justify-between gap-3 text-app-muted">
            <span>Plan {selectedPlanConfig?.name ?? "actual"}</span>
            <span className="font-medium text-app">{formatCurrency(baseAmount)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-app">Código de descuento</p>
          <p className="text-xs leading-5 text-app-soft">
            Ingresa un código promocional para validarlo antes del pago.
          </p>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={discountCode}
            onChange={(event) => handleDiscountChange(event.target.value)}
            placeholder="MONEXITY"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-[18px] border border-app bg-white px-4 py-3 text-sm font-medium uppercase tracking-[0.08em] text-app outline-none transition-[background-color,border-color,box-shadow] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] placeholder:text-app-soft focus:border-sky-400 focus:bg-slate-50 focus-visible:ring-2 focus-visible:ring-sky-400/30 dark:bg-white/[0.06] dark:focus:bg-white/[0.08]"
          />
          <button
            type="button"
            onClick={handleApplyDiscount}
            disabled={validatingDiscount}
            className="rounded-[18px] bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-[background-color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
          >
            {validatingDiscount ? "Validando..." : "Aplicar"}
          </button>
        </div>

        {discountStatus === "empty" && (
          <p className="mt-2 text-xs text-app-soft">
            La validación se hará antes de confirmar el cobro.
          </p>
        )}

        {(discountStatus === "validating" || validatingDiscount) && (
          <p className="mt-2 text-xs text-sky-600 dark:text-cyan-300">
            Revisando código...
          </p>
        )}

        {discountStatus === "applied" && (
          <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-300">
            {discountResult?.message ?? "Código válido."}
          </p>
        )}

        {discountResult?.ok && discountResult.finalAmount < MINIMUM_DISCOUNTED_PAYMENT && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
            Este código supera el descuento permitido. El mínimo a pagar es {formatCurrency(MINIMUM_DISCOUNTED_PAYMENT)}.
          </p>
        )}

        {discountStatus === "invalid" && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
            {discountResult?.message ?? "El código no es válido."}
          </p>
        )}

        <div className="mt-4 space-y-2 rounded-[18px] border border-app bg-white/70 p-4 text-sm dark:bg-white/[0.04]">
          {displayedDiscountAmount > 0 && (
            <div className="flex items-center justify-between gap-3 text-emerald-600 dark:text-emerald-300">
              <span>Descuento</span>
              <span>-{formatCurrency(displayedDiscountAmount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 border-t border-app pt-2 font-semibold text-app">
            <span>Total</span>
            <span>{formatCurrency(displayedFinalAmount)}</span>
          </div>
        </div>
      </div>
      )}

      {error && (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
          {error}
        </p>
      )}

      {message && (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          {message}
        </p>
      )}

      {!canManage && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          Solo el dueño o un administrador puede cambiar el plan.
        </p>
      )}

      {showPrimaryAction && (
        <div className="space-y-3">
          {needsInitialPayment ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleCheckout}
                disabled={loading || !canManage || hasCheckoutMinimumIssue}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[22px] bg-sky-600 px-4 py-3.5 text-sm font-semibold text-white transition-[background-color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-sky-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 motion-reduce:transition-none dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
              >
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                {loading ? "Procesando..." : "Pagar con tarjeta"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setYappyFormError("");
                  setYappyModalOpen(true);
                }}
                disabled={
                  yappyLoading ||
                  !canManage ||
                  hasCheckoutMinimumIssue ||
                  Boolean(localYappyIntent)
                }
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[22px] border border-sky-300 bg-white px-4 py-3.5 text-sm font-semibold text-sky-700 transition-[background-color,border-color,color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-sky-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 motion-reduce:transition-none dark:border-cyan-500/30 dark:bg-white/[0.04] dark:text-cyan-300 dark:hover:bg-cyan-500/10"
              >
                <span
                  aria-hidden="true"
                  className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-sky-700 dark:bg-cyan-500/15 dark:text-cyan-200"
                >
                  Yappy
                </span>
                {localYappyIntent ? "Pago pendiente" : "Pagar por Yappy"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleCheckout}
              disabled={loading || !canManage || hasCheckoutMinimumIssue}
              className="w-full rounded-[22px] bg-sky-600 py-3.5 text-sm font-semibold text-white transition-[background-color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-sky-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 motion-reduce:transition-none dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
            >
              {loading ? "Procesando..." : buttonLabel}
            </button>
          )}
        </div>
      )}

      {yappyModalOpen && (
        <div className="fixed inset-0 z-[1000]">
          <button
            type="button"
            aria-label="Cerrar modal"
            className="absolute inset-0 bg-slate-950/45 dark:bg-black/60"
            onClick={() => setYappyModalOpen(false)}
          />
          <div className="absolute inset-0 overflow-y-auto overscroll-contain p-4">
            <div className="flex min-h-full items-center justify-center">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="yappy-payment-title"
                className="relative my-4 w-full max-w-sm rounded-[28px] border border-slate-200 bg-white p-5 text-app shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-950 dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-soft">
                      Facturación
                    </p>
                    <h2
                      id="yappy-payment-title"
                      className="mt-1 text-xl font-semibold tracking-tight text-app"
                    >
                      Pago por Yappy
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setYappyModalOpen(false)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-app text-app-muted transition-[background-color,border-color,color,opacity] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-app-soft hover:text-app active:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 motion-reduce:transition-none"
                    aria-label="Cerrar"
                  >
                    x
                  </button>
                </div>

                <div className="mt-4 rounded-[20px] border border-sky-200 bg-sky-100 p-4 text-sm leading-6 text-sky-800 dark:border-cyan-500/35 dark:bg-cyan-950/80 dark:text-cyan-100">
                  <p>Envía el pago por Yappy al 6601-7105.</p>
                  <p className="mt-1 font-semibold">
                    Monto a pagar: {formatCurrency(displayedFinalAmount)}
                  </p>
                </div>

                <div className="mt-4 grid gap-2">
                  <input
                    type="text"
                    value={yappySenderName}
                    onChange={(event) => {
                      setYappySenderName(event.target.value);
                      setYappyFormError("");
                    }}
                    placeholder="Nombre de quien enviará el Yappy"
                    disabled={Boolean(localYappyIntent) || yappyLoading}
                    className="rounded-[18px] border border-app bg-white px-4 py-3 text-sm text-app outline-none transition-[background-color,border-color,box-shadow,opacity] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] placeholder:text-app-soft disabled:cursor-not-allowed disabled:opacity-60 focus:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-400/30 motion-reduce:transition-none dark:bg-white/[0.06]"
                  />
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="6[0-9]{3}-[0-9]{4}"
                    maxLength={9}
                    value={yappySenderPhone}
                    onChange={(event) => {
                      setYappySenderPhone(formatYappyPhone(event.target.value));
                      setYappyFormError("");
                    }}
                    placeholder="6000-0000"
                    disabled={Boolean(localYappyIntent) || yappyLoading}
                    aria-invalid={Boolean(yappyPhoneError || yappyFormError)}
                    className="rounded-[18px] border border-app bg-white px-4 py-3 text-sm text-app outline-none transition-[background-color,border-color,box-shadow,opacity] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] placeholder:text-app-soft disabled:cursor-not-allowed disabled:opacity-60 focus:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-400/30 motion-reduce:transition-none dark:bg-white/[0.06]"
                  />
                </div>

                {(yappyPhoneError || yappyFormError) && (
                  <p className="mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                    {yappyFormError || yappyPhoneError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleYappyPayment}
                  disabled={
                    yappyLoading ||
                    !canManage ||
                    hasCheckoutMinimumIssue ||
                    Boolean(localYappyIntent) ||
                    !isYappyFormReady
                  }
                  className="mt-4 w-full rounded-[20px] bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition-[background-color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-sky-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 motion-reduce:transition-none dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
                >
                  {localYappyIntent
                    ? "Pago pendiente de revisión"
                    : yappyLoading
                      ? "Registrando..."
                      : "Registrar pago por Yappy"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-app-soft">
        Monexity no almacena datos de tarjeta.
      </p>
    </div>
  );
}
