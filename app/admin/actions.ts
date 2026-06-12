"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGlobalAdmin } from "@/lib/admin-auth";

type ActionState = {
  success: boolean;
  message: string;
};

const initialError = { success: false, message: "No se pudo guardar el código." };
const missingTableMessage =
  "La tabla discount_codes no existe todavía. Ejecuta el SQL de códigos de descuento en Supabase y vuelve a intentar.";

function normalizeCode(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toUpperCase();
}

function cleanString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function cleanDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseDecimalValue(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export async function createDiscountCode(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireGlobalAdmin();
  const admin = createAdminClient();

  const code = normalizeCode(formData.get("code"));
  const description = cleanString(formData.get("description"));
  const discountType = String(formData.get("discountType") ?? "");
  const appliesTo = String(formData.get("appliesTo") ?? "both");
  const discountValue = parseDecimalValue(formData.get("discountValue"));
  const startsAt = cleanDate(formData.get("startsAt"));
  const expiresAt = cleanDate(formData.get("expiresAt"));
  const maxUsesRaw = String(formData.get("maxUses") ?? "").trim();
  const maxUses = maxUsesRaw ? Number(maxUsesRaw) : null;

  if (!code || code.length < 3 || code.length > 40) {
    return { success: false, message: "El código debe tener entre 3 y 40 caracteres." };
  }

  if (!["percentage", "fixed"].includes(discountType)) {
    return { success: false, message: "Selecciona un tipo de descuento válido." };
  }

  if (!["monthly", "yearly", "both"].includes(appliesTo)) {
    return { success: false, message: "Selecciona una aplicación válida." };
  }

  if (discountValue === null) {
    return { success: false, message: "Ingresa un valor de descuento válido con máximo 2 decimales." };
  }

  if (discountType === "percentage" && (discountValue <= 0 || discountValue > 99.99)) {
    return { success: false, message: "El porcentaje debe ser mayor a 0 y máximo 99.99." };
  }

  if (discountType === "fixed" && discountValue <= 0) {
    return { success: false, message: "El monto debe ser mayor a 0." };
  }

  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 0)) {
    return { success: false, message: "El límite de usos debe ser un número entero." };
  }

  const { error } = await admin.from("discount_codes").insert({
    code,
    description,
    discount_type: discountType,
    discount_value: discountValue,
    applies_to: appliesTo,
    starts_at: startsAt,
    expires_at: expiresAt,
    max_uses: maxUses,
    created_by: user.id,
    is_active: true,
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, message: "Ya existe un código con ese nombre." };
    }

    if (error.code === "PGRST205" || error.code === "42P01") {
      return { success: false, message: missingTableMessage };
    }

    if (error.code === "23514") {
      return { success: false, message: "El código no cumple una validación de la base de datos." };
    }

    return initialError;
  }

  revalidatePath("/admin/discount-codes");
  return { success: true, message: "Código creado correctamente." };
}

export async function toggleDiscountCode(formData: FormData) {
  await requireGlobalAdmin();
  const admin = createAdminClient();

  const id = String(formData.get("id") ?? "").trim();
  const isActive = String(formData.get("isActive") ?? "") === "true";

  if (!id) return;

  if (!isActive) {
    const { data: discountCode } = await admin
      .from("discount_codes")
      .select("discount_type, discount_value")
      .eq("id", id)
      .maybeSingle();

    if (
      discountCode?.discount_type === "percentage" &&
      Number(discountCode.discount_value) >= 100
    ) {
      return;
    }
  }

  await admin
    .from("discount_codes")
    .update({ is_active: !isActive })
    .eq("id", id);

  revalidatePath("/admin/discount-codes");
}

export async function deleteDiscountCode(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireGlobalAdmin();
  const admin = createAdminClient();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { success: false, message: "Código inválido." };

  const { data: discountCode, error: lookupError } = await admin
    .from("discount_codes")
    .select("id, used_count")
    .eq("id", id)
    .maybeSingle();

  if (lookupError || !discountCode?.id) {
    return { success: false, message: "No se encontró el código." };
  }

  if (Number(discountCode.used_count ?? 0) > 0) {
    return {
      success: false,
      message: "Este código ya fue utilizado. Para conservar el historial, puedes desactivarlo.",
    };
  }

  const { count } = await admin
    .from("payment_intents")
    .select("id", { count: "exact", head: true })
    .eq("discount_code_id", id);

  if ((count ?? 0) > 0) {
    return {
      success: false,
      message: "Este código ya fue utilizado. Para conservar el historial, puedes desactivarlo.",
    };
  }

  const { error } = await admin
    .from("discount_codes")
    .delete()
    .eq("id", id);

  if (error) {
    if (error.code === "23503") {
      return {
        success: false,
        message: "Este código ya fue utilizado. Para conservar el historial, puedes desactivarlo.",
      };
    }

    return { success: false, message: "No se pudo eliminar el código." };
  }

  revalidatePath("/admin/discount-codes");
  return { success: true, message: "Código eliminado correctamente." };
}
