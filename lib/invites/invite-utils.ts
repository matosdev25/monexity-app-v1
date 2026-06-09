// Caracteres ambiguos excluidos: O, 0, I, l, 1, B, 8
const SAFE_CHARS = "ACDEFGHJKMNPQRSTUVWXYZ2345679";

export function randomSuffix(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
  }
  return result;
}

export function normalizeCompanyPrefix(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, "X");
}

export function roleSegment(role: string): string {
  if (role === "owner") return "OWN";
  if (role === "admin") return "ADM";
  return "VEN";
}

export function numericBlock(): string {
  return String(Math.floor(Math.random() * 900) + 100);
}

export function generateInviteCode(companyName: string, role: string): string {
  const prefix = normalizeCompanyPrefix(companyName);
  const num = numericBlock();
  const rol = roleSegment(role);
  const suffix = randomSuffix(4);
  return `${prefix}${num}${rol}${suffix}`;
}

// Normaliza input del usuario para comparar contra DB:
// elimina guiones y espacios, convierte a mayúsculas
export function normalizeInviteCodeInput(raw: string): string {
  return raw.replace(/[-\s]/g, "").toUpperCase();
}

// Formatea código limpio para mostrar: MON056VEN9YT6 → MON-056-VEN-9YT6
export function formatInviteCode(code: string): string {
  if (code.length === 13) {
    return `${code.slice(0, 3)}-${code.slice(3, 6)}-${code.slice(6, 9)}-${code.slice(9)}`;
  }
  return code;
}

// Aplica máscara al input del usuario mientras escribe o pega.
// Acepta cualquier formato y devuelve siempre AAA-999-AAA-AAAA.
// Solo permite alfanuméricos, guiones máximos donde corresponden.
export function maskInviteCodeInput(raw: string): string {
  // Extraer solo alfanuméricos y convertir a mayúsculas
  const clean = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 13);

  // Insertar guiones en posiciones 3, 6, 9
  const parts: string[] = [];

  if (clean.length > 0) parts.push(clean.slice(0, 3));
  if (clean.length > 3) parts.push(clean.slice(3, 6));
  if (clean.length > 6) parts.push(clean.slice(6, 9));
  if (clean.length > 9) parts.push(clean.slice(9, 13));

  return parts.join("-");
}

// Valida que el código tenga el formato visual correcto: AAA-999-AAA-AAAA
export function isValidInviteCodeFormat(masked: string): boolean {
  return /^[A-Z0-9]{3}-[0-9]{3}-[A-Z]{3}-[A-Z0-9]{4}$/.test(masked);
}