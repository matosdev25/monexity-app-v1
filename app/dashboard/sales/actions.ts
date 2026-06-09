"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "../../../lib/supabase/server";
import { PAYMENT_METHODS, type PaymentMethodOptionFull } from "../../../lib/payments";
import {
  SPECIAL_ADMIN_RELATED_ID,
  canEditManualTransactionDates,
} from "../../../lib/admin-auth";
import {
  getNextDocumentNumber,
  isDuplicateDocumentNumberError,
} from "../../../lib/document-numbering";

type ActionState = {
  success: boolean;
  message: string;
  timestamp?: number;
};

type SaleItemInput = {
  description: string;
  quantity: number;
  unit_price: number;
  sort_order: number;
  product_id?: string | null;
};

type InstallmentFrequency = "weekly" | "biweekly" | "monthly";

type InstallmentPlanInput = {
  planName: string | null;
  frequency: InstallmentFrequency;
  installmentAmount: number;
  installmentsCount: number;
  startDate: string;
  planNotes: string | null;
  downPaymentAmount: number;
};

type ExistingSaleRow = {
  id: string;
  payment_type: string | null;
  has_payment_plan: boolean | null;
  sale_date: string | null;
  payment_date: string | null;
};

const DOCUMENT_NUMBER_RETRIES = 3;

// Re-exportado desde lib/payments para compatibilidad con componentes de ventas.
export type SalePaymentMethodOption = PaymentMethodOptionFull;

const FALLBACK_PAYMENT_METHODS: SalePaymentMethodOption[] = PAYMENT_METHODS.map((m) => ({
  id: m.value,
  type: m.value,
  label: m.label,
  details: null,
}));

export async function fetchActivePaymentMethods(
  companyId: string
): Promise<SalePaymentMethodOption[]> {
  const supabase = await createClient();

  // Traemos todos los métodos (activos e inactivos) para saber qué tipos
  // ya están configurados en la empresa, y así no duplicar defaults.
  const { data } = await supabase
    .from("company_payment_methods")
    .select("id, type, label, details, is_active")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true });

  const all = (data ?? []) as Array<SalePaymentMethodOption & { is_active: boolean }>;

  // Tipos que el negocio ya tiene registrados (activos o inactivos).
  // Un tipo inactivo sigue "reclamado": no debe reaparecer el default.
  const claimedTypes = new Set(all.map((m) => m.type));

  // Lista base: métodos activos de la empresa (con sus labels personalizados)
  const merged: SalePaymentMethodOption[] = all
    .filter((m) => m.is_active)
    .map(({ id, type, label, details }) => ({ id, type, label, details }));

  // Agregar defaults solo para tipos que el negocio aún no tiene configurados
  for (const fallback of FALLBACK_PAYMENT_METHODS) {
    if (!claimedTypes.has(fallback.type)) {
      merged.push(fallback);
    }
  }

  return merged;
}

const ALLOWED_PAYMENT_TYPES = [
  "full",
  "partial",
  "installment",
] as const;

const ALLOWED_INSTALLMENT_FREQUENCIES = [
  "weekly",
  "biweekly",
  "monthly",
] as const;

function ok(message: string): ActionState {
  return {
    success: true,
    message,
    timestamp: Date.now(),
  };
}

function fail(message: string): ActionState {
  return {
    success: false,
    message,
    timestamp: Date.now(),
  };
}

function getTodayInPanama() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Panama",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return `${year}-${month}-${day}`;
}

function sanitizeMoneyInput(value: string) {
  return value.replace(/,/g, "").trim();
}

function parseMoney(value: string) {
  const normalized = sanitizeMoneyInput(value);
  if (!normalized) return Number.NaN;
  return Number(normalized);
}

function parsePositiveInteger(value: string) {
  const normalized = value.trim();
  if (!normalized) return Number.NaN;

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed)) return Number.NaN;

  return parsed;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function isValidDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getStringFromKeys(formData: FormData, keys: string[]) {
  for (const key of keys) {
    const value = String(formData.get(key) ?? "").trim();
    if (value) return value;
  }

  return "";
}

function getAllStrings(formData: FormData, keys: string[]) {
  for (const key of keys) {
    const values = formData
      .getAll(key)
      .map((value) => String(value ?? "").trim());

    if (values.length > 0) {
      return values;
    }
  }

  return [] as string[];
}

function normalizePaymentMethod(value: string) {
  return value.trim().toLowerCase();
}

function normalizePaymentType(value: string) {
  return value.trim().toLowerCase();
}

function revalidateSalesPages() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/ventas");
}

async function getSalesContext() {
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
    .select("company_id, role, companies(owner_user_id, name)")
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

  const { data: specialAdminMembership } = await supabase
    .from("memberships")
    .select("company_id")
    .eq("company_id", membership.company_id)
    .eq("user_id", SPECIAL_ADMIN_RELATED_ID)
    .maybeSingle();

  return {
    supabase,
    userId: user.id,
    userEmail: user.email ?? null,
    companyId: membership.company_id,
    role: String(membership.role ?? "").toLowerCase(),
    companyOwnerUserId:
      (membership.companies as { owner_user_id?: string | null } | null)?.owner_user_id ?? null,
    companyName:
      (membership.companies as { name?: string | null } | null)?.name ?? null,
    hasSpecialAdminMembership: Boolean(specialAdminMembership?.company_id),
    error: null,
  };
}

async function getNextInvoiceNumber(
  context: Awaited<ReturnType<typeof getSalesContext>>,
  offset = 0
) {
  if (!context.companyId) throw new Error("missing_company");

  return getNextDocumentNumber({
    supabase: context.supabase,
    table: "sales",
    column: "invoice_number",
    companyId: context.companyId,
    companyName: context.companyName,
    prefix: "FAC",
    offset,
  });
}

function canManageSalesRecords(role: string | null | undefined) {
  return ["owner", "admin"].includes(String(role ?? "").toLowerCase());
}

function validateBaseSaleFields(params: {
  paymentMethod: string;
  paymentType: string;
  saleDate: string;
  paymentDate: string;
}) {
  const { paymentMethod, paymentType, saleDate, paymentDate } = params;

  if (!paymentMethod) {
    return { error: "Selecciona un método de pago." };
  }

  if (!paymentType) {
    return { error: "Selecciona un tipo de pago." };
  }

  if (
    !ALLOWED_PAYMENT_TYPES.includes(
      paymentType as (typeof ALLOWED_PAYMENT_TYPES)[number]
    )
  ) {
    return { error: "El tipo de pago no es válido." };
  }

  if (!saleDate || !isValidDateOnly(saleDate)) {
    return { error: "La fecha de la venta no es válida." };
  }

  if (paymentDate && !isValidDateOnly(paymentDate)) {
    return { error: "La fecha de pago no es válida." };
  }

  return { error: null };
}

function computePaymentSnapshot(params: {
  subtotal: number;
  paymentType: string;
  paidAmountRaw: string;
}) {
  const { subtotal, paymentType, paidAmountRaw } = params;

  if (paymentType === "installment") {
    return { error: "Las ventas a cuotas deben usar el flujo de plan de pagos." };
  }

  let paidAmount = paidAmountRaw
    ? parseMoney(paidAmountRaw)
    : paymentType === "full"
      ? subtotal
      : 0;

  if (!Number.isFinite(paidAmount) || paidAmount < 0) {
    return { error: "El abono recibido no es válido." };
  }

  paidAmount = roundMoney(paidAmount);

  if (paidAmount > subtotal) {
    return { error: "El abono recibido no puede ser mayor al total." };
  }

  if (paymentType === "full" && paidAmount !== subtotal) {
    return { error: "Para un pago completo, el abono debe ser igual al total." };
  }

  if (paymentType === "partial" && paidAmount <= 0) {
    return { error: "Para un abono, el monto pagado debe ser mayor a cero." };
  }

  if (paymentType === "partial" && paidAmount >= subtotal) {
    return { error: "Si el cliente pagó todo, usa tipo de pago completo." };
  }

  const balanceDue = roundMoney(Math.max(0, subtotal - paidAmount));

  const paymentStatus =
    balanceDue <= 0
      ? "paid"
      : paidAmount > 0
        ? "partial"
        : "pending";

  return {
    error: null,
    paidAmount,
    balanceDue,
    paymentStatus,
  };
}

function parseInvoiceItems(
  formData: FormData,
  fallbackAmount: number,
  fallbackDescription: string
):
  | {
      items: SaleItemInput[];
      subtotal: number;
    }
  | {
      error: string;
    } {
  const descriptions = getAllStrings(formData, [
    "itemDescription",
    "itemDescription[]",
  ]);
  const quantities = getAllStrings(formData, ["itemQuantity", "itemQuantity[]"]);
  const unitPrices = getAllStrings(formData, ["itemUnitPrice", "itemUnitPrice[]"]);

  const rowCount = Math.max(
    descriptions.length,
    quantities.length,
    unitPrices.length
  );

  if (rowCount === 0) {
    if (!Number.isFinite(fallbackAmount) || fallbackAmount <= 0) {
      return { error: "Agrega un monto válido o al menos un ítem válido." };
    }

    return {
      items: [
        {
          description: fallbackDescription || "Venta registrada",
          quantity: 1,
          unit_price: roundMoney(fallbackAmount),
          sort_order: 0,
        },
      ],
      subtotal: roundMoney(fallbackAmount),
    };
  }

  const items: SaleItemInput[] = [];

  for (let index = 0; index < rowCount; index += 1) {
    const description = (descriptions[index] ?? "").trim();
    const quantityRaw = (quantities[index] ?? "").trim();
    const unitPriceRaw = (unitPrices[index] ?? "").trim();

    const hasAnyValue = Boolean(description || quantityRaw || unitPriceRaw);
    if (!hasAnyValue) continue;

    if (!description) {
      return { error: `El ítem ${index + 1} debe tener descripción.` };
    }

    const quantity = quantityRaw ? parseMoney(quantityRaw) : 1;
    const unitPrice = unitPriceRaw ? parseMoney(unitPriceRaw) : 0;

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { error: `La cantidad del ítem ${index + 1} no es válida.` };
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return { error: `El precio del ítem ${index + 1} no es válido.` };
    }

    items.push({
      description,
      quantity: roundMoney(quantity),
      unit_price: roundMoney(unitPrice),
      sort_order: index,
    });
  }

  if (items.length === 0) {
    if (!Number.isFinite(fallbackAmount) || fallbackAmount <= 0) {
      return { error: "Agrega al menos un ítem válido." };
    }

    return {
      items: [
        {
          description: fallbackDescription || "Venta registrada",
          quantity: 1,
          unit_price: roundMoney(fallbackAmount),
          sort_order: 0,
        },
      ],
      subtotal: roundMoney(fallbackAmount),
    };
  }

  const subtotal = roundMoney(
    items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
  );

  if (subtotal <= 0) {
    return { error: "El total de la factura debe ser mayor a cero." };
  }

  return { items, subtotal };
}

function parseInstallmentPlan(
  formData: FormData,
  subtotal: number
):
  | { data: InstallmentPlanInput }
  | { error: string } {
  const planName = getStringFromKeys(formData, ["planName"]);
  const frequency = getStringFromKeys(formData, [
    "frequency",
    "installmentFrequency",
  ]).toLowerCase();

  const installmentAmountRaw = getStringFromKeys(formData, [
    "installmentAmount",
    "cuotaAmount",
  ]);

  const installmentsCountRaw = getStringFromKeys(formData, [
    "installmentsCount",
    "installmentCount",
    "cuotas",
  ]);

  const startDate = getStringFromKeys(formData, [
    "startDate",
    "installmentStartDate",
  ]);

  const planNotes = getStringFromKeys(formData, [
    "planNotes",
    "installmentNotes",
  ]);

  const downPaymentRaw = getStringFromKeys(formData, [
    "paidAmount",
    "downPaymentAmount",
  ]);

  const downPaymentAmount = downPaymentRaw ? parseMoney(downPaymentRaw) : 0;
  const installmentAmount = parseMoney(installmentAmountRaw);
  const installmentsCount = parsePositiveInteger(installmentsCountRaw);

  if (
    !ALLOWED_INSTALLMENT_FREQUENCIES.includes(
      frequency as (typeof ALLOWED_INSTALLMENT_FREQUENCIES)[number]
    )
  ) {
    return { error: "Selecciona una frecuencia válida para el plan." };
  }

  if (!Number.isFinite(downPaymentAmount) || downPaymentAmount < 0) {
    return { error: "El abono inicial no es válido." };
  }

  if (downPaymentAmount > subtotal) {
    return { error: "El abono inicial no puede ser mayor al total." };
  }

  if (!Number.isFinite(installmentAmount) || installmentAmount <= 0) {
    return { error: "El monto de la cuota no es válido." };
  }

  if (!Number.isFinite(installmentsCount) || installmentsCount <= 0) {
    return { error: "La cantidad de cuotas no es válida." };
  }

  if (!startDate || !isValidDateOnly(startDate)) {
    return { error: "Debes seleccionar una fecha de inicio válida para el plan." };
  }

  const remainingBalance = roundMoney(subtotal - roundMoney(downPaymentAmount));

  if (remainingBalance <= 0) {
    return { error: "El plan no puede crearse si la venta ya quedó pagada." };
  }

  return {
    data: {
      planName: planName || null,
      frequency: frequency as InstallmentFrequency,
      installmentAmount: roundMoney(installmentAmount),
      installmentsCount,
      startDate,
      planNotes: planNotes || null,
      downPaymentAmount: roundMoney(downPaymentAmount),
    },
  };
}

async function getExistingSale(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  saleId: string;
  companyId: string;
}) {
  const { supabase, saleId, companyId } = params;

  const { data, error } = await supabase
    .from("sales")
    .select("id, payment_type, has_payment_plan, sale_date, payment_date")
    .eq("id", saleId)
    .eq("company_id", companyId)
    .maybeSingle();

  return {
    data: (data as ExistingSaleRow | null) ?? null,
    error,
  };
}

async function insertSaleItems(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  saleId: string;
  companyId: string;
  items: SaleItemInput[];
}) {
  const { supabase, saleId, companyId, items } = params;

  const payload = items.map((item) => ({
    sale_id: saleId,
    company_id: companyId,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    sort_order: item.sort_order,
    product_id: item.product_id ?? null,
  }));

  const { error } = await supabase.from("sale_items").insert(payload);
  return { error };
}

async function replaceSaleItems(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  saleId: string;
  companyId: string;
  items: SaleItemInput[];
}) {
  const { supabase, saleId, companyId, items } = params;

  const { data: existingItems, error: existingItemsError } = await supabase
    .from("sale_items")
    .select("description, quantity, unit_price, sort_order")
    .eq("sale_id", saleId)
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true });

  if (existingItemsError) {
    return { error: existingItemsError };
  }

  const { error: deleteError } = await supabase
    .from("sale_items")
    .delete()
    .eq("sale_id", saleId)
    .eq("company_id", companyId);

  if (deleteError) {
    return { error: deleteError };
  }

  const insertResult = await insertSaleItems({
    supabase,
    saleId,
    companyId,
    items,
  });

  if (!insertResult.error) {
    return { error: null };
  }

  if (existingItems && existingItems.length > 0) {
    await supabase.from("sale_items").insert(
      existingItems.map((item, index) => ({
        sale_id: saleId,
        company_id: companyId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        sort_order:
          typeof item.sort_order === "number" ? item.sort_order : index,
      }))
    );
  }

  return { error: insertResult.error };
}

export async function createSaleWithPlan(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  void prevState;

  const context = await getSalesContext();

  if (context.error || !context.companyId || !context.userId) {
    return fail(context.error ?? "No se pudo validar el usuario.");
  }

  const customerName = getString(formData, "customerName");
  const customerCompany = getString(formData, "customerCompany");
  const customerEmail = getString(formData, "customerEmail");
  const customerPhone = getString(formData, "customerPhone");

  const amountRaw = getString(formData, "amount");
  const paymentMethod = normalizePaymentMethod(getString(formData, "paymentMethod"));
  const paymentType = normalizePaymentType(getString(formData, "paymentType"));

  const note = getString(formData, "note");
  const invoiceNotes = getString(formData, "invoiceNotes") || note;

  const canEditManualDates = canEditManualTransactionDates({
    email: context.userEmail,
    userId: context.userId,
    companyId: context.companyId,
    companyOwnerUserId: context.companyOwnerUserId,
    hasSpecialAdminMembership: context.hasSpecialAdminMembership,
  });
  const saleDate = canEditManualDates
    ? (getString(formData, "saleDate") || "").slice(0, 10) || getTodayInPanama()
    : getTodayInPanama();
  const paymentDate = canEditManualDates
    ? (getString(formData, "paymentDate") || "").slice(0, 10) || saleDate
    : saleDate;

  const baseValidation = validateBaseSaleFields({
    paymentMethod,
    paymentType,
    saleDate,
    paymentDate,
  });

  if (baseValidation.error) {
    return fail(baseValidation.error);
  }

  const fallbackAmount = parseMoney(amountRaw);
  const fallbackDescription = invoiceNotes || note || "Venta registrada";

  if (paymentType !== "installment") {
    return fail("Esta acción solo permite ventas con plan de cuotas.");
  }

  const parsedItems = parseInvoiceItems(
    formData,
    fallbackAmount,
    fallbackDescription
  );

  if ("error" in parsedItems) {
    return fail(parsedItems.error);
  }

  const subtotal = parsedItems.subtotal;
  const parsedPlan = parseInstallmentPlan(formData, subtotal);

  if ("error" in parsedPlan) {
    return fail(parsedPlan.error);
  }

  const plan = parsedPlan.data;

  const noteValue =
    note || invoiceNotes || parsedItems.items[0]?.description || null;

  const { data, error } = await context.supabase.rpc("create_sale_with_plan", {
    p_company_id: context.companyId,
    p_created_by: context.userId,
    p_customer_name: customerName || null,
    p_customer_email: customerEmail || null,
    p_customer_phone: customerPhone || null,
    p_amount: subtotal,
    p_payment_method: paymentMethod,
    p_payment_type: "installment",
    p_sale_date: saleDate,
    p_payment_date: paymentDate || null,
    p_note: noteValue,
    p_invoice_notes: invoiceNotes || null,
    p_down_payment_amount: plan.downPaymentAmount,
    p_plan_name: plan.planName,
    p_frequency: plan.frequency,
    p_installment_amount: plan.installmentAmount,
    p_installments_count: plan.installmentsCount,
    p_start_date: plan.startDate,
    p_plan_notes: plan.planNotes,
  });

  if (error) {
    return fail(error.message || "No se pudo crear la venta con plan.");
  }

  const result = Array.isArray(data) ? data[0] : data;
  const saleId =
    result && typeof result === "object" && "sale_id" in result
      ? String(result.sale_id)
      : "";

  if (!saleId) {
    return fail("La venta se creó sin devolver un identificador válido.");
  }

  let invoiceAssigned = false;
  for (let attempt = 0; attempt < DOCUMENT_NUMBER_RETRIES; attempt += 1) {
    const invoiceNumberPlan = await getNextInvoiceNumber(context, attempt);
    const { error: updateNumberError } = await context.supabase
      .from("sales")
      .update({ invoice_number: invoiceNumberPlan, customer_company: customerCompany || null })
      .eq("id", saleId)
      .eq("company_id", context.companyId);

    if (!updateNumberError) {
      invoiceAssigned = true;
      break;
    }

    if (!isDuplicateDocumentNumberError(updateNumberError)) {
      await context.supabase
        .from("sales")
        .delete()
        .eq("id", saleId)
        .eq("company_id", context.companyId);
      return fail("No se pudo generar el número del documento. Intenta nuevamente.");
    }
  }

  if (!invoiceAssigned) {
    await context.supabase
      .from("sales")
      .delete()
      .eq("id", saleId)
      .eq("company_id", context.companyId);
    return fail("No se pudo generar el número del documento. Intenta nuevamente.");
  }

  const { error: insertItemsError } = await insertSaleItems({
    supabase: context.supabase,
    saleId,
    companyId: context.companyId,
    items: parsedItems.items,
  });

  if (insertItemsError) {
    await context.supabase
      .from("sales")
      .delete()
      .eq("id", saleId)
      .eq("company_id", context.companyId);

    return fail(
      insertItemsError.message ||
        "La venta fue creada, pero no se pudieron guardar los ítems."
    );
  }

  revalidateSalesPages();
  return ok("Venta con plan de pagos registrada correctamente.");
}

export async function createSale(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  void prevState;

  const context = await getSalesContext();

  if (context.error || !context.companyId || !context.userId) {
    return fail(context.error ?? "No se pudo validar el usuario.");
  }

  const customerName = getString(formData, "customerName");
  const customerCompany = getString(formData, "customerCompany");
  const customerEmail = getString(formData, "customerEmail");
  const customerPhone = getString(formData, "customerPhone");

  const amountRaw = getString(formData, "amount");
  const paymentMethod = normalizePaymentMethod(getString(formData, "paymentMethod"));
  const paymentType = normalizePaymentType(getString(formData, "paymentType"));

  const note = getString(formData, "note");
  const invoiceNotes = getString(formData, "invoiceNotes") || note;

  const canEditManualDates = canEditManualTransactionDates({
    email: context.userEmail,
    userId: context.userId,
    companyId: context.companyId,
    companyOwnerUserId: context.companyOwnerUserId,
    hasSpecialAdminMembership: context.hasSpecialAdminMembership,
  });
  const saleDate = canEditManualDates
    ? (getString(formData, "saleDate") || "").slice(0, 10) || getTodayInPanama()
    : getTodayInPanama();
  const paymentDate = canEditManualDates
    ? (getString(formData, "paymentDate") || "").slice(0, 10) || saleDate
    : saleDate;

  const baseValidation = validateBaseSaleFields({
    paymentMethod,
    paymentType,
    saleDate,
    paymentDate,
  });

  if (baseValidation.error) {
    return fail(baseValidation.error);
  }

  const fallbackAmount = parseMoney(amountRaw);
  const fallbackDescription = invoiceNotes || note || "Venta registrada";

  if (paymentType === "installment") {
    return createSaleWithPlan(prevState, formData);
  }

  const parsedItems = parseInvoiceItems(
    formData,
    fallbackAmount,
    fallbackDescription
  );

  if ("error" in parsedItems) {
    return fail(parsedItems.error);
  }

  const subtotal = parsedItems.subtotal;

  const discountAmountRaw = getString(formData, "discountAmount");
  const discountAmount = Math.max(0, roundMoney(parseMoney(discountAmountRaw)));
  if (discountAmount > 0 && discountAmount >= subtotal) {
    return fail("El descuento debe ser menor al total.");
  }
  const finalAmount = discountAmount > 0 ? roundMoney(subtotal - discountAmount) : subtotal;

  const paymentSnapshot = computePaymentSnapshot({
    subtotal: finalAmount,
    paymentType,
    paidAmountRaw: getStringFromKeys(formData, ["paidAmount"]),
  });

  if (paymentSnapshot.error) {
    return fail(paymentSnapshot.error);
  }

  const noteValue =
    note || invoiceNotes || parsedItems.items[0]?.description || null;

  let insertedSale: { id: string } | null = null;
  let insertSaleError: { code?: string; message?: string } | null = null;

  for (let attempt = 0; attempt < DOCUMENT_NUMBER_RETRIES; attempt += 1) {
    const invoiceNumber = await getNextInvoiceNumber(context, attempt);
    const { data, error } = await context.supabase
      .from("sales")
      .insert({
        company_id: context.companyId,
        created_by: context.userId,
        customer_name: customerName || null,
        customer_company: customerCompany || null,
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        amount: finalAmount,
        discount_amount: discountAmount,
        paid_amount: paymentSnapshot.paidAmount,
        balance_due: paymentSnapshot.balanceDue,
        payment_status: paymentSnapshot.paymentStatus,
        has_payment_plan: false,
        payment_method: paymentMethod,
        payment_type: paymentType,
        sale_date: saleDate,
        payment_date: paymentDate || null,
        note: noteValue,
        invoice_notes: invoiceNotes || null,
        invoice_number: invoiceNumber,
      })
      .select("id")
      .single();

    insertedSale = data;
    insertSaleError = error;

    if (!error) break;
    if (!isDuplicateDocumentNumberError(error)) break;
  }

  if (insertSaleError || !insertedSale?.id) {
    return fail("No se pudo generar el número del documento. Intenta nuevamente.");
  }

  // Asociar product_id a cada ítem por índice (para restaurar stock al eliminar)
  const productIds = formData.getAll("productId[]").map(String).filter(Boolean);
  const qtys = formData.getAll("qty[]").map((v) => Math.max(1, Math.floor(Number(String(v)))));

  const itemsWithProducts = parsedItems.items.map((item, i) => ({
    ...item,
    product_id: productIds[i] ?? null,
  }));

  const { error: insertItemsError } = await insertSaleItems({
    supabase: context.supabase,
    saleId: insertedSale.id,
    companyId: context.companyId,
    items: itemsWithProducts,
  });

  if (insertItemsError) {
    await context.supabase
      .from("sales")
      .delete()
      .eq("id", insertedSale.id)
      .eq("company_id", context.companyId);

    return fail(
      insertItemsError.message ||
        "No se pudieron guardar los ítems de la factura."
    );
  }

  if (productIds.length > 0) {
    const { data: soldProducts } = await context.supabase
      .from("products")
      .select("id, stock, track_inventory")
      .in("id", productIds)
      .eq("company_id", context.companyId);

    const trackedProducts = (soldProducts ?? []).filter((p) => p.track_inventory);

    if (trackedProducts.length > 0) {
      await Promise.all(
        trackedProducts.map((product) => {
          const totalQty = productIds.reduce<number>((sum, pid, idx) => {
            return pid === product.id ? sum + (qtys[idx] ?? 0) : sum;
          }, 0);
          const newStock = Math.max(0, Number(product.stock ?? 0) - totalQty);
          return context.supabase
            .from("products")
            .update({ stock: newStock })
            .eq("id", product.id)
            .eq("company_id", context.companyId);
        })
      );
      revalidatePath("/dashboard/inventario");
    }
  }

  revalidateSalesPages();
  return ok("Venta registrada correctamente.");
}

export async function updateSale(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  void prevState;

  const context = await getSalesContext();

  if (context.error || !context.companyId) {
    return fail(context.error ?? "No se pudo validar el usuario.");
  }
  if (!canManageSalesRecords(context.role)) {
    return fail("No tienes permisos para editar ventas.");
  }

  const saleId = getString(formData, "saleId");
  const customerName = getString(formData, "customerName");
  const customerCompany = getString(formData, "customerCompany");
  const customerEmail = getString(formData, "customerEmail");
  const customerPhone = getString(formData, "customerPhone");

  const amountRaw = getString(formData, "amount");
  const paymentMethod = normalizePaymentMethod(getString(formData, "paymentMethod"));
  const paymentType = normalizePaymentType(getString(formData, "paymentType"));

  const note = getString(formData, "note");
  const invoiceNotes = getString(formData, "invoiceNotes") || note;

  if (!saleId) {
    return fail("No se encontró la venta a editar.");
  }

  const { data: existingSale, error: existingSaleError } = await getExistingSale({
    supabase: context.supabase,
    saleId,
    companyId: context.companyId,
  });

  if (existingSaleError) {
    return fail(existingSaleError.message || "No se pudo validar la venta.");
  }

  if (!existingSale?.id) {
    return fail("No se encontró la venta a editar.");
  }

  const canEditManualDates = canEditManualTransactionDates({
    email: context.userEmail,
    userId: context.userId,
    companyId: context.companyId,
    companyOwnerUserId: context.companyOwnerUserId,
    hasSpecialAdminMembership: context.hasSpecialAdminMembership,
  });
  const saleDate = canEditManualDates
    ? (getString(formData, "saleDate") || "").slice(0, 10) || existingSale.sale_date || getTodayInPanama()
    : existingSale.sale_date || getTodayInPanama();
  const paymentDate = canEditManualDates
    ? (getString(formData, "paymentDate") || "").slice(0, 10) || saleDate
    : existingSale.payment_date || saleDate;

  const baseValidation = validateBaseSaleFields({
    paymentMethod,
    paymentType,
    saleDate,
    paymentDate,
  });

  if (baseValidation.error) {
    return fail(baseValidation.error);
  }

  if (
    existingSale.has_payment_plan ||
    String(existingSale.payment_type ?? "").toLowerCase() === "installment"
  ) {
    return fail(
      "Por ahora la edición de ventas a cuotas se manejará en un flujo separado."
    );
  }

  if (paymentType === "installment") {
    return fail(
      "Por ahora la edición de ventas a cuotas se manejará en un flujo separado."
    );
  }

  const fallbackAmount = parseMoney(amountRaw);
  const fallbackDescription = invoiceNotes || note || "Venta registrada";

  const parsedItems = parseInvoiceItems(
    formData,
    fallbackAmount,
    fallbackDescription
  );

  if ("error" in parsedItems) {
    return fail(parsedItems.error);
  }

  const subtotal = parsedItems.subtotal;

  const discountAmountRaw = getString(formData, "discountAmount");
  const discountAmount = Math.max(0, roundMoney(parseMoney(discountAmountRaw)));
  if (discountAmount > 0 && discountAmount >= subtotal) {
    return fail("El descuento debe ser menor al total.");
  }
  const finalAmount = discountAmount > 0 ? roundMoney(subtotal - discountAmount) : subtotal;

  const paymentSnapshot = computePaymentSnapshot({
    subtotal: finalAmount,
    paymentType,
    paidAmountRaw: getStringFromKeys(formData, ["paidAmount"]),
  });

  if (paymentSnapshot.error) {
    return fail(paymentSnapshot.error);
  }

  const noteValue =
    note || invoiceNotes || parsedItems.items[0]?.description || null;

  const updatePayload: Record<string, unknown> = {
    customer_name: customerName || null,
    customer_company: customerCompany || null,
    customer_email: customerEmail || null,
    customer_phone: customerPhone || null,
    amount: finalAmount,
    discount_amount: discountAmount,
    paid_amount: paymentSnapshot.paidAmount,
    balance_due: paymentSnapshot.balanceDue,
    payment_status: paymentSnapshot.paymentStatus,
    has_payment_plan: false,
    payment_method: paymentMethod,
    payment_type: paymentType,
    sale_date: saleDate,
    payment_date: paymentDate || null,
    note: noteValue,
    invoice_notes: invoiceNotes || null,
  };

  const { data: updatedSale, error: updateSaleError } = await context.supabase
    .from("sales")
    .update(updatePayload)
    .eq("id", saleId)
    .eq("company_id", context.companyId)
    .select("id")
    .maybeSingle();

  if (updateSaleError) {
    return fail(updateSaleError.message || "No se pudo actualizar la venta.");
  }

  if (!updatedSale?.id) {
    return fail("No se encontró la venta a editar.");
  }

  const { error: replaceItemsError } = await replaceSaleItems({
    supabase: context.supabase,
    saleId,
    companyId: context.companyId,
    items: parsedItems.items,
  });

  if (replaceItemsError) {
    return fail(
      replaceItemsError.message ||
        "No se pudieron actualizar los ítems de la factura."
    );
  }

  revalidateSalesPages();
  return ok("Venta actualizada correctamente.");
}

export async function fetchSaleItems(saleId: string): Promise<{
  id: string;
  sale_id: string;
  company_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  sort_order: number;
  created_at: string | null;
}[]> {
  const context = await getSalesContext();
  if (context.error || !context.companyId || !saleId) return [];

  const { data } = await context.supabase
    .from("sale_items")
    .select("id, sale_id, company_id, description, quantity, unit_price, sort_order, created_at")
    .eq("sale_id", saleId)
    .eq("company_id", context.companyId)
    .order("sort_order", { ascending: true });

  return (data ?? []).map((row) => ({
    id: String(row.id),
    sale_id: String(row.sale_id),
    company_id: String(row.company_id),
    description: String(row.description ?? ""),
    quantity: Number(row.quantity ?? 1),
    unit_price: Number(row.unit_price ?? 0),
    sort_order: Number(row.sort_order ?? 0),
    created_at: row.created_at as string | null,
  }));
}

export async function fetchSalePayments(saleId: string): Promise<{
  id: string;
  amount: number;
  payment_method: string | null;
  payment_date: string;
  note: string | null;
  created_at: string | null;
}[]> {
  const context = await getSalesContext();
  if (context.error || !context.companyId || !saleId) return [];

  const { data } = await context.supabase
    .from("sale_payments")
    .select("id, amount, payment_method, payment_date, note, created_at")
    .eq("sale_id", saleId)
    .eq("company_id", context.companyId)
    .order("payment_date", { ascending: true });

  return (data ?? []).map((row) => ({
    id: String(row.id),
    amount: Number(row.amount ?? 0),
    payment_method: row.payment_method as string | null,
    payment_date: String(row.payment_date ?? ""),
    note: row.note as string | null,
    created_at: row.created_at as string | null,
  }));
}

export async function recordPayment(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  void prevState;

  const context = await getSalesContext();
  if (context.error || !context.companyId) {
    return fail(context.error ?? "No se pudo validar el usuario.");
  }
  if (!canManageSalesRecords(context.role)) {
    return fail("No tienes permisos para registrar pagos.");
  }

  const saleId = getString(formData, "saleId");
  const amountRaw = getString(formData, "amount");
  const paymentMethod = normalizePaymentMethod(getString(formData, "paymentMethod"));
  const paymentDate = getString(formData, "paymentDate");
  const note = getString(formData, "note");

  if (!saleId) return fail("Venta no encontrada.");

  const amount = parseMoney(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return fail("Ingresa un monto válido mayor a 0.");
  }

  if (!paymentMethod) {
    return fail("Selecciona un método de pago válido.");
  }

  if (!paymentDate || !isValidDateOnly(paymentDate)) {
    return fail("Selecciona una fecha de pago válida.");
  }

  const { error } = await context.supabase.rpc("record_sale_payment", {
    p_sale_id: saleId,
    p_company_id: context.companyId,
    p_amount: roundMoney(amount),
    p_payment_date: paymentDate,
    p_payment_method: paymentMethod,
    p_note: note || null,
    p_reference: null,
  });

  if (error) return fail(error.message || "No se pudo registrar el pago.");

  revalidateSalesPages();
  return ok("Pago registrado correctamente.");
}

// ─── Recalcular totales de venta desde pagos ────────────────────────────────

async function recalcSaleTotals(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  saleId: string,
  companyId: string
): Promise<void> {
  const [{ data: sale }, { data: payments }] = await Promise.all([
    supabase
      .from("sales")
      .select("amount, discount_amount")
      .eq("id", saleId)
      .eq("company_id", companyId)
      .single(),
    supabase
      .from("sale_payments")
      .select("amount")
      .eq("sale_id", saleId)
      .eq("company_id", companyId),
  ]);

  if (!sale) return;

  const paidAmount = roundMoney(
    (payments ?? []).reduce((s: number, r: { amount: unknown }) => s + Number(r.amount ?? 0), 0)
  );
  const subtotal = roundMoney(Number(sale.amount ?? 0) - Number(sale.discount_amount ?? 0));
  const balanceDue = roundMoney(Math.max(0, subtotal - paidAmount));
  const paymentStatus = balanceDue <= 0 ? "paid" : paidAmount > 0 ? "partial" : "pending";

  await supabase
    .from("sales")
    .update({ paid_amount: paidAmount, balance_due: balanceDue, payment_status: paymentStatus })
    .eq("id", saleId)
    .eq("company_id", companyId);
}

// ─── Editar pago ────────────────────────────────────────────────────────────

export async function editPayment(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  void prevState;

  const context = await getSalesContext();
  if (context.error || !context.companyId) {
    return fail(context.error ?? "No se pudo validar el usuario.");
  }
  if (!canManageSalesRecords(context.role)) {
    return fail("No tienes permisos para editar pagos.");
  }

  const paymentId = getString(formData, "paymentId");
  const saleId = getString(formData, "saleId");
  const amountRaw = getString(formData, "amount");
  const paymentMethod = normalizePaymentMethod(getString(formData, "paymentMethod"));
  const paymentDate = getString(formData, "paymentDate");
  const note = getString(formData, "note");

  if (!paymentId || !saleId) return fail("Pago no encontrado.");

  const amount = parseMoney(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return fail("Ingresa un monto válido mayor a 0.");
  }
  if (!paymentMethod) return fail("Selecciona un método de pago válido.");
  if (!paymentDate || !isValidDateOnly(paymentDate)) {
    return fail("Selecciona una fecha de pago válida.");
  }

  const { error } = await context.supabase
    .from("sale_payments")
    .update({
      amount: roundMoney(amount),
      payment_method: paymentMethod,
      payment_date: paymentDate,
      note: note || null,
    })
    .eq("id", paymentId)
    .eq("sale_id", saleId)
    .eq("company_id", context.companyId);

  if (error) return fail(error.message || "No se pudo actualizar el pago.");

  await recalcSaleTotals(context.supabase, saleId, context.companyId);
  revalidateSalesPages();
  return ok("Pago actualizado.");
}

// ─── Eliminar pago ──────────────────────────────────────────────────────────

export async function deletePayment(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  void prevState;

  const context = await getSalesContext();
  if (context.error || !context.companyId) {
    return fail(context.error ?? "No se pudo validar el usuario.");
  }
  if (!canManageSalesRecords(context.role)) {
    return fail("No tienes permisos para eliminar pagos.");
  }

  const paymentId = getString(formData, "paymentId");
  const saleId = getString(formData, "saleId");

  if (!paymentId || !saleId) return fail("Pago no encontrado.");

  const { error } = await context.supabase
    .from("sale_payments")
    .delete()
    .eq("id", paymentId)
    .eq("sale_id", saleId)
    .eq("company_id", context.companyId);

  if (error) return fail(error.message || "No se pudo eliminar el pago.");

  await recalcSaleTotals(context.supabase, saleId, context.companyId);
  revalidateSalesPages();
  return ok("Pago eliminado.");
}

export async function deleteSale(formData: FormData): Promise<void> {
  const context = await getSalesContext();

  if (context.error || !context.companyId) {
    return;
  }
  if (!canManageSalesRecords(context.role)) {
    return;
  }

  const saleId = getString(formData, "saleId");

  if (!saleId) {
    return;
  }

  // Restaurar stock antes de eliminar los ítems
  const { data: saleItems } = await context.supabase
    .from("sale_items")
    .select("product_id, quantity")
    .eq("sale_id", saleId)
    .eq("company_id", context.companyId);

  const itemsWithProduct = (saleItems ?? []).filter(
    (item): item is { product_id: string; quantity: number } =>
      Boolean(item.product_id)
  );

  if (itemsWithProduct.length > 0) {
    // Agrupar cantidades por product_id
    const qtyByProduct = new Map<string, number>();
    for (const item of itemsWithProduct) {
      qtyByProduct.set(
        item.product_id,
        (qtyByProduct.get(item.product_id) ?? 0) + Number(item.quantity)
      );
    }

    const productIds = [...qtyByProduct.keys()];
    const { data: products } = await context.supabase
      .from("products")
      .select("id, stock, track_inventory")
      .in("id", productIds)
      .eq("company_id", context.companyId);

    const tracked = (products ?? []).filter((p) => p.track_inventory);

    if (tracked.length > 0) {
      await Promise.all(
        tracked.map((product) => {
          const returnQty = qtyByProduct.get(product.id) ?? 0;
          const newStock = Number(product.stock ?? 0) + returnQty;
          return context.supabase
            .from("products")
            .update({ stock: newStock })
            .eq("id", product.id)
            .eq("company_id", context.companyId);
        })
      );
      revalidatePath("/dashboard/inventario");
    }
  }

  const { error: deleteItemsError } = await context.supabase
    .from("sale_items")
    .delete()
    .eq("sale_id", saleId)
    .eq("company_id", context.companyId);

  if (deleteItemsError) {
    return;
  }

  const { error: deleteSaleError } = await context.supabase
    .from("sales")
    .delete()
    .eq("id", saleId)
    .eq("company_id", context.companyId);

  if (deleteSaleError) {
    return;
  }

  revalidateSalesPages();
}

export type SalePlanSummary = {
  frequency: string;
  installment_amount: number;
  pending_count: number;
  next_due_date: string | null;
};

export async function fetchSalePlan(saleId: string): Promise<SalePlanSummary | null> {
  const context = await getSalesContext();
  if (context.error || !context.companyId || !saleId) return null;

  const { data: plan } = await context.supabase
    .from("sale_payment_plans")
    .select("frequency, installment_amount")
    .eq("sale_id", saleId)
    .eq("company_id", context.companyId)
    .maybeSingle();

  if (!plan) return null;

  const { data: installments } = await context.supabase
    .from("sale_installments")
    .select("due_date")
    .eq("sale_id", saleId)
    .eq("company_id", context.companyId)
    .neq("status", "paid")
    .order("due_date", { ascending: true });

  const pending = installments ?? [];

  return {
    frequency: String(plan.frequency ?? ""),
    installment_amount: Number(plan.installment_amount ?? 0),
    pending_count: pending.length,
    next_due_date: pending[0]?.due_date ?? null,
  };
}
