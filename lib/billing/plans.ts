// Reglas de planes y cobro propias de Monexity, independientes del proveedor.
// El catálogo (nombres, precios, features) vive en lib/plans/plans.ts.
import type { BillingCycle } from "./types";

type PlanPrices = { priceMonthly: string; priceAnnual: string };

// Orden de los planes para distinguir upgrade de downgrade.
export const PLAN_LEVELS: Record<string, number> = {
  emprende: 1,
  control: 2,
  equipo: 3,
};

export function isPlanUpgrade(fromPlanId: string, toPlanId: string) {
  const from = PLAN_LEVELS[fromPlanId];
  const to = PLAN_LEVELS[toPlanId];
  return from !== undefined && to !== undefined && to > from;
}

// Precio del plan para el ciclo, a partir del catálogo.
export function getPlanAmount(plan: PlanPrices, cycle: BillingCycle) {
  const raw = cycle === "annual" ? plan.priceAnnual : plan.priceMonthly;
  return Number(raw.replace(/[^0-9.]/g, ""));
}

// Período que acreditará un pago de renovación. Se calcula al crear el intent y
// se persiste en él; la activación acredita exactamente estas fechas.
// Regla vigente: empieza al terminar el período actual si sigue activo; si no,
// ahora. Duración 30 días (mensual) o 365 días (anual).
export function getNextBillingPeriod(
  currentPeriodEndsAt: string | null,
  billingCycle: BillingCycle
) {
  const now = Date.now();
  const currentEnd = currentPeriodEndsAt ? new Date(currentPeriodEndsAt).getTime() : NaN;
  const start = Number.isFinite(currentEnd) && currentEnd > now ? currentEnd : now;
  const days = billingCycle === "annual" ? 365 : 30;

  return {
    periodStart: new Date(start).toISOString(),
    periodEnd: new Date(start + days * 86_400_000).toISOString(),
  };
}
