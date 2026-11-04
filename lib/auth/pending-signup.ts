import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

// Registro pendiente: el usuario ya fue creado en Supabase Auth (signUp) pero aún no
// confirmó su correo, así que no tiene sesión. La cookie solo identifica a ese usuario
// para completar el onboarding: contiene únicamente su userId, cifrado y autenticado
// (AES-256-GCM), con expiración, y solo se envía a /onboarding. Nunca la contraseña.
export const PENDING_SIGNUP_COOKIE = "pending_signup";
export const PENDING_SIGNUP_PATH = "/onboarding";
export const PENDING_SIGNUP_MAX_AGE_SECONDS = 60 * 30;
// Una cuenta que nunca confirma el correo ni inicia sesión se elimina pasado este
// plazo (cron /api/cron/purge-unconfirmed-signups; política de privacidad).
export const UNCONFIRMED_SIGNUP_RETENTION_DAYS = 7;

export type PendingSignup = { userId: string };

const IV_BYTES = 12;
const TAG_BYTES = 16;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getKey(): Buffer | null {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;
  // Clave derivada y separada por dominio. v2: el formato anterior (con datos del
  // formulario) deja de ser válido y obliga a registrarse de nuevo.
  return createHmac("sha256", secret).update("monexity:pending-signup:v2").digest();
}

export function sealPendingSignup({ userId }: PendingSignup): string | null {
  const key = getKey();
  if (!key || !UUID_REGEX.test(userId)) return null;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = JSON.stringify({
    uid: userId,
    exp: Date.now() + PENDING_SIGNUP_MAX_AGE_SECONDS * 1000,
  });
  const ciphertext = Buffer.concat([cipher.update(body, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

// Devuelve null si la cookie fue alterada, está vencida, es de otro formato o no se
// puede descifrar.
export function openPendingSignup(sealed: string | undefined): PendingSignup | null {
  if (!sealed) return null;
  const key = getKey();
  if (!key) return null;

  try {
    const raw = Buffer.from(sealed, "base64url");
    if (raw.length <= IV_BYTES + TAG_BYTES) return null;

    const iv = raw.subarray(0, IV_BYTES);
    const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES);

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const body = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");

    const parsed = JSON.parse(body) as Record<string, unknown>;
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    if (typeof parsed.uid !== "string" || !UUID_REGEX.test(parsed.uid)) return null;
    // Solo se aceptan exactamente { uid, exp }
    if (Object.keys(parsed).length !== 2) return null;
    return { userId: parsed.uid };
  } catch {
    return null;
  }
}

// Borrado con el mismo path con el que se creó (si no, el navegador conserva la cookie).
export const PENDING_SIGNUP_DELETE_OPTIONS = {
  name: PENDING_SIGNUP_COOKIE,
  path: PENDING_SIGNUP_PATH,
} as const;
