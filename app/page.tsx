import Link from "next/link";
import { MonexityLogo } from "@/components/monexity-logo";
import { PricingPlansSection } from "@/components/pricing-plans-section";
import { ThemeToggle } from "@/components/theme-toggle";
import { PLANS as PRODUCT_PLANS } from "@/lib/plans/plans";

export const dynamic = "force-dynamic";

const SIGNUP_HREF = "/auth/sign-up";
const LOGIN_HREF = "/auth/login";
const WHATSAPP_NUMBER = "50761912312";
const WHATSAPP_TEXT = "Hola, quiero más información sobre MONEXITY.";
const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  WHATSAPP_TEXT
)}`;

function IconArrow() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 shrink-0 transition-transform duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true">
      <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSales() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M7 8.5C7 7.12 8.12 6 9.5 6H17C18.66 6 20 7.34 20 9V15C20 16.66 18.66 18 17 18H9.5C8.12 18 7 16.88 7 15.5V8.5Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 8H6C4.9 8 4 8.9 4 10V14C4 15.1 4.9 16 6 16H7" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16" cy="12" r="1.25" fill="currentColor" />
    </svg>
  );
}

function IconExpenses() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M7 4.75V7M12 4.75V7M17 4.75V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M6.5 7H17.5C18.88 7 20 8.12 20 9.5V17C20 18.66 18.66 20 17 20H7C5.34 20 4 18.66 4 17V9.5C4 8.12 5.12 7 6.5 7Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 11.5H16M9.5 15H14.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconQuote() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M8 4H6C4.9 4 4 4.9 4 6V18C4 19.1 4.9 20 6 20H18C19.1 20 20 19.1 20 18V6C20 4.9 19.1 4 18 4H16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 4C8 3.45 8.45 3 9 3H15C15.55 3 16 3.45 16 4V5C16 5.55 15.55 6 15 6H9C8.45 6 8 5.55 8 5V4Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 11H16M8 15H13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconBox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M4 7.5C4 6.67 4.67 6 5.5 6H18.5C19.33 6 20 6.67 20 7.5V9H4V7.5Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 9H20V18.5C20 19.33 19.33 20 18.5 20H5.5C4.67 20 4 19.33 4 18.5V9Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 13H15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconTeam() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4.5 18C5.34 15.94 7.01 15 9 15C10.99 15 12.66 15.94 13.5 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="17" cy="10" r="2.25" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15.25 17.5C15.82 16.31 16.81 15.75 18 15.75C19.19 15.75 20.18 16.31 20.75 17.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconSummary() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M5 19V5M5 19H20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M9 15L12 12L14.5 13.8L19 8.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 18V15M12 18V12M15 18V14M18 18V9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

const PAIN_POINTS = [
  "No sabes exactamente cuánto vendiste.",
  "Todo depende de Excel, libretas o memoria.",
  "Pierdes cotizaciones o pedidos.",
  "No tienes claro cuánto te queda.",
  "Se te olvidan gastos pequeños.",
];

const FEATURES = [
  {
    Icon: IconSales,
    title: "Ventas",
    description: "Registra lo que vendes cada día y mantén un historial claro.",
    color: "text-sky-600 bg-sky-50 dark:text-sky-300 dark:bg-sky-500/10",
  },
  {
    Icon: IconExpenses,
    title: "Gastos",
    description: "Anota compras, pagos y costos para saber en qué se va el dinero.",
    color: "text-violet-600 bg-violet-50 dark:text-violet-300 dark:bg-violet-500/10",
  },
  {
    Icon: IconQuote,
    title: "Cotizaciones",
    description: "Envía propuestas más ordenadas y profesionales a tus clientes.",
    color: "text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10",
  },
  {
    Icon: IconBox,
    title: "Productos o servicios",
    description: "Organiza lo que vendes, tus precios y detalles importantes.",
    color: "text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10",
  },
  {
    Icon: IconTeam,
    title: "Equipo",
    description: "Agrega vendedores o ayudantes para trabajar con más orden.",
    color: "text-rose-600 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/10",
  },
  {
    Icon: IconSummary,
    title: "Resumen del negocio",
    description: "Mira cuánto entra, cuánto sale y cuánto te queda.",
    color: "text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-500/10",
  },
];

const BUSINESS_TYPES = [
  "Barberías",
  "Salones de uñas",
  "Negocios de belleza",
  "Tiendas pequeñas",
  "Revendedores",
  "Food trucks",
  "Freelancers",
  "Servicios profesionales",
  "Emprendedores",
];

const FAQS = [
  {
    q: "¿Necesito saber contabilidad?",
    a: "No. MONEXITY está pensado para dueños de negocio que quieren orden sin aprender términos complicados.",
  },
  {
    q: "¿Puedo usarlo desde el celular?",
    a: "Sí. Funciona desde el navegador de tu celular, sin descargar una app.",
  },
  {
    q: "¿La prueba gratis tiene compromiso?",
    a: "No. Puedes probar MONEXITY gratis por 7 días y decidir después si quieres continuar.",
  },
  {
    q: "¿Puedo pagar por Yappy?",
    a: "Sí. Puedes pagar tu suscripción mensual por Yappy. El pago se revisa y se activa desde MONEXITY.",
  },
  {
    q: "¿Para qué tipo de negocios funciona?",
    a: "Funciona para servicios, tiendas, belleza, comida, freelancers y negocios pequeños que venden y gastan todos los días.",
  },
  {
    q: "¿MONEXITY reemplaza a un contador?",
    a: "No. Te ayuda a tener tus números diarios más claros. Para temas fiscales o contables, siempre conviene apoyarte con un profesional.",
  },
  {
    q: "¿Puedo pedir ayuda por WhatsApp?",
    a: "Sí. Puedes escribirnos por WhatsApp y te orientamos para empezar.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <LandingHeader />
      <main>
        <HeroSection />
        <ProblemSection />
        <SolutionSection />
        <FeaturesSection />
        <AudienceSection />
        <PricingSection />
        <FAQSection />
        <FinalCTASection />
      </main>
      <MobileStickyCTA />
      <LandingFooter />
    </div>
  );
}

function LandingHeader() {
  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white/82 dark:border-slate-800/60 dark:bg-slate-950/82"
      style={{ WebkitBackdropFilter: "blur(20px)", backdropFilter: "blur(20px)" }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 sm:grid sm:grid-cols-[1fr_auto_1fr]">
        <MonexityLogo size="sm" label="MONEXITY" />

        <nav className="hidden items-center gap-6 sm:flex" aria-label="Navegación principal">
          {[
            { label: "Funciones", href: "#funciones" },
            { label: "Planes", href: "#planes" },
            { label: "FAQ", href: "#faq" },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="text-sm text-slate-500 transition-colors duration-180 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:text-slate-400 dark:hover:text-white"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-2">
          <Link
            href={LOGIN_HREF}
            className="hidden rounded-[14px] px-4 py-2 text-sm font-medium text-slate-600 transition-[background-color,color] duration-180 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-95 sm:block dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            Iniciar sesión
          </Link>
          <Link
            href={SIGNUP_HREF}
            className="rounded-[14px] bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-[background-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-95 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Probar gratis
          </Link>
          <ThemeToggle compact />
        </div>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-14 sm:pb-20 sm:pt-20" aria-labelledby="hero-heading">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
        <div className="h-96 w-[46rem] rounded-full bg-sky-100/55 blur-3xl dark:bg-sky-500/7" />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="text-center lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden="true" />
            Para pequeños negocios en Panamá
          </span>

          <h1 id="hero-heading" className="mt-6 text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.55rem] lg:leading-[1.05] dark:text-white">
            Controla tu negocio desde el celular
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-slate-500 lg:mx-0 dark:text-slate-400">
            Registra ventas, gastos, cotizaciones y productos para saber cuánto entra, cuánto sale y cuánto te queda. Sin Excel, sin libretas y sin enredos.
          </p>

          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row lg:justify-start">
            <Link
              href={SIGNUP_HREF}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[18px] bg-slate-900 px-6 text-sm font-semibold text-white transition-[background-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              Probar gratis 7 días
              <IconArrow />
            </Link>
            <a
              href={WHATSAPP_HREF}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center justify-center rounded-[18px] border border-slate-200 bg-white px-6 text-sm font-medium text-slate-700 transition-[background-color,border-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
            >
              Hablar por WhatsApp
            </a>
          </div>

          <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">
            Sin compromiso. Planes desde $3.99/mes. Pago por Yappy disponible.
          </p>
        </div>

        <BusinessMockup />
      </div>
    </section>
  );
}

function BusinessMockup() {
  return (
    <div className="mx-auto w-full max-w-md lg:max-w-none">
      <div className="rounded-[32px] border border-slate-200/70 bg-white p-4 shadow-[0_18px_60px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_24px_70px_rgba(2,6,23,0.40)]">
        <div className="rounded-[26px] border border-slate-200/70 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600 dark:text-sky-400">
                Resumen del negocio
              </p>
              <p className="mt-1 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                Junio
              </p>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              Al día
            </span>
          </div>

          <div className="mt-5 grid gap-3">
            {[
              { label: "Ventas del mes", value: "$ 2,840.00", tone: "text-emerald-600 dark:text-emerald-300" },
              { label: "Gastos", value: "$ 970.00", tone: "text-rose-600 dark:text-rose-300" },
              { label: "Te queda", value: "$ 1,870.00", tone: "text-sky-600 dark:text-sky-300" },
            ].map((item) => (
              <div key={item.label} className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-sm text-slate-500 dark:text-slate-400">{item.label}</p>
                <p className={`mt-1 text-2xl font-bold tracking-tight ${item.tone}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-[22px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Últimas ventas</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Hoy</p>
            </div>
            <div className="space-y-2">
              {[
                ["Corte + barba", "$ 18.00"],
                ["Producto vendido", "$ 12.50"],
                ["Servicio completo", "$ 35.00"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
                  <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProblemSection() {
  return (
    <section className="px-4 py-16 sm:py-20" aria-labelledby="problem-heading">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
            EL PROBLEMA
          </p>
          <h2 id="problem-heading" className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            ¿Todavía manejas tu negocio con libretas, Excel o notas de WhatsApp?
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-500 dark:text-slate-400">
            Cuando las ventas, gastos y cotizaciones están regadas, es difícil saber cómo va realmente tu negocio.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {PAIN_POINTS.map((item, index) => (
            <div
              key={item}
              className={[
                "rounded-[24px] border border-slate-200/70 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900",
                index === PAIN_POINTS.length - 1 ? "sm:col-span-2 sm:w-[calc(50%-0.375rem)] sm:justify-self-center" : "",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-rose-400" aria-hidden="true" />
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{item}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SolutionSection() {
  return (
    <section className="border-y border-slate-200/60 bg-white/55 px-4 py-16 dark:border-slate-800/60 dark:bg-slate-900/35" aria-labelledby="solution-heading">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
          La solución
        </p>
        <h2 id="solution-heading" className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          MONEXITY pone tus números en orden de forma simple.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-500 dark:text-slate-400">
          Registra lo importante de tu negocio desde el celular y revisa tu información en un solo lugar. No necesitas ser contador ni usar sistemas complicados.
        </p>
        <Link
          href={SIGNUP_HREF}
          className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-[16px] bg-slate-900 px-5 text-sm font-semibold text-white transition-[background-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          Empezar gratis
          <IconArrow />
        </Link>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="funciones" className="px-4 py-16 sm:py-20" aria-labelledby="features-heading">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
            Lo que puedes hacer
          </p>
          <h2 id="features-heading" className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Todo lo básico para entender mejor tu negocio.
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ Icon, title, description, color }) => (
            <div key={title} className="rounded-[24px] border border-slate-200/70 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900">
              <div className={["mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl", color].join(" ")}>
                <Icon />
              </div>
              <h3 className="font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AudienceSection() {
  return (
    <section className="px-4 py-16 sm:py-20" aria-labelledby="audience-heading">
      <div className="mx-auto max-w-5xl rounded-[28px] border border-slate-200/70 bg-white p-6 shadow-[0_2px_16px_rgba(15,23,42,0.06)] sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
            Para quién es
          </p>
          <h2 id="audience-heading" className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Hecho para pequeños negocios que quieren orden sin complicarse.
          </h2>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-2.5">
          {BUSINESS_TYPES.map((item) => (
            <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {item}
            </span>
          ))}
        </div>

        <p className="mx-auto mt-7 max-w-2xl text-center text-base leading-relaxed text-slate-500 dark:text-slate-400">
          Si vendes, gastas y necesitas saber mejor cómo va tu negocio, MONEXITY es para ti.
        </p>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="planes" className="px-4 py-16 sm:py-20" aria-labelledby="pricing-heading">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
            Planes
          </p>
          <h2 id="pricing-heading" className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Planes simples para ordenar tu negocio
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-slate-500 dark:text-slate-400">
            Puedes empezar con 7 días gratis y pagar tu suscripción mensual por Yappy.
          </p>
        </div>

        <PricingPlansSection plans={PRODUCT_PLANS} signupHref={SIGNUP_HREF} />
      </div>
    </section>
  );
}

function FAQSection() {
  return (
    <section id="faq" className="px-4 py-16 sm:py-20" aria-labelledby="faq-heading">
      <div className="mx-auto max-w-2xl">
        <div className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
            Preguntas frecuentes
          </p>
          <h2 id="faq-heading" className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Lo básico antes de empezar.
          </h2>
        </div>

        <div className="divide-y divide-slate-200/60 rounded-[28px] border border-slate-200/70 bg-white shadow-[0_2px_16px_rgba(15,23,42,0.05)] dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {FAQS.map(({ q, a }) => (
            <details key={q} className="group px-6 py-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-medium text-slate-900 [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500 dark:text-white">
                {q}
                <IconChevronDown />
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTASection() {
  return (
    <section className="px-4 py-16 sm:py-24" aria-labelledby="cta-heading">
      <div className="mx-auto max-w-2xl text-center">
        <h2 id="cta-heading" className="text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          Deja de adivinar cómo va tu negocio.
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-slate-500 dark:text-slate-400">
          Prueba MONEXITY gratis por 7 días y empieza a ver tus ventas, gastos y ganancias con más claridad.
        </p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
          <Link
            href={SIGNUP_HREF}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[18px] bg-slate-900 px-7 text-sm font-semibold text-white transition-[background-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Probar gratis 7 días
            <IconArrow />
          </Link>
          <a
            href={WHATSAPP_HREF}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 items-center justify-center rounded-[18px] border border-slate-200 bg-white px-6 text-sm font-medium text-slate-700 transition-[background-color,border-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
          >
            Hablar por WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}

function MobileStickyCTA() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/70 bg-white/90 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:hidden dark:border-slate-800/70 dark:bg-slate-950/90">
      <div className="mx-auto grid max-w-md grid-cols-[1fr_auto] gap-2">
        <Link
          href={SIGNUP_HREF}
          className="inline-flex h-11 items-center justify-center rounded-[16px] bg-slate-900 px-4 text-sm font-semibold text-white transition-[background-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          Probar gratis
        </Link>
        <a
          href={WHATSAPP_HREF}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center justify-center rounded-[16px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-[background-color,border-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600"
        >
          WhatsApp
        </a>
      </div>
    </div>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-slate-200/60 dark:border-slate-800/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <MonexityLogo size="sm" label="MONEXITY" />

        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2" aria-label="Footer">
          {[
            { label: "Funciones", href: "#funciones" },
            { label: "Planes", href: "#planes" },
            { label: "FAQ", href: "#faq" },
            { label: "WhatsApp", href: WHATSAPP_HREF },
            { label: "Iniciar sesión", href: LOGIN_HREF },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="text-sm text-slate-400 transition-colors duration-180 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-slate-500 dark:hover:text-slate-300"
            >
              {label}
            </a>
          ))}
        </nav>

        <p className="text-xs text-slate-400 dark:text-slate-600">
          © {new Date().getFullYear()} MONEXITY · Panamá
        </p>
      </div>
    </footer>
  );
}
