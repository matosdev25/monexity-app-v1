import Link from "next/link";
import { MonexityLogo } from "@/components/monexity-logo";

const REASON_MESSAGES: Record<string, string> = {
  link_expired: "El enlace expiró o ya fue utilizado. Los enlaces son válidos por 24 horas.",
  invalid_link: "El enlace de confirmación no es válido.",
  no_session: "No se encontró una sesión activa.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; reason?: string }>;
}) {
  const params = await searchParams;
  const message =
    params.message ??
    REASON_MESSAGES[params.reason ?? ""] ??
    "Ocurrió un error en la autenticación.";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Link href="/" aria-label="Ir al inicio">
            <MonexityLogo size="md" />
          </Link>
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white p-8 text-center shadow-[0_2px_24px_rgba(15,23,42,0.07)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_2px_24px_rgba(2,6,23,0.24)]">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
              <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden="true">
                <circle cx="12" cy="12" r="10" className="fill-red-500/15 dark:fill-red-400/15" />
                <path
                  d="M15 9l-6 6M9 9l6 6"
                  stroke="#ef4444"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  className="dark:stroke-red-400"
                />
              </svg>
            </div>
          </div>

          <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Algo salió mal
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{message}</p>

          <div className="mt-6 space-y-2">
            <Link
              href="/auth/login"
              className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-slate-900 px-5 text-[15px] font-semibold text-white transition-[background-color,transform] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-700 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/auth/sign-up"
              className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-[15px] font-medium text-slate-700 transition-[background-color,border-color] duration-[180ms] hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
            >
              Crear cuenta nueva
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
