import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MonexityLogo } from "@/components/monexity-logo";
import {
  LEGAL_ENTITY,
  legalContactChannels,
  legalField,
  legalRucDv,
} from "@/lib/legal/entity";

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
    updatedAt: "1 de noviembre de 2026",
    intro:
      "Esta política explica cómo MONEXITY trata los datos personales de sus usuarios y los datos que cada negocio registra en la plataforma, conforme a la Ley 81 de 2019 de Protección de Datos Personales de la República de Panamá y su reglamentación.",
    sections: [
      {
        title: "Responsable del tratamiento y contacto",
        items: [
          `Responsable: ${legalField(LEGAL_ENTITY.legalName)}, a través del establecimiento ${legalField(LEGAL_ENTITY.establishmentName)}, operador del servicio ${LEGAL_ENTITY.tradeName}. RUC: ${legalRucDv()}. Domicilio: ${legalField(LEGAL_ENTITY.address)}, ${LEGAL_ENTITY.country}.`,
          `Canal de contacto para privacidad y soporte: ${legalContactChannels()}.`,
          "Cuando un negocio registra en MONEXITY datos de sus propios clientes o colaboradores, ese negocio decide qué datos ingresa y para qué los usa; MONEXITY los trata por cuenta del negocio para prestarle el servicio.",
        ],
      },
      {
        title: "Datos que tratamos",
        items: [
          "Datos de cuenta: nombre completo, nombre de usuario, correo electrónico, número de teléfono y contraseña. La contraseña se gestiona mediante el servicio de autenticación y no se guarda en texto legible en nuestra base de datos.",
          "Datos del negocio: nombre, logo, datos para facturas (RUC, DV, dirección, correo y teléfono del negocio), métodos de pago configurados y preferencias del panel.",
          "Datos operativos: ventas, abonos y cuotas, gastos y sus comprobantes adjuntos, cotizaciones, productos, servicios, inventario y cierres de período.",
          "Datos de terceros que registra el negocio: clientes (nombre, empresa, correo, teléfono, RUC y DV) y miembros del equipo e invitaciones (correo y rol).",
          "Datos de suscripción y pagos: plan, estado, fechas, montos y referencias de pago. En pagos por Yappy, el nombre y teléfono del remitente que indicas. En pagos con tarjeta, los datos de la tarjeta los ingresas directamente en la página de PagueloFácil y MONEXITY no los recibe ni los almacena; de PagueloFácil solo recibimos el resultado y la referencia del cobro.",
          "Registro de aceptación legal: versiones de los Términos de uso y de esta Política aceptadas, y la fecha y hora de cada aceptación.",
          "Datos técnicos: cookies necesarias para la sesión y para recordar el negocio activo, y preferencias guardadas en tu navegador (tema y vista del panel). MONEXITY no usa herramientas de analítica ni de publicidad.",
        ],
      },
      {
        title: "Finalidades",
        items: [
          "Prestar el servicio: registrar y mostrar la información del negocio, generar resúmenes y documentos PDF que tú decides descargar o compartir.",
          "Autenticar usuarios, mantener la seguridad de las cuentas y separar la información de cada negocio según roles.",
          "Gestionar el equipo: enviar invitaciones por correo y administrar permisos.",
          "Gestionar la suscripción: procesar, verificar y registrar pagos, y avisar sobre su estado.",
          "Brindar soporte y atender solicitudes, y conservar el registro de aceptación de los documentos legales.",
          "Cumplir obligaciones legales, contables y fiscales, y atender reclamos o disputas.",
          "No vendemos datos personales, no los usamos para publicidad y no enviamos comunicaciones de marketing.",
        ],
      },
      {
        title: "Proveedores que tratan datos por cuenta de MONEXITY",
        items: [
          "Supabase: base de datos, autenticación de usuarios y almacenamiento de archivos (logos, comprobantes de gastos y PDFs compartidos).",
          "Vercel: alojamiento y ejecución de la aplicación web.",
          "Resend: envío de correos transaccionales, como invitaciones al equipo y avisos de pago.",
          "PagueloFácil: procesamiento de pagos de la suscripción con tarjeta.",
          "Yappy: cuando pagas tu suscripción por Yappy, el pago se realiza en esa aplicación; MONEXITY solo recibe los datos que reportas para verificarlo.",
          "WhatsApp: solo si nos escribes por ese canal o decides compartir un documento por WhatsApp desde MONEXITY.",
          "Estos proveedores tratan los datos únicamente en la medida necesaria para prestar sus servicios a MONEXITY.",
        ],
      },
      {
        title: "Transferencias internacionales",
        items: [
          "Algunos de los proveedores indicados, como Supabase, Vercel y Resend, y la pasarela de pago PagueloFácil, pueden alojar o procesar datos en servidores ubicados fuera de Panamá.",
          "Estas transferencias se realizan solo para prestar el servicio descrito en esta política y bajo las condiciones de protección de datos de cada proveedor.",
        ],
      },
      {
        title: "Conservación de los datos",
        items: [
          "Datos de cuenta y del negocio: mientras la cuenta o el negocio permanezcan activos en MONEXITY.",
          "Si cancelas la membresía, la información del negocio se conserva para que puedas reactivarlo, hasta que el titular solicite su eliminación.",
          "Registros de pagos y su auditoría: durante el tiempo necesario para cumplir obligaciones contables y fiscales y para atender reclamos; la auditoría de un pago se conserva aunque se elimine la solicitud de pago asociada.",
          "Registro de aceptación legal: mientras exista la cuenta del usuario.",
          "Enlaces de documentos compartidos por WhatsApp: el enlace de acceso vence a los 7 días.",
          "Registro sin confirmar: al registrarte se crean tu cuenta, tu perfil y tu aceptación de los términos (y el negocio, si completas ese paso). Si en 7 días no confirmas tu correo ni inicias sesión, la cuenta y esos datos se eliminan automáticamente. Mientras completas el registro, tu navegador guarda solo un identificador cifrado durante un máximo de 30 minutos.",
        ],
      },
      {
        title: "Tus derechos",
        items: [
          "Acceso: conocer qué datos personales tuyos tratamos y cómo los usamos.",
          "Rectificación: corregir datos inexactos o incompletos. Muchos datos puedes actualizarlos directamente desde tu cuenta.",
          "Cancelación: solicitar la eliminación de tus datos cuando ya no sean necesarios, salvo los que debamos conservar por obligación legal, contable o fiscal.",
          "Oposición: oponerte a un tratamiento concreto de tus datos por motivos legítimos.",
          "Portabilidad: recibir tus datos en un formato estructurado y de uso común.",
        ],
      },
      {
        title: "Cómo ejercer tus derechos",
        items: [
          `Envía tu solicitud por ${legalContactChannels()}.`,
          "Incluye tu nombre, el correo de tu cuenta, el derecho que deseas ejercer y una descripción de tu solicitud.",
          "Antes de responder verificaremos tu identidad, por ejemplo confirmando la solicitud desde el correo registrado en tu cuenta.",
          "Responderemos dentro de los plazos establecidos por la normativa panameña aplicable.",
          "Si eres cliente o colaborador de un negocio que usa MONEXITY, puedes dirigir tu solicitud a ese negocio; MONEXITY le dará el apoyo necesario para atenderla.",
          "Si consideras que no atendimos correctamente tu solicitud, puedes acudir a la Autoridad Nacional de Transparencia y Acceso a la Información (ANTAI).",
        ],
      },
      {
        title: "Seguridad",
        items: [
          "El acceso a la información está separado por negocio y limitado según el rol de cada usuario.",
          "Aplicamos medidas razonables de seguridad, pero ningún sistema conectado a internet puede garantizar seguridad absoluta.",
        ],
      },
      {
        title: "Cambios en esta política",
        items: [
          "Cuando actualicemos esta política publicaremos la nueva versión con su fecha y te pediremos aceptarla al volver a ingresar a MONEXITY.",
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
    updatedAt: "31 de octubre de 2026",
    intro:
      "Este aviso identifica al operador de MONEXITY y aclara el alcance del servicio como herramienta de organización y control de información de negocio.",
    sections: [
      {
        title: "Identificación del operador",
        items: [
          `Nombre comercial: ${LEGAL_ENTITY.tradeName}.`,
          `Titular: ${legalField(LEGAL_ENTITY.legalName)}.`,
          `Establecimiento comercial: ${legalField(LEGAL_ENTITY.establishmentName)}.`,
          `RUC: ${legalRucDv()}.`,
          `Domicilio: ${legalField(LEGAL_ENTITY.address)}, ${LEGAL_ENTITY.country}.`,
          `Correo de soporte: ${legalField(LEGAL_ENTITY.supportEmail)}.`,
          `WhatsApp de soporte: ${LEGAL_ENTITY.whatsappDisplay}.`,
          `Aviso de Operación: ${legalField(LEGAL_ENTITY.operationNoticeNumber)}.`,
        ],
      },
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

type LegalPageProps = {
  params: Promise<{ slug: string }>;
};

// Solo claves propias: evita que slugs como "constructor" resuelvan propiedades heredadas
function getLegalDocument(slug: string): LegalDocument | undefined {
  return Object.hasOwn(LEGAL_DOCUMENTS, slug) ? LEGAL_DOCUMENTS[slug] : undefined;
}

export async function generateMetadata({ params }: LegalPageProps): Promise<Metadata> {
  const { slug } = await params;
  const document = getLegalDocument(slug);

  if (!document) {
    return { title: "Legal" };
  }

  return {
    title: `${document.title} — MONEXITY`,
    description: document.intro,
  };
}

export default async function LegalPage({ params }: LegalPageProps) {
  const { slug } = await params;
  const document = getLegalDocument(slug);

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
