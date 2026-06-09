"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

type Props = { compact?: boolean };

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeToggle({ compact = false }: Props) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );

  if (!mounted) {
    if (compact) {
      return <div className="h-8 w-8 rounded-full border border-slate-200/80 bg-slate-100 dark:border-white/10 dark:bg-slate-800" />;
    }
    return (
      <div className="flex h-11 w-[78px] items-center rounded-full border border-slate-200/80 bg-white/80 px-1 shadow-[0_8px_24px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
        <div className="h-9 w-9 rounded-full bg-white dark:bg-slate-950" />
      </div>
    );
  }

  const isDark = resolvedTheme === "dark";

  function toggle() {
    setTheme(isDark ? "light" : "dark");
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/80 bg-white/80 text-slate-500 transition-[background-color,color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 active:scale-95 motion-reduce:transition-none dark:border-white/10 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      title={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      className="group relative flex h-11 w-[78px] items-center rounded-full border border-slate-200/80 bg-white/80 px-1 shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-[background-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.01] hover:bg-white motion-reduce:transition-none dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[0_8px_24px_rgba(0,0,0,0.18)] dark:hover:bg-white/[0.08]"
    >
      <span
        className={`absolute top-1 h-9 w-9 rounded-full transition-all duration-300 motion-reduce:transition-none ${
          isDark
            ? "translate-x-0 bg-slate-950 shadow-[0_6px_18px_rgba(0,0,0,0.32)]"
            : "translate-x-[34px] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.14)]"
        }`}
      />
      <span className="relative z-10 flex w-full items-center justify-between px-1">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-180 ${
            isDark ? "text-white" : "text-slate-400"
          }`}
        >
          <SunIcon />
        </span>
        <span
          className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-180 ${
            isDark ? "text-slate-500" : "text-slate-950"
          }`}
        >
          <MoonIcon />
        </span>
      </span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
      <path d="M12 2a.75.75 0 0 1 .75.75V4a.75.75 0 0 1-1.5 0V2.75A.75.75 0 0 1 12 2Zm0 18a.75.75 0 0 1 .75.75V22a.75.75 0 0 1-1.5 0v-1.25A.75.75 0 0 1 12 20Zm10-8a.75.75 0 0 1-.75.75H20a.75.75 0 0 1 0-1.5h1.25A.75.75 0 0 1 22 12ZM4 12a.75.75 0 0 1-.75.75H2a.75.75 0 0 1 0-1.5h1.25A.75.75 0 0 1 4 12Zm14.364-6.364a.75.75 0 0 1 1.06 0l.884.884a.75.75 0 1 1-1.06 1.06l-.884-.883a.75.75 0 0 1 0-1.061Zm-12.728 0a.75.75 0 0 1 0 1.06l-.884.884a.75.75 0 1 1-1.06-1.06l.883-.884a.75.75 0 0 1 1.061 0Zm13.612 12.728a.75.75 0 0 1 1.06 1.06l-.883.884a.75.75 0 1 1-1.06-1.06l.883-.884Zm-14.496 0 .884.884a.75.75 0 1 1-1.06 1.06l-.884-.883a.75.75 0 0 1 1.06-1.061Z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M21.752 15.002A9 9 0 0 1 8.998 2.248a.75.75 0 0 0-.813-.996A10.5 10.5 0 1 0 22.748 15.815a.75.75 0 0 0-.996-.813Z" />
    </svg>
  );
}
