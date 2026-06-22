import { Suspense } from "react";
import Image from "next/image";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { DashboardSidebar } from "../../components/dashboard-sidebar";
import { MobileSidebar } from "../../components/mobile-sidebar";
import { NavigationProvider, NavigationOverlay } from "@/components/navigation-context";
import { InactivityLogout } from "@/components/inactivity-logout";
import { logout } from "@/app/auth/logout/actions";
import { resolveLogoUrl } from "../../lib/storage/resolve-logo";
import { isGlobalAdminEmail } from "../../lib/admin-auth";
import { canAccessCompanyApp } from "../../lib/memberships/app-access";

export type CompanyOption = {
  companyId: string;
  companyName: string;
  role: string;
  logoUrl: string | null;
};

const ACCOUNT_ROUTE = "/dashboard/mi-negocio";
const ACCOUNT_ROUTE_WITH_TAB = "/dashboard/mi-negocio?tab=cuenta";
const BILLING_ROUTE = "/dashboard/billing";

function isExpiredAccountRoute(pathname: string, search: string) {
  if (pathname !== ACCOUNT_ROUTE) return false;
  const params = new URLSearchParams(search);
  return params.get("tab") === "cuenta";
}

function isExpiredAllowedDashboardPath(pathname: string, search: string) {
  return pathname.startsWith(BILLING_ROUTE) || isExpiredAccountRoute(pathname, search);
}

function getCompanyInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "M";
}

function MobileCompanyAvatar({
  companyName,
  logoUrl,
}: {
  companyName: string;
  logoUrl: string | null;
}) {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-app-soft text-sm font-semibold text-app shadow-[0_8px_18px_rgba(15,23,42,0.08)] dark:shadow-none"
      aria-label={companyName}
      title={companyName}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`Logo de ${companyName}`}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{getCompanyInitial(companyName)}</span>
      )}
    </div>
  );
}

function PausedAccessScreen() {
  return (
    <main className="h-dvh overflow-hidden text-app">
      <section className="flex h-full w-full items-center justify-center p-4">
        <div className="app-card max-w-md rounded-[28px] border border-app p-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-soft">
            Acceso pausado
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-app">
            Contacta al dueño del negocio
          </h1>
          <p className="mt-2 text-sm leading-6 text-app-muted">
            La membresía necesita atención. Solo el dueño puede gestionar el plan y los pagos de Monexity.
          </p>
          <form action={logout} className="mt-5">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full border border-app bg-transparent px-4 py-2 text-sm font-medium text-app-muted transition-[background-color,border-color,color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-app-muted/10 hover:text-app active:scale-[0.98] active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 motion-reduce:transition-none dark:focus-visible:ring-white/20"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function BillingAccessShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="h-dvh overflow-hidden text-app">
      <InactivityLogout />
      <section className="h-full w-full p-2 sm:p-3">
        <div className="relative app-panel flex h-full min-h-0 flex-col rounded-[28px] px-3 pb-3 sm:px-4 sm:pb-4 lg:px-5 lg:pb-5">
          <div className="flex h-12 shrink-0 items-center justify-end">
            <form action={logout}>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full border border-app bg-transparent px-4 py-2 text-sm font-medium text-app-muted transition-[background-color,border-color,color,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-app-muted/10 hover:text-app active:scale-[0.98] active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 motion-reduce:transition-none dark:focus-visible:ring-white/20"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
          <div
            data-scroll-container
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pt-0 md:pt-2 sm:pt-3"
          >
            <Suspense fallback={null}>{children}</Suspense>
          </div>
        </div>
      </section>
    </main>
  );
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // Error real de sesión — no hay nada que mostrar
  if (userError) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-400">Error al cargar la sesión.</p>
      </div>
    );
  }

  if (!user) {
    redirect("/auth/login");
  }

  const { data: membershipsRaw, error: membershipsError } = await supabase
    .from("memberships")
    .select("company_id, role, companies(id, name, logo_url, subscription_status, subscription_plan, trial_ends_at, current_period_ends_at, is_blocked, needs_inventory)")
    .eq("user_id", user.id);

  if (membershipsError) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-400">Error al cargar el negocio.</p>
      </div>
    );
  }

  if (!membershipsRaw || membershipsRaw.length === 0) {
    redirect("/onboarding");
  }

  type CompanyRow = {
    id: string;
    name: string | null;
    logo_url: string | null;
    subscription_status: string | null;
    subscription_plan: string | null;
    trial_ends_at: string | null;
    current_period_ends_at: string | null;
    is_blocked: boolean | null;
    needs_inventory: boolean | null;
  };

  const memberships = membershipsRaw.map((m) => ({ company_id: m.company_id, role: m.role }));
  const companiesData = membershipsRaw
    .map((m) => {
      const companies = m.companies as unknown as CompanyRow | CompanyRow[] | null;
      return Array.isArray(companies) ? companies[0] ?? null : companies;
    })
    .filter((c): c is CompanyRow => c !== null);

  if (companiesData.length === 0) {
    redirect("/onboarding");
  }

  const cookieStore = await cookies();
  const headersList = await headers();
  const cookieCompanyId = cookieStore.get("active_company_id")?.value ?? null;
  const pathname = headersList.get("x-pathname") ?? "";
  const search = headersList.get("x-search") ?? "";
  const isBillingPath = pathname.startsWith(BILLING_ROUTE);

  const validCookieCompany = cookieCompanyId
    ? companiesData.find((c) => c.id === cookieCompanyId) ?? null
    : null;

  const validAccessCompany =
    companiesData.find((company) => canAccessCompanyApp(company)) ?? null;

  const activeCompany =
    validCookieCompany ??
    validAccessCompany ??
    companiesData[0];

  if (cookieCompanyId && cookieCompanyId !== activeCompany.id) {
    const params = new URLSearchParams({
      cid: activeCompany.id,
      next: pathname || "/dashboard",
    });
    redirect(`/api/dashboard/active-company?${params.toString()}`);
  }

  const activeMembership = memberships.find(
    (m) => m.company_id === activeCompany.id
  );
  const isGlobalAdmin = isGlobalAdminEmail(user.email);

  if (!activeCompany.subscription_plan) {
    redirect(`/onboarding/plan?cid=${activeCompany.id}`);
  }

  const canAccessActiveCompany =
    isGlobalAdmin || canAccessCompanyApp(activeCompany);
  const activeRole = String(activeMembership?.role ?? "").toLowerCase();

  if (!canAccessActiveCompany) {
    if (!isExpiredAllowedDashboardPath(pathname, search)) {
      redirect(ACCOUNT_ROUTE_WITH_TAB);
    }

    if (activeRole !== "owner") {
      return <PausedAccessScreen />;
    }

    if (isBillingPath) {
      return <BillingAccessShell>{children}</BillingAccessShell>;
    }
  }

  if (isBillingPath && activeRole !== "owner") {
    redirect("/dashboard");
  }

  const sellerAllowedPaths = ["/dashboard", "/dashboard/sales", "/dashboard/expenses"];
  const isSellerAllowedPath = sellerAllowedPaths.some((allowedPath) =>
    pathname === allowedPath || pathname.startsWith(`${allowedPath}/`)
  );

  if (activeRole === "seller" && !isSellerAllowedPath) {
    redirect("/dashboard");
  }

  const companyOptions: CompanyOption[] = await Promise.all(
    companiesData.map(async (company) => {
      const membership = memberships.find((m) => m.company_id === company.id);
      const rawLogo = (company as { logo_url?: string | null }).logo_url ?? null;
      return {
        companyId: company.id,
        companyName: company.name ?? "Sin nombre",
        role: membership?.role ?? "seller",
        logoUrl: await resolveLogoUrl(rawLogo),
      };
    })
  );
  const activeCompanyName = activeCompany.name ?? "Mi negocio";
  const activeCompanyLogoUrl =
    companyOptions.find((option) => option.companyId === activeCompany.id)?.logoUrl ?? null;

  return (
    <main className="h-dvh overflow-hidden text-app">
      <InactivityLogout />
      <section className="h-full w-full p-2 sm:p-3">
        <NavigationProvider>
          <div className="flex h-full min-h-0 w-full min-w-0 gap-3">
            <DashboardSidebar
              activeCompanyId={activeCompany.id}
              activeCompanyName={activeCompanyName}
              activeRole={activeRole || "seller"}
              companyOptions={companyOptions}
              needsInventory={Boolean((activeCompany as { needs_inventory?: boolean }).needs_inventory)}
              isGlobalAdmin={isGlobalAdmin}
            />

            <div className="relative app-panel flex min-h-0 min-w-0 flex-1 flex-col rounded-[28px] px-3 pb-3 sm:px-4 sm:pb-4 lg:px-5 lg:pb-5">
              <div className="grid h-12 min-w-0 shrink-0 grid-cols-[40px_minmax(0,1fr)_40px] items-center md:hidden">
                <MobileSidebar
                  activeCompanyId={activeCompany.id}
                  activeCompanyName={activeCompanyName}
                  activeRole={activeRole || "seller"}
                  companyOptions={companyOptions}
                  needsInventory={Boolean((activeCompany as { needs_inventory?: boolean }).needs_inventory)}
                  isGlobalAdmin={isGlobalAdmin}
                />
                <div className="flex min-w-0 justify-center overflow-hidden">
                  <div className="relative h-8 w-[104px] max-w-full overflow-hidden">
                    <Image
                      src="/logo/monexity-logotype-light.svg"
                      alt="MONEXITY"
                      fill
                      sizes="104px"
                      className="scale-[2.05] object-contain dark:hidden"
                    />
                    <Image
                      src="/logo/monexity-logotype-dark.svg"
                      alt="MONEXITY"
                      fill
                      sizes="104px"
                      className="hidden scale-[2.05] object-contain dark:block"
                    />
                  </div>
                </div>
                <div className="flex shrink-0 justify-end">
                  <MobileCompanyAvatar
                    companyName={activeCompanyName}
                    logoUrl={activeCompanyLogoUrl}
                  />
                </div>
              </div>

              <div
                data-scroll-container
                className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pt-0 md:pt-2 sm:pt-3"
              >
                <Suspense fallback={null}>{children}</Suspense>
              </div>

              <NavigationOverlay />
            </div>
          </div>
        </NavigationProvider>
      </section>
    </main>
  );
}
