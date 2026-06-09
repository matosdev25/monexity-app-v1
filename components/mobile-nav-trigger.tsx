"use client";

export function MobileNavTrigger() {
  return (
    <button
      type="button"
      aria-label="Abrir menú de navegación"
      onClick={() => window.dispatchEvent(new Event("mx-open-nav"))}
      className="flex h-9 w-9 items-center justify-center rounded-[18px] border border-app bg-app-soft text-app-muted transition-[background-color,border-color,color] duration-[180ms] hover:border-slate-300 hover:text-app active:scale-95 dark:hover:border-slate-600 dark:hover:text-slate-100"
    >
      <svg
        viewBox="0 0 18 18"
        fill="none"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path
          d="M3 5h12M3 9h12M3 13h8"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
