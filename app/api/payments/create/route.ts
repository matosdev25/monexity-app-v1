import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  validateDiscountCodeForAmount,
} from "@/lib/discounts/validate-discount-code";
import { PLAN_MAP } from "@/lib/plans/plans";
import { PLAN_LEVELS, getPlanAmount } from "@/lib/billing/plans";
import type { PaymentIntentType } from "@/lib/billing/types";
import { hasValidPaidPeriod } from "@/lib/memberships/app-access";
import {
  generateTilopayOrderNumber,
  getNextCalendarBillingPeriod,
  resolveTilopayCharge,
  TilopayConfigError,
  TILOPAY_CURRENCY,
} from "@/lib/billing/tilopay/core";
import { getTilopayConfig } from "@/lib/billing/tilopay/config";
import { reconcileTilopayIntentById, startTilopayCheckout } from "@/lib/billing/tilopay/service";
import { decideOpenTilopayIntent } from "@/lib/billing/tilopay/flow";

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
  const discountCode = String(body?.discountCode ?? "").trim();
  const provider = "tilopay";
  // Plan, ciclo y monto se resuelven solo desde lib/plans: cualquier monto o
  // precio enviado por el cliente se ignora.
  const charge = resolveTilopayCharge(String(body?.planId ?? "").trim(), String(body?.billingCycle ?? "").trim());

  if (!companyId || !charge) {
    return NextResponse.json({ error: "Faltan parámetros válidos" }, { status: 400 });
  }

  const { plan, billingCycle } = charge;
  const planId = plan.id;

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
  const currentCycle = company.subscription_billing_cycle as typeof billingCycle | null;
  const hasPaidAccess = hasValidPaidPeriod(company);
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
      getPlanAmount(plan, billingCycle),
      companyId
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
  }

  if (!Number.isFinite(exactAmount) || exactAmount <= 0) {
    return NextResponse.json({ error: "El total final debe ser mayor a $0.00." }, { status: 400 });
  }

  // Configuración server-side obligatoria antes de crear cualquier intent.
  try {
    getTilopayConfig();
  } catch (error) {
    if (error instanceof TilopayConfigError) {
      console.error("Tilopay configuration missing", { message: error.message });
      return NextResponse.json(
        { error: "El pago con tarjeta no está disponible en este momento. Puedes pagar por Yappy." },
        { status: 503 }
      );
    }
    throw error;
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const verifyingResponse = (intentId: string) =>
    NextResponse.json(
      {
        status: "verifying",
        intentId,
        error: "Tienes un pago con tarjeta en verificación. No vuelvas a pagar; revisa el estado en unos minutos.",
      },
      { status: 409 }
    );

  // La base permite UNA sola intención Tilopay abierta por empresa (índice
  // único). Se busca sin filtrar por vencimiento: una orden enviada a Tilopay
  // nunca se abandona sin consultarla antes.
  const { data: openIntent, error: openIntentError } = await admin
    .from("payment_intents")
    .select("id, provider, provider_order_id, exact_amount, currency, checkout_url, expires_at, status, plan_id, billing_cycle, intent_type, discount_code_id, period_start, period_end")
    .eq("company_id", companyId)
    .eq("provider", provider)
    .in("status", ["pending", "claimed", "awaiting_verification"])
    .is("billing_subscription_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openIntentError) {
    console.error("Tilopay open intent lookup failed", { companyId, error: openIntentError.message });
    return NextResponse.json({ error: "No se pudo iniciar el pago con tarjeta." }, { status: 500 });
  }

  // Solo los pagos de período guardan el período a acreditar (por calendario);
  // plan_upgrade no cambia fechas.
  const period = intentType === "subscription_payment"
    ? getNextCalendarBillingPeriod(company.current_period_ends_at, billingCycle)
    : null;

  let existingIntent: typeof openIntent = null;

  if (openIntent) {
    // Identidad del intent: plan, ciclo, monto, tipo, código de descuento y
    // período guardado; un intent vencido no se reutiliza tal cual.
    const matchesSelection =
      new Date(openIntent.expires_at).getTime() > Date.now() &&
      openIntent.plan_id === planId &&
      openIntent.billing_cycle === billingCycle &&
      Number(openIntent.exact_amount) === exactAmount &&
      openIntent.intent_type === intentType &&
      (openIntent.discount_code_id ?? null) === discountCodeId &&
      (intentType !== "subscription_payment" || Boolean(openIntent.period_start && openIntent.period_end));

    // Otra selección: primero se consulta Tilopay sobre la orden existente.
    const reconciled = matchesSelection ? null : await reconcileTilopayIntentById(openIntent.id);
    const action = decideOpenTilopayIntent(matchesSelection, reconciled?.outcome ?? null);

    if (action === "paid") {
      return NextResponse.json({ status: "paid", intentId: openIntent.id });
    }
    if (action === "verifying") {
      return verifyingResponse(openIntent.id);
    }
    if (action === "reuse") {
      existingIntent = openIntent;
    }
    if (action === "retarget") {
      // Nunca se abre una segunda orden mientras la anterior no esté consumida:
      // el enlace hospedado previo podría seguir vivo. Se re-apunta la MISMA
      // intención (mismo orderNumber); Tilopay solo acepta un cobro por orden.
      const { data: retargeted, error: retargetError } = await admin.rpc("retarget_tilopay_intent", {
        p_intent_id: openIntent.id,
        p_plan_id: planId,
        p_billing_cycle: billingCycle,
        p_intent_type: intentType,
        p_exact_amount: exactAmount,
        p_period_start: period?.periodStart ?? null,
        p_period_end: period?.periodEnd ?? null,
        p_expires_at: expiresAt,
        p_discount_code_id: discountCodeId,
        p_discount_code: appliedDiscountCode,
        p_discount_amount: discountAmount,
      });

      if (retargetError || retargeted !== "retargeted") {
        return verifyingResponse(openIntent.id);
      }

      const { data: refreshed } = await admin
        .from("payment_intents")
        .select("id, provider, provider_order_id, exact_amount, currency, checkout_url, expires_at, status, plan_id, billing_cycle, intent_type, discount_code_id, period_start, period_end")
        .eq("id", openIntent.id)
        .maybeSingle();

      if (!refreshed) return verifyingResponse(openIntent.id);
      existingIntent = refreshed;
    }
    // action === "new": la orden anterior quedó consumida por un rechazo.
  }

  let intent = existingIntent ?? null;
  const isExisting = Boolean(intent);

  if (!intent) {
    const { data: createdIntent, error: createIntentError } = await admin
      .from("payment_intents")
      .insert({
        company_id: companyId,
        user_id: user.id,
        plan_id: planId,
        billing_cycle: billingCycle,
        exact_amount: exactAmount,
        currency: TILOPAY_CURRENCY,
        provider,
        // orderNumber único generado y persistido ANTES de llamar a Tilopay.
        provider_order_id: generateTilopayOrderNumber(),
        intent_type: intentType,
        expires_at: expiresAt,
        period_start: period?.periodStart ?? null,
        period_end: period?.periodEnd ?? null,
        discount_code_id: discountCodeId,
        discount_code: appliedDiscountCode,
        discount_amount: discountAmount,
      })
      .select("id, provider, provider_order_id, exact_amount, currency, checkout_url, expires_at, status, plan_id, billing_cycle, intent_type, discount_code_id, period_start, period_end")
      .single();

    // Carrera con otra solicitud de la misma empresa: el índice único de
    // intención abierta rechaza la segunda orden; nunca se llama dos veces a processPayment.
    if (createIntentError?.code === "23505") {
      return NextResponse.json(
        { error: "Ya estamos preparando tu pago. Intenta nuevamente en unos segundos." },
        { status: 409 }
      );
    }

    if (createIntentError || !createdIntent?.id) {
      console.error("Tilopay intent creation failed", {
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

    intent = createdIntent;

    const { error: auditError } = await admin
      .from("payment_audit_logs")
      .insert({
        intent_id: createdIntent.id,
        action: "created",
        to_status: "pending",
        actor_type: "user",
        metadata: { provider: "tilopay", order_number: createdIntent.provider_order_id },
      });

    if (auditError) {
      console.error("Tilopay audit log creation failed", {
        intentId: createdIntent.id,
        error: auditError.message,
      });
    }
  }

  // El descuento se reserva ANTES de cobrar: si el código ya no tiene usos,
  // no se crea el checkout y nadie paga un descuento que no se puede aplicar.
  // El código ya quedó fijado al crear el intent y no se modifica después.
  if (discountCodeId) {
    const { data: reservation, error: reservationError } = await admin.rpc("reserve_intent_discount", {
      p_intent_id: intent.id,
    });

    if (reservationError) {
      return NextResponse.json({ error: "No se pudo aplicar el código de descuento." }, { status: 500 });
    }

    if (reservation === "exhausted") {
      return NextResponse.json({ error: "Este código alcanzó su límite de usos." }, { status: 400 });
    }

    if (reservation !== "reserved" && reservation !== "already_reserved") {
      return NextResponse.json({ error: "No se pudo aplicar el código de descuento." }, { status: 500 });
    }
  }

  if (!user.email) {
    return NextResponse.json({ error: "Tu cuenta necesita un correo para pagar con tarjeta." }, { status: 400 });
  }

  const [{ data: profile }, { data: invoice }] = await Promise.all([
    admin.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle(),
    admin.from("companies").select("invoice_address, invoice_phone").eq("id", companyId).maybeSingle(),
  ]);

  let checkout;
  try {
    checkout = await startTilopayCheckout({
      intent,
      isExisting,
      origin: req.nextUrl.origin,
      customer: {
        fullName: profile?.full_name ?? null,
        email: user.email,
        phone: profile?.phone ?? invoice?.invoice_phone ?? null,
        address: invoice?.invoice_address ?? null,
      },
    });
  } catch (error) {
    console.error("Tilopay checkout failed", {
      intentId: intent.id,
      error: error instanceof Error ? error.name : "unknown",
    });
    checkout = { kind: "error" as const, reason: "unexpected" };
  }

  switch (checkout.kind) {
    case "redirect":
      return NextResponse.json({
        intentId: intent.id,
        exactAmount,
        expiresAt: intent.expires_at ?? expiresAt,
        isExisting,
        checkoutUrl: checkout.url,
      });
    case "paid":
      return NextResponse.json({ status: "paid", intentId: intent.id });
    case "failed":
      return NextResponse.json(
        { error: "Tu intento anterior fue rechazado por el banco. Presiona pagar de nuevo para generar un nuevo pago." },
        { status: 409 }
      );
    case "review":
      return NextResponse.json(
        { error: "Tu pago está en revisión. No vuelvas a pagar; te contactaremos." },
        { status: 409 }
      );
    case "uncertain":
      return NextResponse.json(
        {
          status: "verifying",
          intentId: intent.id,
          error: "Estamos verificando tu pago con Tilopay. No vuelvas a pagar; revisa el estado en unos minutos.",
        },
        { status: 409 }
      );
    default:
      console.error("Tilopay checkout not prepared", { intentId: intent.id, reason: checkout.reason });
      return NextResponse.json(
        { error: "No se pudo conectar con Tilopay. Intenta nuevamente en unos minutos." },
        { status: 502 }
      );
  }
}
