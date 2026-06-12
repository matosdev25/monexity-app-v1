import { createAdminClient } from "@/lib/supabase/admin";
import { requireGlobalAdmin } from "@/lib/admin-auth";
import { formatShortDate } from "@/lib/date-format";
import { formatCurrency } from "@/lib/currency-format";
import { toggleDiscountCode } from "../actions";
import { DiscountCodeForm } from "./discount-code-form";
import { DeleteDiscountCodeButton } from "./delete-discount-code-button";

export const metadata = { title: "Admin — Códigos de descuento" };
export const dynamic = "force-dynamic";

type DiscountCode = {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number | string;
  applies_to: string;
  starts_at: string | null;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  created_at: string;
};

function formatDate(value: string | null) {
  return formatShortDate(value);
}

function formatPercentage(value: number | string) {
  return `${Number(value).toFixed(2).replace(/\.?0+$/, "")}%`;
}

function formatDiscount(code: DiscountCode) {
  return code.discount_type === "percentage"
    ? formatPercentage(code.discount_value)
    : formatCurrency(code.discount_value);
}

function appliesLabel(value: string) {
  if (value === "monthly") return "Mensual";
  if (value === "yearly") return "Anual";
  return "Ambos";
}

export default async function AdminDiscountCodesPage() {
  await requireGlobalAdmin();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("discount_codes")
    .select("id, code, description, discount_type, discount_value, applies_to, starts_at, expires_at, max_uses, used_count, is_active, created_at")
    .order("created_at", { ascending: false });

  const codes = (data ?? []) as DiscountCode[];
  const isMissingTable = error?.code === "PGRST205" || error?.code === "42P01";

  return (
    <div className="space-y-5">
      <DiscountCodeForm />

      {isMissingTable && (
        <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-sm dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
          <p className="font-semibold">Base de datos pendiente</p>
          <p className="mt-1 leading-6">
            La tabla <span className="font-mono">discount_codes</span> no existe todavía en Supabase.
            Ejecuta el SQL de códigos de descuento antes de crear promociones.
          </p>
        </section>
      )}

      <section className="app-card overflow-hidden rounded-[28px]">
        <div className="border-b border-app px-4 py-3 text-sm font-semibold text-app">
          {codes.length} código(s)
        </div>

        <div className="divide-y divide-[var(--border-soft)]">
          {codes.map((code) => (
            <div key={code.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1.1fr_0.8fr_1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-sm font-semibold tracking-[0.12em] text-app">{code.code}</p>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${code.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300"}`}>
                    {code.is_active ? "Activo" : "Inactivo"}
                  </span>
                </div>
                {code.description && (
                  <p className="mt-1 text-sm text-app-muted">{code.description}</p>
                )}
              </div>

              <div className="text-sm">
                <p className="text-app-muted">Descuento</p>
                <p className="font-medium text-app">{formatDiscount(code)} · {appliesLabel(code.applies_to)}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-app-muted">
                <p>Vigencia<br /><span className="font-medium text-app">{formatDate(code.starts_at)} — {formatDate(code.expires_at)}</span></p>
                <p>Usos<br /><span className="font-medium text-app">{code.used_count}{code.max_uses !== null ? ` / ${code.max_uses}` : ""}</span></p>
              </div>

              <div className="grid gap-2">
                <form action={toggleDiscountCode}>
                  <input type="hidden" name="id" value={code.id} />
                  <input type="hidden" name="isActive" value={String(code.is_active)} />
                  <button
                    type="submit"
                    className="w-full rounded-[18px] border border-app bg-app-soft px-4 py-2.5 text-sm font-semibold text-app-muted transition-[background-color,border-color,color,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-app-strong hover:bg-white hover:text-app active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 dark:hover:bg-white/[0.08]"
                  >
                    {code.is_active ? "Desactivar" : "Activar"}
                  </button>
                </form>
                <DeleteDiscountCodeButton codeId={code.id} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
