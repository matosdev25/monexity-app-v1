"use client";

import Link from "next/link";
import { useRef, useState, useEffect, useCallback } from "react";
import { switchCompany } from "@/app/dashboard/actions";
import type { CompanyOption } from "@/app/dashboard/layout";

function CompanyLogoContent({
  name,
  logoUrl,
  spanClassName,
}: {
  name: string;
  logoUrl: string | null | undefined;
  spanClassName: string;
}) {
  const [imgError, setImgError] = useState(false);

  if (logoUrl && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        className="h-full w-full object-cover"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <span className={spanClassName}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    owner: {
      label: "Dueño",
      cls: "bg-violet-500/10 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300",
    },
    admin: {
      label: "Administrador",
      cls: "bg-sky-500/10 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300",
    },
    seller: {
      label: "Vendedor",
      cls: "bg-slate-500/10 text-slate-600 dark:bg-slate-400/10 dark:text-slate-300",
    },
  };
  const { label, cls } = map[role] ?? map.seller;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

type CompanySwitcherProps = {
  activeCompanyId: string;
  activeCompanyName: string;
  activeRole: string;
  companyOptions: CompanyOption[];
};

export function CompanySwitcher({
  activeCompanyId,
  activeCompanyName,
  activeRole,
  companyOptions,
}: CompanySwitcherProps) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const closeDropdown = useCallback(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, prefersReduced ? 0 : 150);
  }, []);

  const openDropdown = useCallback(() => {
    setClosing(false);
    setOpen(true);
  }, []);

  const toggleDropdown = useCallback(() => {
    if (open && !closing) {
      closeDropdown();
    } else if (!open) {
      openDropdown();
    }
  }, [open, closing, closeDropdown, openDropdown]);

  useEffect(() => {
    if (!open) return;

    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeDropdown();
    }

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeDropdown]);

  return (
    <div ref={containerRef} className="relative z-10 w-full">
      {/* ── Trigger ── */}
      <button
        type="button"
        onClick={toggleDropdown}
        className={[
          "flex w-full cursor-pointer items-center gap-2.5 rounded-[18px] border px-3 py-2 text-left",
          "transition-[background-color,border-color,box-shadow] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          "active:scale-[0.98] active:opacity-90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50 dark:focus-visible:ring-sky-400/40",
          open
            ? "border-slate-300/80 bg-app-card dark:border-slate-600/70"
            : "border-app bg-app-soft hover:bg-app-card hover:border-slate-300/60 dark:hover:border-slate-600/50",
        ].join(" ")}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div
          className={[
            "flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[10px]",
            "transition-[background-color,box-shadow] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
            open
              ? "bg-slate-300 shadow-[0_0_0_2px_rgba(148,163,184,0.25)] dark:bg-slate-600"
              : "bg-slate-200 dark:bg-slate-700",
          ].join(" ")}
        >
          <CompanyLogoContent
            name={activeCompanyName}
            logoUrl={companyOptions.find((o) => o.companyId === activeCompanyId)?.logoUrl}
            spanClassName="text-xs font-semibold text-slate-700 dark:text-slate-200"
          />
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <p className="truncate text-sm font-semibold text-app">
            {activeCompanyName}
          </p>
          <RoleBadge role={activeRole} />
        </div>

        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={[
            "h-3.5 w-3.5 shrink-0 text-app-soft",
            "transition-transform duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
            open ? "rotate-180" : "",
          ].join(" ")}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div
          role="listbox"
          className={[
            "absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-[20px]",
            "border border-slate-200/80 bg-white",
            "shadow-[0_16px_48px_rgba(15,23,42,0.18),0_2px_8px_rgba(15,23,42,0.08)]",
            "dark:border-white/10 dark:bg-[#1e2d45]",
            "dark:shadow-[0_16px_48px_rgba(0,0,0,0.6),0_2px_8px_rgba(0,0,0,0.3)]",
            closing ? "animate-mx-scale-out" : "animate-mx-scale-in",
          ].join(" ")}
        >
          <div className="p-1.5">
            {companyOptions.map((option) => {
              const isActive = option.companyId === activeCompanyId;

              return (
                <form key={option.companyId} action={switchCompany}>
                  <input type="hidden" name="companyId" value={option.companyId} />
                  <button
                    type="submit"
                    role="option"
                    aria-selected={isActive}
                    disabled={isActive}
                    className={[
                      "flex w-full items-center gap-3 rounded-[16px] px-3 py-2.5 text-left",
                      "transition-[background-color,transform,opacity] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                      isActive
                        ? "bg-slate-100 dark:bg-white/9 cursor-default"
                        : "cursor-pointer hover:bg-slate-100/70 dark:hover:bg-white/6 active:scale-[0.98] active:opacity-90",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[12px]",
                        "transition-[background-color] duration-[180ms]",
                        isActive
                          ? "bg-slate-300 dark:bg-slate-600"
                          : "bg-slate-200 dark:bg-slate-700",
                      ].join(" ")}
                    >
                      <CompanyLogoContent
                        name={option.companyName}
                        logoUrl={option.logoUrl}
                        spanClassName="text-sm font-semibold text-slate-700 dark:text-slate-200"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-app">
                        {option.companyName}
                      </p>
                      <RoleBadge role={option.role} />
                    </div>

                    {isActive && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 shrink-0 animate-mx-fade-in text-sky-500 dark:text-sky-400"
                        aria-hidden="true"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                </form>
              );
            })}

            {/* Añadir otro negocio */}
            <div className="mt-1 border-t border-app pt-1">
              <Link
                href="/onboarding"
                onClick={() => closeDropdown()}
                className={[
                  "flex w-full items-center gap-3 rounded-[16px] px-3 py-2.5 text-left",
                  "transition-[background-color,transform,opacity] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                  "hover:bg-app-soft active:scale-[0.98] active:opacity-90",
                ].join(" ")}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] border border-dashed border-app-strong bg-transparent">
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-app-muted" aria-hidden="true">
                    <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-app-muted">+ Añadir otro negocio</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
