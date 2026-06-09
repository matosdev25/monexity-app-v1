"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

type ThemeMode = "light" | "dark" | "auto";

const OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscura" },
  { value: "auto", label: "Auto" },
];

export function ThemeSelector() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  function select(m: ThemeMode) {
    setTheme(m);
  }

  if (!mounted) {
    return (
      <div className="h-10 w-full animate-pulse rounded-[20px] bg-app-soft" />
    );
  }

  const current = (theme as ThemeMode | undefined) ?? "auto";

  return (
    <div>
      <div className="inline-grid w-full grid-cols-3 rounded-[20px] border border-app bg-app-soft p-1">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => select(opt.value)}
            className={[
              "rounded-[16px] px-2 py-2.5 text-xs font-medium transition-[background-color,color,box-shadow,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-app active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/45 motion-reduce:transition-none",
              current === opt.value
                ? "bg-[var(--surface-card-strong)] text-app shadow-sm ring-1 ring-[var(--border-strong)]"
                : "text-app-muted hover:text-app",
            ].join(" ")}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
