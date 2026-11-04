import "server-only";

import { getTilopayConfig, type TilopayConfig } from "./config";
import { TilopayRequestError, TilopayTimeoutError } from "./core";

// Cliente HTTP server-side de Tilopay. Nunca registra credenciales, tokens ni
// cuerpos de respuesta en logs.

const REQUEST_TIMEOUT_MS = 15_000;
// Margen para renovar antes de que el token (24 h según la documentación) expire.
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

type CachedToken = { value: string; expiresAt: number; cacheKey: string };

let cachedToken: CachedToken | null = null;
let pendingLogin: Promise<CachedToken> | null = null;

function tokenCacheKey(config: TilopayConfig) {
  return `${config.baseUrl}|${config.apiUser}`;
}

async function postJson(
  config: TilopayConfig,
  path: string,
  body: Record<string, unknown>,
  operation: string,
  token: string | null
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    return { status: response.status, data };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new TilopayTimeoutError(operation);
    }
    throw new TilopayRequestError(operation, null, "network_error");
  } finally {
    clearTimeout(timer);
  }
}

async function login(config: TilopayConfig): Promise<CachedToken> {
  const { status, data } = await postJson(
    config,
    "/api/v1/login",
    { apiuser: config.apiUser, password: config.apiPassword },
    "login",
    null
  );

  const token = typeof data?.access_token === "string" ? data.access_token : "";
  if (status !== 200 || !token) {
    throw new TilopayRequestError("login", status, data?.error ? "unauthorized" : null);
  }

  const expiresIn = Number(data?.expires_in);
  const lifetimeMs = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn * 1000 : 60 * 60 * 1000;

  return {
    value: token,
    expiresAt: Date.now() + lifetimeMs - TOKEN_REFRESH_MARGIN_MS,
    cacheKey: tokenCacheKey(config),
  };
}

async function getToken(config: TilopayConfig, forceRefresh = false) {
  const key = tokenCacheKey(config);
  if (!forceRefresh && cachedToken && cachedToken.cacheKey === key && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  if (!pendingLogin) {
    pendingLogin = login(config)
      .then((token) => {
        cachedToken = token;
        return token;
      })
      .finally(() => {
        pendingLogin = null;
      });
  }

  return (await pendingLogin).value;
}

function isUnauthorized(status: number, data: Record<string, unknown> | null) {
  return status === 401 || data?.error === "Unauthorized";
}

// Llamada autenticada. Ante 401 renueva el token y reintenta UNA vez: un 401
// significa que Tilopay rechazó la autenticación antes de procesar la operación.
async function authorizedPost(path: string, body: Record<string, unknown>, operation: string) {
  const config = getTilopayConfig();
  let token = await getToken(config);
  let result = await postJson(config, path, body, operation, token);

  if (isUnauthorized(result.status, result.data)) {
    cachedToken = null;
    token = await getToken(config, true);
    result = await postJson(config, path, body, operation, token);
  }

  return { config, ...result };
}

export async function tilopayProcessPayment(buildBody: (apiKey: string) => Record<string, unknown>) {
  const config = getTilopayConfig();
  const { status, data } = await authorizedPost("/api/v1/processPayment", buildBody(config.apiKey), "processPayment");
  const url = typeof data?.url === "string" ? data.url : "";

  if (status !== 200 || String(data?.type ?? "") !== "100" || !/^https:\/\//.test(url)) {
    throw new TilopayRequestError("processPayment", status, data?.type != null ? String(data.type) : null);
  }

  return { url };
}

// Devuelve el cuerpo crudo: la evaluación (core.evaluateTilopayConsult) decide.
export async function tilopayConsult(orderNumber: string) {
  const config = getTilopayConfig();
  const { data } = await authorizedPost(
    "/api/v1/consult",
    { key: config.apiKey, orderNumber },
    "consult"
  );
  return data;
}

export async function tilopayRecurrentUrl(remotePlanId: string, email: string) {
  const config = getTilopayConfig();
  const { status, data } = await authorizedPost(
    "/api/v1/recurrentUrl",
    { key: config.apiKey, id: remotePlanId, email },
    "recurrentUrl"
  );

  const urlRegister = typeof data?.url_register === "string" ? data.url_register : "";
  const urlRenew = typeof data?.url_renew === "string" ? data.url_renew : "";
  if (status !== 200 || String(data?.type ?? "") !== "200" || (!urlRegister && !urlRenew)) {
    throw new TilopayRequestError("recurrentUrl", status, data?.type != null ? String(data.type) : null);
  }

  return { urlRegister: urlRegister || null, urlRenew: urlRenew || null };
}
