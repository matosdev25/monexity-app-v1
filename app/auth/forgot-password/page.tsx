import Link from "next/link";
import { MonexityLogo } from "../../../components/monexity-logo";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
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
              Recuperar contraseña
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Cambia tu contraseña
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Ingresa tu correo y te enviaremos un enlace seguro para crear una nueva contraseña.
          </p>

          <div className="mt-7">
            <ForgotPasswordForm />
          </div>
        </div>
      </div>
    </main>
  );
}
