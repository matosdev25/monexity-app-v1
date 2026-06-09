import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGlobalAdmin } from "@/lib/admin-auth";

export const metadata = { title: "Admin — Monexity" };
export const dynamic = "force-dynamic";

function metric(label: string, value: number | string) {
  return (
    <div className="app-card rounded-[24px] p-4 sm:p-5">
      <p className="text-sm font-medium text-app-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-app">{value}</p>
    </div>
  );
}

export default async function AdminHomePage() {
  await requireGlobalAdmin();

  const admin = createAdminClient();

  const [
    { count: companiesCount },
    { count: activeCount },
    { count: trialCount },
    { count: issueCount },
  ] = await Promise.all([
    admin.from("companies").select("id", { count: "exact", head: true }),
    admin
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("subscription_status", "active"),
    admin
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("subscription_status", "trialing"),
    admin
      .from("companies")
      .select("id", { count: "exact", head: true })
      .in("subscription_status", ["pending", "pending_payment_method", "failed", "cancelled", "canceled", "expired", "past_due", "inactive"]),
  ]);

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metric("Empresas registradas", companiesCount ?? 0)}
        {metric("Suscriptores activos", activeCount ?? 0)}
        {metric("En prueba", trialCount ?? 0)}
        {metric("Pendientes/fallidos", issueCount ?? 0)}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/admin/subscribers"
          className="app-card-interactive rounded-[24px] p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
        >
          <p className="text-lg font-semibold text-app">Suscriptores</p>
          <p className="mt-2 text-sm leading-6 text-app-muted">
            Revisa empresas, dueños, planes, estados y fechas clave.
          </p>
        </Link>

        <Link
          href="/admin/discount-codes"
          className="app-card-interactive rounded-[24px] p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
        >
          <p className="text-lg font-semibold text-app">Códigos de descuento</p>
          <p className="mt-2 text-sm leading-6 text-app-muted">
            Crea, activa y desactiva códigos promocionales del SaaS.
          </p>
        </Link>
      </section>
    </div>
  );
}
