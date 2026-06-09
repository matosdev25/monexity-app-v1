"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "../../../lib/supabase/server";
import {
  SPECIAL_ADMIN_RELATED_ID,
  canEditManualTransactionDates,
} from "../../../lib/admin-auth";
import {
  getNextDocumentNumber,
  isDuplicateDocumentNumberError,
} from "../../../lib/document-numbering";
import type { ExpenseActionState } from "./types";

export type { ExpenseActionState } from "./types";

const RECEIPT_BUCKET = "company-assets";
const DOCUMENT_NUMBER_RETRIES = 3;

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

async function requireMembership() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const cookieStore = await cookies();
  const activeCompanyId = cookieStore.get("active_company_id")?.value ?? null;

  const membershipQuery = supabase
    .from("memberships")
    .select("company_id, role, companies(owner_user_id, name)")
    .eq("user_id", user.id);

  const { data: membership, error } = await (
    activeCompanyId
      ? membershipQuery.eq("company_id", activeCompanyId)
      : membershipQuery.limit(1)
  ).maybeSingle();

  if (error || !membership) {
    redirect("/auth/error?message=No se encontró membresía activa");
  }

  const { data: specialAdminMembership } = await supabase
    .from("memberships")
    .select("company_id")
    .eq("company_id", membership.company_id)
    .eq("user_id", SPECIAL_ADMIN_RELATED_ID)
    .maybeSingle();

  return {
    supabase,
    user,
    membership,
    role: String(membership.role ?? "").toLowerCase(),
    canEditManualDates: canEditManualTransactionDates({
      email: user.email,
      userId: user.id,
      companyId: membership.company_id,
      companyOwnerUserId:
        (membership.companies as { owner_user_id?: string | null } | null)?.owner_user_id ?? null,
      hasSpecialAdminMembership: Boolean(specialAdminMembership?.company_id),
    }),
    companyName:
      (membership.companies as { name?: string | null } | null)?.name ?? null,
  };
}

function canManageExpenses(role: string | null | undefined) {
  return ["owner", "admin"].includes(String(role ?? "").toLowerCase());
}

async function uploadReceiptFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  file: File
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filePath = `companies/${companyId}/receipts/${Date.now()}.${fileExt}`;
  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = new Uint8Array(arrayBuffer);

  const { error } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .upload(filePath, fileBuffer, { contentType: file.type, upsert: false });

  if (error) return null;

  const { data } = supabase.storage.from(RECEIPT_BUCKET).getPublicUrl(filePath);
  return data.publicUrl ?? null;
}

async function getNextExpenseNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  companyName: string | null | undefined,
  offset = 0
) {
  return getNextDocumentNumber({
    supabase,
    table: "expenses",
    column: "expense_number",
    companyId,
    companyName,
    prefix: "GAS",
    offset,
  });
}

export async function createExpense(
  _prevState: ExpenseActionState,
  formData: FormData
): Promise<ExpenseActionState> {
  const { supabase, user, membership, canEditManualDates, companyName } = await requireMembership();

  const amount = Number(formData.get("amount"));
  const category = String(formData.get("category") || "");
  const note = String(formData.get("note") || "").trim() || null;
  const expenseDate = canEditManualDates
    ? String(formData.get("expenseDate") || "").slice(0, 10)
    : getTodayInPanama();
  const supplier = String(formData.get("supplier") || "").trim() || null;
  const paymentMethod = String(formData.get("paymentMethod") || "cash");
  const status = String(formData.get("status") || "paid");
  const isRecurring = formData.get("isRecurring") === "on";
  const recurringFrequency = isRecurring
    ? String(formData.get("recurringFrequency") || "monthly")
    : null;

  // Comprobante: archivo tiene prioridad sobre URL
  let receiptUrl = String(formData.get("receiptUrl") || "").trim() || null;
  const receiptFile = formData.get("receiptFile") as File | null;
  if (receiptFile && receiptFile.size > 0) {
    const uploaded = await uploadReceiptFile(supabase, membership.company_id, receiptFile);
    if (uploaded) receiptUrl = uploaded;
  }

  if (!amount || amount <= 0) {
    return { success: false, message: "Ingresa un monto válido.", timestamp: Date.now() };
  }
  if (!category) {
    return { success: false, message: "Selecciona una categoría.", timestamp: Date.now() };
  }
  if (!expenseDate) {
    return { success: false, message: "Selecciona una fecha.", timestamp: Date.now() };
  }

  let insertError: { code?: string; message?: string } | null = null;

  for (let attempt = 0; attempt < DOCUMENT_NUMBER_RETRIES; attempt += 1) {
    const expenseNumber = await getNextExpenseNumber(
      supabase,
      membership.company_id,
      companyName,
      attempt
    );
    const { error } = await supabase.from("expenses").insert({
      company_id: membership.company_id,
      created_by: user.id,
      expense_number: expenseNumber,
      amount,
      category,
      note,
      expense_date: expenseDate,
      supplier,
      payment_method: paymentMethod,
      status,
      receipt_url: receiptUrl,
      is_recurring: isRecurring,
      recurring_frequency: recurringFrequency,
    });

    insertError = error;

    if (!error) break;
    if (!isDuplicateDocumentNumberError(error)) break;
  }

  if (insertError) {
    return {
      success: false,
      message: "No se pudo generar el número del documento. Intenta nuevamente.",
      timestamp: Date.now(),
    };
  }

  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard");

  return { success: true, message: "Gasto registrado correctamente.", timestamp: Date.now() };
}

export async function updateExpense(
  _prevState: ExpenseActionState,
  formData: FormData
): Promise<ExpenseActionState> {
  const { supabase, membership, canEditManualDates } = await requireMembership();
  if (!canManageExpenses(String(membership.role ?? "").toLowerCase())) {
    return { success: false, message: "No tienes permisos para editar gastos.", timestamp: Date.now() };
  }

  const expenseId = String(formData.get("expenseId") || "");
  const amount = Number(formData.get("amount"));
  const category = String(formData.get("category") || "");
  const note = String(formData.get("note") || "").trim() || null;
  const submittedExpenseDate = String(formData.get("expenseDate") || "").slice(0, 10);
  const supplier = String(formData.get("supplier") || "").trim() || null;
  const paymentMethod = String(formData.get("paymentMethod") || "cash");
  const status = String(formData.get("status") || "paid");
  const isRecurring = formData.get("isRecurring") === "on";
  const recurringFrequency = isRecurring
    ? String(formData.get("recurringFrequency") || "monthly")
    : null;

  let receiptUrl = String(formData.get("receiptUrl") || "").trim() || null;
  const receiptFile = formData.get("receiptFile") as File | null;
  if (receiptFile && receiptFile.size > 0) {
    const uploaded = await uploadReceiptFile(supabase, membership.company_id, receiptFile);
    if (uploaded) receiptUrl = uploaded;
  }

  if (!expenseId) {
    return { success: false, message: "Gasto inválido.", timestamp: Date.now() };
  }
  if (!amount || amount <= 0) {
    return { success: false, message: "Ingresa un monto válido.", timestamp: Date.now() };
  }
  if (!category) {
    return { success: false, message: "Selecciona una categoría.", timestamp: Date.now() };
  }
  let expenseDate = submittedExpenseDate;
  if (!canEditManualDates && expenseId) {
    const { data: existingExpense, error: existingExpenseError } = await supabase
      .from("expenses")
      .select("expense_date")
      .eq("id", expenseId)
      .eq("company_id", membership.company_id)
      .maybeSingle();

    if (existingExpenseError || !existingExpense?.expense_date) {
      return { success: false, message: "Gasto inválido.", timestamp: Date.now() };
    }

    expenseDate = existingExpense.expense_date;
  }
  if (!expenseDate) {
    return { success: false, message: "Selecciona una fecha.", timestamp: Date.now() };
  }

  const { error } = await supabase
    .from("expenses")
    .update({
      amount,
      category,
      note,
      expense_date: expenseDate,
      supplier,
      payment_method: paymentMethod,
      status,
      receipt_url: receiptUrl,
      is_recurring: isRecurring,
      recurring_frequency: recurringFrequency,
    })
    .eq("id", expenseId)
    .eq("company_id", membership.company_id);

  if (error) {
    return { success: false, message: error.message, timestamp: Date.now() };
  }

  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard");

  return { success: true, message: "Gasto actualizado correctamente.", timestamp: Date.now() };
}

export async function deleteExpense(formData: FormData) {
  const { supabase, membership } = await requireMembership();
  if (!canManageExpenses(String(membership.role ?? "").toLowerCase())) {
    redirect("/auth/error?message=No tienes permisos para eliminar gastos");
  }

  const expenseId = String(formData.get("expenseId") || "");

  if (!expenseId) {
    redirect("/auth/error?message=Gasto inválido");
  }

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .eq("company_id", membership.company_id);

  if (error) {
    redirect(`/auth/error?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard");
}
