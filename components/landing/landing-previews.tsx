import Image from "next/image";

// Previews estáticas de la homepage pública. Replican la UI real del producto
// (mismos títulos, secciones y flujos del dashboard) con datos de ejemplo.
// No importan componentes del dashboard ni consultan datos: son solo visuales.

type PreviewProps = { className?: string };

// Logo oficial (PROJECT.md: no recrearlo)
function MarkLogo({ size = 24 }: { size?: number }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <Image src="/logo/monexity-mark-light.svg" alt="" fill sizes={`${size}px`} className="object-contain dark:hidden" />
      <Image src="/logo/monexity-mark-dark.svg" alt="" fill sizes={`${size}px`} className="hidden object-contain dark:block" />
    </span>
  );
}

const card = "rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900";
const label = "text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700/80 dark:text-sky-300/80";

function Chip({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "blue" | "amber" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    blue: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200",
  };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tones[tone]}`}>{children}</span>;
}

// Marco de navegador neutro para las vistas de escritorio
export function BrowserFrame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_30px_80px_-20px_rgba(15,23,42,0.25)] dark:border-slate-800 dark:bg-slate-950 ${className}`}>
      <div className="flex items-center gap-2 border-b border-slate-200/70 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        <span className="mx-auto hidden rounded-full bg-white px-4 py-1 text-[11px] text-slate-400 ring-1 ring-slate-200/70 sm:block dark:bg-slate-950 dark:ring-slate-800">
          monexity-app.com/dashboard
        </span>
      </div>
      {children}
    </div>
  );
}

const SIDEBAR_ITEMS = ["Dashboard", "Ventas", "Cotizaciones", "Inventario", "Gastos", "Cierre del período", "Mi negocio"];

function StatCard({ title, value, tone = "default" }: { title: string; value: string; tone?: "default" | "positive" }) {
  return (
    <div className={`${card} p-3`}>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{title}</p>
      <p className={`mt-1 text-base font-semibold tracking-tight sm:text-lg ${tone === "positive" ? "text-emerald-600 dark:text-emerald-300" : "text-slate-900 dark:text-white"}`}>
        {value}
      </p>
    </div>
  );
}

const MOVEMENTS = [
  { title: "Corte + barba", meta: "Venta · Efectivo", amount: "+$18.00", tone: "text-emerald-600 dark:text-emerald-300" },
  { title: "Cuota 2 de 4", meta: "Pago · Yappy", amount: "+$25.00", tone: "text-emerald-600 dark:text-emerald-300" },
  { title: "Compra de insumos", meta: "Gasto · Tarjeta", amount: "−$42.50", tone: "text-rose-600 dark:text-rose-300" },
  { title: "Kit de cuidado", meta: "Venta · Yappy", amount: "+$35.00", tone: "text-emerald-600 dark:text-emerald-300" },
];

// Vista principal: dashboard real (sidebar, resumen, últimos movimientos, balance)
export function DashboardPreview({ className = "" }: PreviewProps) {
  return (
    <div className={`grid bg-slate-50/60 dark:bg-slate-950 md:grid-cols-[180px_1fr] ${className}`}>
      <aside className="hidden flex-col gap-1 border-r border-slate-200/70 p-4 md:flex dark:border-slate-800">
        <div className="mb-3 flex items-center gap-2">
          <MarkLogo />
          <span className="text-sm font-semibold text-slate-900 dark:text-white">Monexity</span>
        </div>
        {SIDEBAR_ITEMS.map((item, index) => (
          <span
            key={item}
            className={`rounded-xl px-3 py-2 text-xs font-medium ${index === 0 ? "bg-slate-900 text-white dark:bg-white/10" : "text-slate-500 dark:text-slate-400"}`}
          >
            {item}
          </span>
        ))}
      </aside>

      <div className="min-w-0 space-y-3 p-4 sm:p-5">
        <div>
          <p className={label}>Panel privado</p>
          <p className="mt-1 text-lg font-bold tracking-tight text-slate-900 sm:text-xl dark:text-white">Dashboard de Barbería Central</p>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
          <div className={`${card} p-4`}>
            <p className={label}>Vista general</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">Resumen de hoy y del mes</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <StatCard title="Cobrado hoy" value="$186.00" />
              <StatCard title="Gastos de hoy" value="$42.50" />
              <StatCard title="Balance de hoy" value="$143.50" tone="positive" />
              <StatCard title="Balance del mes" value="$1,870.00" tone="positive" />
            </div>
          </div>

          <div className={`${card} p-4`}>
            <p className={label}>Actividad reciente</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">Últimos movimientos</p>
            <ul className="mt-3 space-y-2">
              {MOVEMENTS.map((item) => (
                <li key={item.title} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-900 dark:text-white">{item.title}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{item.meta}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-semibold ${item.tone}`}>{item.amount}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={`${card} hidden p-4 sm:block`}>
          <p className={label}>Insights visuales</p>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">Balance y rendimiento</p>
          <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-6">
            <BalanceDonut />
            <MonthlyBars />
          </div>
        </div>
      </div>
    </div>
  );
}

// "Balance general del mes" (cobrado vs gastos)
function BalanceDonut() {
  return (
    <div className="flex items-center gap-4">
      <div
        className="relative h-20 w-20 shrink-0 rounded-full"
        style={{ background: "conic-gradient(rgb(2 132 199) 0 66%, rgb(251 113 133) 66% 100%)" }}
      >
        <div className="absolute inset-[9px] rounded-full bg-white dark:bg-slate-900" />
      </div>
      <div className="space-y-1 text-[11px]">
        <p className="font-medium text-slate-500 dark:text-slate-400">Balance general del mes</p>
        <p className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300"><span className="h-2 w-2 rounded-full bg-sky-600" />Cobrado $2,840.00</p>
        <p className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300"><span className="h-2 w-2 rounded-full bg-rose-400" />Gastos $970.00</p>
      </div>
    </div>
  );
}

// "Comparativo mensual" (ventas vs gastos, 3 meses)
function MonthlyBars() {
  const months = [
    { m: "Abr", v: 58, g: 30 },
    { m: "May", v: 72, g: 34 },
    { m: "Jun", v: 90, g: 32 },
  ];
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Comparativo mensual</p>
      <div className="mt-2 flex h-20 items-end gap-4">
        {months.map((month) => (
          <div key={month.m} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-16 w-full items-end justify-center gap-1">
              <span className="w-3 rounded-t-md bg-sky-600" style={{ height: `${month.v}%` }} />
              <span className="w-3 rounded-t-md bg-rose-300" style={{ height: `${month.g}%` }} />
            </div>
            <span className="text-[10px] text-slate-400">{month.m}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Flujo de ventas: registrar venta con tipo de pago y plan de cuotas
export function SalesPreview({ className = "" }: PreviewProps) {
  const installments = [
    { n: 1, date: "1 jun", amount: "$25.00", status: "Pagada", tone: "green" as const },
    { n: 2, date: "1 jul", amount: "$25.00", status: "Pagada", tone: "green" as const },
    { n: 3, date: "1 ago", amount: "$25.00", status: "Pendiente", tone: "amber" as const },
    { n: 4, date: "1 sep", amount: "$25.00", status: "Pendiente", tone: "amber" as const },
  ];
  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${className}`}>
      <div className={`${card} p-4`}>
        <p className={label}>Registro rápido</p>
        <p className="mt-1 text-base font-semibold text-slate-900 dark:text-white">Nueva venta</p>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-white/5">
            <span className="text-slate-700 dark:text-slate-300">Silla de barbero × 1</span>
            <span className="font-semibold text-slate-900 dark:text-white">$120.00</span>
          </div>
          {/* Selector real "Tipo de pago": Completo / Cuotas */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400">Tipo de pago</span>
            <span className="font-semibold text-slate-900 dark:text-white">Cuotas ▾</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip tone="blue">Efectivo</Chip>
            <Chip>Yappy</Chip>
            <Chip>Tarjeta</Chip>
            <Chip>Transferencia</Chip>
          </div>
          <div className="rounded-xl bg-sky-600 px-3 py-2 text-center text-xs font-semibold text-white">Registrar venta</div>
        </div>
      </div>

      <div className={`${card} p-4`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className={label}>Cuotas</p>
            <p className="mt-1 text-base font-semibold text-slate-900 dark:text-white">Plan de cuotas</p>
          </div>
          <Chip tone="blue">Mensual</Chip>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Abono inicial $20.00 · Saldo $50.00</p>
        <ul className="mt-3 space-y-1.5">
          {installments.map((item) => (
            <li key={item.n} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-white/5">
              <span className="text-slate-700 dark:text-slate-300">Cuota {item.n} · {item.date}</span>
              <span className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 dark:text-white">{item.amount}</span>
                <Chip tone={item.tone}>{item.status}</Chip>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Controla: balance, métodos de pago y productos más vendidos
export function InsightsPreview({ className = "" }: PreviewProps) {
  const methods = [
    { name: "Efectivo", pct: 46 },
    { name: "Yappy", pct: 38 },
    { name: "Tarjeta", pct: 16 },
  ];
  const products = [
    { name: "Corte clásico", qty: 64 },
    { name: "Barba", qty: 41 },
    { name: "Kit de cuidado", qty: 18 },
  ];
  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${className}`}>
      <div className={`${card} p-4 sm:col-span-2`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <BalanceDonut />
          <MonthlyBars />
        </div>
      </div>
      <div className={`${card} p-4`}>
        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Ingresos por método de pago</p>
        <ul className="mt-3 space-y-2.5">
          {methods.map((item) => (
            <li key={item.name}>
              <div className="flex justify-between text-xs text-slate-700 dark:text-slate-300">
                <span>{item.name}</span>
                <span className="font-semibold">{item.pct}%</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-white/10">
                <div className="mx-grow-x h-1.5 rounded-full bg-sky-600" style={{ width: `${item.pct}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className={`${card} p-4`}>
        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Productos más vendidos</p>
        <ol className="mt-3 space-y-2">
          {products.map((item, index) => (
            <li key={item.name} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  {index + 1}
                </span>
                {item.name}
              </span>
              <span className="font-semibold text-slate-900 dark:text-white">{item.qty} u.</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center text-slate-300 dark:text-slate-600" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 rotate-90 md:rotate-0">
        <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// Organiza: cotización → venta → comprobante PDF
export function QuoteFlowPreview({ className = "" }: PreviewProps) {
  return (
    <div className={`grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] ${className}`}>
      <div className={`${card} p-4`}>
        <div className="flex items-center justify-between">
          <p className={label}>Cotización</p>
          <Chip tone="blue">Aceptada</Chip>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">COT-0012</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">Estudio Luna · válida 15 días</p>
        <div className="mt-3 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
          <p className="flex justify-between"><span>Diseño de logo</span><span>$150.00</span></p>
          <p className="flex justify-between"><span>Manual de marca</span><span>$90.00</span></p>
        </div>
        <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-center text-[11px] font-semibold text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300">
          Convertir a venta
        </div>
      </div>
      <FlowArrow />
      <div className={`${card} p-4`}>
        <div className="flex items-center justify-between">
          <p className={label}>Venta</p>
          <Chip tone="green">Pagada</Chip>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">FAC-0045</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">Estudio Luna · Transferencia</p>
        <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">$240.00</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">Ítems y cliente copiados de la cotización</p>
      </div>
      <FlowArrow />
      <div className={`${card} p-4`}>
        <p className={label}>Comprobante PDF</p>
        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-white/5">
          <div className="flex items-center justify-between">
            <span className="h-4 w-12 rounded bg-slate-300 dark:bg-slate-600" />
            <span className="text-[10px] font-semibold text-slate-500">FAC-0045</span>
          </div>
          <div className="mt-3 space-y-1.5">
            <span className="block h-1.5 w-full rounded bg-slate-200 dark:bg-slate-700" />
            <span className="block h-1.5 w-4/5 rounded bg-slate-200 dark:bg-slate-700" />
            <span className="block h-1.5 w-3/5 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
          <p className="mt-3 text-right text-xs font-bold text-slate-900 dark:text-white">Total $240.00</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1.5 text-center text-[11px] font-semibold">
          <span className="rounded-xl bg-slate-900 px-2 py-1.5 text-white dark:bg-white dark:text-slate-900">Descargar PDF</span>
          <span className="rounded-xl bg-emerald-500 px-2 py-1.5 text-white">WhatsApp</span>
        </div>
      </div>
    </div>
  );
}

// Mini previews de las tarjetas de funciones
export type MiniPreviewKind = "sale" | "quote" | "inventory" | "month";

export function MiniPreview({ kind }: { kind: MiniPreviewKind }) {
  const base = "rounded-2xl border border-slate-200/70 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950";
  switch (kind) {
    case "sale":
      return (
        <div className={base}>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-300">Corte + barba</span>
            <span className="font-semibold text-slate-900 dark:text-white">$18.00</span>
          </div>
          <div className="mt-2 rounded-lg bg-sky-600 py-1.5 text-center text-[11px] font-semibold text-white">Registrar venta</div>
        </div>
      );
    case "quote":
      return (
        <div className={base}>
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-900 dark:text-white">COT-0012</span>
            <Chip tone="blue">Enviada</Chip>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">2 ítems · válida 15 días</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white">$240.00</p>
        </div>
      );
    case "inventory":
      return (
        <div className={`${base} space-y-1.5`}>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-300">Cera para cabello</span>
            <span className="font-semibold text-slate-900 dark:text-white">24 u.</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-300">Aceite de barba</span>
            <Chip tone="amber">Stock bajo</Chip>
          </div>
        </div>
      );
    case "month":
      return (
        <div className={base}>
          <p className="text-[11px] text-slate-500">Balance del mes</p>
          <p className="text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-300">$1,870.00</p>
          <div className="mt-1 flex h-8 items-end gap-1">
            {[40, 55, 35, 70, 60, 85, 75].map((h, i) => (
              <span key={i} className="mx-grow-y flex-1 rounded-t bg-sky-600/80" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      );
  }
}

// Composición móvil: el dashboard real en el celular
export function PhonePreview({ className = "" }: PreviewProps) {
  return (
    <div className={`mx-auto w-[260px] rounded-[44px] border border-slate-200 bg-slate-900 p-2.5 shadow-[0_40px_90px_-25px_rgba(15,23,42,0.45)] dark:border-slate-700 ${className}`}>
      <div className="overflow-hidden rounded-[36px] bg-slate-50 dark:bg-slate-950">
        <div className="flex justify-center pt-2.5">
          <span className="h-5 w-24 rounded-full bg-slate-900" />
        </div>
        <div className="space-y-2.5 p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <MarkLogo size={20} />
              <span className="text-xs font-semibold text-slate-900 dark:text-white">Monexity</span>
            </div>
            <span className="h-7 w-7 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" />
          </div>
          <p className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">Dashboard de Barbería Central</p>
          <div className="grid grid-cols-2 gap-2">
            <StatCard title="Cobrado hoy" value="$186.00" />
            <StatCard title="Balance del mes" value="$1,870" tone="positive" />
          </div>
          <div className="grid grid-cols-2 gap-2 text-center text-[11px] font-semibold">
            <span className="rounded-xl bg-sky-600 px-2 py-2 text-white">Nueva venta</span>
            <span className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Nuevo gasto</span>
          </div>
          <div className={`${card} p-3`}>
            <p className="text-[11px] font-semibold text-slate-900 dark:text-white">Últimos movimientos</p>
            <ul className="mt-2 space-y-1.5">
              {MOVEMENTS.slice(0, 3).map((item) => (
                <li key={item.title} className="flex justify-between gap-2 text-[11px]">
                  <span className="truncate text-slate-600 dark:text-slate-300">{item.title}</span>
                  <span className={`shrink-0 font-semibold ${item.tone}`}>{item.amount}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
