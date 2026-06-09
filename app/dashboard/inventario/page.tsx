import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Package } from "lucide-react";
import { createClient } from "../../../lib/supabase/server";
import { fetchProducts } from "./actions";
import { ProductsList } from "./products-list";

export default async function InventarioPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const cookieStore = await cookies();
  const activeCompanyId = cookieStore.get("active_company_id")?.value ?? null;

  const membershipQuery = supabase
    .from("memberships")
    .select("company_id, role")
    .eq("user_id", user.id);

  const { data: membership } = await (
    activeCompanyId
      ? membershipQuery.eq("company_id", activeCompanyId)
      : membershipQuery.limit(1)
  ).maybeSingle();

  if (!membership?.company_id) redirect("/dashboard");

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, needs_inventory")
    .eq("id", membership.company_id)
    .maybeSingle();

  if (!company?.needs_inventory) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl">
          <div className="rounded-[28px] border border-app bg-app-soft p-6 sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-app bg-app-soft px-3 py-1 text-xs font-medium text-app-muted">
              <Package className="h-3.5 w-3.5" />
              Inventario
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-app sm:text-3xl">
              Inventario desactivado
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-app-soft">
              El inventario no está habilitado para este negocio. Puedes
              activarlo desde{" "}
              <a
                href="/dashboard/mi-negocio"
                className="underline underline-offset-2 hover:text-app"
              >
                Mi negocio → Operación
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  const role = String(membership.role ?? "").toLowerCase();
  const canEdit = ["owner", "admin"].includes(role);
  const products = await fetchProducts(membership.company_id);

  const lowStockCount = products.filter(
    (p) => p.is_active && p.track_inventory && p.min_stock != null && p.stock <= p.min_stock
  ).length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-app bg-app-soft px-3 py-1 text-xs font-medium text-app-muted">
            <Package className="h-3.5 w-3.5" />
            Inventario
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-app sm:text-3xl">
            Productos
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-app-soft sm:text-[15px]">
            Administra el catálogo y stock de tu negocio.
          </p>
        </div>

        {/* Stats */}
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Total productos", value: products.length },
            {
              label: "Con stock activo",
              value: products.filter((p) => p.is_active && p.track_inventory).length,
            },
            {
              label: "Stock bajo",
              value: lowStockCount,
              warn: lowStockCount > 0,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-[20px] border border-app bg-app-soft px-4 py-3"
            >
              <p className="text-xs uppercase tracking-[0.16em] text-app-soft">
                {stat.label}
              </p>
              <p
                className={[
                  "mt-1 text-2xl font-semibold tracking-tight",
                  stat.warn ? "text-rose-600 dark:text-rose-300" : "text-app",
                ].join(" ")}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-[28px] border border-app bg-app-soft p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold tracking-[-0.02em] text-app">
                Catálogo
              </h2>
              <p className="mt-0.5 text-sm text-app-soft">
                {products.length} producto{products.length !== 1 ? "s" : ""} registrado
                {products.length !== 1 ? "s" : ""}.
              </p>
            </div>
          </div>

          <ProductsList
            products={products}
            companyId={company.id}
            canEdit={canEdit}
          />
        </div>
      </div>
    </div>
  );
}
