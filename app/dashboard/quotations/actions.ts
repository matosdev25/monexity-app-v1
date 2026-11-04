"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "../../../lib/supabase/server";
import { isGlobalAdminEmail } from "../../../lib/admin-auth";
import { canAccessCompanyApp } from "../../../lib/memberships/app-access";
import {
  getNextDocumentNumber,
  isDuplicateDocumentNumberError,
} from "../../../lib/document-numbering";
import type { QuotationActionState } from "./types";

export type { QuotationActionState } from "./types";

type QuotationItemInput = {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sort_order: number;
  service_id: string | null;
  service_name_snapshot: string | null;
};

const ALLOWED_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "converted",
] as const;

const DOCUMENT_NUMBER_RETRIES = 3;

function ok(
  message: string,
  extra?: Partial<QuotationActionState>
): QuotationActionState {
  return { success: true, message, timestamp: Date.now(), ...extra };
}

function fail(message: string): QuotationActionState {
  return { success: false, message, timestamp: Date.now() };
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parseMoney(value: string) {
  const n = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function isValidDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPanamaPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("507");
}

function getTodayInPanama() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Panama",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`;
}

function revalidateQuotationsPages() {
  revalidatePath("/dashboard/quotations");
}

async function getQuotationsContext() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      userId: null,
      companyId: null,
      error: "Debes iniciar sesión.",
    };
  }

  const cookieStore = await cookies();
  const activeCompanyId = cookieStore.get("active_company_id")?.value ?? null;

  const membershipQuery = supabase
    .from("memberships")
    .select("company_id, role, companies(name, subscription_status, subscription_plan, trial_ends_at, current_period_ends_at, is_blocked)")
    .eq("user_id", user.id);

  const { data: membership, error: membershipError } = await (
    activeCompanyId
      ? membershipQuery.eq("company_id", activeCompanyId)
      : membershipQuery.limit(1)
  ).maybeSingle();

  if (membershipError || !membership?.company_id) {
    return {
      supabase,
      userId: user.id,
      companyId: null,
      error: "No se encontró la empresa del usuario.",
    };
  }

  type MembershipCompany = {
    name?: string | null;
    subscription_status: string | null;
    subscription_plan: string | null;
    trial_ends_at: string | null;
    current_period_ends_at: string | null;
    is_blocked: boolean | null;
  };
  const companies = membership.companies as unknown as MembershipCompany | MembershipCompany[] | null;
  const company = Array.isArray(companies) ? companies[0] ?? null : companies;

  if (!isGlobalAdminEmail(user.email) && (!company || !canAccessCompanyApp(company))) {
    return {
      supabase,
      userId: user.id,
      companyId: null,
      error: "Tu cuenta necesita pago activo para usar cotizaciones.",
    };
  }

  return {
    supabase,
    userId: user.id,
    companyId: membership.company_id as string,
    companyName: company?.name ?? null,
    role: String(membership.role ?? "").toLowerCase(),
    error: null,
  };
}

async function getNextQuotationNumber(
  ctx: Awaited<ReturnType<typeof getQuotationsContext>>,
  offset = 0
) {
  if (!ctx.companyId) throw new Error("missing_company");

  return getNextDocumentNumber({
    supabase: ctx.supabase,
    table: "quotations",
    column: "quotation_number",
    companyId: ctx.companyId,
    companyName: ctx.companyName,
    prefix: "COT",
    offset,
  });
}

async function getNextInvoiceNumber(
  ctx: Awaited<ReturnType<typeof getQuotationsContext>>,
  offset = 0
) {
  if (!ctx.companyId) throw new Error("missing_company");

  return getNextDocumentNumber({
    supabase: ctx.supabase,
    table: "sales",
    column: "invoice_number",
    companyId: ctx.companyId,
    companyName: ctx.companyName,
    prefix: "FAC",
    offset,
  });
}

type RpcError = { code?: string; message?: string } | null;

// Solo los mensajes de validación/permiso de las RPC se muestran al usuario
function getQuotationRpcErrorMessage(error: RpcError, fallback: string) {
  if (!error) return fallback;
  if ((error.code === "22023" || error.code === "42501") && error.message) return error.message;
  return fallback;
}

function canManageQuotations(role: string | null | undefined) {
  return ["owner", "admin"].includes(String(role ?? "").toLowerCase());
}

function parseItemsFromFormData(
  formData: FormData
): { items: QuotationItemInput[]; subtotal: number } | { error: string } {
  const descriptions = formData
    .getAll("itemDescription[]")
    .map((v) => String(v).trim());
  const quantities = formData
    .getAll("itemQuantity[]")
    .map((v) => String(v).trim());
  const unitPrices = formData
    .getAll("itemUnitPrice[]")
    .map((v) => String(v).trim());
  const serviceIds = formData
    .getAll("itemServiceId[]")
    .map((v) => String(v).trim());
  const serviceNames = formData
    .getAll("itemServiceName[]")
    .map((v) => String(v).trim());

  const count = Math.max(
    descriptions.length,
    quantities.length,
    unitPrices.length
  );
  if (count === 0) return { error: "Agrega al menos un ítem." };

  const items: QuotationItemInput[] = [];

  for (let i = 0; i < count; i++) {
    const description = (descriptions[i] ?? "").trim();
    const qtyRaw = (quantities[i] ?? "1").trim();
    const priceRaw = (unitPrices[i] ?? "0").trim();

    if (!description && !qtyRaw && !priceRaw) continue;
    if (!description)
      return { error: `El ítem ${i + 1} necesita descripción.` };

    // Vacío → 1 por defecto; 0, negativos o texto inválido se rechazan abajo
    const quantity = qtyRaw === "" ? 1 : parseMoney(qtyRaw);
    const unit_price = parseMoney(priceRaw);
    const line_total = roundMoney(quantity * unit_price);

    if (quantity <= 0)
      return { error: `La cantidad del ítem ${i + 1} no es válida.` };
    if (unit_price < 0)
      return { error: `El precio del ítem ${i + 1} no puede ser negativo.` };

    const rawServiceId = (serviceIds[i] ?? "").trim();
    const rawServiceName = (serviceNames[i] ?? "").trim();

    items.push({
      description,
      quantity: roundMoney(quantity),
      unit_price: roundMoney(unit_price),
      line_total,
      sort_order: i,
      service_id: rawServiceId || null,
      service_name_snapshot: rawServiceName || null,
    });
  }

  if (items.length === 0) return { error: "Agrega al menos un ítem válido." };

  const subtotal = roundMoney(
    items.reduce((sum, item) => sum + item.line_total, 0)
  );
  return { items, subtotal };
}

export async function createQuotation(
  prevState: QuotationActionState,
  formData: FormData
): Promise<QuotationActionState> {
  void prevState;

  const ctx = await getQuotationsContext();
  if (ctx.error || !ctx.companyId || !ctx.userId)
    return fail(ctx.error ?? "Error de autenticación.");
  if (!canManageQuotations(ctx.role))
    return fail("No tienes permisos para crear cotizaciones.");

  const customerName = getString(formData, "customerName");
  const customerEmail = getString(formData, "customerEmail");
  const customerPhone = getString(formData, "customerPhone");
  const customerCompany = getString(formData, "customerCompany");
  const issueDate = getString(formData, "issueDate") || getTodayInPanama();
  const validUntil = getString(formData, "validUntil");
  const discountRaw = getString(formData, "discountAmount");
  const taxRaw = getString(formData, "taxAmount");
  const notes = getString(formData, "notes");
  const terms = getString(formData, "terms");

  if (customerEmail && !isValidEmail(customerEmail))
    return fail("El email del cliente no es válido.");
  if (customerPhone && !isValidPanamaPhone(customerPhone))
    return fail("El teléfono del cliente no es válido.");
  if (!isValidDateOnly(issueDate))
    return fail("La fecha de emisión no es válida.");
  if (validUntil && !isValidDateOnly(validUntil))
    return fail("La fecha de vigencia no es válida.");

  const parsedItems = parseItemsFromFormData(formData);
  if ("error" in parsedItems) return fail(parsedItems.error);

  const discount = roundMoney(Math.max(0, parseMoney(discountRaw)));
  const tax = roundMoney(Math.max(0, parseMoney(taxRaw)));
  const total = roundMoney(
    Math.max(0, parsedItems.subtotal - discount + tax)
  );

  let quotationNumber = "";
  let inserted: { id: string } | null = null;
  let insertError: { code?: string; message?: string } | null = null;

  for (let attempt = 0; attempt < DOCUMENT_NUMBER_RETRIES; attempt += 1) {
    quotationNumber = await getNextQuotationNumber(ctx, attempt);
    const { data, error } = await ctx.supabase
      .from("quotations")
      .insert({
        company_id: ctx.companyId,
        created_by: ctx.userId,
        quotation_number: quotationNumber,
        status: "draft",
        customer_name: customerName || null,
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        customer_company: customerCompany || null,
        issue_date: issueDate,
        valid_until: validUntil || null,
        subtotal: parsedItems.subtotal,
        discount_amount: discount,
        tax_amount: tax,
        total,
        notes: notes || null,
        terms: terms || null,
      })
      .select("id")
      .single();

    inserted = data;
    insertError = error;

    if (!error) break;
    if (!isDuplicateDocumentNumberError(error)) break;
  }

  if (insertError || !inserted?.id)
    return fail("No se pudo generar el número del documento. Intenta nuevamente.");

  const { error: itemsError } = await ctx.supabase
    .from("quotation_items")
    .insert(
      parsedItems.items.map((item) => ({
        quotation_id: inserted.id,
        company_id: ctx.companyId,
        ...item,
      }))
    );

  if (itemsError) {
    await ctx.supabase
      .from("quotations")
      .delete()
      .eq("id", inserted.id)
      .eq("company_id", ctx.companyId);
    return fail(itemsError.message ?? "No se pudieron guardar los ítems.");
  }

  revalidateQuotationsPages();
  return ok(`Cotización ${quotationNumber} creada.`, {
    quotationId: inserted.id,
    quotationNumber,
  });
}

export async function updateQuotation(
  prevState: QuotationActionState,
  formData: FormData
): Promise<QuotationActionState> {
  void prevState;

  const ctx = await getQuotationsContext();
  if (ctx.error || !ctx.companyId)
    return fail(ctx.error ?? "Error de autenticación.");
  if (!canManageQuotations(ctx.role))
    return fail("No tienes permisos para editar cotizaciones.");

  const quotationId = getString(formData, "quotationId");
  if (!quotationId) return fail("Cotización no encontrada.");

  const customerName = getString(formData, "customerName");
  const customerEmail = getString(formData, "customerEmail");
  const customerPhone = getString(formData, "customerPhone");
  const customerCompany = getString(formData, "customerCompany");
  const issueDate = getString(formData, "issueDate");
  const validUntil = getString(formData, "validUntil");
  const discountRaw = getString(formData, "discountAmount");
  const taxRaw = getString(formData, "taxAmount");
  const notes = getString(formData, "notes");
  const terms = getString(formData, "terms");

  if (customerEmail && !isValidEmail(customerEmail))
    return fail("El email del cliente no es válido.");
  if (customerPhone && !isValidPanamaPhone(customerPhone))
    return fail("El teléfono del cliente no es válido.");
  if (!isValidDateOnly(issueDate))
    return fail("La fecha de emisión no es válida.");
  if (validUntil && !isValidDateOnly(validUntil))
    return fail("La fecha de vigencia no es válida.");

  const parsedItems = parseItemsFromFormData(formData);
  if ("error" in parsedItems) return fail(parsedItems.error);

  const discount = roundMoney(Math.max(0, parseMoney(discountRaw)));
  const tax = roundMoney(Math.max(0, parseMoney(taxRaw)));

  // Cabecera + ítems en una sola transacción (bloquea la fila y rechaza convertidas).
  // Subtotal y total se recalculan en la base con la misma regla.
  const { error: updateError } = await ctx.supabase.rpc("update_quotation_atomic", {
    p_company_id: ctx.companyId,
    p_quotation_id: quotationId,
    p_quotation: {
      customer_name: customerName || null,
      customer_email: customerEmail || null,
      customer_phone: customerPhone || null,
      customer_company: customerCompany || null,
      issue_date: issueDate,
      valid_until: validUntil || null,
      discount_amount: discount,
      tax_amount: tax,
      notes: notes || null,
      terms: terms || null,
    },
    p_items: parsedItems.items,
  });

  if (updateError)
    return fail(getQuotationRpcErrorMessage(updateError, "No se pudo actualizar la cotización."));

  revalidateQuotationsPages();
  revalidatePath(`/dashboard/quotations/${quotationId}`);
  return ok("Cotización actualizada.");
}

export async function changeQuotationStatus(
  formData: FormData
): Promise<void> {
  const ctx = await getQuotationsContext();
  if (ctx.error || !ctx.companyId) return;
  if (!canManageQuotations(ctx.role)) return;

  const quotationId = String(formData.get("quotationId") ?? "").trim();
  const newStatus = String(formData.get("status") ?? "").trim();

  if (
    !quotationId ||
    !ALLOWED_STATUSES.includes(
      newStatus as (typeof ALLOWED_STATUSES)[number]
    )
  )
    return;
  if (newStatus === "converted") return;

  const { data: existing } = await ctx.supabase
    .from("quotations")
    .select("id, status")
    .eq("id", quotationId)
    .eq("company_id", ctx.companyId)
    .maybeSingle();

  if (!existing || existing.status === "converted") return;

  await ctx.supabase
    .from("quotations")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", quotationId)
    .eq("company_id", ctx.companyId);

  revalidateQuotationsPages();
  revalidatePath(`/dashboard/quotations/${quotationId}`);
}

const ALLOWED_INSTALLMENT_FREQUENCIES = ["weekly", "biweekly", "monthly"] as const;

export async function convertQuotationToSale(
  prevState: QuotationActionState,
  formData: FormData
): Promise<QuotationActionState> {
  void prevState;

  const ctx = await getQuotationsContext();
  if (ctx.error || !ctx.companyId || !ctx.userId)
    return fail(ctx.error ?? "Error de autenticación.");
  if (!canManageQuotations(ctx.role))
    return fail("No tienes permisos para convertir cotizaciones.");

  const quotationId = getString(formData, "quotationId");
  const paymentMethod = getString(formData, "paymentMethod") || "cash";
  const paymentType = getString(formData, "paymentType") || "full";

  if (!quotationId) return fail("Cotización no encontrada.");

  let plan: Record<string, unknown> | null = null;

  if (paymentType === "installment") {
    // ── Plan de cuotas (lo crea la RPC; aquí solo se valida el formulario) ──
    const frequency = getString(formData, "frequency").toLowerCase();
    if (!ALLOWED_INSTALLMENT_FREQUENCIES.includes(frequency as typeof ALLOWED_INSTALLMENT_FREQUENCIES[number]))
      return fail("Selecciona una frecuencia válida para el plan.");

    const downPaymentAmount = roundMoney(Math.max(0, parseMoney(getString(formData, "paidAmount"))));
    const installmentAmount = parseMoney(getString(formData, "installmentAmount"));
    const installmentsCount = Math.floor(Math.abs(Number(getString(formData, "installmentsCount"))));
    const startDate = getString(formData, "startDate");

    if (installmentAmount <= 0) return fail("El monto de la cuota no es válido.");
    if (installmentsCount <= 0) return fail("El número de cuotas no es válido.");
    if (!startDate) return fail("La fecha de inicio del plan es requerida.");
    // Abono > total lo rechaza la RPC con el total vigente de la cotización

    plan = {
      down_payment_amount: downPaymentAmount,
      plan_name: getString(formData, "planName") || null,
      frequency,
      installment_amount: installmentAmount,
      installments_count: installmentsCount,
      start_date: startDate,
      plan_notes: getString(formData, "planNotes") || null,
    };
  } else if (paymentType !== "full") {
    return fail("Tipo de pago no válido.");
  }

  // Venta, ítems, plan y marca de convertida en una sola transacción. La cotización
  // es la clave de idempotencia: si ya fue convertida, devuelve la misma venta.
  // Solo se reintenta ante colisión del número de factura (todo se revierte).
  let rpcError: RpcError = null;
  let saleId = "";

  for (let attempt = 0; attempt < DOCUMENT_NUMBER_RETRIES; attempt += 1) {
    let invoiceNumber: string;
    try {
      invoiceNumber = await getNextInvoiceNumber(ctx, attempt);
    } catch {
      return fail("No se pudo generar el número del documento. Intenta nuevamente.");
    }

    const { data, error } = await ctx.supabase.rpc("convert_quotation_to_sale_atomic", {
      p_company_id: ctx.companyId,
      p_quotation_id: quotationId,
      p_invoice_number: invoiceNumber,
      p_payment: {
        payment_type: paymentType,
        payment_method: paymentMethod,
        customer_phone: getString(formData, "customerPhone") || null,
        plan,
      },
    });

    rpcError = error;
    if (!error) {
      const row = (Array.isArray(data) ? data[0] : data) as { sale_id?: string } | null;
      saleId = row?.sale_id ? String(row.sale_id) : "";
      break;
    }
    if (!isDuplicateDocumentNumberError(error)) break;
  }

  if (rpcError) {
    if (isDuplicateDocumentNumberError(rpcError))
      return fail("No se pudo generar el número del documento. Intenta nuevamente.");
    return fail(getQuotationRpcErrorMessage(rpcError, "No se pudo convertir la cotización. Intenta nuevamente."));
  }
  if (!saleId) return fail("La venta se creó sin devolver un identificador válido.");

  revalidateQuotationsPages();
  revalidatePath(`/dashboard/quotations/${quotationId}`);
  revalidatePath("/dashboard/sales");
  redirect("/dashboard/sales");
}

export async function deleteQuotation(formData: FormData): Promise<void> {
  const ctx = await getQuotationsContext();
  if (ctx.error || !ctx.companyId) return;
  if (!canManageQuotations(ctx.role)) return;

  const quotationId = String(formData.get("quotationId") ?? "").trim();
  if (!quotationId) return;

  const { data: existing } = await ctx.supabase
    .from("quotations")
    .select("id")
    .eq("id", quotationId)
    .eq("company_id", ctx.companyId)
    .maybeSingle();

  if (!existing) return;

  await ctx.supabase
    .from("quotation_items")
    .delete()
    .eq("quotation_id", quotationId)
    .eq("company_id", ctx.companyId);

  await ctx.supabase
    .from("quotations")
    .delete()
    .eq("id", quotationId)
    .eq("company_id", ctx.companyId);

  revalidateQuotationsPages();
  redirect("/dashboard/quotations");
}
