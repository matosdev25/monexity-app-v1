import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  MINIMUM_DISCOUNTED_PAYMENT,
  MINIMUM_DISCOUNTED_PAYMENT_MESSAGE,
} from "@/lib/discounts/constants";

export type DiscountBillingCycle = "monthly" | "annual";

export type DiscountCodeValidation =
  | {
      ok: true;
      code: string;
      discountType: "percentage" | "fixed";
      discountValue: number;
      discountAmount: number;
      finalAmount: number;
      message: string;
    }
  | {
      ok: false;
      code?: string;
      message: string;
    };

export function normalizeDiscountCode(rawCode: string) {
  return rawCode.trim().toUpperCase();
}

export async function validateDiscountCodeForAmount(
  rawCode: string,
  billingCycle: DiscountBillingCycle,
  baseAmount: number
): Promise<DiscountCodeValidation> {
  const code = normalizeDiscountCode(rawCode);
  if (!code) return { ok: false, message: "Ingresa un código." };

  const admin = createAdminClient();
  const { data: discount, error } = await admin
    .from("discount_codes")
    .select("code, discount_type, discount_value, applies_to, starts_at, expires_at, max_uses, used_count, is_active")
    .eq("code", code)
    .maybeSingle();

  if (error || !discount || !discount.is_active) {
    return { ok: false, code, message: "El código no es válido o no está activo." };
  }

  const now = Date.now();
  if (discount.starts_at && new Date(discount.starts_at).getTime() > now) {
    return { ok: false, code, message: "Este código todavía no está vigente." };
  }

  if (discount.expires_at && new Date(discount.expires_at).getTime() < now) {
    return { ok: false, code, message: "Este código ya expiró." };
  }

  if (discount.max_uses !== null && Number(discount.used_count) >= Number(discount.max_uses)) {
    return { ok: false, code, message: "Este código alcanzó su límite de usos." };
  }

  const appliesTo = String(discount.applies_to ?? "both");
  const normalizedCycle = billingCycle === "annual" ? "yearly" : "monthly";
  if (appliesTo !== "both" && appliesTo !== normalizedCycle) {
    return { ok: false, code, message: "Este código no aplica al ciclo seleccionado." };
  }

  const discountType = discount.discount_type as "percentage" | "fixed";
  const discountValue = Number(discount.discount_value);
  if (
    !Number.isFinite(discountValue) ||
    discountValue <= 0 ||
    (discountType === "percentage" && discountValue >= 100)
  ) {
    return { ok: false, code, message: "El descuento configurado no es válido." };
  }

  const rawDiscount = discountType === "percentage"
    ? baseAmount * (discountValue / 100)
    : discountValue;
  const discountAmount = Number(Math.min(baseAmount, rawDiscount).toFixed(2));
  const finalAmount = Number((baseAmount - discountAmount).toFixed(2));

  if (finalAmount < MINIMUM_DISCOUNTED_PAYMENT) {
    return { ok: false, code, message: MINIMUM_DISCOUNTED_PAYMENT_MESSAGE };
  }

  return {
    ok: true,
    code,
    discountType,
    discountValue,
    discountAmount,
    finalAmount,
    message: "Código aplicado correctamente.",
  };
}
