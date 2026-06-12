import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "../../../lib/supabase/server";
import { CreateSaleForm } from "./create-sale-form";
import { SalesHistoryModal } from "./sales-history-modal";
import { EditSaleModal } from "./edit-sale-modal";
import { SaleInvoiceModal } from "./sale-invoice-modal";
import { ConfirmSubmitButton } from "../../../components/confirm-submit-button";
import { RecordPaymentModal } from "./record-payment-modal";
import { SaleDetailModal } from "./sale-detail-modal";
import { deleteSale, fetchActivePaymentMethods } from "./actions";
import { fetchActiveProducts } from "../inventario/actions";
import { fetchActiveServices } from "../mi-negocio/services-actions";
import { resolveLogoUrl } from "../../../lib/storage/resolve-logo";
import {
  SPECIAL_ADMIN_RELATED_ID,
  canEditManualTransactionDates,
} from "../../../lib/admin-auth";
import { formatShortDate, formatTime } from "../../../lib/date-format";
import { formatCurrency } from "../../../lib/currency-format";
import type { Sale } from "./types";

type SalesPageProps = {
  searchParams?: Promise<{
    from?: string;
    to?: string;
    status?: string;
  }>;
};

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

function formatPaymentMethodLabel(value: string | null | undefined) {
  switch ((value ?? "").toLowerCase()) {
    case "cash":
      return "Efectivo";
    case "card":
      return "Tarjeta";
    case "transfer":
      return "Transferencia";
    case "yappy":
      return "Yappy";
    case "other":
      return "Otro";
    default:
      return value || "Sin método";
  }
}

function formatPaymentTypeLabel(value: string | null | undefined) {
  switch ((value ?? "").toLowerCase()) {
    case "full":
      return "Completo";
    case "partial":
      return "Abono";
    case "installment":
      return "Cuotas";
    default:
      return value || "Sin tipo";
  }
}

function formatPaymentStatusLabel(value: string | null | undefined) {
  switch ((value ?? "").toLowerCase()) {
    case "paid":
      return "Pagada";
    case "partial":
      return "Abonada";
    case "pending":
      return "Pendiente";
    case "overdue":
      return "Vencida";
    default:
      return "Sin estado";
  }
}

function getPaymentStatusBadgeClass(value: string | null | undefined) {
  switch ((value ?? "").toLowerCase()) {
    case "paid":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200";
    case "partial":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-200";
    case "pending":
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";
    case "overdue":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-200";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";
  }
}

function buildContactFooter(company: {
  contact_footer?: string | null;
  invoice_ruc?: string | null;
  invoice_dv?: string | null;
  invoice_address?: string | null;
  invoice_email?: string | null;
  invoice_phone?: string | null;
} | null): string {
  if (!company) return "";
  const parts: string[] = [];
  if (company.invoice_ruc) {
    parts.push(
      company.invoice_dv
        ? `RUC: ${company.invoice_ruc}  DV: ${company.invoice_dv}`
        : `RUC: ${company.invoice_ruc}`
    );
  }
  if (company.invoice_address) parts.push(company.invoice_address);
  const contact: string[] = [];
  if (company.invoice_phone) contact.push(company.invoice_phone);
  if (company.invoice_email) contact.push(company.invoice_email);
  if (contact.length) parts.push(contact.join("  ·  "));
  if (company.contact_footer?.trim()) parts.push(company.contact_footer.trim());
  return parts.join("\n");
}

function formatSaleTime(value: string | null | undefined) {
  return formatTime(value, "Sin hora");
}

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function getCollectedAmount(
  sale: Sale,
  paymentTotals: Map<string, number>,
  downPaymentTotals: Map<string, number>
) {
  const total = roundMoney(Number(sale.amount ?? 0));
  const storedPaid = roundMoney(Number(sale.paid_amount ?? 0));
  const storedBalance = roundMoney(Number(sale.balance_due ?? total));
  const paidFromBalance = roundMoney(Math.max(0, total - storedBalance));
  const paidFromPayments = roundMoney(
    (paymentTotals.get(sale.id) ?? 0) + (downPaymentTotals.get(sale.id) ?? 0)
  );

  return Math.min(total, Math.max(storedPaid, paidFromBalance, paidFromPayments));
}

const shellClass =
  "min-h-full px-2 py-2 text-app sm:px-3 sm:py-3";

const containerClass =
  "mx-auto flex w-full max-w-7xl flex-col gap-3";

const heroClass =
  "app-card rounded-[24px] px-5 py-4";

const panelClass =
  "app-card rounded-[24px] p-4";

const statCardClass =
  "rounded-[20px] border border-slate-200 bg-white px-5 py-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)] dark:border-slate-700 dark:bg-slate-950/70 dark:shadow-none";

const saleCardClass =
  "rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition-colors hover:border-sky-200/80 dark:border-slate-700 dark:bg-slate-950/70 dark:shadow-none dark:hover:border-cyan-400/30";

export default async function SalesPage({ searchParams }: SalesPageProps) {
  const params = (await searchParams) ?? {};
  const from = params.from ?? "";
  const to = params.to ?? "";
  const statusParam = params.status ?? "all";
  const today = getTodayInPanama();

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
    .select("company_id, role, companies(owner_user_id)")
    .eq("user_id", user.id);

  const { data: membership, error: membershipError } = await (
    activeCompanyId
      ? membershipQuery.eq("company_id", activeCompanyId)
      : membershipQuery.limit(1)
  ).maybeSingle();

  if (membershipError || !membership?.company_id) {
    redirect("/dashboard");
  }

  const companyId = membership.company_id;
  const role = String(membership.role ?? "").toLowerCase();
  const canManageRecords = ["owner", "admin"].includes(role);
  const { data: specialAdminMembership } = await supabase
    .from("memberships")
    .select("company_id")
    .eq("company_id", companyId)
    .eq("user_id", SPECIAL_ADMIN_RELATED_ID)
    .maybeSingle();
  const canEditManualDates = canEditManualTransactionDates({
    email: user.email,
    userId: user.id,
    companyId,
    companyOwnerUserId:
      (membership.companies as { owner_user_id?: string | null } | null)?.owner_user_id ?? null,
    hasSpecialAdminMembership: Boolean(specialAdminMembership?.company_id),
  });

  // Armar el query de ventas con filtros de fecha en DB cuando aplique
  let salesQuery = supabase
    .from("sales")
    .select(
      `
        id,
        invoice_number,
        customer_name,
        customer_company,
        customer_email,
        customer_phone,
        amount,
        paid_amount,
        balance_due,
        payment_method,
        payment_type,
        payment_status,
        has_payment_plan,
        note,
        invoice_notes,
        sale_date,
        payment_date,
        created_at
      `
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (from) salesQuery = salesQuery.gte("sale_date", from);
  if (to) salesQuery = salesQuery.lte("sale_date", to);

  const [{ data: company }, { data: sales }, paymentMethods, allProducts, activeServices] = await Promise.all([
    supabase
      .from("companies")
      .select("name, contact_footer, logo_url, needs_inventory, invoice_ruc, invoice_dv, invoice_address, invoice_email, invoice_phone")
      .eq("id", companyId)
      .maybeSingle(),
    salesQuery,
    fetchActivePaymentMethods(companyId),
    fetchActiveProducts(companyId),
    fetchActiveServices(companyId),
  ]);

  const allSales = (sales ?? []) as Sale[];
  const saleIds = allSales.map((sale) => sale.id).filter(Boolean);
  const [{ data: salePayments }, { data: salePaymentPlans }] = saleIds.length > 0
    ? await Promise.all([
        supabase
          .from("sale_payments")
          .select("sale_id, amount")
          .eq("company_id", companyId)
          .in("sale_id", saleIds),
        supabase
          .from("sale_payment_plans")
          .select("sale_id, down_payment_amount")
          .eq("company_id", companyId)
          .in("sale_id", saleIds),
      ])
    : [{ data: [] }, { data: [] }];

  const paymentTotals = new Map<string, number>();
  for (const payment of salePayments ?? []) {
    const saleId = String(payment.sale_id ?? "");
    if (!saleId) continue;
    paymentTotals.set(
      saleId,
      roundMoney((paymentTotals.get(saleId) ?? 0) + Number(payment.amount ?? 0))
    );
  }

  const downPaymentTotals = new Map<string, number>();
  for (const plan of salePaymentPlans ?? []) {
    const saleId = String(plan.sale_id ?? "");
    if (!saleId) continue;
    downPaymentTotals.set(saleId, roundMoney(Number(plan.down_payment_amount ?? 0)));
  }

  // Filtrar por estado en la vista principal
  const visibleSales = allSales.filter((sale) => {
    if (statusParam === "all") return true;
    const ps = (sale.payment_status ?? "").toLowerCase();
    if (statusParam === "pending") return ps === "pending" || ps === "partial" || ps === "overdue";
    if (statusParam === "paid") return ps === "paid";
    return true;
  });

  // totalAmount calculado de la misma query — elimina el segundo SELECT a sales
  const totalAmount = allSales.reduce(
    (sum, sale) => sum + Number(sale.amount ?? 0),
    0
  );

  const totalCollected = allSales.reduce(
    (sum, sale) => sum + getCollectedAmount(sale, paymentTotals, downPaymentTotals),
    0
  );

  const totalPendingBalance = allSales.reduce(
    (sum, sale) => sum + Math.max(0, Number(sale.amount ?? 0) - getCollectedAmount(sale, paymentTotals, downPaymentTotals)),
    0
  );

  const installmentSalesCount = allSales.filter(
    (sale) => String(sale.payment_type ?? "").toLowerCase() === "installment"
  ).length;

  const companyInvoice = {
    name: company?.name?.trim() || "Mi negocio",
    contactFooter: buildContactFooter(company),
    logoUrl: await resolveLogoUrl(company?.logo_url ?? null),
    companyId,
  };

  const needsInventory = Boolean((company as { needs_inventory?: boolean } | null)?.needs_inventory);
  const activeProducts = needsInventory ? allProducts : [];

  return (
    <main className={shellClass}>
      <div className={containerClass}>
        <section className={heroClass}>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-sky-700 dark:text-cyan-300">
                Módulo de ventas
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50 md:text-3xl">
                Registra, consulta y gestiona tus ventas
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Lleva control rápido de cada venta, incluyendo abonos, saldo
                pendiente y ventas con plan de cuotas.
              </p>
            </div>

            <div className="grid min-w-[220px] gap-3 sm:grid-cols-3 xl:w-[780px]">
              <div className={statCardClass}>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Total general
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                  {formatCurrency(totalAmount)}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Suma acumulada de ventas registradas.
                </p>
              </div>

              <div className={statCardClass}>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Cobrado
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                  {formatCurrency(totalCollected)}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Dinero recibido por ventas.
                </p>
              </div>

              <div className={statCardClass}>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Saldo pendiente
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                  {formatCurrency(totalPendingBalance)}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {installmentSalesCount} venta
                  {installmentSalesCount === 1 ? "" : "s"} con cuotas.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 xl:grid-cols-[440px_minmax(0,1fr)] xl:items-start">
          <div className={`${panelClass} self-start`}>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Registrar venta
            </h2>

            <div className="mt-1 [&_label]:text-sm">
              <CreateSaleForm
                today={today}
                paymentMethods={paymentMethods}
                products={activeProducts}
                services={activeServices}
                canEditManualDates={canEditManualDates}
              />
            </div>
          </div>

          <div
            className={`${panelClass} flex min-h-[320px] flex-col overflow-hidden`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-sky-700 dark:text-cyan-300">
                  Ventas recientes
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                  Actividad
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Últimas 5 ventas registradas.
                </p>
              </div>

              <SalesHistoryModal
                sales={allSales}
                from={from}
                to={to}
                company={companyInvoice}
                deleteSaleAction={deleteSale}
                paymentMethods={paymentMethods}
                canEditManualDates={canEditManualDates}
                canManageRecords={canManageRecords}
              />
            </div>

            {/* Tabs de estado */}
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  { value: "all", label: "Todas" },
                  { value: "pending", label: "Pendientes" },
                  { value: "paid", label: "Pagadas" },
                ] as const
              ).map(({ value, label }) => {
                const isActive = statusParam === value;
                const href = `?${new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}), status: value }).toString()}`;
                return (
                  <a
                    key={value}
                    href={href}
                    className={[
                      "rounded-xl border px-3 py-1.5 text-xs font-medium transition",
                      isActive
                        ? "border-sky-500 bg-sky-500 text-white dark:border-cyan-500 dark:bg-cyan-500 dark:text-slate-950"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
                    ].join(" ")}
                  >
                    {label}
                  </a>
                );
              })}
            </div>

            <div className="mt-3 flex-1 overflow-y-auto pr-1">
              <div className="grid gap-3">
                {visibleSales.length > 0 ? (
                  visibleSales.slice(0, 5).map((sale) => {
                    const amount = Number(sale.amount ?? 0);
                    const paidAmount = Number(sale.paid_amount ?? 0);
                    const balanceDue = Number(sale.balance_due ?? 0);
                    const noteText = sale.invoice_notes || sale.note;

                    return (
                      <div key={sale.id} className={saleCardClass}>
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-sky-700/70 dark:text-cyan-300/80">
                              Factura {sale.invoice_number ?? "Sin factura"}
                            </p>
                            <p className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                              {formatCurrency(amount)}
                            </p>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                              {sale.customer_name?.trim()
                                ? sale.customer_name
                                : "Consumidor final"}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                              {formatPaymentMethodLabel(sale.payment_method)}
                            </span>

                            <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-sky-700 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-200">
                              {formatPaymentTypeLabel(sale.payment_type)}
                            </span>

                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${getPaymentStatusBadgeClass(
                                sale.payment_status
                              )}`}
                            >
                              {formatPaymentStatusLabel(sale.payment_status)}
                            </span>

                            {sale.has_payment_plan ? (
                              <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-violet-700 dark:border-violet-400/25 dark:bg-violet-500/10 dark:text-violet-200">
                                Con plan
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                          Fecha: {formatShortDate(sale.sale_date)} · Hora:{" "}
                          {formatSaleTime(sale.created_at)}
                        </p>

                        {(sale.payment_type === "partial" ||
                          sale.payment_type === "installment") && (
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                Abonado
                              </p>
                              <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                                {formatCurrency(paidAmount)}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                Saldo
                              </p>
                              <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                                {formatCurrency(balanceDue)}
                              </p>
                            </div>
                          </div>
                        )}

                        {noteText ? (
                          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                            {noteText}
                          </p>
                        ) : null}

                        <div className="mt-3 flex flex-wrap gap-3">
                          <SaleDetailModal
                            sale={sale}
                            company={companyInvoice}
                            canManagePayments={canManageRecords}
                          />

                          {(sale.payment_status === "pending" ||
                            sale.payment_status === "partial" ||
                            sale.payment_status === "overdue") &&
                          balanceDue > 0 ? (
                            canManageRecords ? (
                              <RecordPaymentModal
                                saleId={sale.id}
                                balanceDue={balanceDue}
                                today={today}
                                paymentMethods={paymentMethods}
                                company={companyInvoice}
                                sale={sale}
                              />
                            ) : null
                          ) : null}

                          {canManageRecords && (
                            <EditSaleModal
                              sale={sale}
                              paymentMethods={paymentMethods}
                              canEditManualDates={canEditManualDates}
                            />
                          )}
                          <SaleInvoiceModal
                            sale={sale}
                            company={companyInvoice}
                          />

                          {canManageRecords && (
                            <form action={deleteSale}>
                              <input type="hidden" name="saleId" value={sale.id} />
                              <ConfirmSubmitButton
                                label="Eliminar"
                                title="Eliminar factura"
                                confirmMessage="Esta acción eliminará la venta y devolverá las existencias al inventario."
                                confirmLabel="Sí, eliminar"
                                className="rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-2 text-sm text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 hover:text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15 dark:hover:text-rose-200"
                              />
                            </form>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={saleCardClass}>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Aún no hay ventas registradas en este rango.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
