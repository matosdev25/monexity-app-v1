"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "../../lib/currency-format";

// ── Types ─────────────────────────────────────────────────────────────────────

type BalanceChartItem = { name: string; value: number };
type DailyComparisonItem = { label: string; value: number };
type TrendItem = { date: string; ventas: number; gastos: number };
type MonthlyDataItem = { label: string; ventas: number; gastos: number; balance: number; isCurrent: boolean };
type DashboardChartSale = {
  id: string;
  amount: number;
  paymentMethod: string | null;
  saleDate: string;
};
type DashboardChartSaleItem = {
  saleId: string;
  description: string;
  quantity: number;
  productId: string | null;
};
type RangeFilter = "today" | "7d" | "30d" | "month";
type TrendRange = number;
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
  hiddenWidgets: WidgetKey[];
};

type DashboardInsightsChartsProps = {
  balanceData: BalanceChartItem[];
  dailySalesComparison: DailyComparisonItem[];
  trendData: TrendItem[];
  monthlyData: MonthlyDataItem[];
  chartSales: DashboardChartSale[];
  chartSaleItems: DashboardChartSaleItem[];
  today: string;
  monthStart: string;
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
  hiddenWidgets: [],
};

function loadPrefs(): ChartPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<ChartPrefs>;
    return {
      rangeFilter: (["today", "7d", "30d", "month"] as RangeFilter[]).includes(
        parsed.rangeFilter as RangeFilter
      )
        ? (parsed.rangeFilter as RangeFilter)
        : DEFAULT_PREFS.rangeFilter,
      trendMetrics: (["both", "sales", "expenses"] as TrendMetrics[]).includes(
        parsed.trendMetrics as TrendMetrics
      )
        ? (parsed.trendMetrics as TrendMetrics)
        : DEFAULT_PREFS.trendMetrics,
      compareMetric: (["sales", "expenses", "balance"] as CompareMetric[]).includes(
        parsed.compareMetric as CompareMetric
      )
        ? (parsed.compareMetric as CompareMetric)
        : DEFAULT_PREFS.compareMetric,
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

// ── Theme ─────────────────────────────────────────────────────────────────────

const DEFAULT_THEME = {
  textPrimary: "#0f172a",
  textMuted: "#475569",
  textSoft: "#94a3b8",
  borderSoft: "rgba(148,163,184,0.2)",
  surfaceStrong: "rgba(255,255,255,0.92)",
  emerald: "#10b981",
  emeraldSoft: "#34d399",
  red: "#ef4444",
  redSoft: "#f87171",
  sky: "#38bdf8",
  slate: "#64748b",
};

function getChartTheme() {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const style = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  return {
    textPrimary: get("--text-primary", DEFAULT_THEME.textPrimary),
    textMuted: get("--text-muted", DEFAULT_THEME.textMuted),
    textSoft: get("--text-soft", DEFAULT_THEME.textSoft),
    borderSoft: get("--border-soft", DEFAULT_THEME.borderSoft),
    surfaceStrong: get("--surface-card-strong", DEFAULT_THEME.surfaceStrong),
    emerald: DEFAULT_THEME.emerald,
    emeraldSoft: DEFAULT_THEME.emeraldSoft,
    red: DEFAULT_THEME.red,
    redSoft: DEFAULT_THEME.redSoft,
    sky: DEFAULT_THEME.sky,
    slate: DEFAULT_THEME.slate,
  };
}

function useChartTheme() {
  return useMemo(() => getChartTheme(), []);
}

function useContainerWidth(minWidth = 100) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w >= minWidth) setWidth(w);
      }
    });
    observer.observe(ref.current);
    const initialWidth = ref.current.getBoundingClientRect().width;
    if (initialWidth >= minWidth) setWidth(initialWidth);
    return () => observer.disconnect();
  }, [minWidth]);

  return { ref, width };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPreviousDate(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() - days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTrendLabel(isoDate: string, range: TrendRange): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  if (range <= 7) {
    return new Intl.DateTimeFormat("es-PA", { weekday: "short" }).format(d);
  }
  return new Intl.DateTimeFormat("es-PA", { day: "numeric", month: "short" }).format(d);
}

function getMonthValue(item: MonthlyDataItem, metric: CompareMetric): number {
  if (metric === "sales") return item.ventas;
  if (metric === "expenses") return item.gastos;
  return item.balance;
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

function getRangeMeta(range: RangeFilter, today: string, monthStart: string) {
  if (range === "today") {
    return { label: "Hoy", start: today, trendRange: 7 as TrendRange };
  }

  if (range === "30d") {
    return { label: "Últimos 30 días", start: getPreviousDate(today, 29), trendRange: 30 as TrendRange };
  }

  if (range === "month") {
    const start = new Date(`${monthStart}T12:00:00`);
    const end = new Date(`${today}T12:00:00`);
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
    return { label: "Mes actual", start: monthStart, trendRange: days as TrendRange };
  }

  return { label: "Últimos 7 días", start: getPreviousDate(today, 6), trendRange: 7 as TrendRange };
}

function hasPositiveValues(data: Array<{ value?: number; ventas?: number; gastos?: number }>) {
  return data.some((item) =>
    Number(item.value ?? 0) > 0 ||
    Number(item.ventas ?? 0) > 0 ||
    Number(item.gastos ?? 0) > 0
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

const chartCardClass = "app-card w-full min-w-0 max-w-full overflow-hidden rounded-[24px] p-4";
const chartFrameClass = "mt-4 min-w-0 max-w-full overflow-hidden";

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      className="animate-pulse rounded-2xl bg-slate-200/60 dark:bg-slate-800/60"
      style={{ height }}
    />
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[180px] items-center justify-center rounded-[20px] border border-dashed border-app bg-app-soft px-4 text-center">
      <p className="max-w-xs text-sm text-app-muted">{message}</p>
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  const theme = useChartTheme();
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      className="max-w-[calc(100vw-3rem)] rounded-2xl border px-3 py-2 shadow-[0_12px_28px_rgba(15,23,42,0.14)] backdrop-blur-md"
      style={{ background: theme.surfaceStrong, borderColor: theme.borderSoft }}
    >
      {label && (
        <p className="mb-2 text-xs font-semibold" style={{ color: theme.textPrimary }}>
          {label}
        </p>
      )}
      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <span className="flex items-center gap-2" style={{ color: theme.textMuted }}>
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color ?? theme.slate }}
              />
              <span>{entry.name}</span>
            </span>
            <span className="font-semibold" style={{ color: theme.textPrimary }}>
              {entry.name === "Unidades"
                ? `${Number(entry.value ?? 0).toLocaleString("es-PA")} uds.`
                : formatCurrency(Number(entry.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Range selector ────────────────────────────────────────────────────────────

const RANGE_OPTIONS: { value: RangeFilter; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "month", label: "Mes" },
];

function RangeFilterSelector({
  value,
  onChange,
}: {
  value: RangeFilter;
  onChange: (v: RangeFilter) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Rango de tiempo"
      className="flex w-full max-w-full gap-0.5 overflow-x-auto rounded-xl border border-app bg-app-soft p-0.5 sm:w-auto sm:shrink-0"
    >
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={[
            "whitespace-nowrap rounded-[10px] px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] transition-[background-color,color,box-shadow,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
            value === opt.value
              ? "bg-white text-slate-900 shadow-sm dark:bg-white/12 dark:text-white"
              : "text-app-muted hover:text-app active:scale-95",
          ].join(" ")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Metrics selector ──────────────────────────────────────────────────────────

const METRICS_OPTIONS: { value: TrendMetrics; label: string }[] = [
  { value: "both", label: "Ambas" },
  { value: "sales", label: "Cobrado" },
  { value: "expenses", label: "Gastos" },
];

function MetricsSelector({
  value,
  onChange,
}: {
  value: TrendMetrics;
  onChange: (v: TrendMetrics) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Métricas a mostrar"
      className="inline-flex max-w-full overflow-x-auto rounded-xl border border-app bg-app-soft p-0.5 sm:shrink-0"
    >
      {METRICS_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={[
            "rounded-[10px] px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] transition-[background-color,color,box-shadow,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
            value === opt.value
              ? "bg-white text-slate-900 shadow-sm dark:bg-white/12 dark:text-white"
              : "text-app-muted hover:text-app active:scale-95",
          ].join(" ")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Compare metric selector ───────────────────────────────────────────────────

const COMPARE_OPTIONS: { value: CompareMetric; label: string }[] = [
  { value: "sales", label: "Cobrado" },
  { value: "expenses", label: "Gastos" },
  { value: "balance", label: "Balance" },
];

function CompareMetricSelector({
  value,
  onChange,
}: {
  value: CompareMetric;
  onChange: (v: CompareMetric) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Métrica comparativa"
      className="inline-flex max-w-full overflow-x-auto rounded-xl border border-app bg-app-soft p-0.5 sm:shrink-0"
    >
      {COMPARE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={[
            "rounded-[10px] px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] transition-[background-color,color,box-shadow,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
            value === opt.value
              ? "bg-white text-slate-900 shadow-sm dark:bg-white/12 dark:text-white"
              : "text-app-muted hover:text-app active:scale-95",
          ].join(" ")}
        >
          {opt.label}
        </button>
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
  const { ref, width } = useContainerWidth();
  const positiveBalance = balanceMonth >= 0;
  const hasData = balanceData.some((item) => Number(item.value ?? 0) > 0);

  return (
    <div className={chartCardClass}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-app-muted">Balance general del mes</p>
          <p
            className={[
              "mt-1 break-words text-2xl font-semibold tracking-tight",
              positiveBalance
                ? "text-emerald-600 dark:text-emerald-300"
                : "text-red-600 dark:text-red-300",
            ].join(" ")}
          >
            {formatCurrency(balanceMonth)}
          </p>
        </div>
      </div>

      <div ref={ref} className={`${chartFrameClass} h-60`}>
        {!hasData ? (
          <EmptyChartState message="Aún no hay cobros ni gastos del mes para graficar." />
        ) : width ? (
          <PieChart width={width} height={240}>
            <Pie
              data={balanceData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={64}
              outerRadius={88}
              paddingAngle={3}
              stroke="none"
            >
              {balanceData.map((entry, index) => (
                <Cell
                  key={`balance-${index}`}
                  fill={entry.name === "Gastos" ? theme.red : theme.emerald}
                  fillOpacity={0.92}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        ) : (
          <ChartSkeleton height={240} />
        )}
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-3">
        <div className="min-w-0 rounded-[18px] bg-emerald-500/10 px-3 py-2 dark:bg-emerald-500/14">
          <p className="text-xs text-app-muted">Cobrado</p>
          <p className="mt-1 break-words text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            {formatCurrency(salesMonth)}
          </p>
        </div>
        <div className="min-w-0 rounded-[18px] bg-red-500/10 px-3 py-2 dark:bg-red-500/14">
          <p className="text-xs text-app-muted">Gastos</p>
          <p className="mt-1 break-words text-sm font-semibold text-red-700 dark:text-red-300">
            {formatCurrency(expensesMonth)}
          </p>
        </div>
      </div>
    </div>
  );
}

function DailyBarChart({ data }: { data: DailyComparisonItem[] }) {
  const theme = useChartTheme();
  const { ref, width } = useContainerWidth();
  const hasData = hasPositiveValues(data);

  return (
    <div className={chartCardClass}>
      <div>
        <p className="text-sm font-medium text-app-muted">Cobrado hoy vs ayer</p>
        <p className="mt-1 text-sm text-app-muted">Comparación rápida del dinero recibido.</p>
      </div>

      <div ref={ref} className={`${chartFrameClass} h-70`}>
        {!hasData ? (
          <EmptyChartState message="No hay cobros registrados entre hoy y ayer." />
        ) : width ? (
          <BarChart width={width} height={280} data={data} barSize={38}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.borderSoft} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: theme.textSoft, fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: theme.textSoft, fontSize: 12 }}
              tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" name="Cobrado" radius={[14, 14, 8, 8]}>
              {data.map((item, index) => (
                <Cell
                  key={`day-${index}`}
                  fill={item.label === "Hoy" ? theme.sky : theme.slate}
                  fillOpacity={item.label === "Hoy" ? 0.95 : 0.75}
                />
              ))}
            </Bar>
          </BarChart>
        ) : (
          <ChartSkeleton height={280} />
        )}
      </div>
    </div>
  );
}

function TrendLineChart({
  data,
  range,
  metrics,
  onMetricsChange,
}: {
  data: TrendItem[];
  range: TrendRange;
  metrics: TrendMetrics;
  onMetricsChange: (v: TrendMetrics) => void;
}) {
  const theme = useChartTheme();
  const { ref, width } = useContainerWidth();

  const chartData = data.slice(-range).map((item) => ({
    label: formatTrendLabel(item.date, range),
    ventas: item.ventas,
    gastos: item.gastos,
  }));

  const tickGap = range <= 7 ? 0 : 55;
  const hasData = hasPositiveValues(chartData);

  const metricLabel =
    metrics === "both" ? "cobrado y gastos" : metrics === "sales" ? "cobrado" : "gastos";

  return (
    <div className={chartCardClass}>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-app-muted">
            Flujo de {range} días
          </p>
          <p className="mt-1 text-sm text-app-muted capitalize">{metricLabel}</p>
        </div>

        <div className="flex max-w-full flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-2">
          <MetricsSelector value={metrics} onChange={onMetricsChange} />
        </div>
      </div>

      <div ref={ref} className={`${chartFrameClass} h-70`}>
        {!hasData ? (
          <EmptyChartState message="No hay movimientos suficientes en este rango." />
        ) : width ? (
          <AreaChart width={width} height={280} data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.borderSoft} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: theme.textSoft, fontSize: 11 }}
              minTickGap={tickGap}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: theme.textSoft, fontSize: 12 }}
              tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
            />
            <Tooltip content={<CustomTooltip />} />
            {(metrics === "both" || metrics === "sales") && (
              <>
                <Legend wrapperStyle={{ color: theme.textMuted, fontSize: "12px" }} />
                <Area
                  type="monotone"
                  dataKey="ventas"
                  name="Cobrado"
                  stroke={theme.emeraldSoft}
                  fill={theme.emeraldSoft}
                  fillOpacity={0.14}
                  strokeWidth={3}
                  dot={{ r: 3, fill: theme.emeraldSoft, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: theme.emerald }}
                />
              </>
            )}
            {(metrics === "both" || metrics === "expenses") && (
              <>
                {metrics !== "both" && (
                  <Legend wrapperStyle={{ color: theme.textMuted, fontSize: "12px" }} />
                )}
                <Area
                  type="monotone"
                  dataKey="gastos"
                  name="Gastos"
                  stroke={theme.redSoft}
                  fill={theme.redSoft}
                  fillOpacity={0.1}
                  strokeWidth={3}
                  dot={{ r: 3, fill: theme.redSoft, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: theme.red }}
                />
              </>
            )}
          </AreaChart>
        ) : (
          <ChartSkeleton height={280} />
        )}
      </div>
    </div>
  );
}

function PaymentMethodsChart({ data }: { data: Array<{ name: string; value: number }> }) {
  const theme = useChartTheme();
  const { ref, width } = useContainerWidth();
  const hasData = hasPositiveValues(data);
  const colors = [theme.sky, theme.emerald, theme.slate, theme.emeraldSoft, theme.redSoft];

  return (
    <div className={chartCardClass}>
      <div>
        <p className="text-sm font-medium text-app-muted">Ingresos por método de pago</p>
        <p className="mt-1 text-sm text-app-muted">Dónde está entrando el dinero.</p>
      </div>

      <div ref={ref} className={`${chartFrameClass} h-64`}>
        {!hasData ? (
          <EmptyChartState message="No hay cobros con método de pago en este rango." />
        ) : width ? (
          <PieChart width={width} height={256}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={56}
              outerRadius={86}
              paddingAngle={3}
              stroke="none"
            >
              {data.map((_, index) => (
                <Cell
                  key={`payment-${index}`}
                  fill={colors[index % colors.length]}
                  fillOpacity={0.9}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: theme.textMuted, fontSize: "12px" }} />
          </PieChart>
        ) : (
          <ChartSkeleton height={256} />
        )}
      </div>
    </div>
  );
}

function TopProductsChart({ data }: { data: Array<{ name: string; value: number }> }) {
  const theme = useChartTheme();
  const { ref, width } = useContainerWidth();
  const hasData = hasPositiveValues(data);

  return (
    <div className={chartCardClass}>
      <div>
        <p className="text-sm font-medium text-app-muted">Productos más vendidos</p>
        <p className="mt-1 text-sm text-app-muted">Top por cantidad vendida.</p>
      </div>

      <div ref={ref} className={`${chartFrameClass} h-70`}>
        {!hasData ? (
          <EmptyChartState message="No hay ítems de venta en este rango." />
        ) : width ? (
          <BarChart
            width={width}
            height={280}
            data={data}
            layout="vertical"
            barSize={18}
            margin={{ left: 12, right: 12 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme.borderSoft} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tick={{ fill: theme.textSoft, fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={width < 380 ? 72 : 96}
              tickLine={false}
              axisLine={false}
              tick={{ fill: theme.textMuted, fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" name="Unidades" radius={[0, 12, 12, 0]} fill={theme.emerald} fillOpacity={0.86} />
          </BarChart>
        ) : (
          <ChartSkeleton height={280} />
        )}
      </div>
    </div>
  );
}

function ComparisonBarChart({
  data,
  metric,
  onMetricChange,
}: {
  data: MonthlyDataItem[];
  metric: CompareMetric;
  onMetricChange: (v: CompareMetric) => void;
}) {
  const theme = useChartTheme();
  const { ref, width } = useContainerWidth();

  const activeColor =
    metric === "sales" ? theme.emerald : metric === "expenses" ? theme.red : theme.sky;
  const metricLabel =
    metric === "sales" ? "Cobrado" : metric === "expenses" ? "Gastos" : "Balance";

  const chartData = data.map((item) => ({
    label: item.label,
    value: getMonthValue(item, metric),
    isCurrent: item.isCurrent,
  }));

  const currentItem = data.find((d) => d.isCurrent);
  const prevItem = data.filter((d) => !d.isCurrent).at(-1);
  const currentVal = currentItem ? getMonthValue(currentItem, metric) : 0;
  const prevVal = prevItem ? getMonthValue(prevItem, metric) : 0;
  const delta = prevVal !== 0 ? ((currentVal - prevVal) / Math.abs(prevVal)) * 100 : null;
  const deltaPositive = delta !== null && delta >= 0;

  return (
    <div className={chartCardClass}>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1">
          <div>
            <p className="text-sm font-medium text-app-muted">Comparativo mensual</p>
            <p className="mt-1 text-sm text-app-muted">Últimos 3 meses — {metricLabel.toLowerCase()}</p>
          </div>
          {delta !== null && (
            <span
              className={[
                "mt-1 shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                deltaPositive
                  ? "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                  : "bg-red-500/12 text-red-700 dark:bg-red-500/20 dark:text-red-300",
              ].join(" ")}
            >
              {deltaPositive ? "+" : ""}
              {delta.toFixed(1)}% vs mes ant.
            </span>
          )}
        </div>
          <div className="max-w-full">
            <CompareMetricSelector value={metric} onChange={onMetricChange} />
          </div>
      </div>

      <div ref={ref} className={`${chartFrameClass} h-70`}>
        {width ? (
          <BarChart width={width} height={280} data={chartData} barSize={42}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.borderSoft} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: theme.textSoft, fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: theme.textSoft, fontSize: 12 }}
              tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" name={metricLabel} radius={[14, 14, 8, 8]}>
              {chartData.map((item, index) => (
                <Cell
                  key={`month-${index}`}
                  fill={item.isCurrent ? activeColor : theme.slate}
                  fillOpacity={item.isCurrent ? 0.9 : 0.5}
                />
              ))}
            </Bar>
          </BarChart>
        ) : (
          <ChartSkeleton height={280} />
        )}
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
  chartSaleItems,
  today,
  monthStart,
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

  const hidden = prefsLoaded ? new Set(prefs.hiddenWidgets) : new Set<WidgetKey>();
  const visibleCount = VALID_WIDGET_KEYS.filter((k) => !hidden.has(k)).length;
  const activeRange = prefsLoaded ? prefs.rangeFilter : DEFAULT_PREFS.rangeFilter;
  const rangeMeta = getRangeMeta(activeRange, today, monthStart);
  const filteredSales = chartSales.filter(
    (sale) => sale.saleDate >= rangeMeta.start && sale.saleDate <= today
  );
  const filteredSaleIds = new Set(filteredSales.map((sale) => sale.id));
  const filteredItems = chartSaleItems.filter((item) => filteredSaleIds.has(item.saleId));

  const filteredTrendData = trendData.filter(
    (item) => item.date >= rangeMeta.start && item.date <= today
  );

  const paymentMethodData = Object.entries(
    filteredSales.reduce<Record<string, number>>((acc, sale) => {
      const label = formatPaymentMethodLabel(sale.paymentMethod);
      acc[label] = (acc[label] ?? 0) + Number(sale.amount ?? 0);
      return acc;
    }, {})
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const topProductsData = Object.entries(
    filteredItems.reduce<Record<string, number>>((acc, item) => {
      const name = item.description?.trim() || "Producto sin nombre";
      acc[name] = (acc[name] ?? 0) + Number(item.quantity ?? 0);
      return acc;
    }, {})
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-hidden">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-sm text-app-muted">
          Rango activo: <span className="font-semibold text-app">{rangeMeta.label}</span>
        </p>
        <RangeFilterSelector
          value={activeRange}
          onChange={(value) => updatePrefs({ rangeFilter: value })}
        />
      </div>

      <div className="grid min-w-0 max-w-full gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {!hidden.has("balance-pie") && (
        <PieBalanceChart
          balanceData={balanceData}
          balanceMonth={balanceMonth}
          salesMonth={salesMonth}
          expensesMonth={expensesMonth}
        />
      )}
      {!hidden.has("daily-bar") && (
        <DailyBarChart data={dailySalesComparison} />
      )}
      {!hidden.has("trend-line") && (
        <TrendLineChart
          data={filteredTrendData}
          range={rangeMeta.trendRange}
          metrics={prefsLoaded ? prefs.trendMetrics : DEFAULT_PREFS.trendMetrics}
          onMetricsChange={(v) => updatePrefs({ trendMetrics: v })}
        />
      )}
      {!hidden.has("payment-methods") && (
        <PaymentMethodsChart data={paymentMethodData} />
      )}
      {!hidden.has("top-products") && (
        <TopProductsChart data={topProductsData} />
      )}
      {!hidden.has("monthly-compare") && (
        <ComparisonBarChart
          data={monthlyData}
          metric={prefsLoaded ? prefs.compareMetric : DEFAULT_PREFS.compareMetric}
          onMetricChange={(v) => updatePrefs({ compareMetric: v })}
        />
      )}
      {prefsLoaded && visibleCount === 0 && (
        <div className="flex min-w-0 flex-col items-center justify-center rounded-[24px] border border-dashed border-app bg-app-soft py-12 text-center xl:col-span-2">
          <p className="text-sm font-medium text-app-muted">No hay widgets visibles.</p>
          <p className="mt-1 text-xs text-app-soft">
            Actívalos desde Mi negocio → General → Dashboard.
          </p>
        </div>
      )}
      </div>
    </div>
  );
}
