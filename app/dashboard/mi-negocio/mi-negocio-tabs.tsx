import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  activeTab: string;
  hasTeam: boolean;
  canViewAccount: boolean;
  generalSlot?: ReactNode;
  cuentaSlot?: ReactNode;
  serviciosSlot?: ReactNode;
  equipoSlot?: ReactNode;
};

function tabClass(active: boolean) {
  return [
    "rounded-[10px] sm:rounded-[14px] px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium",
    "transition-[background-color,color,box-shadow,transform,opacity] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 focus-visible:ring-offset-1",
    active
      ? [
          "bg-white text-slate-900",
          "shadow-[0_1px_3px_rgba(15,23,42,0.10),0_0_0_0.5px_rgba(15,23,42,0.05)]",
          "dark:bg-white/[0.13] dark:text-white",
          "dark:shadow-[0_1px_3px_rgba(0,0,0,0.30),0_0_0_0.5px_rgba(255,255,255,0.06)]",
        ].join(" ")
      : [
          "text-slate-500 dark:text-slate-400",
          "hover:bg-white/60 hover:text-slate-800",
          "dark:hover:bg-white/[0.08] dark:hover:text-slate-200",
          "active:scale-[0.95] active:opacity-75",
        ].join(" "),
  ].join(" ");
}

export function MiNegocioTabs({
  activeTab,
  hasTeam,
  canViewAccount,
  generalSlot,
  cuentaSlot,
  serviciosSlot,
  equipoSlot,
}: Props) {
  return (
    <>
      <div className="mb-3 sm:mb-5 flex w-fit max-w-full items-center gap-1 rounded-xl sm:rounded-[22px] border border-app bg-app-soft p-1">
        <Link href="/dashboard/mi-negocio" className={tabClass(activeTab === "general")}>
          General
        </Link>
        {canViewAccount && (
          <Link
            href="/dashboard/mi-negocio?tab=cuenta"
            className={tabClass(activeTab === "cuenta")}
          >
            Mi cuenta
          </Link>
        )}
        <Link
          href="/dashboard/mi-negocio?tab=servicios"
          className={tabClass(activeTab === "servicios")}
        >
          Servicios
        </Link>
        {hasTeam && (
          <Link
            href="/dashboard/mi-negocio?tab=equipo"
            className={tabClass(activeTab === "equipo")}
          >
            Equipo
          </Link>
        )}
      </div>

      {activeTab === "general" && <div>{generalSlot}</div>}
      {canViewAccount && activeTab === "cuenta" && <div>{cuentaSlot}</div>}
      {activeTab === "servicios" && <div className="pb-6">{serviciosSlot}</div>}
      {hasTeam && activeTab === "equipo" && (
        <div className="flex flex-col gap-6 pb-6">{equipoSlot}</div>
      )}
    </>
  );
}
