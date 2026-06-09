"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavCtxType = { startNavigation: () => void; isNavigating: boolean };

const NavCtx = createContext<NavCtxType>({ startNavigation: () => {}, isNavigating: false });

export function useNavigation() {
  return useContext(NavCtx);
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [isNavigating, setIsNavigating] = useState(false);
  const pathname = usePathname();
  const startNavigation = useCallback(() => setIsNavigating(true), []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsNavigating(false);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [pathname]);

  useEffect(() => {
    if (!isNavigating) return;

    const timeoutId = window.setTimeout(() => {
      setIsNavigating(false);
    }, 8_000);

    return () => window.clearTimeout(timeoutId);
  }, [isNavigating]);

  return (
    <NavCtx.Provider value={{ startNavigation, isNavigating }}>
      {children}
    </NavCtx.Provider>
  );
}

export function NavigationOverlay() {
  const { isNavigating } = useNavigation();
  if (!isNavigating) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[28px] bg-white/80 backdrop-blur-sm dark:bg-slate-950/80"
    >
      <div className="mx-loader" role="status" aria-label="Cargando" />
    </div>
  );
}
