import Link from "next/link";
import type { Plan } from "@/lib/plans/plans";

type PricingPlansSectionProps = {
  plans: Plan[];
  signupHref: string;
};

const EXTRA_EXCLUDED_FEATURES_BY_PLAN: Record<string, string[]> = {
  emprende: [
    "Equipo",
    "Vendedores o ayudantes",
  ],
  control: ["Equipo", "Vendedores o ayudantes"],
  equipo: [],
};

const INCLUDED_FEATURES_BY_PLAN: Record<string, string[]> = {
  emprende: [
    "Ventas y Gastos",
    "Cotizaciones",
    "Resumen del negocio",
    "Facturas en PDF",
    "Registro de Servicios",
    "Prueba gratis por 7 días",
  ],
  control: [
    "Ventas y Gastos",
    "Cotizaciones",
    "Inventario",
    "Resumen del negocio",
    "Facturas en PDF",
    "Registro de Servicios",
    "Prueba gratis por 7 días",
  ],
  equipo: [
    "Ventas y Gastos",
    "Cotizaciones",
    "Inventario",
    "Resumen del negocio",
    "Facturas en PDF",
    "Registro de Servicios",
    "Equipo",
    "Vendedores o ayudantes ilimitados",
    "Prueba gratis por 7 días",
  ],
};

function IconCheck({ className = "text-emerald-500" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={`h-4 w-4 shrink-0 ${className}`} aria-hidden="true">
      <path d="M3 8.5L6 11.5L13 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconMinus() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" aria-hidden="true">
      <path d="M4 8H12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function displayFeature(feature: string) {
  const normalized = feature.toLowerCase();

  if (normalized.includes("cierre del período")) return "Resumen del negocio";
  if (normalized.includes("inventario de productos")) return "Inventario";
  if (normalized.includes("control completo de stock")) return "Inventario";
  if (normalized.includes("roles:")) return "Vendedores o ayudantes";
  if (normalized.includes("usuarios ilimitados")) return "Vendedores o ayudantes ilimitados";
  if (normalized.includes("ventas, gastos e inventario")) return "Ventas, gastos y productos";

  return feature;
}

function getIncludedFeatures(plan: Plan) {
  return INCLUDED_FEATURES_BY_PLAN[plan.id] ?? plan.features.map(displayFeature);
}

function getExcludedFeatures(plan: Plan) {
  return Array.from(
    new Set([
      ...plan.notIncluded.map(displayFeature),
      ...(EXTRA_EXCLUDED_FEATURES_BY_PLAN[plan.id] ?? []),
    ])
  );
}

export function PricingPlansSection({ plans, signupHref }: PricingPlansSectionProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {plans.map((plan) => {
        const excludedFeatures = getExcludedFeatures(plan);
        const includedFeatures = getIncludedFeatures(plan);

        return (
          <div
            key={plan.id}
            className={[
              "relative flex flex-col rounded-[28px] p-6",
              plan.highlight
                ? "border-2 border-sky-500 bg-white shadow-[0_8px_40px_rgba(14,165,233,0.16)] dark:border-sky-400 dark:bg-slate-900"
                : "border border-slate-200/80 bg-white shadow-[0_2px_16px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900",
            ].join(" ")}
          >
            {plan.highlight && (
              <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
                <span className="rounded-full bg-sky-500 px-4 py-1 text-xs font-semibold text-white shadow-sm dark:bg-sky-400 dark:text-slate-900">
                  Recomendado
                </span>
              </div>
            )}

            <div>
              <p className="font-semibold tracking-tight text-slate-900 dark:text-white">{plan.name}</p>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{plan.tagline}</p>
              <div className="mt-5 flex items-end gap-1">
                <span className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">{plan.priceMonthly}</span>
                <span className="mb-1 text-sm text-slate-400">/mes</span>
              </div>
            </div>

            <Link
              href={signupHref}
              className={[
                "mt-6 inline-flex h-11 w-full items-center justify-center rounded-[18px] text-sm font-semibold transition-[background-color,border-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-[0.98]",
                plan.highlight
                  ? "bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400"
                  : "border border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:border-slate-600",
              ].join(" ")}
            >
              Probar gratis 7 días
            </Link>

            <div className="mt-6 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Incluye
              </p>
              <ul className="mt-3 space-y-2.5">
                {includedFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                    <IconCheck />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {excludedFeatures.length > 0 ? (
                <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-800">
                  <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">
                    No incluye
                  </p>
                  <ul className="mt-3 space-y-2.5">
                    {excludedFeatures.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-400 dark:text-slate-500">
                        <IconMinus />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
