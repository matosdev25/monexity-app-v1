"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "../../../lib/supabase/server";
import { PLAN_MAP } from "../../../lib/plans/plans";
import type { CompanyPaymentMethod, UpdateBusinessState } from "./types";

// ── Payment Methods ──────────────────────────────────────────────

export type { CompanyPaymentMethod } from "./types";

type PMResult = { success: boolean; error?: string };
export type CancelMembershipResult = { success: boolean; error?: string };

const VALID_PM_TYPES = ["cash", "yappy", "transfer", "card", "other"] as const;

async function getPMContext(companyId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, authorized: false as const };
  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .maybeSingle();
  const role = String(membership?.role ?? "").toLowerCase();
  return { supabase, authorized: ALLOWED_ROLES.has(role) };
}

export async function fetchPaymentMethods(
  companyId: string
): Promise<CompanyPaymentMethod[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_payment_methods")
    .select("id, type, label, details, is_active, sort_order")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true });
  return (data ?? []) as CompanyPaymentMethod[];
}

export async function createPaymentMethod(formData: FormData): Promise<PMResult> {
  const companyId = String(formData.get("companyId") ?? "");
  const type = String(formData.get("type") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim() || null;

  if (!label) return { success: false, error: "El nombre es requerido." };
  if (!(VALID_PM_TYPES as readonly string[]).includes(type))
    return { success: false, error: "Tipo inválido." };

  const { supabase, authorized } = await getPMContext(companyId);
  if (!authorized) return { success: false, error: "Sin permisos." };

  const { data: last } = await supabase
    .from("company_payment_methods")
    .select("sort_order")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (last?.sort_order ?? -1) + 1;

  const { error } = await supabase
    .from("company_payment_methods")
    .insert({ company_id: companyId, type, label, details, sort_order: nextOrder });

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/mi-negocio");
  return { success: true };
}

export async function updatePaymentMethod(formData: FormData): Promise<PMResult> {
  const id = String(formData.get("id") ?? "");
  const companyId = String(formData.get("companyId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim() || null;

  if (!label) return { success: false, error: "El nombre es requerido." };

  const { supabase, authorized } = await getPMContext(companyId);
  if (!authorized) return { success: false, error: "Sin permisos." };

  const { error } = await supabase
    .from("company_payment_methods")
    .update({ label, details })
    .eq("id", id)
    .eq("company_id", companyId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/mi-negocio");
  return { success: true };
}

export async function togglePaymentMethod(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const companyId = String(formData.get("companyId") ?? "");

  const { supabase, authorized } = await getPMContext(companyId);
  if (!authorized) return;

  const { data: current } = await supabase
    .from("company_payment_methods")
    .select("is_active")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!current) return;

  await supabase
    .from("company_payment_methods")
    .update({ is_active: !current.is_active })
    .eq("id", id)
    .eq("company_id", companyId);

  revalidatePath("/dashboard/mi-negocio");
}

export async function deletePaymentMethod(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const companyId = String(formData.get("companyId") ?? "");

  const { supabase, authorized } = await getPMContext(companyId);
  if (!authorized) return;

  await supabase
    .from("company_payment_methods")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);

  revalidatePath("/dashboard/mi-negocio");
}

export async function movePaymentMethod(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const companyId = String(formData.get("companyId") ?? "");
  const direction = String(formData.get("direction") ?? "");

  const { supabase, authorized } = await getPMContext(companyId);
  if (!authorized) return;

  const { data: methods } = await supabase
    .from("company_payment_methods")
    .select("id, sort_order")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true });

  if (!methods || methods.length < 2) return;

  const idx = methods.findIndex((m) => m.id === id);
  if (idx === -1) return;

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= methods.length) return;

  const a = methods[idx];
  const b = methods[swapIdx];

  await Promise.all([
    supabase
      .from("company_payment_methods")
      .update({ sort_order: b.sort_order })
      .eq("id", a.id)
      .eq("company_id", companyId),
    supabase
      .from("company_payment_methods")
      .update({ sort_order: a.sort_order })
      .eq("id", b.id)
      .eq("company_id", companyId),
  ]);

  revalidatePath("/dashboard/mi-negocio");
}

// ── Business Settings ────────────────────────────────────────────

export type { UpdateBusinessState } from "./types";

const ALLOWED_ROLES = new Set(["admin", "owner"]);
const OWNER_ONLY_ROLES = new Set(["owner"]);
const LOGO_BUCKET = "company-assets";
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
]);

function normalizeText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function normalizeBooleanString(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toLowerCase();
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function cancelMembership(
  companyId: string
): Promise<CancelMembershipResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, error: "Debes iniciar sesión para cancelar la membresía." };
  }

  if (!companyId) {
    return { success: false, error: "No se pudo identificar el negocio." };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("company_id, role")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (membershipError || !membership?.company_id) {
    return { success: false, error: "No tienes acceso a este negocio." };
  }

  const role = String(membership.role ?? "").trim().toLowerCase();
  if (!OWNER_ONLY_ROLES.has(role)) {
    return { success: false, error: "No tienes permisos para cancelar esta membresía." };
  }

  const { data: updatedCompany, error: updateError } = await supabase
    .from("companies")
    .update({
      subscription_cancel_at_period_end: true,
      subscription_cancelled_at: new Date().toISOString(),
    })
    .eq("id", companyId)
    .select("id")
    .maybeSingle();

  if (updateError || !updatedCompany) {
    return { success: false, error: "No se pudo cancelar la membresía. Intenta nuevamente." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard/mi-negocio");

  return { success: true };
}

export async function updateBusinessSettings(
  prevState: UpdateBusinessState,
  formData: FormData
): Promise<UpdateBusinessState> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      formError: "Debes iniciar sesión para actualizar tu negocio.",
    };
  }

  const companyId = normalizeText(formData.get("companyId"));
  const profilePhoneRaw = normalizeText(formData.get("profilePhone"));
  const logoUrlInput = normalizeText(formData.get("logoUrl"));
  const logoStoredPath = normalizeText(formData.get("logoStoredPath"));
  const contactFooter = normalizeText(formData.get("contactFooter"));
  const invoiceRuc = normalizeText(formData.get("invoiceRuc")).slice(0, 30);
  const invoiceDv = normalizeText(formData.get("invoiceDv")).slice(0, 5);
  const invoiceAddress = normalizeText(formData.get("invoiceAddress")).slice(0, 200);
  const invoiceEmail = normalizeText(formData.get("invoiceEmail")).slice(0, 120);
  const invoicePhone = normalizeText(formData.get("invoicePhone"));
  const needsInventoryValue = normalizeBooleanString(
    formData.get("needsInventory")
  );

  const logoFileEntry = formData.get("logoFile");
  const logoFile =
    logoFileEntry instanceof File && logoFileEntry.size > 0
      ? logoFileEntry
      : null;

  const fieldErrors: UpdateBusinessState["fieldErrors"] = {};

  if (!companyId) {
    return {
      success: false,
      formError: "No se pudo identificar la empresa a actualizar.",
    };
  }

  if (logoUrlInput && !isValidUrl(logoUrlInput)) {
    fieldErrors.logoUrl = "La URL del logo no es válida.";
  }

  if (logoFile) {
    if (!ALLOWED_LOGO_TYPES.has(logoFile.type)) {
      fieldErrors.logoFile =
        "El logo debe ser PNG, JPG, WEBP o SVG.";
    } else if (logoFile.size > MAX_LOGO_SIZE_BYTES) {
      fieldErrors.logoFile = "El logo no puede superar 2 MB.";
    }
  }

  if (contactFooter.length > 300) {
    fieldErrors.contactFooter =
      "El texto de contacto no puede superar 300 caracteres.";
  }

  const profilePhoneDigits = profilePhoneRaw.replace(/\D/g, "");
  const profilePhone = profilePhoneDigits.length === 0
    ? null
    : profilePhoneDigits.length === 11 && profilePhoneDigits.startsWith("507")
      ? profilePhoneRaw.trim()
      : null;

  if (profilePhoneRaw && !profilePhone) {
    fieldErrors.profilePhone = "Ingresa un número de teléfono válido (8 dígitos).";
  }

  const invoicePhoneDigits = invoicePhone.replace(/\D/g, "");
  const invoicePhoneFinal = invoicePhoneDigits.length === 0
    ? null
    : invoicePhoneDigits.length === 11 && invoicePhoneDigits.startsWith("507")
      ? invoicePhone.trim()
      : null;

  if (!["yes", "no"].includes(needsInventoryValue)) {
    fieldErrors.needsInventory =
      "Debes indicar si el negocio usa inventario.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      fieldErrors,
    };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("company_id, role")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (membershipError) {
    return {
      success: false,
      formError:
        membershipError.message ||
        "No se pudo validar el acceso a la empresa.",
    };
  }

  if (!membership?.company_id) {
    return {
      success: false,
      formError: "No tienes acceso a esta empresa.",
    };
  }

  const normalizedRole = String(membership.role ?? "").trim().toLowerCase();

  if (!ALLOWED_ROLES.has(normalizedRole)) {
    return {
      success: false,
      formError: "No tienes permisos para actualizar esta configuración.",
    };
  }

  let finalLogoUrl: string | null;
  if (logoUrlInput) {
    finalLogoUrl = logoUrlInput;
  } else {
    finalLogoUrl = logoStoredPath || null;
  }

  if (logoFile) {
    const fileExt =
      logoFile.name.split(".").pop()?.toLowerCase() ||
      logoFile.type.split("/").pop() ||
      "png";

    const filePath = `companies/${companyId}/${randomUUID()}.${fileExt}`;

    const arrayBuffer = await logoFile.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(LOGO_BUCKET)
      .upload(filePath, fileBuffer, {
        contentType: logoFile.type,
        upsert: true,
      });

    if (uploadError) {
      return {
        success: false,
        formError: uploadError.message || "No se pudo subir el logo.",
      };
    }

    finalLogoUrl = filePath;
  }

  const needsInventory = needsInventoryValue === "yes";

  // Validate plan allows inventory
  if (needsInventory) {
    const { data: companyRow } = await supabase
      .from("companies")
      .select("subscription_plan")
      .eq("id", companyId)
      .maybeSingle();
    const planConfig = PLAN_MAP[companyRow?.subscription_plan ?? ""];
    if (planConfig && !planConfig.hasInventory) {
      return {
        success: false,
        fieldErrors: {
          needsInventory:
            "Tu plan actual no incluye inventario. Cambia al plan Control o Equipo.",
        },
      };
    }
  }

  const { data: updatedCompany, error: updateError } = await supabase
    .from("companies")
    .update({
      logo_url: finalLogoUrl,
      contact_footer: contactFooter || null,
      needs_inventory: needsInventory,
      invoice_ruc: invoiceRuc || null,
      invoice_dv: invoiceDv || null,
      invoice_address: invoiceAddress || null,
      invoice_email: invoiceEmail || null,
      invoice_phone: invoicePhoneFinal,
    })
    .eq("id", companyId)
    .select("id, name, logo_url")
    .maybeSingle();

  if (updateError) {
    return {
      success: false,
      formError: updateError.message || "No se pudo actualizar la empresa.",
    };
  }

  if (!updatedCompany) {
    return {
      success: false,
      formError:
        "No se pudo actualizar la empresa. Revisa las políticas RLS de companies.",
    };
  }

  await supabase
    .from("profiles")
    .update({ phone: profilePhone })
    .eq("id", user.id);

  revalidatePath("/dashboard/mi-negocio");
  revalidatePath("/dashboard");

  return {
    success: true,
  };
}

// ── Disable Inventory (destructive) ─────────────────────────────

export async function disableInventory(
  companyId: string
): Promise<{ success: boolean; error?: string }> {
  if (!companyId) return { success: false, error: "ID de empresa requerido." };

  const { supabase, authorized } = await getPMContext(companyId);
  if (!authorized) return { success: false, error: "Sin permisos." };

  // Delete all products for the company
  const { error: deleteError } = await supabase
    .from("products")
    .delete()
    .eq("company_id", companyId);

  if (deleteError) return { success: false, error: deleteError.message };

  // Disable inventory flag
  const { error: updateError } = await supabase
    .from("companies")
    .update({ needs_inventory: false })
    .eq("id", companyId);

  if (updateError) return { success: false, error: updateError.message };

  revalidatePath("/dashboard/mi-negocio");
  revalidatePath("/dashboard");
  return { success: true };
}
