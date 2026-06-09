import Link from "next/link";
import { MonexityLogo } from "@/components/monexity-logo";

export default function CheckEmailPage() {
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
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-50 dark:bg-sky-500/10">
              <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden="true">
                <rect x="3" y="6" width="18" height="13" rx="2.5" className="fill-sky-500/15 dark:fill-sky-400/15" />
                <path
                  d="M3 9l9 5.5L21 9"
                  stroke="#0ea5e9"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="dark:stroke-sky-400"
                />
              </svg>
            </div>
          </div>

          <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Revisa tu correo
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Te enviamos un enlace de confirmación. Haz clic en el botón del correo para activar tu cuenta.
          </p>
          <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
            Si no lo ves, revisa tu carpeta de spam.
          </p>

          <div className="mt-6 border-t border-slate-100 pt-6 dark:border-slate-800">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-sky-600 transition-colors duration-[180ms] hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
            >
              Ya confirmé mi cuenta → Iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
