"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateDiscountCodeForAmount } from "@/lib/discounts/validate-discount-code";
import { getPlanAmount } from "@/lib/paguelofacil";
import { PLAN_MAP } from "@/lib/plans/plans";
import {
  MINIMUM_DISCOUNTED_PAYMENT,
  MINIMUM_DISCOUNTED_PAYMENT_MESSAGE,
} from "@/lib/discounts/constants";

type BillingCycle = "monthly" | "annual";
type SubscriptionActionResult = { success: boolean; error?: string };
type YappyPaymentResult =
  | {
      success: true;
      message: string;
      intent: {
        id: string;
        exactAmount: number;
        planId: string;
        billingCycle: BillingCycle;
      };
    }
  | { success: false; error: string };

async function canManageSubscription(companyId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !companyId) return false;

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .maybeSingle();

  return String(membership?.role ?? "").toLowerCase() === "owner";
}

export async function cancelScheduledSubscriptionChange(
  companyId: string
): Promise<SubscriptionActionResult> {
  if (!(await canManageSubscription(companyId))) {
    return { success: false, error: "No tienes permisos para cambiar esta suscripción." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("companies")
    .update({
      scheduled_subscription_plan: null,
      scheduled_subscription_billing_cycle: null,
      scheduled_subscription_change_at: null,
    })
    .eq("id", companyId);

  if (error) {
    return { success: false, error: "No se pudo cancelar el cambio programado." };
  }

  return { success: true };
}

export type DiscountValidationResult =
  | {
      ok: true;
      code: string;
      discountType: "percentage" | "fixed";
      discountValue: number;
      baseAmount: number;
      discountAmount: number;
      finalAmount: number;
      message: string;
    }
  | {
      ok: false;
      code?: string;
      message: string;
    };

export async function validateDiscountCode(
  companyId: string,
  planId: string,
  billingCycle: BillingCycle,
  rawCode: string
): Promise<DiscountValidationResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    return { ok: false, message: "Ingresa un código." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Inicia sesión para validar el código." };
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("company_id, role")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return { ok: false, message: "No tienes acceso a este negocio." };
  }

  const role = String(membership.role ?? "").toLowerCase();
  if (role !== "owner") {
    return { ok: false, message: "No tienes permisos para aplicar descuentos." };
  }

  const admin = createAdminClient();
  const { data: company } = await admin
    .from("companies")
    .select("subscription_status, subscription_plan, subscription_billing_cycle, trial_ends_at")
    .eq("id", companyId)
    .maybeSingle();

  if (!PLAN_MAP[planId]) {
    return { ok: false, code, message: "Selecciona un plan válido." };
  }

  if (
    company?.subscription_status === "trialing" &&
    company.trial_ends_at &&
    new Date(company.trial_ends_at).getTime() > Date.now()
  ) {
    return { ok: false, code, message: "Podrás aplicar el código cuando finalice tu prueba gratis." };
  }

  const baseAmount = getPlanAmount(PLAN_MAP[planId], billingCycle);
  const validation = await validateDiscountCodeForAmount(code, billingCycle, baseAmount);

  return validation.ok
    ? { ...validation, baseAmount }
    : validation;
}

export async function createYappyManualPayment(
  companyId: string,
  rawSenderName: string,
  rawSenderPhone: string,
  selectedPlanId: string,
  selectedBillingCycle: BillingCycle,
  rawDiscountCode?: string
): Promise<YappyPaymentResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Inicia sesión para continuar." };

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .maybeSingle();

  const role = String(membership?.role ?? "").toLowerCase();
  if (role !== "owner") {
    return { success: false, error: "No tienes permisos para gestionar la facturación." };
  }

  const senderName = rawSenderName.trim();
  const senderPhone = rawSenderPhone.trim();
  if (senderName.length < 3 || senderName.length > 120) {
    return { success: false, error: "Ingresa el nombre de quien enviará el Yappy." };
  }
  if (!/^[0-9+\-\s()]{7,24}$/.test(senderPhone)) {
    return { success: false, error: "Ingresa un número Yappy válido." };
  }

  const admin = createAdminClient();
  const { data: company } = await admin
    .from("companies")
    .select("subscription_status, subscription_plan, subscription_billing_cycle, trial_ends_at")
    .eq("id", companyId)
    .maybeSingle();

  if (!company) {
    return { success: false, error: "No se encontró el negocio." };
  }

  if (!PLAN_MAP[selectedPlanId] || !["monthly", "annual"].includes(selectedBillingCycle)) {
    return { success: false, error: "Selecciona un plan válido." };
  }

  const currentStatus = String(company.subscription_status ?? "").toLowerCase();
  const hasPaidAccess = ["active", "paid"].includes(currentStatus);
  const hasValidTrial = Boolean(
    currentStatus === "trialing" &&
      company.trial_ends_at &&
      new Date(company.trial_ends_at).getTime() > Date.now()
  );

  if (hasPaidAccess || hasValidTrial) {
    return { success: false, error: "Tu membresía aún está activa." };
  }

  const planId = selectedPlanId;
  const billingCycle = selectedBillingCycle;
  const plan = PLAN_MAP[planId];
  let exactAmount = getPlanAmount(plan, billingCycle);
  let discountCodeId: string | null = null;
  let appliedDiscountCode: string | null = null;
  let discountAmount = 0;
  const discountCode = String(rawDiscountCode ?? "").trim().toUpperCase();

  if (discountCode) {
    const validation = await validateDiscountCodeForAmount(
      discountCode,
      billingCycle,
      exactAmount
    );

    if (!validation.ok) {
      return { success: false, error: validation.message };
    }

    const { data: discount, error: discountError } = await admin
      .from("discount_codes")
      .select("id")
      .eq("code", validation.code)
      .maybeSingle();

    if (discountError || !discount?.id) {
      return { success: false, error: "No se pudo aplicar el código de descuento." };
    }

    discountCodeId = discount.id;
    appliedDiscountCode = validation.code;
    discountAmount = validation.discountAmount;
    exactAmount = validation.finalAmount;

    if (exactAmount < MINIMUM_DISCOUNTED_PAYMENT) {
      return { success: false, error: MINIMUM_DISCOUNTED_PAYMENT_MESSAGE };
    }
  }

  const { data: existingIntent } = await admin
    .from("payment_intents")
    .select("id, exact_amount, plan_id, billing_cycle")
    .eq("company_id", companyId)
    .eq("provider", "yappy_manual")
    .eq("status", "manual_review")
    .eq("plan_id", planId)
    .eq("billing_cycle", billingCycle)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingIntent?.id) {
    return {
      success: true,
      message: "Ya tienes un pago por Yappy pendiente de revisión.",
      intent: {
        id: existingIntent.id,
        exactAmount: Number(existingIntent.exact_amount),
        planId: existingIntent.plan_id,
        billingCycle: existingIntent.billing_cycle as BillingCycle,
      },
    };
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: intent, error } = await admin
    .from("payment_intents")
    .insert({
      company_id: companyId,
      user_id: user.id,
      plan_id: planId,
      billing_cycle: billingCycle,
      exact_amount: exactAmount,
      provider: "yappy_manual",
      status: "manual_review",
      expires_at: expiresAt,
      discount_code_id: discountCodeId,
      discount_code: appliedDiscountCode,
      discount_amount: discountAmount,
      raw_response: {
        provider: "yappy_manual",
        yappy_number: "6601-7105",
        sender_name: senderName,
        sender_phone: senderPhone,
        submitted_at: new Date().toISOString(),
      },
    })
    .select("id, exact_amount, plan_id, billing_cycle")
    .single();

  if (error || !intent?.id) {
    return { success: false, error: "No se pudo registrar el pago por Yappy." };
  }

  return {
    success: true,
    message: "Pago por Yappy pendiente de revisión.",
    intent: {
      id: intent.id,
      exactAmount: Number(intent.exact_amount),
      planId: intent.plan_id,
      billingCycle: intent.billing_cycle as BillingCycle,
    },
  };
}
