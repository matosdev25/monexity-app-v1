import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import dynamic from "next/dynamic";
import { createClient } from "../../../lib/supabase/server";
import { resolveLogoUrl } from "../../../lib/storage/resolve-logo";
import { formatShortDate } from "../../../lib/date-format";
import { formatCurrency } from "../../../lib/currency-format";
import { deleteQuotation } from "./actions";
import { fetchActivePaymentMethods } from "../sales/actions";
import { fetchActiveServices } from "../mi-negocio/services-actions";
import { ConfirmSubmitButton } from "../../../components/confirm-submit-button";
import type { Quotation, QuotationItem } from "./types";
import type { QuotationCompanyInfo } from "./pdf-helpers";

function getTodayInPanama() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Panama",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`;
}

function getStatusLabel(status: string) {
  switch (status) {
    case "draft": return "Borrador";
    case "sent": return "Enviada";
    case "accepted": return "Aceptada";
    case "rejected": return "Rechazada";
    case "expired": return "Vencida";
    case "converted": return "Convertida";
    default: return status;
  }
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "draft":
      return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
    case "sent":
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-200";
    case "accepted":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200";
    case "rejected":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-200";
    case "expired":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-200";
    case "converted":
      return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/25 dark:bg-violet-500/10 dark:text-violet-200";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
}

function isExpired(validUntil: string | null, status: string) {
  if (!validUntil || status === "converted" || status === "expired") return false;
  const today = getTodayInPanama();
  return validUntil < today;
}

type QuotationsPageProps = {
  searchParams?: Promise<{ status?: string }>;
};

const shellClass = "min-h-full px-2 py-2 text-app sm:px-3 sm:py-3";
const containerClass = "mx-auto flex w-full max-w-7xl flex-col gap-4";
const heroClass = "app-card rounded-[28px] px-5 py-5 sm:px-6";
const panelClass = "app-card rounded-[28px] p-4 sm:p-5";
const statCardClass =
  "rounded-[20px] border border-slate-200 bg-white px-5 py-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)] dark:border-slate-700 dark:bg-slate-950/70 dark:shadow-none";
const quotationCardClass =
  "rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition-[border-color,box-shadow,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-sky-200/80 hover:shadow-[0_12px_28px_rgba(15,23,42,0.07)] dark:border-slate-700 dark:bg-slate-950/70 dark:shadow-none dark:hover:border-cyan-400/30";
const primaryButtonClass =
  "inline-flex h-11 w-full items-center justify-center rounded-2xl border border-sky-600 bg-sky-600 px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(14,165,233,0.22)] sm:w-auto";
const softButtonClass =
  "rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-200";

const CreateQuotationForm = dynamic(
  () => import("./create-quotation-form").then((mod) => mod.CreateQuotationForm),
  { loading: () => <button type="button" className={primaryButtonClass}>Nueva cotización</button> }
);

const QuotationManagementModal = dynamic(
  () => import("./quotation-management-modal").then((mod) => mod.QuotationManagementModal),
  { loading: () => <button type="button" className={softButtonClass}>Gestionar</button> }
);

const QuotationsHistoryModal = dynamic(
  () => import("./quotations-history-modal").then((mod) => mod.QuotationsHistoryModal),
  { loading: () => <button type="button" className={softButtonClass}>Historial</button> }
);

export default async function QuotationsPage({ searchParams }: QuotationsPageProps) {
  const params = (await searchParams) ?? {};
  const statusParam = params.status ?? "all";
  const today = getTodayInPanama();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const cookieStore = await cookies();
  const activeCompanyId = cookieStore.get("active_company_id")?.value ?? null;

  const membershipQuery = supabase
    .from("memberships")
    .select("company_id")
    .eq("user_id", user.id);

  const { data: membership, error: membershipError } = await (
    activeCompanyId
      ? membershipQuery.eq("company_id", activeCompanyId)
      : membershipQuery.limit(1)
  ).maybeSingle();

  if (membershipError || !membership?.company_id) redirect("/dashboard");

  const companyId = membership.company_id;

  const [{ data: company }, { data: quotations }, { data: quotationItems }, services, paymentMethods] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, contact_footer, logo_url, invoice_ruc, invoice_dv, invoice_address, invoice_email, invoice_phone")
      .eq("id", companyId)
      .maybeSingle(),
    supabase
      .from("quotations")
      .select(
        "id, company_id, quotation_number, status, customer_name, customer_email, customer_phone, customer_company, issue_date, valid_until, subtotal, discount_amount, tax_amount, total, notes, terms, converted_sale_id, converted_at, created_by, created_at, updated_at"
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("quotation_items")
      .select(
        "id, quotation_id, company_id, service_id, service_name_snapshot, description, quantity, unit_price, line_total, sort_order, created_at"
      )
      .eq("company_id", companyId)
      .order("sort_order", { ascending: true }),
    fetchActiveServices(companyId),
    fetchActivePaymentMethods(companyId),
  ]);

  const allQuotations = (quotations ?? []) as Quotation[];
  const allItems = (quotationItems ?? []) as QuotationItem[];
  const companyInfo: QuotationCompanyInfo = {
    name: company?.name ?? "Empresa",
    logoUrl: await resolveLogoUrl(company?.logo_url ?? null),
    contactFooter: company?.contact_footer ?? null,
    invoiceRuc: company?.invoice_ruc ?? null,
    invoiceDv: company?.invoice_dv ?? null,
    invoiceAddress: company?.invoice_address ?? null,
    invoiceEmail: company?.invoice_email ?? null,
    invoicePhone: company?.invoice_phone ?? null,
  };

  const visibleQuotations = allQuotations.filter((q) => {
    if (statusParam === "all") return true;
    const s = (q.status ?? "").toLowerCase();
    if (statusParam === "pending")
      return s === "draft" || s === "sent" || s === "accepted";
    return s === statusParam;
  });

  const totalValue = allQuotations.reduce(
    (sum, q) => sum + Number(q.total ?? 0),
    0
  );
  const acceptedCount = allQuotations.filter(
    (q) => q.status === "accepted"
  ).length;
  const pendingCount = allQuotations.filter(
    (q) => q.status === "draft" || q.status === "sent"
  ).length;

  return (
    <main className={shellClass}>
      <div className={containerClass}>
        <section className={heroClass}>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,560px)] xl:items-center">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-sky-700 dark:text-cyan-300">
                Módulo de cotizaciones
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50 md:text-3xl">
                Crea y gestiona cotizaciones
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Genera propuestas para tus clientes y conviértelas a ventas con un clic cuando sean aceptadas.
              </p>
              <div className="mt-4 sm:hidden">
                <CreateQuotationForm today={today} services={services} company={companyInfo} />
              </div>
            </div>

            <div className="grid gap-3">
              <div className="hidden justify-end sm:flex">
                <CreateQuotationForm today={today} services={services} company={companyInfo} />
              </div>
              <div className="grid min-w-[220px] gap-3 sm:grid-cols-3">
                <div className={statCardClass}>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Valor total
                  </p>
                  <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                    {formatCurrency(totalValue)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {allQuotations.length} cotización{allQuotations.length !== 1 ? "es" : ""}
                  </p>
                </div>
                <div className={statCardClass}>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Aceptadas
                  </p>
                  <p className="mt-2 text-xl font-semibold tracking-tight text-emerald-700 dark:text-emerald-300">
                    {acceptedCount}
                  </p>
                </div>
                <div className={statCardClass}>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Pendientes
                  </p>
                  <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                    {pendingCount}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className={`${panelClass} flex min-h-[320px] flex-col overflow-hidden`}>
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-sky-700 dark:text-cyan-300">
                  Cotizaciones recientes
                </p>
                <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                    Actividad
                  </h2>
                  <span className="pb-1 text-xs font-medium text-slate-400 dark:text-slate-500">
                    Últimas 5
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Revisa propuestas activas, aceptadas y convertidas sin salir del módulo.
                </p>
              </div>
              <div className="shrink-0">
                <QuotationsHistoryModal quotations={allQuotations} />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-1 dark:border-slate-800 dark:bg-slate-950/60">
              {(
                [
                  { value: "all", label: "Todas" },
                  { value: "pending", label: "Activas" },
                  { value: "accepted", label: "Aceptadas" },
                  { value: "converted", label: "Convertidas" },
                ] as const
              ).map(({ value, label }) => {
                const isActive = statusParam === value;
                const href = `?status=${value}`;
                return (
                  <a
                    key={value}
                    href={href}
                    className={[
                      "rounded-xl border px-3 py-1.5 text-xs font-medium transition-[background-color,border-color,color,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600",
                      isActive
                        ? "border-sky-500 bg-sky-500 text-white dark:border-cyan-500 dark:bg-cyan-500 dark:text-slate-950"
                        : "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-white dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900",
                    ].join(" ")}
                  >
                    {label}
                  </a>
                );
              })}
            </div>

            <div className="mt-4 flex-1 overflow-y-auto pr-1">
              <div className="grid gap-3">
                {visibleQuotations.length > 0 ? (
                  visibleQuotations.slice(0, 5).map((q) => {
                    const expired = isExpired(q.valid_until, q.status);
                    const displayStatus = expired ? "expired" : q.status;

                    return (
                      <div key={q.id} className={quotationCardClass}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-sky-700/70 dark:text-cyan-300/80">
                              {q.quotation_number ?? "Sin número"}
                            </p>
                            <p className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                              {formatCurrency(Number(q.total ?? 0))}
                            </p>
                            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                              {q.customer_name?.trim() || "Cliente general"}
                            </p>
                          </div>
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.14em] ${getStatusBadgeClass(displayStatus)}`}
                          >
                            {getStatusLabel(displayStatus)}
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          Emitida: {formatShortDate(q.issue_date)}
                          {q.valid_until ? ` · Vigente hasta: ${formatShortDate(q.valid_until)}` : ""}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <QuotationManagementModal
                            quotation={q}
                            items={allItems.filter((item) => item.quotation_id === q.id)}
                            services={services}
                            paymentMethods={paymentMethods}
                            today={today}
                            company={companyInfo}
                          />

                          {q.status !== "converted" ? (
                            <form action={deleteQuotation}>
                              <input type="hidden" name="quotationId" value={q.id} />
                              <ConfirmSubmitButton
                                label="Eliminar"
                                title="Eliminar cotización"
                                confirmMessage={`Se eliminará la cotización ${q.quotation_number ?? ""}.`}
                                confirmLabel="Sí, eliminar"
                                className="rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-2 text-sm text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 hover:text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15 dark:hover:text-rose-200"
                              />
                            </form>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={quotationCardClass}>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      No hay cotizaciones en este estado.
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
