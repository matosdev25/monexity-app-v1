interface ButtonSpinnerProps {
  // "current" hereda el color del texto del botón (útil en botones neutros o de color)
  variant?: "primary" | "neutral" | "current";
}

export function ButtonSpinner({ variant = "primary" }: ButtonSpinnerProps) {
  const cls =
    variant === "primary"
      ? "border-white/30 border-t-white dark:border-slate-900/20 dark:border-t-slate-900"
      : variant === "neutral"
        ? "border-slate-300 border-t-slate-600 dark:border-slate-600 dark:border-t-slate-300"
        : "border-current/25 border-t-current";

  return (
    <span
      className={`inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 ${cls}`}
      role="status"
      aria-label="Cargando"
    />
  );
}
