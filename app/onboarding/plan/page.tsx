import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "../../../lib/supabase/server";
import { selectPlan } from "../actions";
import { PLANS } from "../../../lib/plans/plans";
import type { Plan } from "../../../lib/plans/plans";

type Props = {
  searchParams: Promise<{ cid?: string; billing?: string }>;
};

// ─── Estilos por plan (visual hierarchy clara) ───────────────────────────────

const PLAN_STYLES = {
  emprende: {
    card: [
      "border-white/8 bg-white/[0.03] opacity-90",
      "hover:border-white/[0.13] hover:bg-white/[0.055] hover:opacity-100",
      "hover:shadow-[0_8px_28px_rgba(0,0,0,0.22)]",
    ].join(" "),
    cardPadding: "p-6",
    price: "text-[32px] text-white/80",
    check: "text-white/35",
    cta: [
      "bg-white/[0.08] text-white/65",
      "hover:bg-white/[0.13] hover:text-white/90",
    ].join(" "),
  },
  control: {
    card: [
      "border-sky-500/45 bg-sky-500/[0.07]",
      "ring-1 ring-sky-500/[0.20]",
      "shadow-[0_4px_36px_rgba(56,189,248,0.09)]",
      "hover:border-sky-500/65 hover:bg-sky-500/[0.12]",
      "hover:shadow-[0_14px_52px_rgba(56,189,248,0.18)]",
      "hover:-translate-y-1",
    ].join(" "),
    cardPadding: "p-7 sm:p-8",
    price: "text-[40px] text-white",
    check: "text-sky-400",
    cta: [
      "bg-sky-500 text-white",
      "shadow-[0_4px_18px_rgba(56,189,248,0.30)]",
      "hover:bg-sky-400 hover:shadow-[0_6px_22px_rgba(56,189,248,0.40)]",
    ].join(" "),
  },
  equipo: {
    card: [
      "border-violet-400/20 bg-violet-500/[0.04]",
      "hover:border-violet-400/32 hover:bg-violet-500/[0.08]",
      "hover:shadow-[0_8px_32px_rgba(139,92,246,0.12)]",
    ].join(" "),
    cardPadding: "p-6",
    price: "text-[32px] text-white/85",
    check: "text-violet-400",
    cta: [
      "border border-violet-500/28 bg-violet-500/[0.14] text-violet-200",
      "hover:bg-violet-500/[0.22] hover:border-violet-400/40 hover:text-violet-100",
    ].join(" "),
  },
} as const;

// ─── Componentes ─────────────────────────────────────────────────────────────

function CheckIcon({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${className}`}
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/20" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PlanBadge({ plan }: { plan: Plan }) {
  if (plan.highlight) {
    return (
      <div className="mb-4 flex items-center gap-2">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-55" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.10em] text-sky-300">
          Más elegido
        </span>
      </div>
    );
  }
  if (plan.multiUser) {
    return (
      <div className="mb-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.10em] text-violet-300/80">
          Para equipos
        </span>
      </div>
    );
  }
  // Emprende — espacio para mantener alineación
  return <div className="mb-4 h-4" aria-hidden="true" />;
}

function PlanCard({ plan, isAnnual, cid }: { plan: Plan; isAnnual: boolean; cid: string }) {
  const styles = PLAN_STYLES[plan.id as keyof typeof PLAN_STYLES];
  const mainPrice = isAnnual ? plan.priceAnnualMonthlyEquiv : plan.priceMonthly;

  return (
    <form action={selectPlan}>
      <input type="hidden" name="companyId" value={cid} />
      <input type="hidden" name="plan" value={plan.id} />
      <input type="hidden" name="billing" value={isAnnual ? "annual" : "monthly"} />

      <button
        type="submit"
        className={[
          "flex w-full flex-col rounded-[28px] border text-left",
          styles.card,
          styles.cardPadding,
          "transition-[background-color,border-color,box-shadow,transform,opacity]",
          "duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          "active:scale-[0.983] active:translate-y-0 active:shadow-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25",
          "focus-visible:ring-offset-2 focus-visible:ring-offset-[#090d18]",
        ].join(" ")}
      >
        <PlanBadge plan={plan} />

        <p className="text-[17px] font-semibold text-white">{plan.name}</p>
        <p className="mt-1 text-xs text-white/45">{plan.tagline}</p>

        {/* Precio */}
        <div className="mt-4">
          <div className="flex items-baseline gap-1">
            <span className={`font-bold tracking-tight ${styles.price}`}>
              {mainPrice}
            </span>
            <span className="text-sm text-white/40">/mes</span>
          </div>

          {isAnnual ? (
            <p className="mt-1 text-[11px] text-white/38">
              Facturado a {plan.priceAnnual}/año
              <span className="ml-1.5 font-medium text-emerald-400">
                · {plan.savingsLabel}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-white/0 select-none" aria-hidden="true">
              &nbsp;
            </p>
          )}
        </div>

        {/* Features incluidos */}
        <ul className="mt-5 flex flex-col gap-2.5">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-white/70">
              <CheckIcon className={styles.check} />
              {f}
            </li>
          ))}
          {/* Features NO incluidos — efecto decoy */}
          {plan.notIncluded.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-white/28">
              <CrossIcon />
              {f}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div
          className={[
            "mt-6 rounded-[18px] py-3 text-center text-sm font-semibold",
            styles.cta,
            "transition-[background-color,border-color,box-shadow,color] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          ].join(" ")}
        >
          Seleccionar plan →
        </div>
      </button>
    </form>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default async function PlanPage({ searchParams }: Props) {
  const { cid, billing } = await searchParams;

  if (!cid) redirect("/onboarding");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", cid)
    .maybeSingle();

  if (!membership) redirect("/onboarding");
  if (membership.role !== "owner") redirect("/dashboard");

  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", cid)
    .maybeSingle();

  const isAnnual = billing === "annual";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090d18] px-4 py-8 text-white sm:px-6 lg:px-8">
      {/* Background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[#090d18]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(88,108,210,0.16),transparent_40%)]" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:radial-gradient(rgba(255,255,255,0.9)_0.6px,transparent_0.6px)] [background-size:14px_14px]" />
      </div>

      <div className="relative mx-auto max-w-4xl py-8">

        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.06]">
            <Image
              src="/logo/monexity-mark-dark.svg"
              alt="Monexity"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
              priority
            />
          </div>
        </div>

        {/* Header */}
        <div className="text-center">
          <div className="mb-3 inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-medium tracking-[0.02em] text-white/70">
            {company?.name ?? "Tu negocio"}
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            Empieza gratis. Escala cuando crezcas.
          </h1>
          <p className="mt-2 text-[15px] text-white/50">
            Prueba Monexity gratis por 7 días. Al finalizar, podrás continuar pagando tu plan mensual o anual.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="mt-6 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-[18px] border border-white/10 bg-white/[0.04] p-1">
            <Link
              href={`/onboarding/plan?cid=${cid}`}
              className={[
                "rounded-[14px] px-5 py-2 text-sm font-medium",
                "transition-[background-color,color] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                !isAnnual
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-white/55 hover:text-white/85",
              ].join(" ")}
            >
              Mensual
            </Link>
            <Link
              href={`/onboarding/plan?cid=${cid}&billing=annual`}
              className={[
                "inline-flex items-center gap-2 rounded-[14px] px-5 py-2 text-sm font-medium",
                "transition-[background-color,color] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                isAnnual
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-white/55 hover:text-white/85",
              ].join(" ")}
            >
              Anual
              <span
                className={[
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  isAnnual
                    ? "bg-emerald-500/25 text-emerald-700"
                    : "bg-emerald-500/20 text-emerald-300",
                ].join(" ")}
              >
                2 meses gratis
              </span>
            </Link>
          </div>
        </div>

        {/* Plans grid */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3 sm:items-start">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isAnnual={isAnnual}
              cid={cid}
            />
          ))}
        </div>

        {/* Trust / microcopy */}
        <p className="mt-7 text-center text-xs text-white/30">
          Checkout seguro · Cancela cuando quieras · Cambia de plan en cualquier momento
        </p>
      </div>
    </main>
  );
}
