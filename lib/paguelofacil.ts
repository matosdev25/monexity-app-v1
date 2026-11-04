import "server-only";

type PagueloFacilTransaction = {
  codOper?: string;
  status?: number | string;
  authStatus?: string | null;
  amount?: number | string;
  authAmount?: number | string;
  requestPayAmount?: number | string;
  totalPay?: number | string;
  customFields?: unknown;
  urlString?: string | null;
};

const RETURN_PATH = "/api/payments/paguelofacil/return";

const LIVE_API_BASE = "https://api.pfserver.net";
const DEMO_API_BASE = "https://api-sand.pfserver.net";

function getEnv() {
  const cclw = process.env.PAGUELOFACIL_CCLW;
  const apiKey = process.env.PAGUELOFACIL_API_KEY;
  const env = process.env.PAGUELOFACIL_ENV === "demo" ? "demo" : "live";

  if (!cclw || !apiKey) {
    throw new Error("PAGUELOFACIL_ENV_MISSING");
  }

  return {
    cclw,
    apiKey,
    apiBase: env === "demo" ? DEMO_API_BASE : LIVE_API_BASE,
  };
}

export async function createPagueloFacilPaymentLink({
  amount,
  description,
  returnUrl,
  intentId,
}: {
  amount: number;
  description: string;
  returnUrl: string;
  intentId: string;
}) {
  const env = getEnv();
  const checkoutBase = process.env.PAGUELOFACIL_ENV === "demo"
    ? "https://sandbox.paguelofacil.com"
    : "https://secure.paguelofacil.com";
  const fields = new URLSearchParams({
    CCLW: env.cclw,
    CMTN: amount.toFixed(2),
    CDSC: description.slice(0, 150),
    RETURN_URL: Buffer.from(returnUrl, "utf8").toString("hex"),
    PARM_1: intentId,
    EXPIRES_IN: String(24 * 60 * 60),
  });

  const response = await fetch(`${checkoutBase}/LinkDeamon.cfm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: fields,
    cache: "no-store",
  });
  const data = await response.json().catch(() => null) as {
    success?: boolean;
    data?: { url?: string; code?: string };
  } | null;

  if (!response.ok || !data?.success || !data.data?.url) {
    throw new Error("PAGUELOFACIL_CHECKOUT_FAILED");
  }

  return {
    checkoutUrl: data.data.url,
    providerReference: data.data.code ?? null,
  };
}

export async function findPagueloFacilTransaction(codOper: string) {
  const env = getEnv();
  const url = new URL(`${env.apiBase}/PFManagementServices/api/v1/MerchantTransactions`);
  url.searchParams.set("filter", `codOper::${codOper}`);
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      Authorization: env.apiKey,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => null) as {
    success?: boolean;
    data?: PagueloFacilTransaction[];
  } | null;

  if (!response.ok || !Array.isArray(data?.data)) {
    throw new Error("PAGUELOFACIL_VERIFY_FAILED");
  }

  return data.data[0] ?? null;
}

// La URL de retorno se genera en el servidor por intent y el proveedor la
// devuelve en urlString desde su API autenticada: vincula transacción e intent.
export function isPagueloFacilTransactionLinkedToIntent(
  tx: PagueloFacilTransaction | null,
  codOper: string,
  intentId: string
) {
  if (!tx || String(tx.codOper ?? "") !== codOper || !tx.urlString) return false;

  try {
    const url = new URL(tx.urlString);
    return url.pathname === RETURN_PATH && url.searchParams.get("intent") === intentId;
  } catch {
    return false;
  }
}

export function isApprovedPagueloFacilTransaction(tx: PagueloFacilTransaction | null, amount: number) {
  if (!tx) return false;
  const paidAmount = Number(tx.totalPay ?? tx.authAmount ?? tx.amount ?? tx.requestPayAmount ?? 0);
  const status = String(tx.status ?? "");
  const authStatus = String(tx.authStatus ?? "");

  return (
    Math.abs(paidAmount - amount) < 0.01 &&
    (status === "1" || authStatus === "00")
  );
}

// Regla de Monexity, no del proveedor: vive en lib/billing/plans.
// Se reexporta por compatibilidad con los importadores existentes.
export { getPlanAmount } from "./billing/plans";
