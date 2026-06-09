"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { createBusiness, joinViaCode } from "./actions";
import { logout } from "../auth/logout/actions";
import { initialOnboardingState } from "./types";
import { maskInviteCodeInput, normalizeInviteCodeInput } from "../../lib/invites/invite-utils";
import { PLANS } from "../../lib/plans/plans";
import Image from "next/image";

type Step = "choice" | "plan" | "create" | "join";

const labelClass =
  "mb-2 block text-sm font-medium tracking-[-0.01em] text-slate-700 dark:text-white/72";

const baseField =
  "w-full rounded-[22px] border bg-white/80 px-4 py-3.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:bg-white backdrop-blur-xl outline-none transition-[border-color,box-shadow,background-color] duration-[180ms] dark:bg-white/[0.07] dark:text-white dark:placeholder:text-white/32 dark:focus:bg-white/[0.09]";

const normalField = `${baseField} border-slate-200 focus:border-slate-300 focus:shadow-[0_0_0_3px_rgba(15,23,42,0.06)] dark:border-white/10 dark:focus:border-white/16 dark:focus:shadow-[0_0_0_3px_rgba(255,255,255,0.05)]`;

function SubmitBtn({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-[24px] bg-slate-900 px-5 py-4 text-[15px] font-semibold tracking-[-0.01em] text-white shadow-[0_4px_16px_rgba(15,23,42,0.14)] transition-[opacity,transform,background-color] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white dark:text-slate-950 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_8px_24px_rgba(255,255,255,0.08)] dark:hover:bg-white/92"
    >
      {pending && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" className="opacity-20" stroke="currentColor" strokeWidth="3" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {pending ? pendingLabel : label}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-5 inline-flex items-center gap-1.5 rounded-full px-1 py-0.5 text-sm text-slate-400 transition-[color,opacity] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 active:opacity-70 dark:text-white/48 dark:hover:text-white/75 dark:focus-visible:ring-white/20"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Volver
    </button>
  );
}

function LogoutActionButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-full border border-slate-200/80 bg-white/70 px-4 py-2 text-sm font-medium text-slate-500 shadow-[0_2px_10px_rgba(15,23,42,0.06)] backdrop-blur-sm transition-[background-color,border-color,color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-slate-300 hover:bg-white hover:text-slate-700 active:scale-[0.97] active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none dark:border-white/10 dark:bg-white/[0.06] dark:text-white/58 dark:shadow-none dark:hover:border-white/18 dark:hover:bg-white/[0.09] dark:hover:text-white/78 dark:focus-visible:ring-white/20"
    >
      {pending ? "Cerrando..." : "Cerrar sesión"}
    </button>
  );
}

function PlanCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true">
      <path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlanMinusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 dark:text-white/20" aria-hidden="true">
      <path d="M6 12h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("choice");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [inviteDisplay, setInviteDisplay] = useState("");
  const [createState, createAction] = useActionState(createBusiness, initialOnboardingState);
  const [joinState, joinAction] = useActionState(joinViaCode, initialOnboardingState);

  const inviteCodeClean = normalizeInviteCodeInput(inviteDisplay);

  useEffect(() => {
    if (!createState.success) return;
    if (createState.requiresConfirmation) {
      router.push("/auth/check-email");
    } else {
      router.push("/dashboard");
    }
  }, [
    createState.success,
    createState.requiresConfirmation,
    router,
  ]);

  useEffect(() => {
    if (joinState.success && joinState.requiresConfirmation) {
      router.push("/auth/check-email");
    }
  }, [joinState.success, joinState.requiresConfirmation, router]);

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      {/* Background — dark overlay solo en dark mode; light usa gradiente del body */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 dark:bg-[#090d18]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(3,105,161,0.05),transparent_22%),radial-gradient(circle_at_82%_16%,rgba(56,130,246,0.03),transparent_20%)] dark:bg-[radial-gradient(circle_at_18%_14%,rgba(88,108,210,0.14),transparent_20%),radial-gradient(circle_at_82%_16%,rgba(56,130,246,0.10),transparent_18%)]" />
        <div className="absolute inset-0 opacity-[0.018] [background-image:radial-gradient(rgba(15,23,42,0.9)_0.6px,transparent_0.6px)] [background-size:14px_14px] dark:opacity-[0.035] dark:[background-image:radial-gradient(rgba(255,255,255,0.9)_0.6px,transparent_0.6px)]" />
      </div>

      <form action={logout} className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <LogoutActionButton />
      </form>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center justify-center">
        <div className={step === "plan" ? "w-full max-w-5xl" : "w-full max-w-lg"}>

          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[22px] border border-slate-200/80 bg-white/70 shadow-[0_2px_10px_rgba(15,23,42,0.07)] dark:border-white/10 dark:bg-white/[0.06] dark:shadow-none">
              <Image
                src="/logo/monexity-mark-light.svg"
                alt="Monexity"
                width={40}
                height={40}
                className="h-9 w-9 object-contain dark:hidden"
                priority
              />
              <Image
                src="/logo/monexity-mark-dark.svg"
                alt="Monexity"
                width={40}
                height={40}
                className="hidden h-9 w-9 object-contain dark:block"
                priority
              />
            </div>
          </div>

          <div className={step === "plan" ? "" : "rounded-[36px] border border-slate-200/70 bg-white/90 shadow-[0_20px_56px_rgba(15,23,42,0.09)] backdrop-blur-sm dark:border-white/10 dark:bg-[rgba(17,23,38,0.88)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.42)] dark:backdrop-blur-xl"}>
            <div className={step === "plan" ? "py-2" : "p-6 sm:p-8"}>

              {/* PASO: Choice */}
              {step === "choice" && (
                <>
                  <BackButton onClick={() => router.back()} />

                  <div className="animate-mx-fade-up mb-1 inline-flex items-center rounded-full border border-slate-200 bg-slate-100/80 px-3 py-1 text-xs font-medium tracking-[0.02em] text-slate-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/70">
                    Tu negocio
                  </div>
                  <h1 className="animate-mx-fade-up mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-4xl [animation-delay:40ms] dark:text-white">
                    ¿Cómo quieres empezar?
                  </h1>
                  <p className="animate-mx-fade-up mt-2 text-[15px] text-slate-500 [animation-delay:70ms] dark:text-white/55">
                    Puedes crear un negocio nuevo o unirte a uno existente.
                  </p>

                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    {/* Card: Crear negocio */}
                    <button
                      type="button"
                      onClick={() => setStep("plan")}
                      className="animate-mx-fade-up group flex flex-col items-start rounded-[24px] border border-slate-200 bg-white p-5 text-left shadow-[0_2px_8px_rgba(15,23,42,0.05)] [animation-delay:110ms]
                        transition-[background-color,border-color,box-shadow,transform]
                        duration-[180ms]
                        ease-[cubic-bezier(0.16,1,0.3,1)]
                        hover:-translate-y-[3px]
                        hover:border-slate-300
                        hover:bg-slate-50/80
                        hover:shadow-[0_12px_32px_rgba(15,23,42,0.10)]
                        active:translate-y-0
                        active:scale-[0.984]
                        active:shadow-[0_2px_8px_rgba(15,23,42,0.05)]
                        focus-visible:outline-none
                        focus-visible:ring-2
                        focus-visible:ring-[var(--brand)]/40
                        dark:border-white/10
                        dark:bg-white/[0.045]
                        dark:shadow-none
                        dark:hover:border-white/[0.22]
                        dark:hover:bg-white/[0.075]
                        dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.07)]
                        dark:active:shadow-none
                        dark:focus-visible:ring-white/25"
                    >
                      <div
                        className="mb-3 flex h-10 w-10 items-center justify-center rounded-[14px] bg-[color-mix(in_srgb,var(--brand)_14%,transparent)]
                          transition-[background-color,transform]
                          duration-[180ms]
                          ease-[cubic-bezier(0.16,1,0.3,1)]
                          group-hover:bg-[color-mix(in_srgb,var(--brand)_24%,transparent)]
                          group-hover:scale-[1.12]"
                      >
                        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-(--brand)" aria-hidden="true">
                          <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </div>
                      <p className="text-[15px] font-semibold text-slate-900 dark:text-white">Crear negocio</p>
                      <p className="mt-1 text-sm text-slate-500 transition-[color] duration-[180ms] group-hover:text-slate-600 dark:text-white/50 dark:group-hover:text-white/65">
                        Empieza desde cero con tu propia empresa.
                      </p>
                    </button>

                    {/* Card: Unirme con código */}
                    <button
                      type="button"
                      onClick={() => setStep("join")}
                      className="animate-mx-fade-up group flex flex-col items-start rounded-[24px] border border-slate-200 bg-white p-5 text-left shadow-[0_2px_8px_rgba(15,23,42,0.05)] [animation-delay:150ms]
                        transition-[background-color,border-color,box-shadow,transform]
                        duration-[180ms]
                        ease-[cubic-bezier(0.16,1,0.3,1)]
                        hover:-translate-y-[3px]
                        hover:border-slate-300
                        hover:bg-slate-50/80
                        hover:shadow-[0_12px_32px_rgba(15,23,42,0.10)]
                        active:translate-y-0
                        active:scale-[0.984]
                        active:shadow-[0_2px_8px_rgba(15,23,42,0.05)]
                        focus-visible:outline-none
                        focus-visible:ring-2
                        focus-visible:ring-[var(--brand)]/40
                        dark:border-white/10
                        dark:bg-white/[0.045]
                        dark:shadow-none
                        dark:hover:border-white/[0.22]
                        dark:hover:bg-white/[0.075]
                        dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.07)]
                        dark:active:shadow-none
                        dark:focus-visible:ring-white/25"
                    >
                      <div
                        className="mb-3 flex h-10 w-10 items-center justify-center rounded-[14px] bg-[color-mix(in_srgb,var(--brand)_14%,transparent)]
                          transition-[background-color,transform]
                          duration-[180ms]
                          ease-[cubic-bezier(0.16,1,0.3,1)]
                          group-hover:bg-[color-mix(in_srgb,var(--brand)_24%,transparent)]
                          group-hover:scale-[1.12]"
                      >
                        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-(--brand)" aria-hidden="true">
                          <path d="M15 7.5A4.5 4.5 0 1 1 6 7.5 4.5 4.5 0 0 1 15 7.5Z" stroke="currentColor" strokeWidth="1.8" />
                          <path d="M2.5 19.5C2.5 17 5.36 15 9 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <path d="M18 14v6M15 17h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      </div>
                      <p className="text-[15px] font-semibold text-slate-900 dark:text-white">Unirme con código</p>
                      <p className="mt-1 text-sm text-slate-500 transition-[color] duration-[180ms] group-hover:text-slate-600 dark:text-white/50 dark:group-hover:text-white/65">
                        Accede a un negocio con tu código de invitación.
                      </p>
                    </button>
                  </div>
                </>
              )}

              {/* PASO: Seleccionar plan */}
              {step === "plan" && (
                <>
                  <BackButton onClick={() => setStep("choice")} />
                  <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-900 sm:text-3xl dark:text-white">
                    Elige tu plan
                  </h1>
                  <p className="mt-1.5 text-[15px] text-slate-500 dark:text-white/55">
                    Selecciona cómo quieres empezar antes de crear tu negocio.
                  </p>

                  <div className="mt-5 flex justify-center">
                    <div className="inline-grid grid-cols-2 gap-1 rounded-[18px] border border-slate-200 bg-white/80 p-1 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                    {(["monthly", "annual"] as const).map((cycle) => (
                      <button
                        key={cycle}
                        type="button"
                        onClick={() => {
                          setBillingCycle(cycle);
                        }}
                        className={[
                          "rounded-[14px] px-5 py-2.5 text-sm font-semibold transition-[background-color,color,box-shadow,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40",
                          billingCycle === cycle
                            ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950"
                            : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-white/50 dark:hover:bg-white/[0.07] dark:hover:text-white/80",
                        ].join(" ")}
                      >
                        {cycle === "monthly" ? "Mensual" : "Anual"}
                      </button>
                    ))}
                    </div>
                  </div>

                  <div className="mt-8 grid gap-4 md:grid-cols-3 md:items-stretch">
                    {PLANS.map((plan) => {
                      const selected = selectedPlan === plan.id;
                      const price = billingCycle === "annual" ? plan.priceAnnualMonthlyEquiv : plan.priceMonthly;

                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => {
                            setSelectedPlan(plan.id);
                          }}
                          className={[
                            "group relative flex w-full flex-col rounded-[28px] p-6 text-left transition-[background-color,border-color,box-shadow,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2",
                            selected
                              ? "border-2 border-sky-500 bg-white shadow-[0_8px_40px_rgba(14,165,233,0.16)] dark:border-sky-400 dark:bg-slate-900"
                              : plan.highlight
                                ? "border-2 border-sky-300 bg-white shadow-[0_8px_32px_rgba(14,165,233,0.10)] hover:border-sky-500 dark:border-sky-500/60 dark:bg-slate-900"
                                : "border border-slate-200/80 bg-white shadow-[0_2px_16px_rgba(15,23,42,0.06)] hover:border-slate-300 hover:shadow-[0_8px_28px_rgba(15,23,42,0.10)] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700",
                          ].join(" ")}
                        >
                          {plan.highlight && (
                            <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
                              <span className="rounded-full bg-sky-500 px-4 py-1 text-xs font-semibold text-white shadow-sm dark:bg-sky-400 dark:text-slate-900">
                                Más popular
                              </span>
                            </div>
                          )}

                          <div>
                            <p className="font-semibold tracking-tight text-slate-900 dark:text-white">{plan.name}</p>
                            <p className="mt-0.5 min-h-10 text-sm leading-5 text-slate-500 dark:text-slate-400">{plan.tagline}</p>
                            <div className="mt-5 flex items-end gap-1">
                              <span className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">{price}</span>
                              <span className="mb-1 text-sm text-slate-400">/mes</span>
                            </div>
                            <p className="mt-1 min-h-4 text-xs text-slate-400 dark:text-slate-500">
                              {plan.priceAnnual} /año ·{" "}
                              <span className="text-emerald-600 dark:text-emerald-400">{plan.savingsLabel}</span>
                            </p>
                          </div>

                          <ul className="mt-6 flex-1 space-y-2.5">
                            {plan.features.map((feature) => (
                              <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                                <PlanCheckIcon />
                                <span>{feature}</span>
                              </li>
                            ))}
                            {plan.notIncluded.map((feature) => (
                              <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-300 dark:text-slate-600">
                                <PlanMinusIcon />
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>

                          <span className={[
                            "mt-8 inline-flex h-11 w-full items-center justify-center rounded-[18px] text-sm font-semibold transition-[background-color,border-color,color,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                            selected
                              ? "bg-sky-600 text-white dark:bg-sky-500"
                              : plan.highlight
                                ? "bg-sky-600 text-white group-hover:bg-sky-700 dark:bg-sky-500"
                                : "border border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white",
                          ].join(" ")}>
                            {selected ? "Plan seleccionado" : "Elegir plan"}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-slate-500 dark:text-white/55">
                    Prueba Monexity gratis por 7 días. Al finalizar, podrás continuar pagando tu plan mensual o anual.
                  </p>

                  <button
                    type="button"
                    disabled={!selectedPlan}
                    onClick={() => setStep("create")}
                    className="mx-auto mt-5 flex w-full max-w-sm items-center justify-center rounded-[24px] bg-slate-900 px-5 py-4 text-[15px] font-semibold text-white transition-[background-color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
                  >
                    Continuar
                  </button>
                </>
              )}

              {/* PASO: Crear negocio */}
              {step === "create" && (
                <>
                  <BackButton onClick={() => setStep("plan")} />
                  <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-900 sm:text-3xl dark:text-white">
                    Cuéntanos sobre tu negocio
                  </h1>
                  <p className="mt-1.5 text-[15px] text-slate-500 dark:text-white/55">
                    Estos datos se pueden editar después.
                  </p>

                  <form action={createAction} className="mt-6 space-y-4">
                    <input type="hidden" name="plan" value={selectedPlan} />
                    <input type="hidden" name="billing" value={billingCycle} />
                    <div>
                      <label htmlFor="companyName" className={labelClass}>
                        Nombre del negocio
                      </label>
                      <input
                        id="companyName"
                        name="companyName"
                        type="text"
                        required
                        minLength={2}
                        maxLength={120}
                        placeholder="Ej. La Tienda de Carlos"
                        className={normalField}
                      />
                    </div>

                    {createState.message && !createState.success && (
                      <p className="rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-300">
                        {createState.message}
                      </p>
                    )}

                    <div className="pt-1">
                      <SubmitBtn label="Continuar" pendingLabel="Creando..." />
                    </div>
                  </form>
                </>
              )}

              {/* PASO: Unirse con código */}
              {step === "join" && (
                <>
                  <BackButton onClick={() => setStep("choice")} />
                  <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-900 sm:text-3xl dark:text-white">
                    Código de invitación
                  </h1>
                  <p className="mt-1.5 text-[15px] text-slate-500 dark:text-white/55">
                    El administrador del negocio te dará este código.
                  </p>

                  <form action={joinAction} className="mt-6 space-y-4">
                    <input type="hidden" name="inviteCode" value={inviteCodeClean} />
                    <div>
                      <label htmlFor="inviteDisplay" className={labelClass}>
                        Código
                      </label>
                      <input
                        id="inviteDisplay"
                        type="text"
                        autoCapitalize="characters"
                        spellCheck={false}
                        inputMode="text"
                        placeholder="NEG-304-VEN-PVME"
                        value={inviteDisplay}
                        onChange={(e) => setInviteDisplay(maskInviteCodeInput(e.target.value))}
                        className={`${normalField} font-mono tracking-[0.1em]`}
                      />
                    </div>

                    {joinState.message && !joinState.success && (
                      <p className="rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-300">
                        {joinState.message}
                      </p>
                    )}

                    <div className="pt-1">
                      <SubmitBtn label="Unirme al negocio" pendingLabel="Verificando..." />
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
