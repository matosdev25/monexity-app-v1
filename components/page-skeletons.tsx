import type { ReactNode } from "react";

// Bloque base: mismo estilo que el skeleton existente de los gráficos del dashboard.
// La animación se anula con prefers-reduced-motion (regla global en globals.css).
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xl bg-slate-200/60 dark:bg-slate-800/60 ${className}`}
    />
  );
}

// Anuncio accesible sin envolver el layout (no altera alturas ni grids)
function SkeletonRegion({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <span role="status" aria-live="polite" className="sr-only">
        {label}
      </span>
      {children}
    </>
  );
}

// ─── Clases copiadas de las páginas reales para que el layout no salte ───────
const moduleShellClass = "min-h-full px-2 py-2 text-app sm:px-3 sm:py-3";
const moduleStatCardClass =
  "rounded-[20px] border border-slate-200 bg-white px-5 py-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)] dark:border-slate-700 dark:bg-slate-950/70 dark:shadow-none";

function HeroTextSkeleton() {
  return (
    <div className="max-w-2xl flex-1">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-2 h-8 w-full max-w-md md:h-9" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      <Skeleton className="mt-2 h-4 w-2/3 max-w-sm" />
    </div>
  );
}

function ModuleStatCardSkeleton({ withSubtitle = true }: { withSubtitle?: boolean }) {
  return (
    <div className={moduleStatCardClass}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-32" />
      {withSubtitle ? <Skeleton className="mt-2 h-4 w-40 max-w-full" /> : null}
    </div>
  );
}

function FormPanelSkeleton({ fields }: { fields: number }) {
  return (
    <div className="app-card self-start rounded-[24px] p-4">
      <Skeleton className="h-6 w-36" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-2xl" />
          </div>
        ))}
        <Skeleton className="mt-2 h-11 w-full rounded-2xl" />
      </div>
    </div>
  );
}

function ActivityPanelSkeleton({ rows = 5, withTabs = false }: { rows?: number; withTabs?: boolean }) {
  return (
    <div className="app-card flex min-h-[320px] flex-col overflow-hidden rounded-[24px] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-8 w-28" />
          <Skeleton className="mt-2 h-4 w-48 max-w-full" />
        </div>
        <Skeleton className="h-9 w-24 shrink-0 rounded-2xl" />
      </div>
      {withTabs ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-7 w-20" />
        </div>
      ) : null}
      <div className="mt-3 grid gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] w-full rounded-[20px]" />
        ))}
      </div>
    </div>
  );
}

// ─── Ventas: hero + 3 métricas + formulario | actividad ──────────────────────
export function SalesPageSkeleton() {
  return (
    <SkeletonRegion label="Cargando ventas">
      <main className={moduleShellClass} aria-busy="true">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">
          <section className="app-card rounded-[24px] px-5 py-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <HeroTextSkeleton />
              <div className="grid min-w-[220px] gap-3 sm:grid-cols-3 xl:w-[780px]">
                <ModuleStatCardSkeleton />
                <ModuleStatCardSkeleton />
                <ModuleStatCardSkeleton />
              </div>
            </div>
          </section>
          <section className="grid gap-3 xl:grid-cols-[440px_minmax(0,1fr)] xl:items-start">
            <FormPanelSkeleton fields={7} />
            <ActivityPanelSkeleton withTabs />
          </section>
        </div>
      </main>
    </SkeletonRegion>
  );
}

// ─── Gastos: hero + 1 métrica + formulario | actividad ───────────────────────
export function ExpensesPageSkeleton() {
  return (
    <SkeletonRegion label="Cargando gastos">
      <div className={moduleShellClass} aria-busy="true">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">
          <section className="app-card rounded-[24px] px-5 py-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <HeroTextSkeleton />
              <div className="xl:w-[260px]">
                <ModuleStatCardSkeleton />
              </div>
            </div>
          </section>
          <section className="grid gap-3 xl:grid-cols-[440px_minmax(0,1fr)] xl:items-start">
            <FormPanelSkeleton fields={6} />
            <ActivityPanelSkeleton />
          </section>
        </div>
      </div>
    </SkeletonRegion>
  );
}

// ─── Cotizaciones: hero (CTA + 3 métricas) + listado ─────────────────────────
export function QuotationsPageSkeleton() {
  return (
    <SkeletonRegion label="Cargando cotizaciones">
      <main className={moduleShellClass} aria-busy="true">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
          <section className="app-card rounded-[28px] px-5 py-5 sm:px-6">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,560px)] xl:items-center">
              <div className="max-w-2xl">
                <HeroTextSkeleton />
                <Skeleton className="mt-4 h-11 w-full rounded-2xl sm:hidden" />
              </div>
              <div className="grid gap-3">
                <div className="hidden justify-end sm:flex">
                  <Skeleton className="h-11 w-44 rounded-2xl" />
                </div>
                <div className="grid min-w-[220px] gap-3 sm:grid-cols-3">
                  <ModuleStatCardSkeleton />
                  <ModuleStatCardSkeleton withSubtitle={false} />
                  <ModuleStatCardSkeleton withSubtitle={false} />
                </div>
              </div>
            </div>
          </section>
          <section>
            <div className="app-card flex min-h-[320px] flex-col overflow-hidden rounded-[28px] p-4 sm:p-5">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-2 h-8 w-32" />
                  <Skeleton className="mt-2 h-4 w-full max-w-md" />
                </div>
                <Skeleton className="h-9 w-28 shrink-0 rounded-2xl" />
              </div>
              {/* Filtros de estado (mismo contenedor que la página) */}
              <div className="mt-4 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-1 dark:border-slate-800 dark:bg-slate-950/60">
                {["w-14", "w-16", "w-20", "w-24"].map((w) => (
                  <Skeleton key={w} className={`h-7 ${w}`} />
                ))}
              </div>
              <div className="mt-4 flex-1 pr-1">
                <div className="grid gap-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:border-slate-700 dark:bg-slate-950/70 dark:shadow-none"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Skeleton className="h-3 w-24" />
                          <Skeleton className="mt-2 h-6 w-28" />
                          <Skeleton className="mt-1.5 h-4 w-36" />
                        </div>
                        <Skeleton className="h-6 w-20 rounded-full" />
                      </div>
                      <Skeleton className="mt-2 h-3 w-56 max-w-full" />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Skeleton className="h-9 w-24 rounded-2xl" />
                        <Skeleton className="h-9 w-20 rounded-2xl" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </SkeletonRegion>
  );
}

// ─── Inventario: encabezado + 3 métricas + catálogo ──────────────────────────
export function InventoryPageSkeleton() {
  return (
    <SkeletonRegion label="Cargando inventario">
      <div className="h-full overflow-y-auto" aria-busy="true">
        <div className="mx-auto w-full max-w-4xl">
          <div className="mb-6">
            <Skeleton className="h-7 w-28 rounded-full" />
            <Skeleton className="mt-4 h-8 w-40 sm:h-9" />
            <Skeleton className="mt-2 h-4 w-72 max-w-full" />
          </div>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-[20px] border border-app bg-app-soft px-4 py-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2 h-8 w-12" />
              </div>
            ))}
          </div>
          <div className="rounded-[28px] border border-app bg-app-soft p-4 sm:p-5">
            <div className="mb-4">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="mt-1.5 h-4 w-44" />
            </div>
            <div className="grid gap-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-[20px]" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </SkeletonRegion>
  );
}

// ─── Equipo: miembros (grid 2 col) + invitaciones activas ────────────────────
function TeamTabSkeleton() {
  const cardClass = "app-card rounded-[24px] p-4";
  return (
    <div className="flex flex-col gap-6 pb-6">
      <section>
        <Skeleton className="h-3 w-20" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${cardClass} flex flex-col gap-3`}>
              <div className="min-w-0">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="mt-1.5 h-3 w-48 max-w-full" />
                <Skeleton className="mt-2 h-5 w-24 rounded-full" />
              </div>
              <div className="flex items-center gap-2 border-t border-app pt-3">
                <Skeleton className="h-7 flex-1" />
                <Skeleton className="h-7 flex-1" />
              </div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <Skeleton className="h-3 w-36" />
        <div className={`${cardClass} mt-3 flex flex-col gap-3`}>
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="mb-1.5 h-3 w-28" />
                <Skeleton className="h-9 w-full rounded-[14px]" />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-9 w-36 rounded-[14px]" />
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className={`${cardClass} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-7 w-28" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-40" />
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-7 w-20" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Mi negocio / Equipo: encabezado + tabs + contenido del tab ──────────────
export function BusinessPageSkeleton({ tab = "general" }: { tab?: "general" | "equipo" }) {
  return (
    <SkeletonRegion label={tab === "equipo" ? "Cargando equipo" : "Cargando configuración del negocio"}>
      <div className="h-full overflow-x-hidden overflow-y-auto" aria-busy="true">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-5">
            <Skeleton className="h-7 w-52 rounded-full" />
            <Skeleton className="mt-4 h-9 w-48 sm:h-10" />
            <Skeleton className="mt-2 h-4 w-80 max-w-full" />
          </div>
          <div className="mb-3 flex w-fit max-w-full items-center gap-1 rounded-xl border border-app bg-app-soft p-1 sm:mb-5 sm:rounded-[22px]">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-lg sm:rounded-[18px]" />
            ))}
          </div>
          {tab === "equipo" ? (
            <TeamTabSkeleton />
          ) : (
            <div className="flex flex-col gap-6 pb-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="app-card rounded-[24px] p-4">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="mt-2 h-3 w-48 max-w-full" />
                    <Skeleton className="mt-4 h-8 w-full rounded-xl" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </SkeletonRegion>
  );
}

// ─── Insights del dashboard: replica DashboardInsightsCharts (6 cards) ───────
// Mismas clases y alturas de frame que dashboard-insights-charts.tsx.
const chartCardClass = "app-card w-full min-w-0 max-w-full overflow-hidden rounded-[24px] p-4";
const chartFrameClass = "mt-4 min-w-0 max-w-full overflow-hidden";

function ChartHeaderSkeleton({ withSelector = false }: { withSelector?: boolean }) {
  return (
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-1 h-5 w-52 max-w-full" />
      </div>
      {withSelector ? <Skeleton className="h-8 w-36 rounded-full" /> : null}
    </div>
  );
}

export function InsightsChartsSkeleton() {
  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-hidden" aria-hidden="true">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-9 w-48 rounded-full" />
      </div>

      <div className="grid min-w-0 max-w-full gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Balance general del mes (pie 240px + resumen) */}
        <div className={chartCardClass}>
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-1 h-8 w-32" />
          <div className={`${chartFrameClass} h-60`}>
            <Skeleton className="h-full rounded-2xl" />
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="min-w-0 rounded-[18px] bg-app-soft px-3 py-2">
                <Skeleton className="h-4 w-14" />
                <Skeleton className="mt-1 h-5 w-20" />
              </div>
            ))}
          </div>
        </div>

        {/* Cobrado hoy vs ayer (280px) */}
        <div className={chartCardClass}>
          <ChartHeaderSkeleton />
          <div className={`${chartFrameClass} h-70`}>
            <Skeleton className="h-full rounded-2xl" />
          </div>
        </div>

        {/* Flujo de N días (selector + 280px) */}
        <div className={chartCardClass}>
          <ChartHeaderSkeleton withSelector />
          <div className={`${chartFrameClass} h-70`}>
            <Skeleton className="h-full rounded-2xl" />
          </div>
        </div>

        {/* Ingresos por método de pago (256px) */}
        <div className={chartCardClass}>
          <ChartHeaderSkeleton />
          <div className={`${chartFrameClass} h-64`}>
            <Skeleton className="h-full rounded-2xl" />
          </div>
        </div>

        {/* Productos más vendidos (280px) */}
        <div className={chartCardClass}>
          <ChartHeaderSkeleton />
          <div className={`${chartFrameClass} h-70`}>
            <Skeleton className="h-full rounded-2xl" />
          </div>
        </div>

        {/* Comparativo mensual (selector + 280px) */}
        <div className={chartCardClass}>
          <ChartHeaderSkeleton withSelector />
          <div className={`${chartFrameClass} h-70`}>
            <Skeleton className="h-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard principal: header + resumen | actividad + shortcuts + gráficos ─
export function DashboardPageSkeleton() {
  const mainCard = "app-panel min-w-0 max-w-full rounded-[30px] p-5";
  return (
    <SkeletonRegion label="Cargando dashboard">
      <div className="flex min-h-full w-full min-w-0 max-w-full flex-col gap-4 overflow-x-hidden pr-1 text-app" aria-busy="true">
        <header className="min-w-0 shrink-0">
          <div className="flex min-w-0 items-start justify-between gap-4 sm:gap-6">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-8 w-full max-w-lg sm:h-9 md:h-10" />
              <Skeleton className="mt-3 h-4 w-full max-w-md" />
            </div>
            <Skeleton className="h-16 w-16 shrink-0 rounded-[22px] sm:h-20 sm:w-20" />
          </div>
        </header>

        <section className="grid min-w-0 max-w-full gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.95fr)]">
          <div className={mainCard}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-64 max-w-full" />
            <Skeleton className="mt-3 h-4 w-48" />
            <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="app-card min-w-0 max-w-full rounded-[24px] p-4">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-3 h-8 w-32" />
                  <Skeleton className="mt-2 h-3 w-36 max-w-full" />
                </div>
              ))}
            </div>
          </div>

          <div className={`${mainCard} xl:row-span-2`}>
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-3 h-7 w-56 max-w-full" />
            <Skeleton className="mt-3 h-4 w-full max-w-xs" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[68px] w-full rounded-[24px]" />
              ))}
            </div>
          </div>

          <div className={mainCard}>
            <Skeleton className="h-7 w-32" />
            <div className="mt-3 grid min-w-0 gap-2.5 sm:grid-cols-2">
              <Skeleton className="h-[72px] w-full rounded-[20px]" />
              <Skeleton className="h-[72px] w-full rounded-[20px]" />
            </div>
            <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
              <Skeleton className="h-11 w-full rounded-2xl" />
              <Skeleton className="h-11 w-full rounded-2xl" />
            </div>
          </div>

          <div className="min-w-0 max-w-full xl:col-span-2">
            <div className={mainCard}>
              <div className="mb-4">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="mt-3 h-7 w-56 max-w-full" />
                <Skeleton className="mt-3 h-4 w-full max-w-md" />
              </div>
              <InsightsChartsSkeleton />
            </div>
          </div>
        </section>
      </div>
    </SkeletonRegion>
  );
}
