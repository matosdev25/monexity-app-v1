import Link from "next/link";
import { logout } from "@/app/auth/logout/actions";
import { InactivityLogout } from "@/components/inactivity-logout";
import { requireGlobalAdmin } from "@/lib/admin-auth";

const navItems = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/subscribers", label: "Suscriptores" },
  { href: "/admin/discount-codes", label: "Códigos" },
  { href: "/admin/billing", label: "Pagos" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireGlobalAdmin();

  return (
    <main className="min-h-screen px-3 py-3 text-app sm:px-4 sm:py-4">
      <InactivityLogout />
      <div className="app-panel mx-auto min-h-[calc(100vh-1.5rem)] max-w-6xl rounded-[32px] p-4 sm:min-h-[calc(100vh-2rem)] sm:p-5 lg:p-6">
        <header className="mb-6 flex flex-col gap-4 rounded-[28px] border border-app bg-app-soft p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div>
            <p className="section-label text-[11px] uppercase tracking-[0.18em]">
              Monexity Admin
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-app sm:text-3xl">
              Administración del SaaS
            </h1>
            <p className="mt-1 text-sm text-app-muted">
              Sesión admin: {user.email}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard"
                className="rounded-[18px] border border-app bg-app-soft px-3 py-2 text-sm font-semibold text-app-muted transition-[background-color,border-color,color,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-app-strong hover:bg-white hover:text-app active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 dark:hover:bg-white/[0.08]"
              >
                Volver al dashboard
              </Link>

              <form action={logout}>
                <button
                  type="submit"
                  className="rounded-[18px] border border-transparent px-3 py-2 text-sm font-semibold text-rose-500 transition-[background-color,color,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-rose-500/10 hover:text-rose-600 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 dark:text-rose-300 dark:hover:text-rose-200"
                >
                  Cerrar sesión
                </button>
              </form>
            </div>

            <nav className="flex max-w-full gap-1 overflow-x-auto rounded-[22px] border border-app bg-app-soft p-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap rounded-[18px] px-3 py-2 text-sm font-medium text-app-muted transition-[background-color,color,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white hover:text-app active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 dark:hover:bg-white/10"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        {children}
      </div>
    </main>
  );
}
