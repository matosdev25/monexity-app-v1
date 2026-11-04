// Identidad comercial del operador de MONEXITY (Aviso Legal, Privacidad, footer y contacto).
// Fuente: Aviso de Operación N.° 3-737-2051-2026-574457907 (MICI, Panamá Emprende),
// guardado fuera de Git en .private/legal/. Contactos oficiales definidos por el propietario.

export const LEGAL_ENTITY = {
  // Nombre comercial del servicio (definido en PROJECT.md / branding).
  tradeName: "MONEXITY",
  // Titular del Aviso de Operación (persona natural).
  legalName: "Martin Matos Peñafiel" as string | null,
  // Establecimiento comercial declarado en el Aviso de Operación.
  establishmentName: "MatosDev" as string | null,
  ruc: "3-737-2051" as string | null,
  dv: "65" as string | null,
  // Ubicación del establecimiento según el Aviso de Operación.
  address:
    "Calle La Feria, casa A-10, Urbanización Medalla Milagrosa, Corregimiento de Cristóbal Este, Distrito de Colón, Provincia de Colón" as
      | string
      | null,
  // Correo oficial para soporte, privacidad y todo lo relacionado con el proyecto.
  supportEmail: "admin@monexity-app.com" as string | null,
  operationNoticeNumber: "3-737-2051-2026-574457907" as string | null,
  // WhatsApp oficial de soporte y ventas.
  whatsappDisplay: "+507 6745-9439",
  whatsappNumber: "50767459439",
  whatsappHref: "https://wa.me/50767459439",
  country: "Panamá",
} as const;

// Correo oficial normalizado (comparaciones de identidad).
export const OFFICIAL_EMAIL = (LEGAL_ENTITY.supportEmail ?? "").trim().toLowerCase();

// Remitente de todos los correos transaccionales (Resend).
export const EMAIL_SENDER = `Monexity <${OFFICIAL_EMAIL}>`;

export const LEGAL_FIELD_PENDING = "Pendiente de publicación";

export function legalField(value: string | null): string {
  return value && value.trim() ? value : LEGAL_FIELD_PENDING;
}

// RUC y DV en una sola línea; si falta alguno se marca como pendiente.
export function legalRucDv(): string {
  const { ruc, dv } = LEGAL_ENTITY;
  if (!ruc || !dv) return LEGAL_FIELD_PENDING;
  return `${ruc} DV ${dv}`;
}

// Canal para soporte y solicitudes de privacidad: correo (si existe) y WhatsApp.
export function legalContactChannels(): string {
  const { supportEmail, whatsappDisplay } = LEGAL_ENTITY;
  return supportEmail
    ? `correo ${supportEmail} o WhatsApp ${whatsappDisplay}`
    : `WhatsApp ${whatsappDisplay} (correo oficial: ${LEGAL_FIELD_PENDING.toLowerCase()})`;
}
