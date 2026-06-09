"use client";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="app-card max-w-md rounded-[24px] p-5 text-center">
        <h2 className="text-lg font-semibold text-app">
          No pudimos cargar el dashboard
        </h2>
        <p className="mt-2 text-sm leading-6 text-app-muted">
          Ocurrió un problema temporal. Intenta cargar esta sección nuevamente.
        </p>
        <button
          type="button"
          onClick={reset}
          className="app-button-primary mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-[0.98] motion-reduce:transition-none"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
