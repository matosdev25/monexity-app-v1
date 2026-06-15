"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ThemeSelector } from "@/components/theme-selector";
import { LogoutButton } from "@/components/logout-button";
import { CompanySwitcher } from "@/components/company-switcher";
import { useNavigation } from "@/components/navigation-context";
import type { CompanyOption } from "@/app/dashboard/layout";

// ── Icons ─────────────────────────────────────────────────────────────

function MenuIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M3 5h12M3 9h12M3 13h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M4 5.5C4 4.67 4.67 4 5.5 4H10.5C11.33 4 12 4.67 12 5.5V10.5C12 11.33 11.33 12 10.5 12H5.5C4.67 12 4 11.33 4 10.5V5.5Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M14 5.5C14 4.67 14.67 4 15.5 4H18.5C19.33 4 20 4.67 20 5.5V8.5C20 9.33 19.33 10 18.5 10H15.5C14.67 10 14 9.33 14 8.5V5.5Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M14 15.5C14 14.67 14.67 14 15.5 14H18.5C19.33 14 20 14.67 20 15.5V18.5C20 19.33 19.33 20 18.5 20H15.5C14.67 20 14 19.33 14 18.5V15.5Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 15.5C4 14.67 4.67 14 5.5 14H10.5C11.33 14 12 14.67 12 15.5V18.5C12 19.33 11.33 20 10.5 20H5.5C4.67 20 4 19.33 4 18.5V15.5Z" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function SalesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M7 8.5C7 7.12 8.12 6 9.5 6H17C18.66 6 20 7.34 20 9V15C20 16.66 18.66 18 17 18H9.5C8.12 18 7 16.88 7 15.5V8.5Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 8H6C4.9 8 4 8.9 4 10V14C4 15.1 4.9 16 6 16H7" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16" cy="12" r="1.25" fill="currentColor" />
    </svg>
  );
}

function ExpensesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M7 4.75V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M12 4.75V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M17 4.75V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M6.5 7H17.5C18.88 7 20 8.12 20 9.5V17C20 18.66 18.66 20 17 20H7C5.34 20 4 18.66 4 17V9.5C4 8.12 5.12 7 6.5 7Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 11.5H16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M9.5 15H14.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ClosureIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3V6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M16 3V6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M4 10H20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M9 15L11 17L15.5 12.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BusinessIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M5 19V8.5C5 7.67 5.67 7 6.5 7H10V5.5C10 4.67 10.67 4 11.5 4H17.5C18.33 4 19 4.67 19 5.5V19" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 19H20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 11H8.01M8 14.5H8.01M13 8.5H13.01M16 8.5H16.01M13 12H13.01M16 12H16.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function InventoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M4 7.5C4 6.67 4.67 6 5.5 6H18.5C19.33 6 20 6.67 20 7.5V9H4V7.5Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 9H20V18.5C20 19.33 19.33 20 18.5 20H5.5C4.67 20 4 19.33 4 18.5V9Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 6V4.5C9 4.22 9.22 4 9.5 4H14.5C14.78 4 15 4.22 15 4.5V6" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 13H15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function QuotationsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M8 4H6C4.9 4 4 4.9 4 6V18C4 19.1 4.9 20 6 20H18C19.1 20 20 19.1 20 18V6C20 4.9 19.1 4 18 4H16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 4C8 3.45 8.45 3 9 3H15C15.55 3 16 3.45 16 4V5C16 5.55 15.55 6 15 6H9C8.45 6 8 5.55 8 5V4Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 11H16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 15H13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M12 3.75L18.5 6.25V11.2C18.5 15.35 15.87 18.97 12 20.25C8.13 18.97 5.5 15.35 5.5 11.2V6.25L12 3.75Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9.25 12.25L11.15 14.15L15 10.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────

const BASE_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/dashboard/sales", label: "Ventas", Icon: SalesIcon },
  { href: "/dashboard/quotations", label: "Cotizaciones", Icon: QuotationsIcon },
  { href: "/dashboard/expenses", label: "Gastos", Icon: ExpensesIcon },
  { href: "/dashboard/cierre", label: "Cierre del período", Icon: ClosureIcon },
  { href: "/dashboard/mi-negocio", label: "Mi negocio", Icon: BusinessIcon },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

// ── Component ─────────────────────────────────────────────────────────

type Props = {
  activeCompanyId: string;
  activeCompanyName: string;
  activeRole: string;
  companyOptions: CompanyOption[];
  needsInventory?: boolean;
  isGlobalAdmin?: boolean;
};

export function MobileSidebar({
  activeCompanyId,
  activeCompanyName,
  activeRole,
  companyOptions,
  needsInventory = false,
  isGlobalAdmin = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const pathname = usePathname();
  const { startNavigation } = useNavigation();

  const navItemsBase = needsInventory
    ? [
        ...BASE_NAV_ITEMS.slice(0, 3),
        { href: "/dashboard/inventario", label: "Inventario", Icon: InventoryIcon },
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
    ? [...visibleNavItemsBase, { href: "/admin", label: "Admin", Icon: AdminIcon }]
    : visibleNavItemsBase;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOpen(false);
      setPendingHref(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  // Bloquea scroll del body
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Cierra con Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const portal = open
    ? createPortal(
        <>
          {/* Overlay */}
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9998,
              backgroundColor: "rgba(15,23,42,0.52)",
              transition: "opacity 180ms cubic-bezier(0.16,1,0.3,1)",
              opacity: open ? 1 : 0,
              pointerEvents: open ? "auto" : "none",
            }}
          />

          {/* Drawer — superficie sólida para separación visual clara */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
            style={{
              position: "fixed",
              top: "8px",
              bottom: "8px",
              left: "8px",
              zIndex: 9999,
              width: "272px",
              borderRadius: "28px",
              overflow: "hidden",
              transition: "transform 180ms cubic-bezier(0.16,1,0.3,1)",
              transform: open ? "translateX(0)" : "translateX(-290px)",
              // Bloquea interacción cuando está cerrado (evita que backdrop-filter
              // escape overflow:hidden e intercepte eventos en iOS Safari)
              pointerEvents: open ? "auto" : "none",
            }}
            className="flex flex-col bg-white p-3 shadow-[0_24px_64px_rgba(15,23,42,0.22)] ring-1 ring-slate-200 dark:bg-slate-900 dark:shadow-[0_24px_64px_rgba(2,6,23,0.60)] dark:ring-slate-700/80"
          >
            {/* Logo + cerrar */}
            <div className="flex items-start gap-2">
              {/* overflow:hidden en el card corta el backdrop-filter del logo
                  y evita que su área de captura de eventos cubra el botón X */}
              <div className="min-w-0 flex-1 overflow-hidden rounded-[22px] border border-slate-200/80 bg-slate-50 px-4 py-3 dark:border-slate-700/50 dark:bg-slate-800/70">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-slate-200/80 bg-white dark:border-slate-700/60 dark:bg-slate-800">
                    <Image src="/logo/monexity-mark-light.svg" alt="" width={32} height={32} className="h-8 w-8 object-contain dark:hidden" />
                    <Image src="/logo/monexity-mark-dark.svg" alt="" width={32} height={32} className="hidden h-8 w-8 object-contain dark:block" />
                  </div>
                  <div className="relative h-10 w-[120px] overflow-hidden">
                    <Image src="/logo/monexity-logotype-light.svg" alt="Monexity" fill sizes="120px" className="origin-left object-contain object-left scale-[2.1] dark:hidden" />
                    <Image src="/logo/monexity-logotype-dark.svg" alt="Monexity" fill sizes="120px" className="hidden origin-left object-contain object-left scale-[2.1] dark:block" />
                  </div>
                </div>
              </div>

              {/* Botón X: z-index explícito y stopPropagation para garantizar
                  que el click llegue aunque haya stacking contexts adyacentes */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                aria-label="Cerrar menú"
                style={{ position: "relative", zIndex: 10, flexShrink: 0 }}
                className="mt-1 flex h-10 w-10 items-center justify-center rounded-[20px] border border-slate-200 bg-slate-100 text-slate-500 transition-[background-color,color] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 active:scale-95 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
              >
                <XIcon />
              </button>
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
            <nav className="mt-4 flex-1 space-y-1 overflow-y-auto" aria-label="Navegación principal">
              {navItems.map(({ href, label, Icon }) => {
                const active = isActive(pathname, href);
                const visuallyActive = active || pendingHref === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => {
                      if (!active) { setPendingHref(href); startNavigation(); }
                      setOpen(false);
                    }}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "group flex items-center gap-3 rounded-[20px] px-3 py-2.5",
                      "transition-[background-color,color] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
                      "active:scale-[0.98] active:opacity-90",
                      visuallyActive
                        ? "bg-slate-900 text-white dark:bg-white/10 dark:text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-white",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition-[background-color,color] duration-180",
                        visuallyActive
                          ? "bg-white/15 text-white"
                          : "bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700 dark:bg-slate-800 dark:text-slate-500 dark:group-hover:bg-slate-700/80 dark:group-hover:text-slate-300",
                      ].join(" ")}
                    >
                      <Icon />
                    </span>
                    <span className="truncate text-[15px] font-medium tracking-tight">
                      {label}
                    </span>
                  </Link>
                );
              })}
            </nav>

            {/* Bottom */}
            <div className="mt-4 space-y-3 border-t border-slate-200/80 pt-4 dark:border-slate-700/60">
              <div>
                <p className="mb-2 px-3 text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Tema</p>
                <ThemeSelector />
              </div>
              <div className="px-1">
                <LogoutButton />
              </div>
            </div>
          </div>
        </>,
        document.body
      )
    : null;

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        className="flex h-9 w-9 items-center justify-center rounded-[18px] border border-app bg-app-soft text-app-muted transition-[background-color,border-color,color] duration-[180ms] hover:border-slate-300 hover:text-app active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50 motion-reduce:transition-none dark:hover:border-slate-600 dark:hover:text-slate-100 dark:focus-visible:ring-sky-400/40"
      >
        <MenuIcon />
      </button>
      {portal}
    </>
  );
}
