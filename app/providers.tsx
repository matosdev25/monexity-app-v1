"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { ThemeProvider } from "../components/theme-provider";
import {
  THEME_INIT_SCRIPT,
  applyResolvedTheme,
  msUntilNextAutoChange,
  resolveTheme,
} from "../components/theme-clock";

// next-themes solo guarda la preferencia (light | dark | auto) en data-theme.
// La clase light/dark del <html> la aplica únicamente este archivo, con la hora
// local; así next-themes nunca la sobrescribe con "auto" al montar o cambiar.
function ThemeInitScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />;
}

function AutoThemeController() {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (theme === "system") {
      setTheme("auto");
      return;
    }

    let timeoutId: number | undefined;

    function sync() {
      if (timeoutId) window.clearTimeout(timeoutId);
      const now = new Date();
      applyResolvedTheme(resolveTheme(theme, now));
      // Solo el modo automático necesita reprogramarse en 07:00 / 19:00 locales
      if (theme !== "light" && theme !== "dark") {
        timeoutId = window.setTimeout(sync, msUntilNextAutoChange(now) + 250);
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") sync();
    }

    sync();
    // Los timers se congelan con la pestaña en segundo plano o el equipo suspendido
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [theme, setTheme]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="auto"
      enableSystem={false}
      enableColorScheme={false}
      themes={["light", "dark", "auto"]}
      disableTransitionOnChange
    >
      <ThemeInitScript />
      <AutoThemeController />
      {children}
    </ThemeProvider>
  );
}
