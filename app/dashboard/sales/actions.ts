"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "../../../lib/supabase/server";
import { PAYMENT_METHODS, type PaymentMethodOptionFull } from "../../../lib/payments";
import {
  SPECIAL_ADMIN_RELATED_ID,
  canEditManualTransactionDates,
  isGlobalAdminEmail,
} from "../../../lib/admin-auth";
import { canAccessCompanyApp } from "../../../lib/memberships/app-access";
import {
  getNextDocumentNumber,
  isDuplicateDocumentNumberError,
} from "../../../lib/document-numbering";
import { calculateSalePaymentSummary } from "./payment-summary";

type ActionState = {
  success: boolean;
  message: string;
  timestamp?: number;
  // ACCOUNT_INACTIVE: canAccessCompanyApp negó el acceso (la UI muestra el popup de facturación)
  code?: "ACCOUNT_INACTIVE";
  // Solo con ACCOUNT_INACTIVE: true si el usuario es owner (puede abrir /dashboard/billing)
  canManageBilling?: boolean;
};

type SalePaymentRow = {
  id: string;
  amount: number;
  payment_method: string | null;
  payment_date: string;
  note: string | null;
  created_at: string | null;
  is_initial_down_payment?: boolean;
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

export type EditableInstallmentPlan = {
  saleId: string;
  saleAmount: number;
  customerPhone: string | null;
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

// Rechazo por contexto: distingue la cuenta inactiva (código) del resto de errores
function failContext(context: {
  error?: string | null;
  accountInactive?: boolean;
  canManageBilling?: boolean;
}): ActionState {
  const result = fail(context.error ?? "No se pudo validar el usuario.");
  return context.accountInactive
    ? { ...result, code: "ACCOUNT_INACTIVE", canManageBilling: context.canManageBilling === true }
    : result;
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

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getInstallmentDueDate(startDate: string, frequency: InstallmentFrequency, index: number) {
  const baseDate = new Date(`${startDate}T00:00:00`);
  if (frequency === "weekly") return formatDateOnly(addDays(baseDate, index * 7));
  if (frequency === "biweekly") return formatDateOnly(addDays(baseDate, index * 14));
  return formatDateOnly(addMonths(baseDate, index));
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
    .select("company_id, role, companies(owner_user_id, name, subscription_status, subscription_plan, trial_ends_at, current_period_ends_at, is_blocked)")
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
    owner_user_id?: string | null;
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
      error: "Tu cuenta necesita pago activo para usar ventas.",
      accountInactive: true,
      // Misma regla que app/dashboard/layout.tsx: solo el owner accede a Facturación
      canManageBilling: String(membership.role ?? "").toLowerCase() === "owner",
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
      company?.owner_user_id ?? null,
    companyName:
      company?.name ?? null,
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

type RpcError = { code?: string; message?: string; hint?: string } | null;

// Mensajes de la RPC create_sale_with_items que sí se pueden mostrar al usuario
function getSaleRpcErrorMessage(error: RpcError, fallback: string) {
  if (!error) return fallback;
  if (error.hint === "insufficient_stock") return error.message || "Stock insuficiente.";
  if ((error.code === "22023" || error.code === "42501") && error.message) return error.message;
  return fallback;
}

function toSaleItemsPayload(items: SaleItemInput[]) {
  return items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    sort_order: item.sort_order,
    product_id: item.product_id || null,
  }));
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
  // Misma posición que el resto de campos del ítem; vacío = servicio / sin producto
  const productIds = formData.getAll("productId[]").map((v) => String(v ?? "").trim());

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
      product_id: productIds[index] || null,
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

// Ítems de una venta vinculados a inventario (product_id). Si existen, la edición
// no puede reemplazarlos: se perdería la asociación y no se restauraría el stock.
async function getInventoryLinkedItems(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  saleId: string;
  companyId: string;
}): Promise<{ linked: boolean; subtotal: number; error: string | null }> {
  const { supabase, saleId, companyId } = params;

  const { data, error } = await supabase
    .from("sale_items")
    .select("quantity, unit_price, product_id")
    .eq("sale_id", saleId)
    .eq("company_id", companyId);

  if (error) {
    return { linked: false, subtotal: 0, error: "No se pudieron validar los ítems de la venta." };
  }

  const rows = data ?? [];
  return {
    linked: rows.some((row) => Boolean(row.product_id)),
    subtotal: roundMoney(
      rows.reduce((sum, row) => sum + Number(row.quantity ?? 0) * Number(row.unit_price ?? 0), 0)
    ),
    error: null,
  };
}

const INVENTORY_LINKED_EDIT_ERROR =
  "Esta venta incluye productos de inventario: no se puede cambiar su monto. Elimínala y regístrala de nuevo.";

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
    return failContext(context);
  }

  const customerName = getString(formData, "customerName");
  const customerCompany = getString(formData, "customerCompany");
  const customerEmail = getString(formData, "customerEmail");
  const customerPhone = getString(formData, "customerPhone");
  const customerRuc = getString(formData, "customerRuc").slice(0, 40);
  const customerDv = getString(formData, "customerDv").slice(0, 4);

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
  const discountAmountRaw = getString(formData, "discountAmount");
  const discountAmount = Math.max(0, roundMoney(parseMoney(discountAmountRaw)));
  if (discountAmount > 0 && discountAmount >= subtotal) {
    return fail("El descuento debe ser menor al total.");
  }
  const finalAmount = discountAmount > 0 ? roundMoney(subtotal - discountAmount) : subtotal;
  const parsedPlan = parseInstallmentPlan(formData, finalAmount);

  if ("error" in parsedPlan) {
    return fail(parsedPlan.error);
  }

  const plan = parsedPlan.data;

  const noteValue =
    note || invoiceNotes || parsedItems.items[0]?.description || null;

  // Venta + plan + cuotas + ítems + stock en una sola transacción (RPC).
  // Si el número de factura choca, la RPC revierte todo y se reintenta.
  let rpcError: RpcError = null;
  for (let attempt = 0; attempt < DOCUMENT_NUMBER_RETRIES; attempt += 1) {
    let invoiceNumber: string;
    try {
      invoiceNumber = await getNextInvoiceNumber(context, attempt);
    } catch {
      return fail("No se pudo generar el número del documento. Intenta nuevamente.");
    }
    const { error } = await context.supabase.rpc("create_sale_with_items", {
      p_company_id: context.companyId,
      p_invoice_number: invoiceNumber,
      p_sale: {
        customer_name: customerName || null,
        customer_company: customerCompany || null,
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        customer_ruc: customerRuc || null,
        customer_dv: customerDv || null,
        amount: finalAmount,
        discount_amount: discountAmount,
        payment_method: paymentMethod,
        sale_date: saleDate,
        payment_date: paymentDate || null,
        note: noteValue,
        invoice_notes: invoiceNotes || null,
      },
      p_items: toSaleItemsPayload(parsedItems.items),
      p_plan: {
        down_payment_amount: plan.downPaymentAmount,
        plan_name: plan.planName,
        frequency: plan.frequency,
        installment_amount: plan.installmentAmount,
        installments_count: plan.installmentsCount,
        start_date: plan.startDate,
        plan_notes: plan.planNotes,
      },
    });

    rpcError = error;
    if (!error) break;
    if (!isDuplicateDocumentNumberError(error)) break;
  }

  if (rpcError) {
    if (isDuplicateDocumentNumberError(rpcError)) {
      return fail("No se pudo generar el número del documento. Intenta nuevamente.");
    }
    return fail(getSaleRpcErrorMessage(rpcError, "No se pudo crear la venta con plan."));
  }

  if (parsedItems.items.some((item) => item.product_id)) {
    revalidatePath("/dashboard/inventario");
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

  // Cuenta inactiva: se rechaza antes de validar datos o ejecutar cualquier RPC
  if (context.error || !context.companyId || !context.userId) {
    return failContext(context);
  }

  const customerName = getString(formData, "customerName");
  const customerCompany = getString(formData, "customerCompany");
  const customerEmail = getString(formData, "customerEmail");
  const customerPhone = getString(formData, "customerPhone");
  const customerRuc = getString(formData, "customerRuc").slice(0, 40);
  const customerDv = getString(formData, "customerDv").slice(0, 4);

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

  // Venta + ítems + stock en una sola transacción (RPC). Stock insuficiente,
  // producto ajeno o cualquier fallo revierte todo. Si el número de factura
  // choca, la RPC revierte y se reintenta con el siguiente.
  let rpcError: RpcError = null;
  for (let attempt = 0; attempt < DOCUMENT_NUMBER_RETRIES; attempt += 1) {
    let invoiceNumber: string;
    try {
      invoiceNumber = await getNextInvoiceNumber(context, attempt);
    } catch {
      return fail("No se pudo generar el número del documento. Intenta nuevamente.");
    }
    const { error } = await context.supabase.rpc("create_sale_with_items", {
      p_company_id: context.companyId,
      p_invoice_number: invoiceNumber,
      p_sale: {
        customer_name: customerName || null,
        customer_company: customerCompany || null,
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        customer_ruc: customerRuc || null,
        customer_dv: customerDv || null,
        amount: finalAmount,
        discount_amount: discountAmount,
        paid_amount: paymentSnapshot.paidAmount,
        balance_due: paymentSnapshot.balanceDue,
        payment_status: paymentSnapshot.paymentStatus,
        payment_method: paymentMethod,
        payment_type: paymentType,
        sale_date: saleDate,
        payment_date: paymentDate || null,
        note: noteValue,
        invoice_notes: invoiceNotes || null,
      },
      p_items: toSaleItemsPayload(parsedItems.items),
      p_plan: null,
    });

    rpcError = error;
    if (!error) break;
    if (!isDuplicateDocumentNumberError(error)) break;
  }

  if (rpcError) {
    if (isDuplicateDocumentNumberError(rpcError)) {
      return fail("No se pudo generar el número del documento. Intenta nuevamente.");
    }
    return fail(getSaleRpcErrorMessage(rpcError, "No se pudo registrar la venta."));
  }

  if (parsedItems.items.some((item) => item.product_id)) {
    revalidatePath("/dashboard/inventario");
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
    if (paymentType !== "installment") {
      return fail("Las ventas a cuota deben conservar el tipo de pago cuotas.");
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

    const inventoryItems = await getInventoryLinkedItems({
      supabase: context.supabase,
      saleId,
      companyId: context.companyId,
    });
    if (inventoryItems.error) {
      return fail(inventoryItems.error);
    }
    if (inventoryItems.linked && inventoryItems.subtotal !== subtotal) {
      return fail(INVENTORY_LINKED_EDIT_ERROR);
    }

    const discountAmountRaw = getString(formData, "discountAmount");
    const discountAmount = Math.max(0, roundMoney(parseMoney(discountAmountRaw)));
    if (discountAmount > 0 && discountAmount >= subtotal) {
      return fail("El descuento debe ser menor al total.");
    }

    const finalAmount = discountAmount > 0 ? roundMoney(subtotal - discountAmount) : subtotal;
    const downPaymentAmount = roundMoney(parseMoney(getStringFromKeys(formData, ["paidAmount"])));

    if (!Number.isFinite(downPaymentAmount) || downPaymentAmount < 0) {
      return fail("El abono inicial no es válido.");
    }

    if (downPaymentAmount > finalAmount) {
      return fail("El abono inicial no puede ser mayor al total.");
    }

    const { data: existingPayments, error: paymentsError } = await context.supabase
      .from("sale_payments")
      .select("amount")
      .eq("sale_id", saleId)
      .eq("company_id", context.companyId);

    if (paymentsError) {
      return fail(paymentsError.message || "No se pudieron validar los pagos registrados.");
    }

    const laterPaymentsAmount = roundMoney(
      (existingPayments ?? []).reduce(
        (sum: number, payment: { amount: unknown }) =>
          sum + Number(payment.amount ?? 0),
        0
      )
    );
    const totalCollected = roundMoney(downPaymentAmount + laterPaymentsAmount);

    if (finalAmount < totalCollected) {
      return fail("El total de la venta no puede ser menor que el monto ya cobrado.");
    }

    const noteValue = note || invoiceNotes || parsedItems.items[0]?.description || null;
    const { data: updatedSale, error: updateSaleError } = await context.supabase
      .from("sales")
      .update({
        customer_name: customerName || null,
        customer_company: customerCompany || null,
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        amount: finalAmount,
        discount_amount: discountAmount,
        payment_method: paymentMethod,
        sale_date: saleDate,
        payment_date: paymentDate || null,
        note: noteValue,
        invoice_notes: invoiceNotes || null,
      })
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

    const { error: updatePlanError } = await context.supabase
      .from("sale_payment_plans")
      .update({ down_payment_amount: downPaymentAmount })
      .eq("sale_id", saleId)
      .eq("company_id", context.companyId);

    if (updatePlanError) {
      return fail(updatePlanError.message || "No se pudo actualizar el abono inicial.");
    }

    // Los ítems vinculados a inventario se conservan tal cual (mismo subtotal)
    if (!inventoryItems.linked) {
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
    }

    await recalcSaleTotals(context.supabase, saleId, context.companyId);
    revalidateSalesPages();
    return ok("Venta actualizada correctamente.");
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

  const inventoryItems = await getInventoryLinkedItems({
    supabase: context.supabase,
    saleId,
    companyId: context.companyId,
  });
  if (inventoryItems.error) {
    return fail(inventoryItems.error);
  }
  if (inventoryItems.linked && inventoryItems.subtotal !== subtotal) {
    return fail(INVENTORY_LINKED_EDIT_ERROR);
  }

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

  // Los ítems vinculados a inventario se conservan tal cual (mismo subtotal)
  if (!inventoryItems.linked) {
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

export async function fetchSalePayments(saleId: string): Promise<SalePaymentRow[]> {
  const context = await getSalesContext();
  if (context.error || !context.companyId || !saleId) return [];

  const [{ data }, { data: sale }, { data: plan }] = await Promise.all([
    context.supabase
      .from("sale_payments")
      .select("id, amount, payment_method, payment_date, note, created_at")
      .eq("sale_id", saleId)
      .eq("company_id", context.companyId)
      .order("payment_date", { ascending: true }),
    context.supabase
      .from("sales")
      .select("payment_method, payment_date, sale_date, payment_type, has_payment_plan")
      .eq("id", saleId)
      .eq("company_id", context.companyId)
      .maybeSingle(),
    context.supabase
      .from("sale_payment_plans")
      .select("down_payment_amount")
      .eq("sale_id", saleId)
      .eq("company_id", context.companyId)
      .maybeSingle(),
  ]);

  const rows: SalePaymentRow[] = (data ?? []).map((row) => ({
    id: String(row.id),
    amount: Number(row.amount ?? 0),
    payment_method: row.payment_method as string | null,
    payment_date: String(row.payment_date ?? ""),
    note: row.note as string | null,
    created_at: row.created_at as string | null,
  }));

  const isInstallmentSale =
    String(sale?.payment_type ?? "").toLowerCase() === "installment" ||
    Boolean(sale?.has_payment_plan);
  const downPaymentAmount = roundMoney(Number(plan?.down_payment_amount ?? 0));

  if (isInstallmentSale && downPaymentAmount > 0) {
    rows.unshift({
      id: `down-payment:${saleId}`,
      amount: downPaymentAmount,
      payment_method: (sale?.payment_method as string | null) ?? null,
      payment_date: String(sale?.payment_date ?? sale?.sale_date ?? ""),
      note: "Abono inicial",
      created_at: null,
      is_initial_down_payment: true,
    });
  }

  return rows;
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

  await recalcSaleTotals(context.supabase, saleId, context.companyId);
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
  const [{ data: sale }, { data: payments }, { data: plan }, { data: paidInstallments }] = await Promise.all([
    supabase
      .from("sales")
      .select("amount, payment_type, has_payment_plan")
      .eq("id", saleId)
      .eq("company_id", companyId)
      .single(),
    supabase
      .from("sale_payments")
      .select("amount, created_at")
      .eq("sale_id", saleId)
      .eq("company_id", companyId),
    supabase
      .from("sale_payment_plans")
      .select("down_payment_amount")
      .eq("sale_id", saleId)
      .eq("company_id", companyId)
      .maybeSingle(),
    supabase
      .from("sale_installments")
      .select("paid_at")
      .eq("sale_id", saleId)
      .eq("company_id", companyId)
      .eq("status", "paid"),
  ]);

  if (!sale) return;

  const laterPaymentsAmount = roundMoney(
    (payments ?? []).reduce((s: number, r: { amount: unknown }) => s + Number(r.amount ?? 0), 0)
  );
  const paymentSummary = calculateSalePaymentSummary({
    sale,
    paymentsAmount: laterPaymentsAmount,
    downPaymentAmount: Number(plan?.down_payment_amount ?? 0),
  });
  const paidAmount = paymentSummary.collectedAmount;
  const balanceDue = paymentSummary.pendingBalance;
  const paymentStatus = balanceDue <= 0 ? "paid" : paidAmount > 0 ? "partial" : "pending";
  const lastPaymentAt = [...(payments ?? []), ...(paidInstallments ?? [])]
    .map((row: { created_at?: unknown; paid_at?: unknown }) => row.created_at ?? row.paid_at)
    .filter(Boolean)
    .map((value: unknown) => new Date(String(value)).getTime())
    .filter((value: number) => Number.isFinite(value))
    .sort((a: number, b: number) => b - a)[0];

  await supabase
    .from("sales")
    .update({
      paid_amount: paidAmount,
      balance_due: balanceDue,
      payment_status: paymentStatus,
      last_payment_at: lastPaymentAt ? new Date(lastPaymentAt).toISOString() : null,
    })
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

export async function fetchEditableInstallmentPlan(
  saleId: string
): Promise<EditableInstallmentPlan | null> {
  const context = await getSalesContext();
  if (context.error || !context.companyId || !saleId) return null;
  if (!canManageSalesRecords(context.role)) return null;

  const [{ data: sale }, { data: plan }] = await Promise.all([
    context.supabase
      .from("sales")
      .select("id, amount, customer_phone, payment_type, has_payment_plan")
      .eq("id", saleId)
      .eq("company_id", context.companyId)
      .maybeSingle(),
    context.supabase
      .from("sale_payment_plans")
      .select("plan_name, down_payment_amount, installment_amount, installments_count, frequency, start_date, notes")
      .eq("sale_id", saleId)
      .eq("company_id", context.companyId)
      .maybeSingle(),
  ]);

  if (
    !sale?.id ||
    !plan ||
    String(sale.payment_type ?? "").toLowerCase() !== "installment" ||
    !sale.has_payment_plan
  ) {
    return null;
  }

  const frequency = String(plan.frequency ?? "monthly") as InstallmentFrequency;
  if (!ALLOWED_INSTALLMENT_FREQUENCIES.includes(frequency)) return null;

  return {
    saleId: String(sale.id),
    saleAmount: Number(sale.amount ?? 0),
    customerPhone: sale.customer_phone as string | null,
    planName: plan.plan_name as string | null,
    frequency,
    installmentAmount: Number(plan.installment_amount ?? 0),
    installmentsCount: Number(plan.installments_count ?? 0),
    startDate: String(plan.start_date ?? ""),
    planNotes: plan.notes as string | null,
    downPaymentAmount: Number(plan.down_payment_amount ?? 0),
  };
}

export async function updateSaleInstallmentPlan(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  void prevState;

  const context = await getSalesContext();
  if (context.error || !context.companyId || !context.userId) {
    return fail(context.error ?? "No se pudo validar el usuario.");
  }
  if (!canManageSalesRecords(context.role)) {
    return fail("No tienes permisos para editar cuotas.");
  }

  const saleId = getString(formData, "saleId");
  if (!saleId) return fail("No se encontró la venta a editar.");

  const { data: sale, error: saleError } = await context.supabase
    .from("sales")
    .select("id, amount, payment_type, has_payment_plan")
    .eq("id", saleId)
    .eq("company_id", context.companyId)
    .maybeSingle();

  if (saleError) return fail(saleError.message || "No se pudo validar la venta.");
  if (
    !sale?.id ||
    String(sale.payment_type ?? "").toLowerCase() !== "installment" ||
    !sale.has_payment_plan
  ) {
    return fail("Esta venta no tiene un plan de cuotas editable.");
  }

  const [{ count: paymentsCount }, { count: paidInstallmentsCount }] = await Promise.all([
    context.supabase
      .from("sale_payments")
      .select("id", { count: "exact", head: true })
      .eq("sale_id", saleId)
      .eq("company_id", context.companyId),
    context.supabase
      .from("sale_installments")
      .select("id", { count: "exact", head: true })
      .eq("sale_id", saleId)
      .eq("company_id", context.companyId)
      .eq("status", "paid"),
  ]);

  if ((paymentsCount ?? 0) > 0 || (paidInstallmentsCount ?? 0) > 0) {
    return fail("No se pueden editar cuotas que ya tienen pagos registrados.");
  }

  const subtotal = roundMoney(Number(sale.amount ?? 0));
  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return fail("El monto de la venta no es válido.");
  }

  const parsedPlan = parseInstallmentPlan(formData, subtotal);
  if ("error" in parsedPlan) {
    return fail(parsedPlan.error);
  }

  const customerPhone = getString(formData, "customerPhone");
  const plan = parsedPlan.data;
  const remainingBalance = roundMoney(subtotal - plan.downPaymentAmount);
  const regularInstallmentsTotal = roundMoney(plan.installmentAmount * (plan.installmentsCount - 1));
  const lastInstallmentAmount = roundMoney(remainingBalance - regularInstallmentsTotal);

  if (lastInstallmentAmount <= 0) {
    return fail("El monto por cuota excede el saldo pendiente para la cantidad indicada.");
  }

  const installmentsPayload = Array.from({ length: plan.installmentsCount }, (_, index) => {
    const amount = index === plan.installmentsCount - 1
      ? lastInstallmentAmount
      : plan.installmentAmount;

    return {
      sale_id: saleId,
      company_id: context.companyId,
      installment_number: index + 1,
      due_date: getInstallmentDueDate(plan.startDate, plan.frequency, index),
      amount,
      paid_amount: 0,
      status: "pending",
    };
  });

  const { error: updatePlanError } = await context.supabase
    .from("sale_payment_plans")
    .update({
      plan_name: plan.planName,
      down_payment_amount: plan.downPaymentAmount,
      installment_amount: plan.installmentAmount,
      installments_count: plan.installmentsCount,
      frequency: plan.frequency,
      start_date: plan.startDate,
      notes: plan.planNotes,
    })
    .eq("sale_id", saleId)
    .eq("company_id", context.companyId);

  if (updatePlanError) {
    return fail(updatePlanError.message || "No se pudo actualizar el plan de cuotas.");
  }

  const { error: deleteInstallmentsError } = await context.supabase
    .from("sale_installments")
    .delete()
    .eq("sale_id", saleId)
    .eq("company_id", context.companyId);

  if (deleteInstallmentsError) {
    return fail(deleteInstallmentsError.message || "No se pudieron reemplazar las cuotas.");
  }

  const { error: insertInstallmentsError } = await context.supabase
    .from("sale_installments")
    .insert(installmentsPayload);

  if (insertInstallmentsError) {
    return fail(insertInstallmentsError.message || "No se pudieron guardar las cuotas.");
  }

  const paymentStatus = plan.downPaymentAmount > 0 ? "partial" : "pending";
  const { error: updateSaleError } = await context.supabase
    .from("sales")
    .update({
      customer_phone: customerPhone || null,
      paid_amount: plan.downPaymentAmount,
      balance_due: remainingBalance,
      payment_status: paymentStatus,
    })
    .eq("id", saleId)
    .eq("company_id", context.companyId);

  if (updateSaleError) {
    return fail(updateSaleError.message || "No se pudo actualizar el saldo de la venta.");
  }

  revalidateSalesPages();
  return ok("Plan de cuotas actualizado correctamente.");
}

export async function deleteSale(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  void prevState;

  const context = await getSalesContext();

  if (context.error || !context.companyId) {
    return fail(context.error ?? "No se pudo validar el usuario.");
  }
  if (!canManageSalesRecords(context.role)) {
    return fail("No tienes permisos para eliminar ventas.");
  }

  const saleId = getString(formData, "saleId");

  if (!saleId) {
    return fail("No se encontró la venta a eliminar.");
  }

  // Restaurar stock y eliminar en una sola transacción (RPC): si la
  // eliminación falla, el inventario no se modifica.
  const { error: deleteError } = await context.supabase.rpc("delete_sale_with_stock_restore", {
    p_company_id: context.companyId,
    p_sale_id: saleId,
  });

  if (deleteError) {
    // La RPC revirtió todo (stock y venta intactos); no se reporta como éxito.
    return fail(
      deleteError.code === "42501" || deleteError.code === "P0002"
        ? deleteError.message || "No se pudo eliminar la venta."
        : "No se pudo eliminar la venta. Intenta nuevamente."
    );
  }

  revalidatePath("/dashboard/inventario");
  revalidateSalesPages();
  return ok("Venta eliminada correctamente.");
}

export type SalePlanSummary = {
  frequency: string;
  installment_amount: number;
  pending_count: number;
  pending_amount: number;
  next_due_date: string | null;
  next_installment_number: number | null;
};

export async function fetchSalePlan(saleId: string): Promise<SalePlanSummary | null> {
  const context = await getSalesContext();
  if (context.error || !context.companyId || !saleId) return null;

  const [{ data: sale }, { data: plan }, { data: payments }, { data: installments }] = await Promise.all([
    context.supabase
      .from("sales")
      .select("amount, paid_amount, balance_due, payment_type, has_payment_plan")
      .eq("id", saleId)
      .eq("company_id", context.companyId)
      .maybeSingle(),
    context.supabase
      .from("sale_payment_plans")
      .select("frequency, installment_amount, down_payment_amount")
      .eq("sale_id", saleId)
      .eq("company_id", context.companyId)
      .maybeSingle(),
    context.supabase
      .from("sale_payments")
      .select("amount")
      .eq("sale_id", saleId)
      .eq("company_id", context.companyId),
    context.supabase
      .from("sale_installments")
      .select("installment_number, due_date, amount, paid_amount, status")
      .eq("sale_id", saleId)
      .eq("company_id", context.companyId)
      .order("due_date", { ascending: true })
      .order("installment_number", { ascending: true }),
  ]);

  if (!sale || !plan) return null;

  const laterPaymentsAmount = roundMoney(
    (payments ?? []).reduce(
      (sum: number, payment: { amount: unknown }) =>
        sum + Number(payment.amount ?? 0),
      0
    )
  );
  const downPaymentAmount = roundMoney(Number(plan.down_payment_amount ?? 0));
  const paymentSummary = calculateSalePaymentSummary({
    sale,
    paymentsAmount: laterPaymentsAmount,
    downPaymentAmount,
  });

  let appliedToInstallments = roundMoney(
    Math.max(0, paymentSummary.collectedAmount - downPaymentAmount)
  );
  const cancelledStatuses = new Set(["cancelled", "canceled", "void", "annulled"]);

  const pending = (installments ?? []).flatMap((installment) => {
    const status = String(installment.status ?? "").toLowerCase();
    const amount = roundMoney(Number(installment.amount ?? 0));
    const storedPaid = roundMoney(Number(installment.paid_amount ?? 0));
    const paidFromPayments = roundMoney(Math.min(amount, Math.max(0, appliedToInstallments)));
    appliedToInstallments = roundMoney(Math.max(0, appliedToInstallments - amount));

    if (status === "paid" || cancelledStatuses.has(status)) return [];

    const effectivePaid = roundMoney(Math.max(storedPaid, paidFromPayments));
    const pendingAmount = roundMoney(Math.max(0, amount - effectivePaid));
    if (pendingAmount <= 0) return [];

    return [{
      installment_number: Number(installment.installment_number ?? 0),
      due_date: String(installment.due_date ?? ""),
      pending_amount: pendingAmount,
    }];
  });

  const next = pending[0] ?? null;

  return {
    frequency: String(plan.frequency ?? ""),
    installment_amount: Number(plan.installment_amount ?? 0),
    pending_count: pending.length,
    pending_amount: paymentSummary.pendingBalance,
    next_due_date: next?.due_date || null,
    next_installment_number: next?.installment_number || null,
  };
}
