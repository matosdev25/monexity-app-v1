import Link from "next/link";

// Piezas compartidas del admin global (server components, sin estado).

export const ADMIN_PAGE_SIZE = 25;

export const adminMotion =
  "transition-[background-color,border-color,color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none";

export const adminInputClass =
  "w-full min-w-0 rounded-[18px] border border-app bg-app-soft px-4 py-3 text-sm text-app outline-none transition-[background-color,border-color,box-shadow] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] placeholder:text-app-soft focus:border-app-strong focus:bg-white focus-visible:ring-2 focus-visible:ring-sky-400/30 motion-reduce:transition-none dark:focus:bg-white/[0.08]";

export const adminPrimaryButtonClass = `rounded-[18px] bg-slate-950 px-5 py-3 text-sm font-semibold text-white ${adminMotion} hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200`;

export const adminSecondaryButtonClass = `rounded-[18px] border border-app bg-app-soft px-4 py-2.5 text-sm font-semibold text-app-muted ${adminMotion} hover:border-app-strong hover:bg-white hover:text-app active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 dark:hover:bg-white/[0.08]`;

// Página 1-based desde searchParams (valores inválidos → 1)
export function parsePage(value: string | undefined) {
  const page = Number.parseInt(value ?? "", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

// Texto seguro para filtros PostgREST (.or / ilike): sin comodines ni separadores
export function sanitizeSearch(value: string | undefined) {
  return (value ?? "").replace(/[%,()*\\"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function AdminEmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-app p-8 text-center">
      <p className="text-sm font-semibold text-app">{title}</p>
      {description ? <p className="mt-1 text-sm text-app-muted">{description}</p> : null}
    </div>
  );
}

export function AdminErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-[24px] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300"
    >
      <p className="font-semibold">No se pudieron cargar los datos</p>
      <p className="mt-1 leading-6">{message}</p>
    </div>
  );
}

export function AdminPagination({
  basePath,
  params,
  page,
  total,
  pageSize = ADMIN_PAGE_SIZE,
}: {
  basePath: string;
  params: Record<string, string>;
  page: number;
  total: number;
  pageSize?: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const hrefFor = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
    if (target > 1) search.set("page", String(target));
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  const linkClass = `${adminSecondaryButtonClass} inline-flex items-center justify-center`;
  const disabledClass =
    "inline-flex items-center justify-center rounded-[18px] border border-app px-4 py-2.5 text-sm font-semibold text-app-soft opacity-50";

  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={linkClass}>
          Anterior
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClass}>Anterior</span>
      )}
      <p className="text-xs text-app-muted">
        Página {Math.min(page, totalPages)} de {totalPages}
      </p>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={linkClass}>
          Siguiente
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClass}>Siguiente</span>
      )}
    </nav>
  );
}
