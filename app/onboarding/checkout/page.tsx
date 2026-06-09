import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "../../../lib/supabase/server";
import { PLAN_MAP } from "../../../lib/plans/plans";
import { getPlanAmount } from "../../../lib/paguelofacil";
import { validateDiscountCodeForAmount } from "../../../lib/discounts/validate-discount-code";
import { formatCurrency } from "../../../lib/currency-format";
import { StartPagueloFacilCheckout } from "./start-paguelofacil-checkout";

type Props = {
  searchParams: Promise<{ cid?: string; plan?: string; billing?: string; discount?: string }>;
};

export default async function CheckoutPage({ searchParams }: Props) {
  const { cid, plan: planId, billing, discount } = await searchParams;

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

  if (membership?.role !== "owner") redirect("/onboarding");

  const { data: company } = await supabase
    .from("companies")
    .select("name, subscription_plan")
    .eq("id", cid)
    .maybeSingle();

  const plan = planId ? PLAN_MAP[planId] : null;
  if (!company || !plan || company.subscription_plan !== planId) {
    redirect(`/onboarding/plan?cid=${cid}`);
  }

  if (!["monthly", "annual"].includes(billing ?? "")) {
    redirect(`/onboarding/plan?cid=${cid}`);
  }

  const isAnnual = billing === "annual";
  const billingCycle = billing as "monthly" | "annual";
  const baseAmount = getPlanAmount(plan, billingCycle);
  const discountValidation = discount
    ? await validateDiscountCodeForAmount(discount, billingCycle, baseAmount)
    : null;
  const appliedDiscount = discountValidation?.ok ? discountValidation : null;
  const displayPrice = plan
    ? isAnnual
      ? `${formatCurrency(baseAmount)} / año`
      : `${formatCurrency(baseAmount)} / mes`
    : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090d18] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[#090d18]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(56,200,120,0.10),transparent_40%)]" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:radial-gradient(rgba(255,255,255,0.9)_0.6px,transparent_0.6px)] [background-size:14px_14px]" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center">
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

        <div className="w-full rounded-[36px] border border-white/10 bg-[rgba(17,23,38,0.88)] shadow-[0_24px_80px_rgba(0,0,0,0.42)]">
          <div className="p-6 sm:p-8">
            {/* Resumen */}
            <div className="mb-6 rounded-[20px] border border-white/8 bg-white/[0.04] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                Resumen
              </p>
              <div className="mt-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {company?.name ?? "Tu negocio"}
                  </p>
                  {plan && (
                    <p className="mt-0.5 text-sm text-white/50">
                      Plan {plan.name}
                      {isAnnual ? " · Facturación anual" : " · Facturación mensual"}
                    </p>
                  )}
                </div>
                {displayPrice && (
                  <p className="shrink-0 text-sm font-semibold text-white">
                    {displayPrice}
                  </p>
                )}
              </div>

              {appliedDiscount && (
                <div className="mt-3 rounded-[14px] bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                  <div className="flex items-center justify-between gap-3">
                    <span>Código {appliedDiscount.code}</span>
                    <span className="font-semibold">
                      -{formatCurrency(appliedDiscount.discountAmount)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 border-t border-emerald-400/15 pt-1">
                    <span>Total</span>
                    <span className="font-semibold">{formatCurrency(appliedDiscount.finalAmount)}</span>
                  </div>
                </div>
              )}

              <div className="mt-3 rounded-[14px] bg-amber-500/10 px-3 py-2 text-center text-sm font-medium text-amber-200">
                Pago pendiente
              </div>
            </div>

            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">
              Continúa usando Monexity
            </h1>
            <p className="mt-1.5 text-[15px] leading-relaxed text-white/55">
              Realiza un pago normal con PagueloFácil para continuar con tu plan mensual o anual.
            </p>

            <div className="mt-5 space-y-2 rounded-[18px] border border-white/8 bg-white/[0.035] p-4">
              {[
                "PagueloFácil procesa tu pago de forma segura.",
                "Monexity confirma el pago.",
                "Tu acceso se activa para el período pagado.",
              ].map((item, index) => (
                <div key={item} className="flex items-start gap-3 text-sm text-white/65">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-[11px] font-semibold text-sky-300">
                    {index + 1}
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <StartPagueloFacilCheckout
              companyId={cid}
              planId={plan.id}
              billingCycle={billingCycle}
              discountCode={appliedDiscount?.code}
            />

            <p className="mt-3 text-center text-xs text-white/30">
              No se realizarán cobros automáticos.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
