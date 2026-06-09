"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { ThemeProvider } from "../components/theme-provider";

type ResolvedTheme = "light" | "dark";

function resolveAutoTheme(date = new Date()): ResolvedTheme {
  const hour = date.getHours();
  return hour >= 19 || hour < 6 ? "dark" : "light";
}

function getMsUntilNextAutoThemeChange(date = new Date()) {
  const next = new Date(date);
  const hour = date.getHours();

  if (hour < 6) {
    next.setHours(6, 0, 0, 0);
  } else if (hour < 19) {
    next.setHours(19, 0, 0, 0);
  } else {
    next.setDate(next.getDate() + 1);
    next.setHours(6, 0, 0, 0);
  }

  return Math.max(next.getTime() - date.getTime(), 1_000);
}

function applyResolvedTheme(resolvedTheme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.remove("auto");
  root.classList.toggle("dark", resolvedTheme === "dark");
  root.classList.toggle("light", resolvedTheme === "light");
  root.style.colorScheme = resolvedTheme;
}

function AutoThemeScript() {
  const script = `
    (function() {
      try {
        var theme = localStorage.getItem("theme") || "auto";
        if (theme === "system") {
          theme = "auto";
          localStorage.setItem("theme", "auto");
        }
        if (theme !== "auto") return;
        var hour = new Date().getHours();
        var resolvedTheme = hour >= 19 || hour < 6 ? "dark" : "light";
        var root = document.documentElement;
        root.classList.remove("auto", "light", "dark");
        root.classList.add(resolvedTheme);
        root.style.colorScheme = resolvedTheme;
      } catch (_) {}
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

function AutoThemeController() {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (theme === "system") {
      setTheme("auto");
      return;
    }

    if (theme !== "auto") {
      document.documentElement.classList.remove("auto");
      return;
    }

    let timeoutId: number | undefined;

    function syncAutoTheme() {
      if (timeoutId) window.clearTimeout(timeoutId);

      const now = new Date();
      applyResolvedTheme(resolveAutoTheme(now));
      timeoutId = window.setTimeout(syncAutoTheme, getMsUntilNextAutoThemeChange(now) + 250);
    }

    syncAutoTheme();
    window.addEventListener("focus", syncAutoTheme);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus", syncAutoTheme);
    };
  }, [theme, setTheme]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="auto"
      enableSystem={false}
      themes={["light", "dark", "auto"]}
      disableTransitionOnChange
    >
      <AutoThemeScript />
      <AutoThemeController />
      {children}
    </ThemeProvider>
  );
}
