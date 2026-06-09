import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "../../../../lib/supabase/server";
import { formatShortDate } from "../../../../lib/date-format";
import { formatCurrency } from "../../../../lib/currency-format";
import { changeQuotationStatus, deleteQuotation } from "../actions";
import { fetchActivePaymentMethods } from "../../sales/actions";
import { fetchActiveServices } from "../../mi-negocio/services-actions";
import { EditQuotationForm, ConvertSection } from "./edit-quotation-form";
import { ConfirmSubmitButton } from "../../../../components/confirm-submit-button";
import type { Quotation, QuotationItem } from "../types";

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

function getTodayInPanama() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Panama",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`;
}

function isExpired(validUntil: string | null, status: string) {
  if (!validUntil || status === "converted" || status === "expired") return false;
  return validUntil < getTodayInPanama();
}

type Props = { params: Promise<{ quotationId: string }> };

export default async function QuotationDetailPage({ params }: Props) {
  const { quotationId } = await params;

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

  const { data: membership } = await (
    activeCompanyId
      ? membershipQuery.eq("company_id", activeCompanyId)
      : membershipQuery.limit(1)
  ).maybeSingle();

  if (!membership?.company_id) redirect("/dashboard");

  const companyId = membership.company_id;

  const [{ data: quotationData }, { data: itemsData }, paymentMethods, services] =
    await Promise.all([
      supabase
        .from("quotations")
        .select("*")
        .eq("id", quotationId)
        .eq("company_id", companyId)
        .maybeSingle(),
      supabase
        .from("quotation_items")
        .select(
          "id, quotation_id, company_id, service_id, service_name_snapshot, description, quantity, unit_price, line_total, sort_order, created_at"
        )
        .eq("quotation_id", quotationId)
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true }),
      fetchActivePaymentMethods(companyId),
      fetchActiveServices(companyId),
    ]);

  if (!quotationData) redirect("/dashboard/quotations");

  const quotation = quotationData as Quotation;
  const items = (itemsData ?? []) as QuotationItem[];

  const expired = isExpired(quotation.valid_until, quotation.status);
  const displayStatus = expired ? "expired" : quotation.status;
  const isConverted = quotation.status === "converted";
  const canConvert = !isConverted && quotation.status !== "rejected";

  const STATUS_TRANSITIONS: { status: string; label: string }[] = [
    { status: "draft", label: "Marcar como borrador" },
    { status: "sent", label: "Marcar como enviada" },
    { status: "accepted", label: "Marcar como aceptada" },
    { status: "rejected", label: "Marcar como rechazada" },
  ].filter((t) => t.status !== quotation.status);

  return (
    <main className="min-h-full px-2 py-2 text-app sm:px-3 sm:py-3">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        {/* Back */}
        <div>
          <Link
            href="/dashboard/quotations"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors duration-150 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Volver a cotizaciones
          </Link>
        </div>

        {/* Header card */}
        <div className="app-card rounded-[24px] px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-sky-700/70 dark:text-cyan-300/80">
                {quotation.quotation_number ?? "Sin número"}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                {quotation.customer_name?.trim() || "Cliente general"}
              </h1>
              {quotation.customer_company ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {quotation.customer_company}
                </p>
              ) : null}
            </div>
            <span
              className={`inline-flex rounded-full border px-4 py-1.5 text-xs font-medium uppercase tracking-[0.14em] ${getStatusBadgeClass(displayStatus)}`}
            >
              {getStatusLabel(displayStatus)}
            </span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/70">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                Emitida
              </p>
              <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                {formatShortDate(quotation.issue_date)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/70">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                Vigencia
              </p>
              <p className={`mt-0.5 text-sm font-medium ${expired ? "text-amber-700 dark:text-amber-300" : "text-slate-900 dark:text-slate-100"}`}>
                {formatShortDate(quotation.valid_until, "Sin fecha")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/70">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                Total
              </p>
              {Number(quotation.discount_amount) > 0 ? (
                <>
                  <p className="mt-0.5 text-xs text-slate-400 line-through dark:text-slate-500">
                    {formatCurrency(Number(quotation.subtotal ?? 0))}
                  </p>
                  <p className="text-[11px] text-rose-500 dark:text-rose-400">
                    − {formatCurrency(Number(quotation.discount_amount))}
                  </p>
                  <p className="mt-0.5 text-lg font-semibold text-slate-950 dark:text-slate-50">
                    {formatCurrency(Number(quotation.total ?? 0))}
                  </p>
                </>
              ) : (
                <p className="mt-0.5 text-lg font-semibold text-slate-950 dark:text-slate-50">
                  {formatCurrency(Number(quotation.total ?? 0))}
                </p>
              )}
            </div>
          </div>

          {(quotation.customer_email || quotation.customer_phone) ? (
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
              {quotation.customer_email ? (
                <span>{quotation.customer_email}</span>
              ) : null}
              {quotation.customer_phone ? (
                <span>{quotation.customer_phone}</span>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Items */}
        <div className="app-card rounded-[24px] p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Ítems
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="pb-2 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                    Descripción
                  </th>
                  <th className="pb-2 text-center text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                    Cant.
                  </th>
                  <th className="pb-2 text-right text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                    P. unit.
                  </th>
                  <th className="pb-2 text-right text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 pr-3 text-slate-900 dark:text-slate-100">
                      {item.description}
                    </td>
                    <td className="py-2 text-center text-slate-600 dark:text-slate-300">
                      {item.quantity}
                    </td>
                    <td className="py-2 text-right text-slate-600 dark:text-slate-300">
                      {formatCurrency(Number(item.unit_price))}
                    </td>
                    <td className="py-2 text-right font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(Number(item.line_total))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td colSpan={3} className="pt-3 text-right text-sm text-slate-500 dark:text-slate-400">
                    Subtotal
                  </td>
                  <td className="pt-3 text-right text-sm font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(Number(quotation.subtotal ?? 0))}
                  </td>
                </tr>
                {Number(quotation.discount_amount) > 0 ? (
                  <tr>
                    <td colSpan={3} className="pt-1 text-right text-sm text-slate-500 dark:text-slate-400">
                      Descuento
                    </td>
                    <td className="pt-1 text-right text-sm font-medium text-rose-600 dark:text-rose-300">
                      − {formatCurrency(Number(quotation.discount_amount))}
                    </td>
                  </tr>
                ) : null}
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td colSpan={3} className="pt-2 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Total
                  </td>
                  <td className="pt-2 text-right text-base font-bold text-slate-950 dark:text-slate-50">
                    {formatCurrency(Number(quotation.total ?? 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Notes / Terms */}
        {(quotation.notes || quotation.terms) ? (
          <div className="app-card rounded-[24px] p-4 space-y-3">
            {quotation.notes ? (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                  Notas
                </p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {quotation.notes}
                </p>
              </div>
            ) : null}
            {quotation.terms ? (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                  Términos
                </p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {quotation.terms}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Actions */}
        {!isConverted ? (
          <div className="app-card rounded-[24px] p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Acciones
            </h2>

            {/* Status change */}
            {STATUS_TRANSITIONS.length > 0 ? (
              <div>
                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                  Cambiar estado
                </p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_TRANSITIONS.map(({ status, label }) => (
                    <form action={changeQuotationStatus} key={status}>
                      <input type="hidden" name="quotationId" value={quotation.id} />
                      <input type="hidden" name="status" value={status} />
                      <button
                        type="submit"
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100"
                      >
                        {label}
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Convert to sale */}
            {canConvert ? (
              <ConvertSection
                quotationId={quotation.id}
                paymentMethods={paymentMethods}
                today={getTodayInPanama()}
                quotationTotal={Number(quotation.total ?? 0)}
              />
            ) : null}

            {/* Delete */}
            <form action={deleteQuotation}>
              <input type="hidden" name="quotationId" value={quotation.id} />
              <ConfirmSubmitButton
                label="Eliminar cotización"
                title="Eliminar cotización"
                confirmMessage={`Se eliminará permanentemente la cotización ${quotation.quotation_number ?? ""}.`}
                confirmLabel="Sí, eliminar"
                className="w-full rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-2 text-sm text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 hover:text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15 dark:hover:text-rose-200"
              />
            </form>
          </div>
        ) : (
          <div className="rounded-2xl border border-violet-200/70 bg-violet-50/60 px-4 py-3 dark:border-violet-500/20 dark:bg-violet-500/5">
            <p className="text-sm font-medium text-violet-800 dark:text-violet-300">
              Cotización convertida a venta
            </p>
            {quotation.converted_at ? (
              <p className="mt-1 text-xs text-violet-700/70 dark:text-violet-400/70">
                Convertida el {formatShortDate(quotation.converted_at)}
              </p>
            ) : null}
            <Link
              href="/dashboard/sales"
              className="mt-2 inline-flex text-xs font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-100"
            >
              Ver en ventas →
            </Link>
          </div>
        )}

        {/* Edit form */}
        {!isConverted ? (
          <div className="app-card rounded-[24px] p-4">
            <EditQuotationForm
              quotation={quotation}
              items={items}
              services={services}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}
