"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type ReactElement } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { ThemeSelector } from "@/components/theme-selector";
import { LogoutButton } from "@/components/logout-button";
import { CompanySwitcher } from "@/components/company-switcher";
import { logout } from "@/app/auth/logout/actions";
import { useNavigation } from "@/components/navigation-context";
import type { CompanyOption } from "@/app/dashboard/layout";

// ── Icons ─────────────────────────────────────────────────────────────

type IconProps = { className?: string };

function DashboardIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 5.5C4 4.67 4.67 4 5.5 4H10.5C11.33 4 12 4.67 12 5.5V10.5C12 11.33 11.33 12 10.5 12H5.5C4.67 12 4 11.33 4 10.5V5.5Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M14 5.5C14 4.67 14.67 4 15.5 4H18.5C19.33 4 20 4.67 20 5.5V8.5C20 9.33 19.33 10 18.5 10H15.5C14.67 10 14 9.33 14 8.5V5.5Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M14 15.5C14 14.67 14.67 14 15.5 14H18.5C19.33 14 20 14.67 20 15.5V18.5C20 19.33 19.33 20 18.5 20H15.5C14.67 20 14 19.33 14 18.5V15.5Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 15.5C4 14.67 4.67 14 5.5 14H10.5C11.33 14 12 14.67 12 15.5V18.5C12 19.33 11.33 20 10.5 20H5.5C4.67 20 4 19.33 4 18.5V15.5Z" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function SalesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M7 8.5C7 7.12 8.12 6 9.5 6H17C18.66 6 20 7.34 20 9V15C20 16.66 18.66 18 17 18H9.5C8.12 18 7 16.88 7 15.5V8.5Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 8H6C4.9 8 4 8.9 4 10V14C4 15.1 4.9 16 6 16H7" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16" cy="12" r="1.25" fill="currentColor" />
    </svg>
  );
}

function ExpensesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M7 4.75V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M12 4.75V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M17 4.75V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M6.5 7H17.5C18.88 7 20 8.12 20 9.5V17C20 18.66 18.66 20 17 20H7C5.34 20 4 18.66 4 17V9.5C4 8.12 5.12 7 6.5 7Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 11.5H16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M9.5 15H14.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ClosureIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3V6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M16 3V6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M4 10H20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M9 15L11 17L15.5 12.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BusinessIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M5 19V8.5C5 7.67 5.67 7 6.5 7H10V5.5C10 4.67 10.67 4 11.5 4H17.5C18.33 4 19 4.67 19 5.5V19" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 19H20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 11H8.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M8 14.5H8.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M13 8.5H13.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M16 8.5H16.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M13 12H13.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M16 12H16.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function InventoryIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 7.5C4 6.67 4.67 6 5.5 6H18.5C19.33 6 20 6.67 20 7.5V9H4V7.5Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 9H20V18.5C20 19.33 19.33 20 18.5 20H5.5C4.67 20 4 19.33 4 18.5V9Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 6V4.5C9 4.22 9.22 4 9.5 4H14.5C14.78 4 15 4.22 15 4.5V6" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 13H15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function QuotationsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M8 4H6C4.9 4 4 4.9 4 6V18C4 19.1 4.9 20 6 20H18C19.1 20 20 19.1 20 18V6C20 4.9 19.1 4 18 4H16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 4C8 3.45 8.45 3 9 3H15C15.55 3 16 3.45 16 4V5C16 5.55 15.55 6 15 6H9C8.45 6 8 5.55 8 5V4Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 11H16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 15H13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function AdminIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 3.75L18.5 6.25V11.2C18.5 15.35 15.87 18.97 12 20.25C8.13 18.97 5.5 15.35 5.5 11.2V6.25L12 3.75Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9.25 12.25L11.15 14.15L15 10.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LogoutIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M10 6.75H8.25C7.01 6.75 6 7.76 6 9V15C6 16.24 7.01 17.25 8.25 17.25H10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M13 8L17 12L13 16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 12H9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function SunIcon({ className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
      <path d="M12 2a.75.75 0 0 1 .75.75V4a.75.75 0 0 1-1.5 0V2.75A.75.75 0 0 1 12 2Zm0 18a.75.75 0 0 1 .75.75V22a.75.75 0 0 1-1.5 0v-1.25A.75.75 0 0 1 12 20Zm10-8a.75.75 0 0 1-.75.75H20a.75.75 0 0 1 0-1.5h1.25A.75.75 0 0 1 22 12ZM4 12a.75.75 0 0 1-.75.75H2a.75.75 0 0 1 0-1.5h1.25A.75.75 0 0 1 4 12Zm14.364-6.364a.75.75 0 0 1 1.06 0l.884.884a.75.75 0 1 1-1.06 1.06l-.884-.883a.75.75 0 0 1 0-1.061Zm-12.728 0a.75.75 0 0 1 0 1.06l-.884.884a.75.75 0 1 1-1.06-1.06l.883-.884a.75.75 0 0 1 1.061 0Zm13.612 12.728a.75.75 0 0 1 1.06 1.06l-.883.884a.75.75 0 1 1-1.06-1.06l.883-.884Zm-14.496 0 .884.884a.75.75 0 1 1-1.06 1.06l-.884-.883a.75.75 0 0 1 1.06-1.061Z" />
    </svg>
  );
}

function MoonIcon({ className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M21.752 15.002A9 9 0 0 1 8.998 2.248a.75.75 0 0 0-.813-.996A10.5 10.5 0 1 0 22.748 15.815a.75.75 0 0 0-.996-.813Z" />
    </svg>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────

const BASE_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/dashboard/sales", label: "Ventas", icon: SalesIcon },
  { href: "/dashboard/quotations", label: "Cotizaciones", icon: QuotationsIcon },
  { href: "/dashboard/expenses", label: "Gastos", icon: ExpensesIcon },
  { href: "/dashboard/cierre", label: "Cierre del período", icon: ClosureIcon },
  { href: "/dashboard/mi-negocio", label: "Mi negocio", icon: BusinessIcon },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

// ── Compact theme button (tablet rail) ───────────────────────────────

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function CompactThemeButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );

  if (!mounted) {
    return <div className="h-10 w-10 rounded-2xl bg-app-soft" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      title={isDark ? "Tema claro" : "Tema oscuro"}
      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-app bg-app-soft text-app-muted transition-[background-color,border-color,color] duration-[180ms] hover:bg-app hover:text-app active:scale-95"
    >
      {isDark
        ? <SunIcon className="h-4 w-4" />
        : <MoonIcon className="h-4 w-4" />
      }
    </button>
  );
}

// ── Compact logout button (tablet rail) ──────────────────────────────

function CompactLogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        className="flex h-10 w-10 items-center justify-center rounded-2xl border border-transparent text-rose-500/90 transition-[background-color,color] duration-[180ms] hover:bg-rose-500/8 hover:text-rose-600 active:scale-95 dark:text-rose-300 dark:hover:bg-rose-500/10 dark:hover:text-rose-200"
      >
        <LogoutIcon className="h-[18px] w-[18px]" />
      </button>
    </form>
  );
}

// ── Main component ────────────────────────────────────────────────────

type DashboardSidebarProps = {
  activeCompanyId: string;
  activeCompanyName: string;
  activeRole: string;
  companyOptions: CompanyOption[];
  needsInventory?: boolean;
  isGlobalAdmin?: boolean;
};

type NavItem = {
  href: string;
  label: string;
  icon: (props: IconProps) => ReactElement;
};

function NavItems({
  items,
  pathname,
  pendingHref,
  onPendingHref,
  onStartNavigation,
  onNavClick,
}: {
  items: NavItem[];
  pathname: string;
  pendingHref: string | null;
  onPendingHref: (href: string) => void;
  onStartNavigation: () => void;
  onNavClick?: () => void;
}) {
  return (
    <>
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const visuallyActive = active || pendingHref === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => {
              if (!active) { onPendingHref(item.href); onStartNavigation(); }
              onNavClick?.();
            }}
            aria-current={active ? "page" : undefined}
            className={[
              "group flex items-center gap-3 rounded-[22px] px-3 py-2.5",
              "transition-[background-color,border-color,color] duration-[180ms]",
              "active:scale-[0.98] active:opacity-90",
              visuallyActive
                ? "app-card border border-app-strong"
                : "border border-transparent text-app-muted hover:bg-app-soft hover:text-app",
            ].join(" ")}
          >
            <span
              className={[
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                "transition-[background-color,color,box-shadow] duration-[180ms]",
                visuallyActive
                  ? "bg-slate-950 text-white shadow-[0_10px_20px_rgba(15,23,42,0.14)] dark:bg-white/[0.12] dark:text-white dark:shadow-none"
                  : "bg-app-soft text-app-muted group-hover:text-app",
              ].join(" ")}
            >
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className={["truncate text-[15px] font-medium tracking-tight", visuallyActive ? "text-app" : "text-app-muted"].join(" ")}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </>
  );
}

export function DashboardSidebar({
  activeCompanyId,
  activeCompanyName,
  activeRole,
  companyOptions,
  needsInventory = false,
  isGlobalAdmin = false,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const { startNavigation } = useNavigation();

  useEffect(() => {
    const timer = window.setTimeout(() => setPendingHref(null), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  const navItemsBase = needsInventory
    ? [
        ...BASE_NAV_ITEMS.slice(0, 3),
        { href: "/dashboard/inventario", label: "Inventario", icon: InventoryIcon },
        ...BASE_NAV_ITEMS.slice(3),
      ]
    : BASE_NAV_ITEMS;
  const role = String(activeRole ?? "").toLowerCase();
  const visibleNavItemsBase = role === "seller"
    ? navItemsBase.filter((item) =>
        ["/dashboard", "/dashboard/sales", "/dashboard/expenses"].includes(item.href)
      )
    : role === "admin"
      ? navItemsBase.filter((item) => item.href !== "/dashboard/billing")
    : navItemsBase;
  const navItems = isGlobalAdmin
    ? [...visibleNavItemsBase, { href: "/admin", label: "Admin", icon: AdminIcon }]
    : visibleNavItemsBase;

  // ── Tablet rail (md–lg, 72px) ──────────────────────────────────────

  const tabletRail = (
    <aside
      aria-label="Navegación"
      className="hidden h-full w-[72px] shrink-0 flex-col app-panel rounded-[32px] p-2 md:flex lg:hidden"
    >
      {/* Logo mark */}
      <div className="app-card flex h-[58px] w-full items-center justify-center rounded-[24px]">
        <Image src="/logo/monexity-mark-light.svg" alt="Monexity" width={32} height={32} className="h-8 w-8 object-contain dark:hidden" priority />
        <Image src="/logo/monexity-mark-dark.svg" alt="Monexity" width={32} height={32} className="hidden h-8 w-8 object-contain dark:block" priority />
      </div>

      {/* Nav icons */}
      <nav className="mt-3 flex flex-1 flex-col items-center gap-1" aria-label="Navegación principal">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);
          const visuallyActive = active || pendingHref === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              onClick={() => { if (!active) { setPendingHref(item.href); startNavigation(); } }}
              className={[
                "flex h-11 w-11 items-center justify-center rounded-[22px]",
                "transition-[background-color,border-color,color,box-shadow] duration-[180ms]",
                "active:scale-[0.96] active:opacity-90",
                visuallyActive
                  ? "app-card border border-app-strong"
                  : "border border-transparent text-app-muted hover:bg-app-soft hover:text-app",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-2xl",
                  "transition-[background-color,color,box-shadow] duration-[180ms]",
                  visuallyActive
                    ? "bg-slate-950 text-white shadow-[0_8px_16px_rgba(15,23,42,0.14)] dark:bg-white/[0.12] dark:text-white dark:shadow-none"
                    : "text-app-muted",
                ].join(" ")}
              >
                <Icon className="h-[18px] w-[18px]" />
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: compact theme + logout */}
      <div className="mt-3 flex flex-col items-center gap-2 border-t border-app pt-3">
        <CompactThemeButton />
        <CompactLogoutButton />
      </div>
    </aside>
  );

  // ── Desktop sidebar (lg+, 258px) ───────────────────────────────────

  const desktopSidebar = (
    <aside
      aria-label="Navegación"
      className="hidden h-full w-[258px] shrink-0 flex-col app-panel rounded-[32px] p-3 lg:flex"
    >
      {/* Logo */}
      <div className="app-card rounded-[22px] px-3 py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-app bg-app-soft">
            <Image src="/logo/monexity-mark-light.svg" alt="Monexity" width={56} height={56} className="h-10 w-10 object-contain dark:hidden" priority />
            <Image src="/logo/monexity-mark-dark.svg" alt="Monexity" width={56} height={56} className="hidden h-10 w-10 object-contain dark:block" priority />
          </div>
          <div className="min-w-0 flex-1 overflow-visible">
            <div className="relative h-11 w-[188px] overflow-visible sm:h-12 sm:w-[206px]">
              <Image src="/logo/monexity-logotype-light.svg" alt="Monexity" fill priority sizes="206px" className="origin-left object-contain object-left scale-[2.25] dark:hidden" />
              <Image src="/logo/monexity-logotype-dark.svg" alt="Monexity" fill priority sizes="206px" className="hidden origin-left object-contain object-left scale-[2.25] dark:block" />
            </div>
          </div>
        </div>
      </div>

      {/* Company switcher */}
      <div className="mt-3">
        <CompanySwitcher
          activeCompanyId={activeCompanyId}
          activeCompanyName={activeCompanyName}
          activeRole={activeRole}
          companyOptions={companyOptions}
        />
      </div>

      {/* Nav */}
      <nav className="mt-4 min-h-0 flex-1 overflow-y-auto space-y-1.5" aria-label="Navegación principal">
        <NavItems
          items={navItems}
          pathname={pathname}
          pendingHref={pendingHref}
          onPendingHref={setPendingHref}
          onStartNavigation={startNavigation}
        />
      </nav>

      {/* Bottom */}
      <div className="mt-5 shrink-0 space-y-3 border-t border-app pt-4">
        <div className="px-1">
          <p className="mb-2 px-1 text-[11px] uppercase tracking-[0.18em] text-app-soft">Tema</p>
          <ThemeSelector />
        </div>
        <div className="px-1">
          <LogoutButton />
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {tabletRail}
      {desktopSidebar}
    </>
  );
}
