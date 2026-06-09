"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "../../../lib/supabase/server";
import { formatShortDate } from "../../../lib/date-format";
import type { ClosureActionState, ClosureSnapshot } from "./types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const cookieStore = await cookies();
  const activeCompanyId = cookieStore.get("active_company_id")?.value ?? null;

  const membershipQuery = supabase
    .from("memberships")
    .select("company_id, role")
    .eq("user_id", user.id);

  const { data: membership, error } = await (
    activeCompanyId
      ? membershipQuery.eq("company_id", activeCompanyId)
      : membershipQuery.limit(1)
  ).maybeSingle();

  if (error || !membership)
    redirect("/auth/error?message=Sin membresía activa");

  const role = String(membership.role ?? "").toLowerCase();
  const canManage = ["owner", "admin"].includes(role);

  return { supabase, user, membership, role, canManage };
}

async function buildAndSaveSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  closureId: string,
  companyId: string,
  periodStart: string,
  periodEnd: string
): Promise<ClosureSnapshot> {
  const [{ data: salesData }, { data: expensesData }] = await Promise.all([
    supabase
      .from("sales")
      .select("amount, paid_amount, balance_due, payment_status")
      .eq("company_id", companyId)
      .gte("sale_date", periodStart)
      .lte("sale_date", periodEnd),
    supabase
      .from("expenses")
      .select("amount, receipt_url")
      .eq("company_id", companyId)
      .gte("expense_date", periodStart)
      .lte("expense_date", periodEnd),
  ]);

  const sales = salesData ?? [];
  const expenses = expensesData ?? [];

  const totalSales = sales.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const totalCollected = sales.reduce(
    (s, r) => s + Number(r.paid_amount ?? 0),
    0
  );
  const totalOpen = sales
    .filter((r) => r.payment_status !== "paid")
    .reduce((s, r) => s + Number(r.balance_due ?? 0), 0);
  const totalExpenses = expenses.reduce(
    (s, r) => s + Number(r.amount ?? 0),
    0
  );
  const expensesNoReceipt = expenses.filter((r) => !r.receipt_url).length;

  const snapshot: ClosureSnapshot = {
    totals: {
      sales: totalSales,
      expenses: totalExpenses,
      net: totalSales - totalExpenses,
      receivables_open: totalOpen,
      receivables_collected: totalCollected,
    },
    counts: {
      sales_total: sales.length,
      sales_paid: sales.filter((r) => r.payment_status === "paid").length,
      sales_pending: sales.filter((r) => r.payment_status !== "paid").length,
      expenses_total: expenses.length,
      expenses_no_receipt: expensesNoReceipt,
    },
    generated_at: new Date().toISOString(),
  };

  await supabase
    .from("period_closures")
    .update({ snapshot, updated_at: new Date().toISOString() })
    .eq("id", closureId);

  return snapshot;
}

// ─── Create Closure ───────────────────────────────────────────────────────────

export async function createClosure(
  _prevState: ClosureActionState,
  formData: FormData
): Promise<ClosureActionState> {
  const { supabase, user, membership, canManage } = await requireAuth();

  if (!canManage) {
    return {
      success: false,
      message: "Solo el dueño o administrador puede crear cierres.",
      timestamp: Date.now(),
    };
  }

  const periodMonths = Number(formData.get("period_months") ?? 3);
  const periodStart = String(formData.get("period_start") ?? "");
  const label = String(formData.get("label") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (![3, 6, 12].includes(periodMonths)) {
    return {
      success: false,
      message: "El período debe ser 3, 6 o 12 meses.",
      timestamp: Date.now(),
    };
  }
  if (!periodStart || !/^\d{4}-\d{2}-\d{2}$/.test(periodStart)) {
    return {
      success: false,
      message: "Selecciona la fecha de inicio del período.",
      timestamp: Date.now(),
    };
  }

  // Calculate end date
  const start = new Date(periodStart + "T12:00:00");
  const end = new Date(start);
  end.setMonth(end.getMonth() + periodMonths);
  end.setDate(end.getDate() - 1);
  const periodEnd = end.toISOString().split("T")[0];

  const { data: closure, error } = await supabase
    .from("period_closures")
    .insert({
      company_id: membership.company_id,
      created_by: user.id,
      period_months: periodMonths,
      period_start: periodStart,
      period_end: periodEnd,
      label,
      notes,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !closure) {
    return {
      success: false,
      message: error?.message ?? "Error al crear el cierre.",
      timestamp: Date.now(),
    };
  }

  revalidatePath("/dashboard/cierre");
  redirect(`/dashboard/cierre/${closure.id}`);
}

// ─── Validate Closure ─────────────────────────────────────────────────────────

export async function validateClosure(formData: FormData): Promise<void> {
  const { supabase, membership, canManage } = await requireAuth();
  if (!canManage) return;

  const closureId = String(formData.get("closureId") ?? "");
  if (!closureId) return;

  const { data: closure } = await supabase
    .from("period_closures")
    .select("id, period_start, period_end, status")
    .eq("id", closureId)
    .eq("company_id", membership.company_id)
    .maybeSingle();

  if (!closure || closure.status === "closed") return;

  const start = closure.period_start;
  const end = closure.period_end;
  const cid = membership.company_id;

  // Step 1: Rebuild snapshot
  const snapshot = await buildAndSaveSnapshot(
    supabase,
    closureId,
    cid,
    start,
    end
  );

  // Step 2: Delete active (non-resolved, non-ignored) issues
  await supabase
    .from("period_closure_issues")
    .delete()
    .eq("closure_id", closureId)
    .is("resolved_at", null)
    .is("ignored_at", null);

  // Step 3: Run checks
  type IssueInsert = {
    closure_id: string;
    company_id: string;
    severity: "error" | "warning" | "info";
    category: string;
    code: string;
    message: string;
    ref_table?: string | null;
    ref_id?: string | null;
  };

  const issues: IssueInsert[] = [];
  const MAX = 10;

  // Check: Sales with zero/null amount
  const { data: salesBadAmount } = await supabase
    .from("sales")
    .select("id, customer_name, sale_date")
    .eq("company_id", cid)
    .gte("sale_date", start)
    .lte("sale_date", end)
    .or("amount.is.null,amount.lte.0")
    .limit(MAX);

  for (const s of salesBadAmount ?? []) {
    issues.push({
      closure_id: closureId,
      company_id: cid,
      severity: "error",
      category: "sales",
      code: "SALE_ZERO_AMOUNT",
      message: `Venta del ${formatShortDate(s.sale_date)} (${s.customer_name ?? "sin cliente"}) tiene monto inválido.`,
      ref_table: "sales",
      ref_id: s.id,
    });
  }

  // Check: Sales marked paid but with balance_due > 0
  const { data: inconsistentPayments } = await supabase
    .from("sales")
    .select("id, customer_name, sale_date, balance_due")
    .eq("company_id", cid)
    .gte("sale_date", start)
    .lte("sale_date", end)
    .eq("payment_status", "paid")
    .gt("balance_due", 0)
    .limit(MAX);

  for (const s of inconsistentPayments ?? []) {
    issues.push({
      closure_id: closureId,
      company_id: cid,
      severity: "error",
      category: "sales",
      code: "SALE_PAYMENT_INCONSISTENT",
      message: `Venta de "${s.customer_name ?? "sin cliente"}" (${formatShortDate(s.sale_date)}) marcada como pagada pero tiene saldo de $${Number(s.balance_due).toFixed(2)}.`,
      ref_table: "sales",
      ref_id: s.id,
    });
  }

  // Check: Expenses without category
  const { data: expensesNoCategory } = await supabase
    .from("expenses")
    .select("id, amount, expense_date, supplier")
    .eq("company_id", cid)
    .gte("expense_date", start)
    .lte("expense_date", end)
    .is("category", null)
    .limit(MAX);

  for (const e of expensesNoCategory ?? []) {
    issues.push({
      closure_id: closureId,
      company_id: cid,
      severity: "error",
      category: "expenses",
      code: "EXPENSE_NO_CATEGORY",
      message: `Gasto del ${formatShortDate(e.expense_date)} por $${Number(e.amount).toFixed(2)}${e.supplier ? ` (${e.supplier})` : ""} no tiene categoría.`,
      ref_table: "expenses",
      ref_id: e.id,
    });
  }

  // Check: Installment sales without payment plan
  const { data: installmentNoPlan } = await supabase
    .from("sales")
    .select("id, customer_name, sale_date")
    .eq("company_id", cid)
    .gte("sale_date", start)
    .lte("sale_date", end)
    .eq("payment_type", "installment")
    .eq("has_payment_plan", false)
    .limit(MAX);

  for (const s of installmentNoPlan ?? []) {
    issues.push({
      closure_id: closureId,
      company_id: cid,
      severity: "warning",
      category: "sales",
      code: "INSTALLMENT_MISSING_PLAN",
      message: `Venta a cuotas de "${s.customer_name ?? "sin cliente"}" (${formatShortDate(s.sale_date)}) no tiene plan de pago configurado.`,
      ref_table: "sales",
      ref_id: s.id,
    });
  }

  // Check: Expenses without receipt (aggregate warning)
  if (snapshot.counts.expenses_no_receipt > 0) {
    issues.push({
      closure_id: closureId,
      company_id: cid,
      severity: "warning",
      category: "documents",
      code: "EXPENSE_NO_RECEIPT",
      message: `${snapshot.counts.expenses_no_receipt} gasto(s) no tienen comprobante adjunto.`,
      ref_table: null,
      ref_id: null,
    });
  }

  // Check: Open receivables (aggregate warning)
  if (snapshot.counts.sales_pending > 0) {
    issues.push({
      closure_id: closureId,
      company_id: cid,
      severity: "warning",
      category: "receivables",
      code: "OPEN_RECEIVABLES",
      message: `${snapshot.counts.sales_pending} venta(s) tienen saldo pendiente por cobrar ($${snapshot.totals.receivables_open.toFixed(2)} en total).`,
      ref_table: null,
      ref_id: null,
    });
  }

  // Check: Negative stock (only if needs_inventory)
  const { data: companyData } = await supabase
    .from("companies")
    .select("needs_inventory")
    .eq("id", cid)
    .maybeSingle();

  if (companyData?.needs_inventory) {
    const { data: negativeStock } = await supabase
      .from("products")
      .select("id, name, stock")
      .eq("company_id", cid)
      .eq("track_inventory", true)
      .lt("stock", 0)
      .limit(MAX);

    for (const p of negativeStock ?? []) {
      issues.push({
        closure_id: closureId,
        company_id: cid,
        severity: "error",
        category: "inventory",
        code: "NEGATIVE_STOCK",
        message: `Producto "${p.name}" tiene inventario negativo (${p.stock} unidades).`,
        ref_table: "products",
        ref_id: p.id,
      });
    }
  }

  // Step 4: Insert issues
  if (issues.length > 0) {
    await supabase.from("period_closure_issues").insert(issues);
  }

  // Step 5: Update status
  const errorCount = issues.filter((i) => i.severity === "error").length;
  await supabase
    .from("period_closures")
    .update({
      status: errorCount > 0 ? "has_issues" : "in_review",
      updated_at: new Date().toISOString(),
    })
    .eq("id", closureId);

  revalidatePath(`/dashboard/cierre/${closureId}`);
}

// ─── Resolve Issue ────────────────────────────────────────────────────────────

export async function resolveIssue(formData: FormData): Promise<void> {
  const { supabase, user, membership, canManage } = await requireAuth();
  if (!canManage) return;

  const issueId = String(formData.get("issueId") ?? "");
  const closureId = String(formData.get("closureId") ?? "");
  if (!issueId || !closureId) return;

  await supabase
    .from("period_closure_issues")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq("id", issueId)
    .eq("company_id", membership.company_id);

  revalidatePath(`/dashboard/cierre/${closureId}`);
}

// ─── Ignore Issue ─────────────────────────────────────────────────────────────

export async function ignoreIssue(formData: FormData): Promise<void> {
  const { supabase, user, membership, canManage } = await requireAuth();
  if (!canManage) return;

  const issueId = String(formData.get("issueId") ?? "");
  const closureId = String(formData.get("closureId") ?? "");
  if (!issueId || !closureId) return;

  // Only warnings/info can be ignored
  const { data: issue } = await supabase
    .from("period_closure_issues")
    .select("severity")
    .eq("id", issueId)
    .maybeSingle();

  if (issue?.severity === "error") return;

  await supabase
    .from("period_closure_issues")
    .update({
      ignored_at: new Date().toISOString(),
      ignored_by: user.id,
      ignore_reason: "Ignorado por el administrador",
    })
    .eq("id", issueId)
    .eq("company_id", membership.company_id);

  revalidatePath(`/dashboard/cierre/${closureId}`);
}

// ─── Mark Ready for Accountant ────────────────────────────────────────────────

export async function markReadyForAccountant(formData: FormData): Promise<void> {
  const { supabase, membership, canManage } = await requireAuth();
  if (!canManage) return;

  const closureId = String(formData.get("closureId") ?? "");
  if (!closureId) return;

  // Verify no active errors
  const { data: activeErrors } = await supabase
    .from("period_closure_issues")
    .select("id")
    .eq("closure_id", closureId)
    .eq("company_id", membership.company_id)
    .eq("severity", "error")
    .is("resolved_at", null)
    .is("ignored_at", null);

  if ((activeErrors ?? []).length > 0) return;

  await supabase
    .from("period_closures")
    .update({
      status: "ready_for_accountant",
      updated_at: new Date().toISOString(),
    })
    .eq("id", closureId)
    .eq("company_id", membership.company_id);

  revalidatePath(`/dashboard/cierre/${closureId}`);
  revalidatePath("/dashboard/cierre");
}

// ─── Close Period ─────────────────────────────────────────────────────────────

export async function closePeriod(formData: FormData): Promise<void> {
  const { supabase, user, membership, canManage } = await requireAuth();
  if (!canManage) return;

  const closureId = String(formData.get("closureId") ?? "");
  if (!closureId) return;

  const { data: closure } = await supabase
    .from("period_closures")
    .select("status")
    .eq("id", closureId)
    .eq("company_id", membership.company_id)
    .maybeSingle();

  if (closure?.status !== "ready_for_accountant") return;

  await supabase
    .from("period_closures")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", closureId)
    .eq("company_id", membership.company_id);

  revalidatePath(`/dashboard/cierre/${closureId}`);
  revalidatePath("/dashboard/cierre");
}

// ─── Reopen Period ────────────────────────────────────────────────────────────

export async function reopenPeriod(
  _prevState: ClosureActionState,
  formData: FormData
): Promise<ClosureActionState> {
  const { supabase, user, membership, canManage } = await requireAuth();

  if (!canManage) {
    return {
      success: false,
      message: "Solo el dueño o administrador puede reabrir períodos.",
      timestamp: Date.now(),
    };
  }

  const closureId = String(formData.get("closureId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!closureId) {
    return {
      success: false,
      message: "Cierre inválido.",
      timestamp: Date.now(),
    };
  }
  if (!reason) {
    return {
      success: false,
      message: "Debes indicar el motivo de reapertura.",
      timestamp: Date.now(),
    };
  }

  const { data: closure } = await supabase
    .from("period_closures")
    .select("status")
    .eq("id", closureId)
    .eq("company_id", membership.company_id)
    .maybeSingle();

  if (!["closed", "ready_for_accountant"].includes(closure?.status ?? "")) {
    return {
      success: false,
      message: "Este cierre no puede reabrirse en su estado actual.",
      timestamp: Date.now(),
    };
  }

  const { error } = await supabase
    .from("period_closures")
    .update({
      status: "draft",
      reopen_reason: reason,
      reopened_at: new Date().toISOString(),
      reopened_by: user.id,
      closed_at: null,
      closed_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", closureId)
    .eq("company_id", membership.company_id);

  if (error) {
    return { success: false, message: error.message, timestamp: Date.now() };
  }

  revalidatePath(`/dashboard/cierre/${closureId}`);
  revalidatePath("/dashboard/cierre");
  return {
    success: true,
    message: "Período reabierto para corrección.",
    timestamp: Date.now(),
  };
}
