import Link from "next/link";
import dynamic from "next/dynamic";
import { cookies } from "next/headers";
import { createClient } from "../../lib/supabase/server";
import { fetchActivePaymentMethods } from "./sales/actions";
import { fetchActiveProducts } from "./inventario/actions";
import { fetchActiveServices } from "./mi-negocio/services-actions";
import { resolveLogoUrl } from "../../lib/storage/resolve-logo";
import {
  SPECIAL_ADMIN_RELATED_ID,
  canEditManualTransactionDates,
} from "../../lib/admin-auth";
import { formatShortDate } from "../../lib/date-format";
import { formatCurrency } from "../../lib/currency-format";

const DashboardInsightsCharts = dynamic(
  () =>
    import("./dashboard-insights-charts").then(
      (mod) => mod.DashboardInsightsCharts
    ),
  {
    loading: () => (
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-80 animate-pulse rounded-3xl bg-slate-200/60 dark:bg-slate-800/60" />
        <div className="h-80 animate-pulse rounded-3xl bg-slate-200/60 dark:bg-slate-800/60" />
        <div className="h-80 animate-pulse rounded-3xl bg-slate-200/60 dark:bg-slate-800/60" />
        <div className="h-80 animate-pulse rounded-3xl bg-slate-200/60 dark:bg-slate-800/60" />
      </div>
    ),
  }
);

const CreateSaleQuickModal = dynamic(() =>
  import("./sales/create-sale-quick-modal").then((mod) => mod.CreateSaleQuickModal)
);

const CreateExpenseQuickModal = dynamic(() =>
  import("./expenses/create-expense-quick-modal").then((mod) => mod.CreateExpenseQuickModal)
);

const sectionLabelClass = "section-label";
const mainSectionCardClass = "app-panel rounded-[30px] p-5";
const statCardClass = "app-card rounded-[24px] p-4";
const movementCardClass = "app-card rounded-[24px] px-4 py-3";
const shortcutTriggerClass = "app-card-interactive group rounded-[20px] p-3";
const actionLinkClass = "app-button-soft";

type RecentMovement = {
  id: string;
  type: "sale" | "payment" | "expense";
  amount: number;
  date: string;
  createdAt: string | null;
  activityAt: string | null;
  label: string;
  meta: string;
};

type DashboardChartSale = {
  id: string;
  amount: number;
  paymentMethod: string | null;
  saleDate: string;
};

type CollectedSaleRow = {
  id: string;
  amount: number | string | null;
  paid_amount: number | string | null;
  payment_method: string | null;
  payment_type: string | null;
  has_payment_plan: boolean | null;
  sale_date: string;
  payment_date: string | null;
};

type CollectedPaymentRow = {
  id: string;
  sale_id: string;
  amount: number | string | null;
  payment_method: string | null;
  payment_date: string;
  created_at: string | null;
};

type CollectedPaymentPlanRow = {
  sale_id: string;
  down_payment_amount: number | string | null;
};

type CollectedEvent = {
  id: string;
  saleId: string;
  amount: number;
  paymentMethod: string | null;
  date: string;
  createdAt: string | null;
};

type DashboardChartSaleItem = {
  saleId: string;
  description: string;
  quantity: number;
  productId: string | null;
};

type ProfileLike = {
  full_name?: string | null;
  display_name?: string | null;
  name?: string | null;
  username?: string | null;
  email?: string | null;
};

type CompanyLike = {
  name?: string | null;
  logo_url?: string | null;
  logo?: string | null;
  image_url?: string | null;
  avatar_url?: string | null;
  contact_footer?: string | null;
  needs_inventory?: boolean | null;
};

function getPanamaDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Panama",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  return {
    year,
    month,
    day,
    iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

function getActivityTime(value: string | null | undefined, fallbackDate: string) {
  if (value) return new Date(value).getTime();
  return new Date(`${fallbackDate}T00:00:00`).getTime();
}

function isInstallmentSale(sale: {
  payment_type?: string | null;
  has_payment_plan?: boolean | null;
}) {
  return (
    String(sale.payment_type ?? "").toLowerCase() === "installment" ||
    Boolean(sale.has_payment_plan)
  );
}

function getCollectedEvents(params: {
  sales: CollectedSaleRow[];
  payments: CollectedPaymentRow[];
  plans: CollectedPaymentPlanRow[];
}) {
  const { sales, payments, plans } = params;
  const downPaymentsBySaleId = new Map(
    plans.map((plan) => [
      String(plan.sale_id),
      Number(plan.down_payment_amount ?? 0),
    ])
  );

  const saleEvents: CollectedEvent[] = sales.flatMap((sale) => {
    const installment = isInstallmentSale(sale);
    const amount = installment
      ? Number(downPaymentsBySaleId.get(sale.id) ?? 0)
      : Number(sale.paid_amount ?? 0);

    if (!Number.isFinite(amount) || amount <= 0) return [];

    return [{
      id: installment ? `down-payment:${sale.id}` : `sale-payment:${sale.id}`,
      saleId: sale.id,
      amount,
      paymentMethod: sale.payment_method ?? null,
      date: sale.payment_date || sale.sale_date,
      createdAt: null,
    }];
  });

  const laterPaymentEvents: CollectedEvent[] = payments
    .map((payment) => ({
      id: `payment:${payment.id}`,
      saleId: String(payment.sale_id),
      amount: Number(payment.amount ?? 0),
      paymentMethod: payment.payment_method ?? null,
      date: payment.payment_date,
      createdAt: payment.created_at ?? null,
    }))
    .filter((payment) => Number.isFinite(payment.amount) && payment.amount > 0);

  return [...saleEvents, ...laterPaymentEvents];
}

function getMonthRangeInPanama() {
  const { year, month } = getPanamaDateParts();
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextMonthYear = month === 12 ? year + 1 : year;
  return {
    startStr: `${year}-${String(month).padStart(2, "0")}-01`,
    endStr: `${nextMonthYear}-${String(nextMonth).padStart(2, "0")}-01`,
  };
}

function getPanamaMonthRange(year: number, month: number) {
  const next = month === 12 ? 1 : month + 1;
  const nextY = month === 12 ? year + 1 : year;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { start: `${year}-${pad(month)}-01`, end: `${nextY}-${pad(next)}-01` };
}

function shiftMonth(year: number, month: number, delta: number) {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

function getPanamaMonthLabel(year: number, month: number): string {
  const s = new Intl.DateTimeFormat("es-PA", { month: "short" }).format(new Date(year, month - 1, 1));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDisplayDate(dateString: string | null | undefined) {
  if (!dateString) return "Sin fecha";
  return formatShortDate(dateString, "Sin fecha");
}

function getGreeting() {
  const panamaNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Panama" })
  );
  const hour = panamaNow.getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 18) return "Buenas tardes";
  return "Buenas noches";
}

function getUserDisplayName(
  user: { email?: string; user_metadata?: { full_name?: string; name?: string } } | null,
  profile: ProfileLike | null
) {
  return (
    profile?.full_name ||
    profile?.display_name ||
    profile?.name ||
    profile?.username ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Usuario"
  );
}

function getCompanyLogo(company: CompanyLike | null) {
  return company?.logo_url || company?.logo || company?.image_url || company?.avatar_url || null;
}

function formatPaymentMethodLabel(value: string | null | undefined) {
  switch ((value ?? "").toLowerCase()) {
    case "cash": return "Efectivo";
    case "card": return "Tarjeta";
    case "transfer": return "Transferencia";
    case "yappy": return "Yappy";
    case "other": return "Otro";
    default: return value || "Sin método";
  }
}

function formatExpenseCategoryLabel(value: string | null | undefined) {
  switch ((value ?? "").toLowerCase()) {
    case "inventory": return "Inventario";
    case "transport": return "Transporte";
    case "services": return "Servicios";
    case "payroll": return "Planilla";
    case "rent": return "Alquiler";
    case "marketing": return "Marketing";
    case "other": return "Otro";
    default: return value || "Sin categoría";
  }
}

function StatCard({
  title,
  value,
  subtitle,
  tone = "default",
}: {
  title: string;
  value: string;
  subtitle: string;
  tone?: "default" | "positive" | "negative";
}) {
  const valueColor =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-300"
      : tone === "negative"
        ? "text-red-600 dark:text-red-300"
        : "text-app";

  return (
    <div className={statCardClass}>
      <p className="text-sm font-medium text-app-muted">{title}</p>
      <p className={`mt-3 text-2xl font-semibold tracking-tight ${valueColor}`}>
        {value}
      </p>
      <p className="mt-1.5 text-sm text-app-muted">{subtitle}</p>
    </div>
  );
}

function ShortcutTriggerCard({ title, description }: { title: string; description: string }) {
  return (
    <div className={shortcutTriggerClass}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold leading-5 text-app">{title}</p>
          <p className="mt-0.5 text-xs leading-5 text-app-muted">{description}</p>
        </div>
        <span className="rounded-full border border-app bg-app-soft px-2 py-0.5 text-[11px] text-app-muted transition-colors duration-150 group-hover:border-app-strong group-hover:text-app">
          Abrir
        </span>
      </div>
    </div>
  );
}

function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={actionLinkClass}>
      {label}
    </Link>
  );
}

function RecentMovementItem({ item }: { item: RecentMovement }) {
  const isIncome = item.type === "sale" || item.type === "payment";

  return (
    <div className={movementCardClass}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={[
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
              isIncome
                ? "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300"
                : "bg-red-500/12 text-red-700 dark:bg-red-500/18 dark:text-red-300",
            ].join(" ")}
          >
            {isIncome ? "+" : "-"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-tight text-app">
              {item.label}
            </p>
            <p className="mt-0.5 truncate text-sm text-app-muted">{item.meta}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={[
              "text-[15px] font-semibold tracking-tight",
              isIncome
                ? "text-emerald-600 dark:text-emerald-300"
                : "text-red-600 dark:text-red-300",
            ].join(" ")}
          >
            {isIncome ? "+" : "-"}
            {formatCurrency(item.amount)}
          </p>
          <p className="mt-0.5 text-sm text-app-soft">
            {formatDisplayDate(item.date)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <p className="text-app-muted">No hay sesión activa.</p>
      </div>
    );
  }

  const cookieStore = await cookies();
  const activeCompanyId = cookieStore.get("active_company_id")?.value ?? null;

  const membershipQuery = supabase
    .from("memberships")
    .select("company_id, companies(owner_user_id)")
    .eq("user_id", user.id);

  const { data: membership } = await (
    activeCompanyId
      ? membershipQuery.eq("company_id", activeCompanyId)
      : membershipQuery.limit(1)
  ).maybeSingle();

  if (!membership?.company_id) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <p className="text-app-muted">No se encontró una empresa asociada.</p>
      </div>
    );
  }

  const { data: specialAdminMembership } = await supabase
    .from("memberships")
    .select("company_id")
    .eq("company_id", membership.company_id)
    .eq("user_id", SPECIAL_ADMIN_RELATED_ID)
    .maybeSingle();
  const canEditManualDates = canEditManualTransactionDates({
    email: user.email,
    userId: user.id,
    companyId: membership.company_id,
    companyOwnerUserId:
      (membership.companies as { owner_user_id?: string | null } | null)?.owner_user_id ?? null,
    hasSpecialAdminMembership: Boolean(specialAdminMembership?.company_id),
  });

  const { year: currentYear, month: currentMonth, iso: today } = getPanamaDateParts();
  const { startStr, endStr } = getMonthRangeInPanama();
  const prev1 = shiftMonth(currentYear, currentMonth, -1);
  const prev2 = shiftMonth(currentYear, currentMonth, -2);
  const prev1Range = getPanamaMonthRange(prev1.year, prev1.month);
  const prev2Range = getPanamaMonthRange(prev2.year, prev2.month);

  const yesterdayDate = new Date(`${today}T12:00:00`);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = getPanamaDateParts(yesterdayDate).iso;

  const last30Dates = Array.from({ length: 30 }, (_, index) => {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() - (29 - index));
    return getPanamaDateParts(d).iso;
  });
  const last30Start = last30Dates[0];
  const tomorrowDate = new Date(`${today}T12:00:00`);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = getPanamaDateParts(tomorrowDate).iso;
  const chartStart = startStr < last30Start ? startStr : last30Start;
  const chartStartDate = new Date(`${chartStart}T12:00:00`);
  const todayDate = new Date(`${today}T12:00:00`);
  const trendDaysCount = Math.max(
    1,
    Math.round((todayDate.getTime() - chartStartDate.getTime()) / 86_400_000) + 1
  );
  const trendDates = Array.from({ length: trendDaysCount }, (_, index) => {
    const d = new Date(`${chartStart}T12:00:00`);
    d.setDate(d.getDate() + index);
    return getPanamaDateParts(d).iso;
  });
  const collectedStart = prev2Range.start < chartStart ? prev2Range.start : chartStart;

  const [
    { data: profile },
    { data: company },
    { data: totalsData, error: totalsError },
    { data: recentSalesByCreatedData },
    { data: recentExpensesData },
    { data: trendExpensesData },
    paymentMethods,
    allProducts,
    activeServices,
    { data: prev1ExpensesData },
    { data: prev2ExpensesData },
    { data: chartSalesData },
    { data: collectedSalesData },
    { data: collectedPaymentsData },
    { data: recentPaymentsData },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, display_name, name, username")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("companies")
      .select("name, logo_url, contact_footer, needs_inventory")
      .eq("id", membership.company_id)
      .maybeSingle(),
    supabase.rpc("get_dashboard_totals", {
      p_company_id: membership.company_id,
      p_today: today,
      p_month_start: startStr,
      p_month_end: endStr,
    }),
    supabase
      .from("sales")
      .select("id, amount, payment_method, sale_date, created_at, customer_name")
      .eq("company_id", membership.company_id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("expenses")
      .select("id, amount, category, expense_date, created_at")
      .eq("company_id", membership.company_id)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("expenses")
      .select("amount, expense_date")
      .eq("company_id", membership.company_id)
      .in("expense_date", trendDates),
    fetchActivePaymentMethods(membership.company_id),
    fetchActiveProducts(membership.company_id),
    fetchActiveServices(membership.company_id),
    supabase
      .from("expenses")
      .select("amount")
      .eq("company_id", membership.company_id)
      .gte("expense_date", prev1Range.start)
      .lt("expense_date", prev1Range.end),
    supabase
      .from("expenses")
      .select("amount")
      .eq("company_id", membership.company_id)
      .gte("expense_date", prev2Range.start)
      .lt("expense_date", prev2Range.end),
    supabase
      .from("sales")
      .select("id, amount, payment_method, sale_date")
      .eq("company_id", membership.company_id)
      .gte("sale_date", chartStart)
      .lt("sale_date", tomorrow),
    supabase
      .from("sales")
      .select("id, amount, paid_amount, payment_method, payment_type, has_payment_plan, sale_date, payment_date")
      .eq("company_id", membership.company_id)
      .or(`sale_date.gte.${collectedStart},payment_date.gte.${collectedStart}`),
    supabase
      .from("sale_payments")
      .select("id, sale_id, amount, payment_method, payment_date, created_at")
      .eq("company_id", membership.company_id)
      .gte("payment_date", collectedStart)
      .lt("payment_date", tomorrow),
    supabase
      .from("sale_payments")
      .select("id, sale_id, amount, payment_method, payment_date, created_at")
      .eq("company_id", membership.company_id)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const collectedSaleIds = (collectedSalesData ?? []).map((sale) => sale.id).filter(Boolean);
  const recentPaymentSaleIds = (recentPaymentsData ?? [])
    .map((payment) => payment.sale_id)
    .filter(Boolean);
  const relatedSaleIds = Array.from(new Set([...collectedSaleIds, ...recentPaymentSaleIds]));

  const [{ data: collectedPaymentPlansData }, { data: recentPaymentSalesData }] = await Promise.all([
    collectedSaleIds.length > 0
      ? supabase
          .from("sale_payment_plans")
          .select("sale_id, down_payment_amount")
          .eq("company_id", membership.company_id)
          .in("sale_id", collectedSaleIds)
      : Promise.resolve({ data: [] }),
    relatedSaleIds.length > 0
      ? supabase
          .from("sales")
          .select("id, invoice_number, customer_name")
          .eq("company_id", membership.company_id)
          .in("id", relatedSaleIds)
      : Promise.resolve({ data: [] }),
  ]);

  const collectedEvents = getCollectedEvents({
    sales: (collectedSalesData ?? []) as CollectedSaleRow[],
    payments: (collectedPaymentsData ?? []) as CollectedPaymentRow[],
    plans: (collectedPaymentPlansData ?? []) as CollectedPaymentPlanRow[],
  });

  const chartSales: DashboardChartSale[] = (chartSalesData ?? []).map((sale) => ({
    id: sale.id,
    amount: Number(sale.amount ?? 0),
    paymentMethod: sale.payment_method ?? null,
    saleDate: sale.sale_date,
  }));

  const chartSaleIds = chartSales.map((sale) => sale.id);

  const [{ data: chartSaleItemsData }] = await Promise.all([
    chartSaleIds.length > 0
      ? supabase
          .from("sale_items")
          .select("sale_id, description, quantity, product_id")
          .eq("company_id", membership.company_id)
          .in("sale_id", chartSaleIds)
      : Promise.resolve({ data: [] }),
  ]);

  const chartSaleItems: DashboardChartSaleItem[] = (chartSaleItemsData ?? []).map((item) => ({
    saleId: item.sale_id,
    description: item.description ?? "Producto sin nombre",
    quantity: Number(item.quantity ?? 0),
    productId: item.product_id ?? null,
  }));

  const needsInventory = Boolean(company?.needs_inventory);
  const activeProducts = needsInventory ? allProducts : [];

  const totals = (!totalsError && totalsData?.[0]) ? totalsData[0] : {
    sales_today: 0,
    expenses_today: 0,
    sales_month: 0,
    expenses_month: 0,
  };

  const totalSalesToday = collectedEvents
    .filter((event) => event.date === today)
    .reduce((sum, event) => sum + event.amount, 0);
  const totalExpensesToday = Number(totals.expenses_today ?? 0);
  const balanceToday = totalSalesToday - totalExpensesToday;

  const totalSalesMonth = collectedEvents
    .filter((event) => event.date >= startStr && event.date < endStr && event.date < tomorrow)
    .reduce((sum, event) => sum + event.amount, 0);
  const totalExpensesMonth = Number(totals.expenses_month ?? 0);
  const balanceMonth = totalSalesMonth - totalExpensesMonth;

  const recentSales: RecentMovement[] = (recentSalesByCreatedData ?? []).map((sale) => ({
    id: sale.id,
    type: "sale",
    amount: Number(sale.amount ?? 0),
    date: sale.sale_date,
    createdAt: sale.created_at ?? null,
    activityAt: sale.created_at ?? null,
    label: sale.customer_name?.trim() || "Venta registrada",
    meta: formatPaymentMethodLabel(sale.payment_method),
  }));

  const recentPaymentSalesById = new Map(
    (recentPaymentSalesData ?? []).map((sale) => [String(sale.id), sale])
  );

  const recentPayments: RecentMovement[] = (recentPaymentsData ?? []).map((payment) => {
    const sale = recentPaymentSalesById.get(String(payment.sale_id));
    const invoiceNumber = String(sale?.invoice_number ?? "").trim();
    const customerName = String(sale?.customer_name ?? "").trim();
    const meta = customerName
      ? `Pago recibido de ${customerName}.`
      : invoiceNumber
        ? `Se registró un pago en la factura #${invoiceNumber}.`
        : "Se registró un pago en una venta a cuota.";

    return {
      id: String(payment.id),
      type: "payment",
      amount: Number(payment.amount ?? 0),
      date: String(payment.payment_date ?? ""),
      createdAt: payment.created_at ?? null,
      activityAt: payment.payment_date ? `${payment.payment_date}T12:00:00` : payment.created_at ?? null,
      label: "Pago registrado",
      meta,
    };
  });

  const recentExpenses: RecentMovement[] = (recentExpensesData ?? []).map((expense) => ({
    id: expense.id,
    type: "expense",
    amount: Number(expense.amount ?? 0),
    date: expense.expense_date,
    createdAt: expense.created_at ?? null,
    activityAt: expense.created_at ?? null,
    label: "Gasto registrado",
    meta: formatExpenseCategoryLabel(expense.category),
  }));

  const recentMovements = [...recentSales, ...recentPayments, ...recentExpenses]
    .sort((a, b) => {
      const activityA = getActivityTime(a.activityAt ?? a.createdAt, a.date);
      const activityB = getActivityTime(b.activityAt ?? b.createdAt, b.date);
      return activityB - activityA;
    })
    .slice(0, 6);

  const salesYesterdayValue = collectedEvents
    .filter((event) => event.date === yesterday)
    .reduce((sum, event) => sum + event.amount, 0);

  const collectedChartSales: DashboardChartSale[] = collectedEvents
    .filter((event) => event.date >= chartStart && event.date < tomorrow)
    .map((event) => ({
      id: event.saleId,
      amount: event.amount,
      paymentMethod: event.paymentMethod,
      saleDate: event.date,
    }));

  const prev1SalesTotal = collectedEvents
    .filter((event) => event.date >= prev1Range.start && event.date < prev1Range.end)
    .reduce((sum, event) => sum + event.amount, 0);
  const prev2SalesTotal = collectedEvents
    .filter((event) => event.date >= prev2Range.start && event.date < prev2Range.end)
    .reduce((sum, event) => sum + event.amount, 0);

  const salesByDate = new Map<string, number>();
  const expensesByDate = new Map<string, number>();

  for (const event of collectedEvents) {
    if (!trendDates.includes(event.date)) continue;
    const current = salesByDate.get(event.date) ?? 0;
    salesByDate.set(event.date, current + event.amount);
  }

  for (const item of trendExpensesData ?? []) {
    const current = expensesByDate.get(item.expense_date) ?? 0;
    expensesByDate.set(item.expense_date, current + Number(item.amount ?? 0));
  }

  const trendData = trendDates.map((date) => ({
    date,
    ventas: salesByDate.get(date) ?? 0,
    gastos: expensesByDate.get(date) ?? 0,
  }));

  const prev1ExpensesTotal = (prev1ExpensesData ?? []).reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
  const prev2ExpensesTotal = (prev2ExpensesData ?? []).reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

  const monthlyData = [
    { label: getPanamaMonthLabel(prev2.year, prev2.month), ventas: prev2SalesTotal, gastos: prev2ExpensesTotal, balance: prev2SalesTotal - prev2ExpensesTotal, isCurrent: false },
    { label: getPanamaMonthLabel(prev1.year, prev1.month), ventas: prev1SalesTotal, gastos: prev1ExpensesTotal, balance: prev1SalesTotal - prev1ExpensesTotal, isCurrent: false },
    { label: getPanamaMonthLabel(currentYear, currentMonth), ventas: totalSalesMonth, gastos: totalExpensesMonth, balance: balanceMonth, isCurrent: true },
  ];

  const balanceData = [
    { name: "Cobrado", value: totalSalesMonth },
    { name: "Gastos", value: totalExpensesMonth },
  ];

  const dailySalesComparison = [
    { label: "Ayer", value: salesYesterdayValue },
    { label: "Hoy", value: totalSalesToday },
  ];

  const displayName = getUserDisplayName(user, profile);
  const companyLogo = await resolveLogoUrl(getCompanyLogo(company));

  return (
    <div className="flex min-h-full flex-col gap-4 overflow-x-hidden overflow-y-auto pr-1 text-app">
      <header className="animate-mx-fade-up shrink-0">
        <div className="flex items-start justify-between gap-4 sm:gap-6">
          <div className="min-w-0 flex-1">
            <p className={sectionLabelClass}>Panel privado</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-app sm:text-3xl md:text-4xl">
              Dashboard de {company?.name ?? "tu empresa"}
            </h1>
            <p className="mt-2 text-app-muted">
              {getGreeting()} {displayName}, estás viendo el resumen operativo de{" "}
              {company?.name ?? "Monexity"}.
            </p>
          </div>

          <div className="flex shrink-0 items-center justify-center">
            <div className="app-card-strong flex h-16 w-16 overflow-hidden rounded-[22px] sm:h-20 sm:w-20">
              {companyLogo ? (
                <img
                  src={companyLogo}
                  alt={`Logo de ${company?.name ?? "la empresa"}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-app-soft">
                  Logo
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
        <div className={`${mainSectionCardClass} animate-mx-fade-up [animation-delay:60ms]`}>
          <p className={sectionLabelClass}>Vista general</p>
          <h2 className="mt-2 text-2xl font-semibold text-app">
            Resumen de hoy y del mes
          </h2>
          <p className="mt-2 text-sm text-app-muted">
            Revisa tus números principales.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <StatCard
              title="Cobrado hoy"
              value={formatCurrency(totalSalesToday)}
              subtitle="Dinero recibido hoy."
            />
            <StatCard
              title="Gastos de hoy"
              value={formatCurrency(totalExpensesToday)}
              subtitle="Egresos registrados hoy."
            />
            <StatCard
              title="Balance de hoy"
              value={formatCurrency(balanceToday)}
              subtitle="Resultado del día."
              tone={balanceToday >= 0 ? "positive" : "negative"}
            />
            <StatCard
              title="Balance del mes"
              value={formatCurrency(balanceMonth)}
              subtitle="Resultado acumulado del mes."
              tone={balanceMonth >= 0 ? "positive" : "negative"}
            />
          </div>
        </div>

        <div className={`${mainSectionCardClass} animate-mx-fade-up xl:row-span-2 [animation-delay:80ms]`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={sectionLabelClass}>Actividad reciente</p>
              <h2 className="mt-2 text-2xl font-semibold text-app">
                Últimos movimientos
              </h2>
            </div>
          </div>
          <p className="mt-2 text-sm text-app-muted">
            Ventas, pagos y gastos mezclados en una sola línea de tiempo.
          </p>
          <div className="mt-4 space-y-3">
            {recentMovements.length > 0 ? (
              recentMovements.map((item) => (
                <RecentMovementItem key={`${item.type}-${item.id}`} item={item} />
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-app bg-app-soft p-4">
                <p className="text-sm text-app-muted">
                  Todavía no hay movimientos registrados.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className={`${mainSectionCardClass} animate-mx-fade-up [animation-delay:100ms]`}>
          <h2 className="text-2xl font-semibold text-app">Shortcuts</h2>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <CreateSaleQuickModal
              today={today}
              paymentMethods={paymentMethods}
              products={activeProducts}
              services={activeServices}
              canEditManualDates={canEditManualDates}
              trigger={
                <ShortcutTriggerCard
                  title="Nueva venta"
                  description="Registra una venta en segundos."
                />
              }
            />
            <CreateExpenseQuickModal
              today={today}
              canEditManualDates={canEditManualDates}
              trigger={
                <ShortcutTriggerCard
                  title="Nuevo gasto"
                  description="Registra un gasto en segundos."
                />
              }
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ActionLink href="/dashboard/sales" label="Ver ventas" />
            <ActionLink href="/dashboard/expenses" label="Ver gastos" />
          </div>
        </div>

        <div className="animate-mx-fade-up xl:col-span-2 [animation-delay:140ms]">
          <div className={mainSectionCardClass}>
            <div className="mb-4">
              <p className={sectionLabelClass}>Insights visuales</p>
              <h2 className="mt-2 text-2xl font-semibold text-app">
                Balance y rendimiento
              </h2>
              <p className="mt-2 text-sm text-app-muted">
                Visualiza el estado del mes, el ritmo diario y la tendencia reciente.
              </p>
            </div>
            <DashboardInsightsCharts
              balanceData={balanceData}
              dailySalesComparison={dailySalesComparison}
              trendData={trendData}
              monthlyData={monthlyData}
              chartSales={collectedChartSales}
              chartSaleItems={chartSaleItems}
              today={today}
              monthStart={startStr}
              balanceMonth={balanceMonth}
              salesMonth={totalSalesMonth}
              expensesMonth={totalExpensesMonth}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
