import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  validateDiscountCodeForAmount,
} from "@/lib/discounts/validate-discount-code";
import {
  MINIMUM_DISCOUNTED_PAYMENT,
  MINIMUM_DISCOUNTED_PAYMENT_MESSAGE,
} from "@/lib/discounts/constants";
import { createPagueloFacilPaymentLink, getPlanAmount } from "@/lib/paguelofacil";
import { PLAN_MAP } from "@/lib/plans/plans";

type BillingCycle = "monthly" | "annual";
type PaymentIntentType = "subscription_payment" | "plan_upgrade";

const PLAN_LEVELS: Record<string, number> = {
  emprende: 1,
  control: 2,
  equipo: 3,
};

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const companyId = String(body?.companyId ?? "").trim();
  const planId = String(body?.planId ?? "").trim();
  const billingCycle = String(body?.billingCycle ?? "").trim() as BillingCycle;
  const discountCode = String(body?.discountCode ?? "").trim();
  const plan = PLAN_MAP[planId];

  if (!companyId || !plan || !["monthly", "annual"].includes(billingCycle)) {
    return NextResponse.json({ error: "Faltan parámetros válidos" }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .maybeSingle();

  const role = String(membership?.role ?? "").toLowerCase();
  if (role !== "owner") {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: company } = await admin
    .from("companies")
    .select("subscription_status, subscription_plan, subscription_billing_cycle, trial_ends_at, current_period_ends_at")
    .eq("id", companyId)
    .maybeSingle();

  if (!company) {
    return NextResponse.json({ error: "No se encontró el negocio." }, { status: 404 });
  }

  const currentStatus = String(company.subscription_status ?? "").toLowerCase();
  const currentPlanId = company.subscription_plan ?? null;
  const currentCycle = company.subscription_billing_cycle as BillingCycle | null;
  const hasPaidAccess = ["active", "paid"].includes(currentStatus);
  const hasValidTrial =
    currentStatus === "trialing" &&
    Boolean(company.trial_ends_at && new Date(company.trial_ends_at).getTime() > Date.now());
  const isPlanChange = Boolean(
    currentPlanId && (currentPlanId !== planId || currentCycle !== billingCycle)
  );
  let intentType: PaymentIntentType = "subscription_payment";
  let exactAmount = roundMoney(getPlanAmount(plan, billingCycle));
  let discountCodeId: string | null = null;
  let appliedDiscountCode: string | null = null;
  let discountAmount = 0;

  if (!isPlanChange && (hasPaidAccess || hasValidTrial)) {
    return NextResponse.json(
      { error: "Selecciona un plan distinto para iniciar un cambio." },
      { status: 400 }
    );
  }

  if (isPlanChange && hasValidTrial) {
    const { error: updateTrialPlanError } = await admin
      .from("companies")
      .update({
        subscription_plan: planId,
        subscription_billing_cycle: billingCycle,
      })
      .eq("id", companyId);

    if (updateTrialPlanError) {
      return NextResponse.json({ error: "No se pudo actualizar el plan." }, { status: 500 });
    }

    await admin
      .from("companies")
      .update({
        scheduled_subscription_plan: null,
        scheduled_subscription_billing_cycle: null,
        scheduled_subscription_change_at: null,
      })
      .eq("id", companyId);

    return NextResponse.json({
      status: "updated",
      planId,
      message: `Tu plan se cambió a ${plan.name}. No pagarás nada durante la prueba gratis. Al finalizar el período de prueba, se te facturará el plan ${plan.name} si decides continuar.`,
    });
  }

  if (isPlanChange && hasPaidAccess) {
    const renewalDate = company.current_period_ends_at;

    if (!renewalDate || !currentCycle || !currentPlanId || !PLAN_MAP[currentPlanId]) {
      return NextResponse.json(
        { error: "No pudimos determinar tu próxima renovación. Contáctanos para cambiar el plan." },
        { status: 409 }
      );
    }

    const renewalTime = new Date(renewalDate).getTime();
    if (!Number.isFinite(renewalTime) || renewalTime <= Date.now()) {
      return NextResponse.json(
        { error: "Tu período actual ya venció. Renueva tu plan para continuar." },
        { status: 409 }
      );
    }

    const isCycleChange = currentCycle !== billingCycle;
    const isUpgrade = PLAN_LEVELS[planId] > PLAN_LEVELS[currentPlanId];
    const daysRemaining = (renewalTime - Date.now()) / 86_400_000;
    const shouldSchedule = isCycleChange || !isUpgrade || daysRemaining <= 5;

    if (shouldSchedule) {
      const { error: scheduleError } = await admin
        .from("companies")
        .update({
          scheduled_subscription_plan: planId,
          scheduled_subscription_billing_cycle: billingCycle,
          scheduled_subscription_change_at: renewalDate,
        })
        .eq("id", companyId);

      if (scheduleError) {
        return NextResponse.json({ error: "No se pudo programar el cambio." }, { status: 500 });
      }

      return NextResponse.json({
        status: "scheduled",
        message: isUpgrade
          ? "Tu cambio quedará programado para la próxima renovación."
          : "Tu cambio se aplicará en la próxima renovación. Mantendrás tu plan actual hasta entonces.",
      });
    }

    intentType = "plan_upgrade";
    exactAmount = roundMoney(
      getPlanAmount(plan, currentCycle) - getPlanAmount(PLAN_MAP[currentPlanId], currentCycle)
    );

    if (exactAmount <= 0) {
      return NextResponse.json({ error: "No hay diferencia pendiente por cobrar." }, { status: 400 });
    }
  }

  if (discountCode && intentType === "subscription_payment") {
    const validation = await validateDiscountCodeForAmount(
      discountCode,
      billingCycle,
      getPlanAmount(plan, billingCycle)
    );
    if (!validation.ok) {
      return NextResponse.json({ error: validation.message }, { status: 400 });
    }

    const { data: discount, error: discountError } = await admin
      .from("discount_codes")
      .select("id")
      .eq("code", validation.code)
      .maybeSingle();

    if (discountError || !discount?.id) {
      return NextResponse.json({ error: "No se pudo aplicar el código de descuento." }, { status: 500 });
    }

    discountCodeId = discount?.id ?? null;
    appliedDiscountCode = validation.code;
    discountAmount = validation.discountAmount;
    exactAmount = roundMoney(validation.finalAmount);

    if (exactAmount < MINIMUM_DISCOUNTED_PAYMENT) {
      return NextResponse.json(
        { error: MINIMUM_DISCOUNTED_PAYMENT_MESSAGE },
        { status: 400 }
      );
    }
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: existingIntent, error: existingIntentError } = await admin
    .from("payment_intents")
    .select("id")
    .eq("company_id", companyId)
    .eq("plan_id", planId)
    .eq("billing_cycle", billingCycle)
    .eq("exact_amount", exactAmount)
    .eq("intent_type", intentType)
    .eq("provider", "paguelofacil")
    .in("status", ["pending", "claimed", "awaiting_verification"])
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingIntentError) {
    console.error("PagueloFacil existing intent lookup failed", {
      companyId,
      userId: user.id,
      planId,
      billingCycle,
      exactAmount,
      discountCode: appliedDiscountCode,
      discountAmount,
      error: existingIntentError.message,
    });
    return NextResponse.json({ error: "No se pudo revisar el pago pendiente." }, { status: 500 });
  }

  let intentId = existingIntent?.id ?? null;
  const isExisting = Boolean(intentId);

  if (!intentId) {
    const { data: createdIntent, error: createIntentError } = await admin
      .from("payment_intents")
      .insert({
        company_id: companyId,
        user_id: user.id,
        plan_id: planId,
        billing_cycle: billingCycle,
        exact_amount: exactAmount,
        provider: "paguelofacil",
        expires_at: expiresAt,
        intent_type: intentType,
      })
      .select("id")
      .single();

    if (createIntentError || !createdIntent?.id) {
      console.error("PagueloFacil intent creation failed", {
        companyId,
        userId: user.id,
        planId,
        billingCycle,
        baseAmount: getPlanAmount(plan, billingCycle),
        discountCode: appliedDiscountCode,
        discountAmount,
        exactAmount,
        error: createIntentError?.message,
      });
      return NextResponse.json({ error: "No se pudo crear el intento de pago." }, { status: 500 });
    }

    intentId = createdIntent.id;

    const { error: auditError } = await admin
      .from("payment_audit_logs")
      .insert({
        intent_id: intentId,
        action: "created",
        to_status: "pending",
        actor_type: "user",
      });

    if (auditError) {
      console.error("PagueloFacil audit log creation failed", {
        intentId,
        error: auditError.message,
      });
    }
  }

  const returnUrl = new URL("/api/payments/paguelofacil/return", req.nextUrl.origin);
  returnUrl.searchParams.set("intent", intentId);

  let checkout;
  try {
    checkout = await createPagueloFacilPaymentLink({
      amount: exactAmount,
      description: `Monexity ${plan.name} ${billingCycle}`,
      returnUrl: returnUrl.toString(),
      intentId,
    });
  } catch (error) {
    console.error("PagueloFacil checkout link creation failed", {
      companyId,
      userId: user.id,
      planId,
      billingCycle,
      discountCode: appliedDiscountCode,
      discountAmount,
      exactAmount,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "No se pudo conectar con PagueloFácil." }, { status: 502 });
  }

  const { error: updateError } = await admin
    .from("payment_intents")
    .update({
      provider: "paguelofacil",
      provider_reference: checkout.providerReference,
      checkout_url: checkout.checkoutUrl,
      exact_amount: exactAmount,
      discount_code_id: discountCodeId,
      discount_code: appliedDiscountCode,
      discount_amount: discountAmount,
      intent_type: intentType,
    })
    .eq("id", intentId);

  if (updateError) {
    console.error("PagueloFacil checkout intent update failed", {
      intentId,
      companyId,
      exactAmount,
      error: updateError.message,
    });
    return NextResponse.json({ error: "No se pudo preparar el checkout." }, { status: 500 });
  }

  return NextResponse.json({
    intentId,
    exactAmount,
    expiresAt,
    isExisting,
    checkoutUrl: checkout.checkoutUrl,
  });
}
