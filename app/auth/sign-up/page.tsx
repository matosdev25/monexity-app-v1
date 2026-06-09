import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { MonexityLogo } from "../../../components/monexity-logo";
import { SignUpForm } from "./sign-up-form";

export default async function SignUpPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex justify-center">
          <Link href="/" aria-label="Ir al inicio">
            <MonexityLogo size="md" />
          </Link>
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white p-8 shadow-[0_2px_24px_rgba(15,23,42,0.07)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_2px_24px_rgba(2,6,23,0.24)]">
          <div className="mb-5">
            <span className="inline-flex items-center rounded-full border border-slate-200/70 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              Crear cuenta
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Empieza con Monexity
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Crea tu cuenta personal. Después podrás crear tu negocio o unirte a uno.
          </p>

          <div className="mt-7">
            <SignUpForm />
          </div>

          <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            ¿Ya tienes cuenta?{" "}
            <Link
              href="/auth/login"
              className="font-medium text-sky-600 transition-colors duration-180 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
            >
              Inicia sesión
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
