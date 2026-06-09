interface ButtonSpinnerProps {
  variant?: "primary" | "neutral";
}

export function ButtonSpinner({ variant = "primary" }: ButtonSpinnerProps) {
  const cls =
    variant === "primary"
      ? "border-white/30 border-t-white dark:border-slate-900/20 dark:border-t-slate-900"
      : "border-slate-300 border-t-slate-600 dark:border-slate-600 dark:border-t-slate-300";

  return (
    <span
      className={`h-4 w-4 animate-spin rounded-full border-2 ${cls}`}
      role="status"
      aria-label="Cargando"
    />
  );
}
