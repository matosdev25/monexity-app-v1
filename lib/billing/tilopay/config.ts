import "server-only";

import type { BillingCycle } from "@/lib/billing/types";
import { PLANS } from "@/lib/plans/plans";
import {
  getTilopayRemotePlanEnvName,
  TilopayConfigError,
  type TilopayEnvironment,
} from "./core";

export type TilopayConfig = {
  baseUrl: string;
  apiUser: string;
  apiPassword: string;
  apiKey: string;
  expectedEnvironment: TilopayEnvironment;
};

// Credenciales exclusivamente server-side. Nunca usar prefijo NEXT_PUBLIC_ ni
// persistirlas en Supabase. Los errores nombran variables, nunca valores.
export function getTilopayConfig(): TilopayConfig {
  const baseUrl = (process.env.TILOPAY_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const apiUser = process.env.TILOPAY_API_USER ?? "";
  const apiPassword = process.env.TILOPAY_API_PASSWORD ?? "";
  const apiKey = process.env.TILOPAY_API_KEY ?? "";
  const expected = (process.env.TILOPAY_EXPECTED_ENV ?? "").trim().toUpperCase();

  const missing = [
    !baseUrl && "TILOPAY_API_BASE_URL",
    !apiUser && "TILOPAY_API_USER",
    !apiPassword && "TILOPAY_API_PASSWORD",
    !apiKey && "TILOPAY_API_KEY",
    !expected && "TILOPAY_EXPECTED_ENV",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new TilopayConfigError(`Tilopay no está configurado. Faltan: ${missing.join(", ")}.`);
  }

  if (!/^https:\/\/[^\s/]+$/.test(baseUrl)) {
    throw new TilopayConfigError("TILOPAY_API_BASE_URL debe ser un origen https (ej. https://app.tilopay.com).");
  }

  if (expected !== "TEST" && expected !== "PROD") {
    throw new TilopayConfigError("TILOPAY_EXPECTED_ENV debe ser TEST o PROD.");
  }

  return { baseUrl, apiUser, apiPassword, apiKey, expectedEnvironment: expected };
}

// Mapa plan + ciclo → id del plan recurrente remoto en Tilopay.
// Se configura por entorno (TILOPAY_PLAN_ID_<PLAN>_<CICLO>); nunca se inventa.
// Inverso del mapa: id remoto → plan + ciclo locales (o null si no está configurado).
export function findTilopayLocalPlan(remotePlanId: string | null) {
  if (!remotePlanId) return null;
  for (const plan of PLANS) {
    for (const billingCycle of ["monthly", "annual"] as const) {
      const value = (process.env[getTilopayRemotePlanEnvName(plan.id, billingCycle)] ?? "").trim();
      if (value && value === remotePlanId) return { planId: plan.id, billingCycle };
    }
  }
  return null;
}

export function getTilopayRemotePlanId(planId: string, billingCycle: BillingCycle) {
  const envName = getTilopayRemotePlanEnvName(planId, billingCycle);
  const value = (process.env[envName] ?? "").trim();

  if (!value) {
    throw new TilopayConfigError(
      `Falta el id del plan recurrente de Tilopay para ${planId}/${billingCycle}. Configura ${envName} con el id devuelto por createPlanRepeat.`
    );
  }

  if (!/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
    throw new TilopayConfigError(`${envName} tiene un formato inválido.`);
  }

  return value;
}
