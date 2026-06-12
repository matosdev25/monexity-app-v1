import Link from "next/link";
import { MonexityLogo } from "../../../components/monexity-logo";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ expired?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const sessionExpiredByInactivity = params.expired === "inactive";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link href="/" aria-label="Ir al inicio">
            <MonexityLogo size="md" />
          </Link>
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white p-8 shadow-[0_2px_24px_rgba(15,23,42,0.07)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_2px_24px_rgba(2,6,23,0.24)]">
          <div className="mb-5">
            <span className="inline-flex items-center rounded-full border border-slate-200/70 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              Iniciar sesión
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Bienvenido de nuevo
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Accede con tu correo o nombre de usuario para continuar.
          </p>

          {sessionExpiredByInactivity && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200">
              Tu sesión expiró por inactividad. Vuelve a iniciar sesión para
              continuar.
            </div>
          )}

          <div className="mt-7">
            <LoginForm />
          </div>
        </div>

        <nav className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs" aria-label="Legal">
          {[
            { label: "Términos", href: "/legal/terminos" },
            { label: "Privacidad", href: "/legal/privacidad" },
            { label: "Cookies", href: "/legal/cookies" },
            { label: "Pagos", href: "/legal/pagos" },
            { label: "Aviso legal", href: "/legal/aviso-legal" },
          ].map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="text-slate-400 transition-colors duration-180 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-slate-500 dark:hover:text-slate-300"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
