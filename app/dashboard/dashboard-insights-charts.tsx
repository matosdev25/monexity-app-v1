"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "../../lib/currency-format";
import { useResolvedTheme, type ResolvedTheme } from "../../components/theme-clock";

// ── Types ─────────────────────────────────────────────────────────────────────

type BalanceChartItem = { name: string; value: number };
type DailyComparisonItem = { label: string; value: number };
type TrendItem = { date: string; ventas: number; gastos: number };
type MonthlyDataItem = { label: string; ventas: number; gastos: number; balance: number; isCurrent: boolean };
// Cobros (fecha de pago): ventas completas, abonos iniciales y pagos de cuotas
type DashboardChartSale = {
  id: string;
  amount: number;
  paymentMethod: string | null;
  saleDate: string;
};
// Ventas por fecha de venta (para productos vendidos)
type DashboardSoldSale = { id: string; saleDate: string };
type DashboardChartSaleItem = {
  saleId: string;
  description: string;
  quantity: number;
  productId: string | null;
};
type RangeFilter = "7d" | "30d" | "month";
type TrendMetrics = "both" | "sales" | "expenses";
type CompareMetric = "sales" | "expenses" | "balance";
type WidgetKey =
  | "balance-pie"
  | "daily-bar"
  | "trend-line"
  | "payment-methods"
  | "top-products"
  | "monthly-compare";

type ChartPrefs = {
  rangeFilter: RangeFilter;
  trendMetrics: TrendMetrics;
  compareMetric: CompareMetric;
  showPrevious: boolean;
  hiddenWidgets: WidgetKey[];
};

type DashboardInsightsChartsProps = {
  balanceData: BalanceChartItem[];
  dailySalesComparison: DailyComparisonItem[];
  trendData: TrendItem[];
  monthlyData: MonthlyDataItem[];
  chartSales: DashboardChartSale[];
  soldSales: DashboardSoldSale[];
  chartSaleItems: DashboardChartSaleItem[];
  today: string;
  monthStart: string;
  prevMonthStart: string;
  balanceMonth: number;
  salesMonth: number;
  expensesMonth: number;
};

// ── Prefs persistence ──────────────────────────────────────────────────────────

const PREFS_KEY = "monexity:chart_prefs";
const VALID_WIDGET_KEYS: WidgetKey[] = [
  "balance-pie",
  "daily-bar",
  "trend-line",
  "payment-methods",
  "top-products",
  "monthly-compare",
];
const DEFAULT_PREFS: ChartPrefs = {
  rangeFilter: "7d",
  trendMetrics: "both",
  compareMetric: "sales",
  showPrevious: true,
  hiddenWidgets: [],
};

function loadPrefs(): ChartPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<Omit<ChartPrefs, "rangeFilter">> & { rangeFilter?: string };
    return {
      // "today" ya no existe como rango (una serie de 1 día no muestra tendencia)
      rangeFilter: (["7d", "30d", "month"] as RangeFilter[]).includes(parsed.rangeFilter as RangeFilter)
        ? (parsed.rangeFilter as RangeFilter)
        : DEFAULT_PREFS.rangeFilter,
      trendMetrics: (["both", "sales", "expenses"] as TrendMetrics[]).includes(parsed.trendMetrics as TrendMetrics)
        ? (parsed.trendMetrics as TrendMetrics)
        : DEFAULT_PREFS.trendMetrics,
      compareMetric: (["sales", "expenses", "balance"] as CompareMetric[]).includes(parsed.compareMetric as CompareMetric)
        ? (parsed.compareMetric as CompareMetric)
        : DEFAULT_PREFS.compareMetric,
      showPrevious: typeof parsed.showPrevious === "boolean" ? parsed.showPrevious : DEFAULT_PREFS.showPrevious,
      hiddenWidgets: Array.isArray(parsed.hiddenWidgets)
        ? (parsed.hiddenWidgets as string[]).filter((k): k is WidgetKey => VALID_WIDGET_KEYS.includes(k as WidgetKey))
        : [],
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: ChartPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

// ── Theme (reacciona al tema aplicado, incluido el cambio automático) ─────────

const BASE_COLORS = {
  emerald: "#10b981",
  emeraldSoft: "#34d399",
  red: "#ef4444",
  redSoft: "#f87171",
  sky: "#0284c7",
  skySoft: "#38bdf8",
  slate: "#64748b",
};

const FALLBACK_THEME = {
  textPrimary: "#0f172a",
  textMuted: "#475569",
  textSoft: "#94a3b8",
  borderSoft: "rgba(148,163,184,0.2)",
  surfaceStrong: "rgba(255,255,255,0.92)",
  ...BASE_COLORS,
};

function readChartTheme(resolved: ResolvedTheme | null) {
  if (typeof window === "undefined" || !resolved) return FALLBACK_THEME;
  const style = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    textPrimary: get("--text-primary", FALLBACK_THEME.textPrimary),
    textMuted: get("--text-muted", FALLBACK_THEME.textMuted),
    textSoft: get("--text-soft", FALLBACK_THEME.textSoft),
    borderSoft: get("--border-soft", FALLBACK_THEME.borderSoft),
    surfaceStrong: get("--surface-card-strong", FALLBACK_THEME.surfaceStrong),
    ...BASE_COLORS,
    sky: resolved === "dark" ? BASE_COLORS.skySoft : BASE_COLORS.sky,
  };
}

type ChartTheme = ReturnType<typeof readChartTheme>;

function useChartTheme(): ChartTheme {
  const resolved = useResolvedTheme();
  return useMemo(() => readChartTheme(resolved), [resolved]);
}

// ── Fechas y formatos (fechas YYYY-MM-DD de calendario, sin UTC) ──────────────

function parseIsoDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string, days: number) {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

function daysBetweenInclusive(start: string, end: string) {
  return Math.max(1, Math.round((parseIsoDate(end).getTime() - parseIsoDate(start).getTime()) / 86_400_000) + 1);
}

// dd/mm/aaaa
function formatFullDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function formatAxisDate(iso: string, days: number) {
  const d = parseIsoDate(iso);
  if (days <= 7) {
    return new Intl.DateTimeFormat("es-PA", { weekday: "short", day: "numeric" }).format(d);
  }
  return new Intl.DateTimeFormat("es-PA", { day: "numeric", month: "short" }).format(d);
}

const COMPACT_NUMBER = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

// Eje Y: dinero compacto ($ 1.2K); tooltips usan formatCurrency ($ 0.00)
function formatAxisMoney(value: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return `$ ${Math.abs(n) >= 1000 ? COMPACT_NUMBER.format(n) : n.toFixed(0)}`;
}

function formatUnits(value: number) {
  return `${Number(value).toLocaleString("es-PA", { maximumFractionDigits: 2 })} u.`;
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

// ── Rangos y período anterior equivalente ─────────────────────────────────────

type RangeMeta = {
  label: string;
  start: string;
  end: string;
  days: number;
  prevStart: string;
  prevEnd: string;
  periodLabel: string;
  prevLabel: string;
};

function getRangeMeta(range: RangeFilter, today: string, monthStart: string, prevMonthStart: string): RangeMeta {
  let label: string;
  let start: string;
  let prevStart: string;
  let prevEnd: string;

  if (range === "month") {
    label = "Mes actual";
    start = monthStart;
    const days = daysBetweenInclusive(monthStart, today);
    // Mismos días del mes anterior (sin pasar del último día de ese mes)
    prevStart = prevMonthStart;
    const candidate = addDays(prevMonthStart, days - 1);
    const prevMonthEnd = addDays(monthStart, -1);
    prevEnd = candidate > prevMonthEnd ? prevMonthEnd : candidate;
  } else {
    const days = range === "30d" ? 30 : 7;
    label = range === "30d" ? "Últimos 30 días" : "Últimos 7 días";
    start = addDays(today, -(days - 1));
    prevEnd = addDays(start, -1);
    prevStart = addDays(prevEnd, -(days - 1));
  }

  return {
    label,
    start,
    end: today,
    days: daysBetweenInclusive(start, today),
    prevStart,
    prevEnd,
    periodLabel: `${formatFullDate(start)} – ${formatFullDate(today)}`,
    prevLabel: `${formatFullDate(prevStart)} – ${formatFullDate(prevEnd)}`,
  };
}

function sumTrend(data: TrendItem[], start: string, end: string, field: "ventas" | "gastos") {
  return data
    .filter((item) => item.date >= start && item.date <= end)
    .reduce((sum, item) => sum + Number(item[field] ?? 0), 0);
}

type DeltaInfo =
  | { kind: "none"; text: string }
  | { kind: "delta"; text: string; favorable: boolean };

// favorableWhenUp: cobrado y balance suben = bueno; gastos suben = malo
function getDelta(current: number, previous: number, favorableWhenUp: boolean): DeltaInfo {
  if (previous === 0) {
    return { kind: "none", text: current === 0 ? "Sin movimientos" : "Sin base comparable" };
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const up = pct >= 0;
  return {
    kind: "delta",
    text: `${up ? "+" : ""}${pct.toFixed(1)}%`,
    favorable: pct === 0 ? true : up === favorableWhenUp,
  };
}

function hasPositiveValues(data: Array<{ value?: number; ventas?: number; gastos?: number }>) {
  return data.some((item) =>
    Number(item.value ?? 0) > 0 || Number(item.ventas ?? 0) > 0 || Number(item.gastos ?? 0) > 0
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

const chartCardClass = "app-card w-full min-w-0 max-w-full overflow-hidden rounded-[24px] p-4";
const chartFrameClass = "mt-4 w-full min-w-0 max-w-full";
const RESPONSIVE_INITIAL = { width: 320, height: 240 };

const segmentButtonClass = (active: boolean) =>
  [
    "whitespace-nowrap rounded-[10px] px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em]",
    "transition-[background-color,color,box-shadow,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50",
    "disabled:cursor-not-allowed disabled:opacity-50",
    active
      ? "bg-white text-slate-900 shadow-sm dark:bg-white/12 dark:text-white"
      : "text-app-muted hover:text-app active:scale-95",
  ].join(" ");

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[180px] items-center justify-center rounded-[20px] border border-dashed border-app bg-app-soft px-4 text-center">
      <p className="max-w-xs text-sm text-app-muted">{message}</p>
    </div>
  );
}

type TooltipEntry = {
  name?: string;
  value?: number;
  color?: string;
  unit?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
};

// Tooltip único: fecha completa, nombre de la métrica y unidad ($ 0.00 o u.)
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  const theme = useChartTheme();
  if (!active || !payload || payload.length === 0) return null;

  const row = payload[0]?.payload ?? {};
  const header = typeof row.tooltipLabel === "string" ? row.tooltipLabel : label;

  return (
    <div
      className="max-w-[calc(100vw-3rem)] rounded-2xl border px-3 py-2 shadow-[0_12px_28px_rgba(15,23,42,0.14)]"
      style={{ background: theme.surfaceStrong, borderColor: theme.borderSoft }}
    >
      {header ? (
        <p className="mb-2 text-xs font-semibold" style={{ color: theme.textPrimary }}>
          {header}
        </p>
      ) : null}
      <div className="space-y-1.5">
        {payload.map((entry, index) => {
          const isPrevious = String(entry.dataKey ?? "").startsWith("prev");
          const prevDate = isPrevious && typeof row.prevDate === "string" ? ` (${formatFullDate(row.prevDate)})` : "";
          const share = typeof entry.payload?.share === "number" ? ` · ${entry.payload.share.toFixed(1)}%` : "";
          const value = Number(entry.value ?? 0);
          return (
            <div key={index} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex min-w-0 items-center gap-2" style={{ color: theme.textMuted }}>
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${isPrevious ? "opacity-50" : ""}`}
                  style={{ backgroundColor: entry.color ?? theme.slate }}
                />
                <span className="truncate">{entry.name}{prevDate}</span>
              </span>
              <span className="shrink-0 font-semibold" style={{ color: theme.textPrimary }}>
                {entry.unit === "u." ? formatUnits(value) : formatCurrency(value)}
                {share}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Leyenda HTML: consistente, accesible y sin desbordar en mobile
function ChartLegend({ items }: { items: Array<{ label: string; color: string; dashed?: boolean }> }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-app-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-0.5 w-4 rounded-full"
            style={
              item.dashed
                ? { backgroundImage: `linear-gradient(90deg, ${item.color} 50%, transparent 50%)`, backgroundSize: "6px 2px" }
                : { backgroundColor: item.color }
            }
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl border border-app bg-app-soft p-0.5 sm:shrink-0"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={segmentButtonClass(value === opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const RANGE_OPTIONS: { value: RangeFilter; label: string }[] = [
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "month", label: "Mes" },
];

const METRICS_OPTIONS: { value: TrendMetrics; label: string }[] = [
  { value: "both", label: "Ambas" },
  { value: "sales", label: "Cobrado" },
  { value: "expenses", label: "Gastos" },
];

const COMPARE_OPTIONS: { value: CompareMetric; label: string }[] = [
  { value: "sales", label: "Cobrado" },
  { value: "expenses", label: "Gastos" },
  { value: "balance", label: "Balance" },
];

function DeltaBadge({ delta, suffix }: { delta: DeltaInfo; suffix?: string }) {
  if (delta.kind === "none") {
    return (
      <span className="inline-flex rounded-full bg-slate-500/10 px-2 py-0.5 text-[11px] font-medium text-app-muted">
        {delta.text}
      </span>
    );
  }
  return (
    <span
      className={[
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
        delta.favorable
          ? "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
          : "bg-red-500/12 text-red-700 dark:bg-red-500/20 dark:text-red-300",
      ].join(" ")}
    >
      {delta.text}
      {suffix ? <span className="ml-1 font-medium opacity-80">{suffix}</span> : null}
    </span>
  );
}

// ── Resumen del rango vs período anterior ─────────────────────────────────────

function RangeSummary({ trendData, meta }: { trendData: TrendItem[]; meta: RangeMeta }) {
  const sales = sumTrend(trendData, meta.start, meta.end, "ventas");
  const expenses = sumTrend(trendData, meta.start, meta.end, "gastos");
  const prevSales = sumTrend(trendData, meta.prevStart, meta.prevEnd, "ventas");
  const prevExpenses = sumTrend(trendData, meta.prevStart, meta.prevEnd, "gastos");

  const items = [
    { label: "Cobrado", value: sales, prev: prevSales, delta: getDelta(sales, prevSales, true), tone: "text-emerald-700 dark:text-emerald-300" },
    { label: "Gastos", value: expenses, prev: prevExpenses, delta: getDelta(expenses, prevExpenses, false), tone: "text-red-700 dark:text-red-300" },
    {
      label: "Balance",
      value: sales - expenses,
      prev: prevSales - prevExpenses,
      delta: getDelta(sales - expenses, prevSales - prevExpenses, true),
      tone: sales - expenses >= 0 ? "text-sky-700 dark:text-sky-300" : "text-red-700 dark:text-red-300",
    },
  ];

  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="app-card min-w-0 rounded-[20px] p-3.5">
          <p className="text-xs font-medium text-app-muted">{item.label}</p>
          <p className={`mt-1 break-words text-xl font-semibold tracking-tight ${item.tone}`}>
            {formatCurrency(item.value)}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <DeltaBadge delta={item.delta} />
            <span className="text-[11px] text-app-soft">antes {formatCurrency(item.prev)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Charts ────────────────────────────────────────────────────────────────────

function PieBalanceChart({
  balanceData,
  balanceMonth,
  salesMonth,
  expensesMonth,
}: {
  balanceData: BalanceChartItem[];
  balanceMonth: number;
  salesMonth: number;
  expensesMonth: number;
}) {
  const theme = useChartTheme();
  const positiveBalance = balanceMonth >= 0;
  const total = balanceData.reduce((sum, item) => sum + Number(item.value ?? 0), 0);
  const hasData = total > 0;
  const data = balanceData.map((item) => ({ ...item, share: total > 0 ? (Number(item.value) / total) * 100 : 0 }));

  return (
    <div className={chartCardClass}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-app-muted">Balance general del mes</p>
        <p
          className={[
            "mt-1 break-words text-2xl font-semibold tracking-tight",
            positiveBalance ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300",
          ].join(" ")}
        >
          {formatCurrency(balanceMonth)}
        </p>
        <p className="mt-0.5 text-xs text-app-soft">Cobrado menos gastos del mes en curso</p>
      </div>

      <div className={`${chartFrameClass} h-56`}>
        {!hasData ? (
          <EmptyChartState message="Aún no hay cobros ni gastos del mes para graficar." />
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={RESPONSIVE_INITIAL}>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={3} stroke="none">
                {data.map((entry, index) => (
                  <Cell key={`balance-${index}`} fill={entry.name === "Gastos" ? theme.red : theme.emerald} fillOpacity={0.92} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-3 grid min-w-0 grid-cols-2 gap-3">
        <div className="min-w-0 rounded-[18px] bg-emerald-500/10 px-3 py-2 dark:bg-emerald-500/14">
          <p className="text-xs text-app-muted">Cobrado</p>
          <p className="mt-1 break-words text-sm font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrency(salesMonth)}</p>
        </div>
        <div className="min-w-0 rounded-[18px] bg-red-500/10 px-3 py-2 dark:bg-red-500/14">
          <p className="text-xs text-app-muted">Gastos</p>
          <p className="mt-1 break-words text-sm font-semibold text-red-700 dark:text-red-300">{formatCurrency(expensesMonth)}</p>
        </div>
      </div>
    </div>
  );
}

function DailyBarChart({ data, today }: { data: DailyComparisonItem[]; today: string }) {
  const theme = useChartTheme();
  const hasData = hasPositiveValues(data);
  const yesterday = addDays(today, -1);
  const chartData = data.map((item) => ({
    ...item,
    tooltipLabel: `${item.label} · ${formatFullDate(item.label === "Hoy" ? today : yesterday)}`,
  }));
  const todayValue = data.find((d) => d.label === "Hoy")?.value ?? 0;
  const yesterdayValue = data.find((d) => d.label === "Ayer")?.value ?? 0;

  return (
    <div className={chartCardClass}>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-app-muted">Cobrado hoy vs ayer</p>
          <p className="mt-1 text-sm text-app-muted">Dinero recibido por día.</p>
        </div>
        <DeltaBadge delta={getDelta(todayValue, yesterdayValue, true)} suffix="vs ayer" />
      </div>

      <div className={`${chartFrameClass} h-64`}>
        {!hasData ? (
          <EmptyChartState message="No hay cobros registrados entre hoy y ayer." />
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={RESPONSIVE_INITIAL}>
            <BarChart data={chartData} barSize={38} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.borderSoft} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: theme.textSoft, fontSize: 12 }} />
              <YAxis width={56} tickLine={false} axisLine={false} tick={{ fill: theme.textSoft, fontSize: 11 }} tickFormatter={formatAxisMoney} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: theme.borderSoft }} />
              <Bar dataKey="value" name="Cobrado" radius={[14, 14, 8, 8]}>
                {chartData.map((item, index) => (
                  <Cell key={`day-${index}`} fill={item.label === "Hoy" ? theme.emerald : theme.slate} fillOpacity={item.label === "Hoy" ? 0.95 : 0.6} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function TrendLineChart({
  trendData,
  meta,
  metrics,
  showPrevious,
  onMetricsChange,
  onShowPreviousChange,
}: {
  trendData: TrendItem[];
  meta: RangeMeta;
  metrics: TrendMetrics;
  showPrevious: boolean;
  onMetricsChange: (v: TrendMetrics) => void;
  onShowPreviousChange: (v: boolean) => void;
}) {
  const theme = useChartTheme();
  const byDate = new Map(trendData.map((item) => [item.date, item]));

  // Cada día del rango se alinea con el día equivalente del período anterior
  const chartData = Array.from({ length: meta.days }, (_, index) => {
    const date = addDays(meta.start, index);
    const prevDate = addDays(meta.prevStart, index);
    const current = byDate.get(date);
    const previous = prevDate <= meta.prevEnd ? byDate.get(prevDate) : undefined;
    return {
      label: formatAxisDate(date, meta.days),
      tooltipLabel: formatFullDate(date),
      prevDate: prevDate <= meta.prevEnd ? prevDate : null,
      ventas: current?.ventas ?? 0,
      gastos: current?.gastos ?? 0,
      prevVentas: prevDate <= meta.prevEnd ? previous?.ventas ?? 0 : null,
      prevGastos: prevDate <= meta.prevEnd ? previous?.gastos ?? 0 : null,
    };
  });

  const showSales = metrics === "both" || metrics === "sales";
  const showExpenses = metrics === "both" || metrics === "expenses";
  // Con una sola métrica la comparación es legible; con ambas serían 4 líneas
  const comparing = showPrevious && metrics !== "both";
  const hasData = hasPositiveValues(chartData);

  const legend = [
    ...(showSales ? [{ label: "Cobrado", color: theme.emerald }] : []),
    ...(showExpenses ? [{ label: "Gastos", color: theme.red }] : []),
    ...(comparing ? [{ label: `Período anterior (${meta.prevLabel})`, color: theme.slate, dashed: true }] : []),
  ];

  return (
    <div className={`${chartCardClass} xl:col-span-2`}>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-app-muted">Flujo diario</p>
          <p className="mt-1 text-xs text-app-soft">{meta.periodLabel}</p>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          <SegmentedControl label="Métricas a mostrar" options={METRICS_OPTIONS} value={metrics} onChange={onMetricsChange} />
          <button
            type="button"
            onClick={() => onShowPreviousChange(!showPrevious)}
            aria-pressed={comparing}
            disabled={metrics === "both"}
            title={metrics === "both" ? "Elige Cobrado o Gastos para comparar con el período anterior" : undefined}
            className={`${segmentButtonClass(comparing)} border border-app bg-app-soft`}
          >
            Vs. período anterior
          </button>
        </div>
      </div>

      <div className={`${chartFrameClass} h-72`}>
        {!hasData && !comparing ? (
          <EmptyChartState message="No hay movimientos en este rango." />
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={RESPONSIVE_INITIAL}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.borderSoft} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: theme.textSoft, fontSize: 11 }}
                interval="preserveStartEnd"
                minTickGap={meta.days <= 7 ? 4 : 24}
              />
              <YAxis width={56} tickLine={false} axisLine={false} tick={{ fill: theme.textSoft, fontSize: 11 }} tickFormatter={formatAxisMoney} />
              <Tooltip content={<CustomTooltip />} />
              {comparing && showSales ? (
                <Area type="monotone" dataKey="prevVentas" name="Cobrado · período anterior" stroke={theme.slate} strokeDasharray="5 4" fill="none" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              ) : null}
              {comparing && showExpenses ? (
                <Area type="monotone" dataKey="prevGastos" name="Gastos · período anterior" stroke={theme.slate} strokeDasharray="5 4" fill="none" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              ) : null}
              {showSales ? (
                <Area
                  type="monotone"
                  dataKey="ventas"
                  name="Cobrado"
                  stroke={theme.emerald}
                  fill={theme.emeraldSoft}
                  fillOpacity={0.14}
                  strokeWidth={2.5}
                  dot={meta.days <= 7 ? { r: 3, fill: theme.emerald, strokeWidth: 0 } : false}
                  activeDot={{ r: 5, fill: theme.emerald }}
                />
              ) : null}
              {showExpenses ? (
                <Area
                  type="monotone"
                  dataKey="gastos"
                  name="Gastos"
                  stroke={theme.red}
                  fill={theme.redSoft}
                  fillOpacity={0.1}
                  strokeWidth={2.5}
                  dot={meta.days <= 7 ? { r: 3, fill: theme.red, strokeWidth: 0 } : false}
                  activeDot={{ r: 5, fill: theme.red }}
                />
              ) : null}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <ChartLegend items={legend} />
    </div>
  );
}

function PaymentMethodsChart({ data, periodLabel }: { data: Array<{ name: string; value: number }>; periodLabel: string }) {
  const theme = useChartTheme();
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const hasData = total > 0;
  const colors = [theme.sky, theme.emerald, theme.slate, theme.emeraldSoft, theme.redSoft];
  const chartData = data.map((item) => ({ ...item, share: total > 0 ? (item.value / total) * 100 : 0 }));

  return (
    <div className={chartCardClass}>
      <div>
        <p className="text-sm font-medium text-app-muted">Cobros por método de pago</p>
        <p className="mt-1 text-xs text-app-soft">{periodLabel} · por fecha de pago</p>
      </div>

      {!hasData ? (
        <div className={`${chartFrameClass} h-56`}>
          <EmptyChartState message="No hay cobros con método de pago en este rango." />
        </div>
      ) : (
        <div className="mt-4 grid min-w-0 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="h-48 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={RESPONSIVE_INITIAL}>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={3} stroke="none">
                  {chartData.map((_, index) => (
                    <Cell key={`payment-${index}`} fill={colors[index % colors.length]} fillOpacity={0.9} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="min-w-0 space-y-2">
            {chartData.map((item, index) => (
              <li key={item.name} className="flex min-w-0 items-center justify-between gap-3 text-xs">
                <span className="flex min-w-0 items-center gap-2 text-app-muted">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="font-semibold text-app">{formatCurrency(item.value)}</span>
                  <span className="ml-1.5 text-app-soft">{item.share.toFixed(0)}%</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TopProductsChart({ data, periodLabel }: { data: Array<{ name: string; value: number }>; periodLabel: string }) {
  const theme = useChartTheme();
  const hasData = hasPositiveValues(data);
  const chartData = data.map((item) => ({ ...item, tooltipLabel: item.name }));

  return (
    <div className={chartCardClass}>
      <div>
        <p className="text-sm font-medium text-app-muted">Productos más vendidos</p>
        <p className="mt-1 text-xs text-app-soft">{periodLabel} · unidades por fecha de venta</p>
      </div>

      <div className={`${chartFrameClass} h-64`}>
        {!hasData ? (
          <EmptyChartState message="No hay ítems vendidos en este rango." />
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={RESPONSIVE_INITIAL}>
            <BarChart data={chartData} layout="vertical" barSize={18} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme.borderSoft} />
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: theme.textSoft, fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={96}
                tickLine={false}
                axisLine={false}
                tick={{ fill: theme.textMuted, fontSize: 11 }}
                tickFormatter={(value: string) => (value.length > 14 ? `${value.slice(0, 13)}…` : value)}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: theme.borderSoft }} />
              <Bar dataKey="value" name="Unidades vendidas" unit="u." radius={[0, 12, 12, 0]} fill={theme.emerald} fillOpacity={0.86} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function ComparisonBarChart({
  data,
  trendData,
  today,
  monthStart,
  prevMonthStart,
  metric,
  onMetricChange,
}: {
  data: MonthlyDataItem[];
  trendData: TrendItem[];
  today: string;
  monthStart: string;
  prevMonthStart: string;
  metric: CompareMetric;
  onMetricChange: (v: CompareMetric) => void;
}) {
  const theme = useChartTheme();
  const activeColor = metric === "sales" ? theme.emerald : metric === "expenses" ? theme.red : theme.sky;
  const metricLabel = metric === "sales" ? "Cobrado" : metric === "expenses" ? "Gastos" : "Balance";
  const getValue = (item: MonthlyDataItem) =>
    metric === "sales" ? item.ventas : metric === "expenses" ? item.gastos : item.balance;

  const chartData = data.map((item) => ({
    label: item.isCurrent ? `${item.label} (en curso)` : item.label,
    tooltipLabel: item.isCurrent ? `${item.label} · hasta ${formatFullDate(today)}` : `${item.label} · mes completo`,
    value: getValue(item),
    isCurrent: item.isCurrent,
  }));

  // El mes en curso es parcial: se compara contra los mismos días del mes anterior
  const monthMeta = getRangeMeta("month", today, monthStart, prevMonthStart);
  const valueFor = (start: string, end: string) => {
    const sales = sumTrend(trendData, start, end, "ventas");
    const expenses = sumTrend(trendData, start, end, "gastos");
    return metric === "sales" ? sales : metric === "expenses" ? expenses : sales - expenses;
  };
  const delta = getDelta(
    valueFor(monthMeta.start, monthMeta.end),
    valueFor(monthMeta.prevStart, monthMeta.prevEnd),
    metric !== "expenses"
  );
  const prevMonthLabel = data.filter((d) => !d.isCurrent).at(-1)?.label ?? "mes anterior";

  return (
    <div className={chartCardClass}>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-app-muted">Comparativo mensual</p>
          <p className="mt-1 text-xs text-app-soft">Últimos 3 meses · {metricLabel.toLowerCase()}</p>
        </div>
        <SegmentedControl label="Métrica comparativa" options={COMPARE_OPTIONS} value={metric} onChange={onMetricChange} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-app-soft">
        <DeltaBadge delta={delta} />
        <span>vs mismos días de {prevMonthLabel} ({monthMeta.prevLabel})</span>
      </div>

      <div className={`${chartFrameClass} h-64`}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={RESPONSIVE_INITIAL}>
          <BarChart data={chartData} barSize={42} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.borderSoft} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: theme.textSoft, fontSize: 11 }} />
            <YAxis width={56} tickLine={false} axisLine={false} tick={{ fill: theme.textSoft, fontSize: 11 }} tickFormatter={formatAxisMoney} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: theme.borderSoft }} />
            <Bar dataKey="value" name={metricLabel} radius={[14, 14, 8, 8]}>
              {chartData.map((item, index) => (
                <Cell key={`month-${index}`} fill={item.isCurrent ? activeColor : theme.slate} fillOpacity={item.isCurrent ? 0.9 : 0.45} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function DashboardInsightsCharts({
  balanceData,
  dailySalesComparison,
  trendData,
  monthlyData,
  chartSales,
  soldSales,
  chartSaleItems,
  today,
  monthStart,
  prevMonthStart,
  balanceMonth,
  salesMonth,
  expensesMonth,
}: DashboardInsightsChartsProps) {
  const [prefs, setPrefs] = useState<ChartPrefs>(DEFAULT_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPrefs(loadPrefs());
      setPrefsLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function updatePrefs(update: Partial<ChartPrefs>) {
    setPrefs((prev) => {
      const next = { ...prev, ...update };
      savePrefs(next);
      return next;
    });
  }

  const active = prefsLoaded ? prefs : DEFAULT_PREFS;
  const hidden = new Set(prefsLoaded ? prefs.hiddenWidgets : []);
  const visibleCount = VALID_WIDGET_KEYS.filter((k) => !hidden.has(k)).length;
  const meta = getRangeMeta(active.rangeFilter, today, monthStart, prevMonthStart);

  // Cobros del rango (fecha de pago) → métodos de pago
  const rangeCollections = chartSales.filter((sale) => sale.saleDate >= meta.start && sale.saleDate <= meta.end);
  const paymentMethodData = Object.entries(
    rangeCollections.reduce<Record<string, number>>((acc, sale) => {
      const label = formatPaymentMethodLabel(sale.paymentMethod);
      acc[label] = (acc[label] ?? 0) + Number(sale.amount ?? 0);
      return acc;
    }, {})
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Ventas del rango (fecha de venta) → productos vendidos
  const rangeSoldIds = new Set(
    soldSales.filter((sale) => sale.saleDate >= meta.start && sale.saleDate <= meta.end).map((sale) => sale.id)
  );
  const topProductsData = Object.entries(
    chartSaleItems
      .filter((item) => rangeSoldIds.has(item.saleId))
      .reduce<Record<string, number>>((acc, item) => {
        const name = item.description?.trim() || "Producto sin nombre";
        acc[name] = (acc[name] ?? 0) + Number(item.quantity ?? 0);
        return acc;
      }, {})
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <div className="min-w-0 max-w-full space-y-4">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-app-muted">
            Rango: <span className="font-semibold text-app">{meta.label}</span>
          </p>
          <p className="text-xs text-app-soft">
            {meta.periodLabel} · comparado con {meta.prevLabel}
          </p>
        </div>
        <SegmentedControl
          label="Rango de tiempo"
          options={RANGE_OPTIONS}
          value={active.rangeFilter}
          onChange={(value) => updatePrefs({ rangeFilter: value })}
        />
      </div>

      <RangeSummary trendData={trendData} meta={meta} />

      <div className="grid min-w-0 max-w-full gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {!hidden.has("trend-line") && (
          <TrendLineChart
            trendData={trendData}
            meta={meta}
            metrics={active.trendMetrics}
            showPrevious={active.showPrevious}
            onMetricsChange={(v) => updatePrefs({ trendMetrics: v })}
            onShowPreviousChange={(v) => updatePrefs({ showPrevious: v })}
          />
        )}
        {!hidden.has("balance-pie") && (
          <PieBalanceChart
            balanceData={balanceData}
            balanceMonth={balanceMonth}
            salesMonth={salesMonth}
            expensesMonth={expensesMonth}
          />
        )}
        {!hidden.has("daily-bar") && <DailyBarChart data={dailySalesComparison} today={today} />}
        {!hidden.has("payment-methods") && <PaymentMethodsChart data={paymentMethodData} periodLabel={meta.periodLabel} />}
        {!hidden.has("top-products") && <TopProductsChart data={topProductsData} periodLabel={meta.periodLabel} />}
        {!hidden.has("monthly-compare") && (
          <ComparisonBarChart
            data={monthlyData}
            trendData={trendData}
            today={today}
            monthStart={monthStart}
            prevMonthStart={prevMonthStart}
            metric={active.compareMetric}
            onMetricChange={(v) => updatePrefs({ compareMetric: v })}
          />
        )}
        {prefsLoaded && visibleCount === 0 && (
          <div className="flex min-w-0 flex-col items-center justify-center rounded-[24px] border border-dashed border-app bg-app-soft py-12 text-center xl:col-span-2">
            <p className="text-sm font-medium text-app-muted">No hay widgets visibles.</p>
            <p className="mt-1 text-xs text-app-soft">Actívalos desde Mi negocio → General → Dashboard.</p>
          </div>
        )}
      </div>
    </div>
  );
}
