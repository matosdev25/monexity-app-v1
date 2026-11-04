"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/subscribers", label: "Empresas" },
  { href: "/admin/users", label: "Usuarios" },
  { href: "/admin/billing", label: "Pagos" },
  { href: "/admin/discount-codes", label: "Códigos" },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones del admin"
      className="flex max-w-full gap-1 overflow-x-auto rounded-[22px] border border-app bg-app-soft p-1"
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={[
              "whitespace-nowrap rounded-[18px] px-3 py-2 text-sm font-medium",
              "transition-[background-color,color,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
              "active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50",
              active
                ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                : "text-app-muted hover:bg-white hover:text-app dark:hover:bg-white/10",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
