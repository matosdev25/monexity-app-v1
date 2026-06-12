import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MonexityLogo } from "@/components/monexity-logo";

type LegalSection = {
  title: string;
  items: string[];
};

type LegalDocument = {
  title: string;
  updatedAt: string;
  intro: string;
  sections: LegalSection[];
};

const LEGAL_NOTICE =
  "Este documento es una base informativa y puede requerir revisión legal profesional según las necesidades de tu negocio.";

const LEGAL_DOCUMENTS: Record<string, LegalDocument> = {
  terminos: {
    title: "Términos y Condiciones",
    updatedAt: "12 de junio de 2026",
    intro:
      "Estos términos regulan el acceso y uso de MONEXITY, una plataforma SaaS para organización y control de pequeños negocios en Panamá.",
    sections: [
      {
        title: "Uso de la plataforma",
        items: [
          "MONEXITY permite registrar ventas, gastos, cotizaciones, productos, servicios, inventario, equipo y datos del negocio.",
          "El usuario es responsable de mantener datos correctos, completos y actualizados dentro de su cuenta y empresa.",
          "MONEXITY no reemplaza asesoría contable, fiscal, legal ni financiera profesional.",
        ],
      },
      {
        title: "Cuentas, empresas y permisos",
        items: [
          "Cada usuario debe usar credenciales propias y proteger el acceso a su cuenta.",
          "Los roles dentro de una empresa pueden limitar o permitir acciones según la configuración disponible.",
          "El dueño o administrador de la empresa es responsable de revisar quién tiene acceso a la información del negocio.",
        ],
      },
      {
        title: "Uso permitido y prohibido",
        items: [
          "El usuario debe usar MONEXITY solo para fines lícitos y relacionados con la operación de su negocio.",
          "No está permitido intentar acceder a datos de otras empresas, vulnerar la seguridad del servicio, abusar de la infraestructura o usar la plataforma para actividades ilegales.",
          "MONEXITY puede suspender o limitar cuentas cuando detecte uso indebido, riesgo de seguridad o incumplimiento de estos términos.",
        ],
      },
      {
        title: "Planes, prueba gratis y pagos",
        items: [
          "MONEXITY puede ofrecer una prueba gratis de 7 días y planes de pago mensuales.",
          "Si no existe prueba vigente, suscripción activa o pago aprobado, el acceso operativo puede suspenderse hasta regularizar la cuenta.",
          "Los pagos por Yappy pueden requerir confirmación manual. Mientras el pago esté en revisión, puede mostrarse como pago pendiente de confirmación.",
        ],
      },
      {
        title: "Cambios y disponibilidad",
        items: [
          "MONEXITY puede actualizar funciones, condiciones, precios o disponibilidad del servicio para mejorar la plataforma o cumplir requisitos operativos.",
          "Aunque trabajamos para mantener el servicio disponible, pueden existir interrupciones por mantenimiento, proveedores externos o causas fuera de nuestro control.",
        ],
      },
      {
        title: "Limitación de responsabilidad y contacto",
        items: [
          "MONEXITY no garantiza resultados comerciales, financieros o fiscales derivados del uso de la plataforma.",
          "El usuario debe validar su información antes de usarla para declaraciones, reportes, decisiones importantes o trámites formales.",
          "Para soporte o consultas sobre estos términos, puedes contactar a MONEXITY por los canales publicados en la plataforma.",
        ],
      },
    ],
  },
  privacidad: {
    title: "Política de Privacidad",
    updatedAt: "12 de junio de 2026",
    intro:
      "Esta política explica cómo MONEXITY trata datos personales y datos del negocio conforme a la normativa aplicable en Panamá.",
    sections: [
      {
        title: "Datos que podemos tratar",
        items: [
          "Datos de cuenta, como nombre, correo electrónico, teléfono si aplica, credenciales y datos de perfil.",
          "Datos del negocio, como nombre comercial, ventas, gastos, cotizaciones, productos, servicios, inventario, equipo y preferencias operativas.",
          "Datos necesarios para procesar, registrar o verificar pagos, incluyendo referencias de pago, método usado, estado de pago y datos de confirmación.",
        ],
      },
      {
        title: "Finalidades",
        items: [
          "Usamos la información para operar MONEXITY, autenticar usuarios, mantener seguridad, brindar soporte, facturar, verificar pagos y mejorar la plataforma.",
          "También podemos usar datos técnicos para prevenir fraude, diagnosticar errores, mantener continuidad del servicio y cumplir obligaciones aplicables.",
        ],
      },
      {
        title: "Proveedores y servicios terceros",
        items: [
          "MONEXITY puede apoyarse en servicios terceros como Supabase, proveedores de hosting, correo electrónico, analítica o pasarelas de pago.",
          "Estos proveedores pueden procesar datos únicamente en la medida necesaria para prestar sus servicios a MONEXITY.",
        ],
      },
      {
        title: "Conservación y seguridad",
        items: [
          "Conservamos la información mientras sea necesaria para operar la cuenta, prestar el servicio, atender soporte, cumplir obligaciones o resolver disputas.",
          "Aplicamos medidas razonables de seguridad, pero ningún sistema conectado a internet puede garantizar seguridad absoluta.",
        ],
      },
      {
        title: "Derechos del usuario",
        items: [
          "El usuario puede solicitar acceso, corrección, actualización o eliminación de sus datos cuando corresponda según la normativa aplicable.",
          "Algunas solicitudes pueden requerir verificación de identidad y pueden estar sujetas a obligaciones legales, fiscales, operativas o de seguridad.",
          "Para solicitudes de privacidad, contacta a MONEXITY por los canales publicados en la plataforma.",
        ],
      },
    ],
  },
  cookies: {
    title: "Política de Cookies",
    updatedAt: "12 de junio de 2026",
    intro:
      "Esta política describe el uso de cookies y tecnologías similares en MONEXITY.",
    sections: [
      {
        title: "Cookies necesarias",
        items: [
          "MONEXITY usa cookies necesarias para iniciar sesión, mantener la seguridad, recordar sesiones y permitir funciones esenciales de la plataforma.",
          "Sin estas cookies, algunas áreas como el dashboard, onboarding, facturación o autenticación podrían no funcionar correctamente.",
        ],
      },
      {
        title: "Preferencias y experiencia",
        items: [
          "Podemos usar cookies o almacenamiento local para recordar preferencias de interfaz, sesión activa, empresa seleccionada u opciones necesarias para mejorar la experiencia.",
        ],
      },
      {
        title: "Analítica",
        items: [
          "MONEXITY puede usar analítica propia o de terceros en el futuro para entender uso general de la plataforma y mejorar el producto.",
          "Si se habilitan herramientas no esenciales, se procurará informar al usuario según corresponda.",
        ],
      },
      {
        title: "Gestión desde el navegador",
        items: [
          "Puedes bloquear, eliminar o limitar cookies desde la configuración de tu navegador.",
          "Si deshabilitas cookies necesarias, es posible que no puedas iniciar sesión o usar correctamente MONEXITY.",
        ],
      },
    ],
  },
  pagos: {
    title: "Política de Pagos, Suscripciones y Reembolsos",
    updatedAt: "12 de junio de 2026",
    intro:
      "Esta política resume cómo MONEXITY maneja prueba gratis, planes, pagos, suspensión de acceso y reembolsos.",
    sections: [
      {
        title: "Prueba gratis y planes",
        items: [
          "MONEXITY puede ofrecer una prueba gratis de 7 días para evaluar la plataforma.",
          "Después de la prueba, el usuario debe elegir y pagar un plan mensual disponible para mantener acceso operativo.",
          "Los precios, beneficios y condiciones de cada plan pueden actualizarse y se mostrarán en la plataforma.",
        ],
      },
      {
        title: "Métodos y confirmación de pago",
        items: [
          "MONEXITY puede aceptar pagos por Yappy con revisión manual y otros métodos disponibles según la plataforma.",
          "Cuando un pago por Yappy está en revisión, el estado puede mostrarse como pago pendiente de confirmación.",
          "La cuenta se activa o actualiza después de que el pago sea aprobado correctamente.",
        ],
      },
      {
        title: "Suspensión por falta de pago",
        items: [
          "Si no existe prueba vigente, suscripción activa o pago aprobado, MONEXITY puede pausar el acceso a funciones operativas.",
          "Durante una pausa, el usuario puede conservar acceso a secciones necesarias para revisar el estado de cuenta, cambiar plan, pagar o cerrar sesión.",
        ],
      },
      {
        title: "Reembolsos",
        items: [
          "Los pagos de suscripción generalmente cubren el período contratado y no garantizan reembolso automático.",
          "MONEXITY puede evaluar solicitudes de reembolso caso por caso, considerando errores de cobro, duplicidad de pago, fallas verificables del servicio u otras circunstancias razonables.",
          "Las solicitudes deben realizarse por los canales de soporte publicados en la plataforma e incluir información suficiente para revisar el caso.",
        ],
      },
    ],
  },
  "aviso-legal": {
    title: "Aviso Legal / Descargo de Responsabilidad",
    updatedAt: "12 de junio de 2026",
    intro:
      "Este aviso aclara el alcance de MONEXITY como herramienta de organización y control de información de negocio.",
    sections: [
      {
        title: "Alcance del servicio",
        items: [
          "MONEXITY ayuda a registrar, organizar y visualizar información operativa de pequeños negocios.",
          "La plataforma no garantiza resultados financieros, comerciales, fiscales ni legales.",
        ],
      },
      {
        title: "No sustituye profesionales",
        items: [
          "MONEXITY no sustituye a un contador, asesor fiscal, abogado, auditor ni otro profesional regulado.",
          "El usuario debe consultar profesionales calificados cuando necesite asesoría contable, tributaria, legal o financiera.",
        ],
      },
      {
        title: "Validación de información",
        items: [
          "El usuario es responsable de revisar la información registrada antes de usarla para declaraciones, reportes, cierres, trámites o decisiones importantes.",
          "Los cálculos, reportes o resúmenes generados por MONEXITY dependen de la información ingresada por el usuario.",
        ],
      },
      {
        title: "Servicios terceros",
        items: [
          "Algunas funciones pueden depender de proveedores externos de infraestructura, autenticación, pagos, correo o hosting.",
          "MONEXITY no controla completamente la disponibilidad, tiempos de respuesta o decisiones operativas de esos proveedores.",
        ],
      },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(LEGAL_DOCUMENTS).map((slug) => ({ slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const document = LEGAL_DOCUMENTS[params.slug];

  if (!document) {
    return { title: "Legal" };
  }

  return {
    title: `${document.title} — MONEXITY`,
    description: document.intro,
  };
}

export default function LegalPage({
  params,
}: {
  params: { slug: string };
}) {
  const document = LEGAL_DOCUMENTS[params.slug];

  if (!document) notFound();

  return (
    <main className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto flex w-full max-w-4xl flex-col px-6 py-8 sm:py-10">
        <header className="flex flex-col gap-5 border-b border-slate-200/70 pb-6 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <Link href="/" aria-label="Ir al inicio">
            <MonexityLogo size="sm" label="MONEXITY" />
          </Link>

          <Link
            href="/"
            className="w-fit rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-[background-color,border-color,color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-800 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:hover:text-white"
          >
            Volver al inicio
          </Link>
        </header>

        <article className="py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
            Legal
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-white">
            {document.title}
          </h1>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Última actualización: {document.updatedAt}
          </p>

          <div className="mt-6 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
            {LEGAL_NOTICE}
          </div>

          <p className="mt-8 text-base leading-7 text-slate-600 dark:text-slate-300">
            {document.intro}
          </p>

          <div className="mt-10 space-y-8">
            {document.sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                  {section.title}
                </h2>
                <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="mt-10 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            {LEGAL_NOTICE}
          </div>
        </article>
      </div>
    </main>
  );
}
