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

// Indicador de navegación no bloqueante: los loading.tsx de cada ruta muestran
// el skeleton; esta barra solo confirma que la navegación está en curso.
export function NavigationOverlay() {
  const { isNavigating } = useNavigation();
  if (!isNavigating) return null;
  return (
    <div className="pointer-events-none absolute inset-x-6 top-0 z-20 h-0.5 overflow-hidden rounded-full">
      <span role="status" className="sr-only">
        Cargando
      </span>
      <div
        aria-hidden="true"
        className="h-full w-full animate-pulse rounded-full bg-[var(--brand)] opacity-70"
      />
    </div>
  );
}
