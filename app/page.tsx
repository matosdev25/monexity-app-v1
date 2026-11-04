import Link from "next/link";
import { MonexityLogo } from "@/components/monexity-logo";
import { PricingPlansSection } from "@/components/pricing-plans-section";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  BrowserFrame,
  DashboardPreview,
  InsightsPreview,
  MiniPreview,
  PhonePreview,
  QuoteFlowPreview,
  SalesPreview,
  type MiniPreviewKind,
} from "@/components/landing/landing-previews";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { PLANS as PRODUCT_PLANS } from "@/lib/plans/plans";
import { LEGAL_ENTITY } from "@/lib/legal/entity";


const SIGNUP_HREF = "/auth/sign-up";
const LOGIN_HREF = "/auth/login";
const WHATSAPP_NUMBER = LEGAL_ENTITY.whatsappNumber;
const WHATSAPP_TEXT = "Hola, quiero más información sobre MONEXITY.";
const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  WHATSAPP_TEXT
)}`;

function IconArrow() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className="h-4 w-4 transition-transform duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 motion-reduce:transition-none"
      aria-hidden="true"
    >
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

// Vitrinas con previews del producto real (datos de ejemplo)
const SHOWCASES = [
  {
    title: "Vende y cobra sin complicarte.",
    description: "Registra ventas con pago completo o por cuotas y lleva el control de cada abono.",
    label: "Vista previa de nueva venta con tipo de pago en cuotas y su plan de cuotas.",
    preview: <SalesPreview />,
  },
  {
    title: "Entiende qué está pasando en tu negocio.",
    description: "Mira tu balance del mes, cómo te pagan y qué productos se venden más.",
    label: "Vista previa de balance del mes, comparativo mensual, ingresos por método de pago y productos más vendidos.",
    preview: <InsightsPreview />,
  },
  {
    title: "De una cotización a una venta, sin empezar de cero.",
    description: "Convierte una cotización en venta y comparte el comprobante en PDF o por WhatsApp.",
    label: "Vista previa del flujo: cotización aceptada, conversión a venta y comprobante PDF.",
    preview: <QuoteFlowPreview />,
  },
];

const FEATURES: {
  Icon: () => React.JSX.Element;
  title: string;
  description: string;
  color: string;
  preview?: MiniPreviewKind;
}[] = [
  {
    Icon: IconSales,
    title: "Ventas",
    description: "Registra lo que vendes cada día y mantén un historial claro.",
    color: "text-sky-600 bg-sky-50 dark:text-sky-300 dark:bg-sky-500/10",
    preview: "sale",
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
    preview: "quote",
  },
  {
    Icon: IconBox,
    title: "Productos o servicios",
    description: "Organiza lo que vendes, tus precios y detalles importantes.",
    color: "text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10",
    preview: "inventory",
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
    preview: "month",
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
      <ScrollReveal />
    </div>
  );
}

function LandingHeader() {
  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white/82 dark:border-slate-800/60 dark:bg-slate-950/82"
      style={{ WebkitBackdropFilter: "blur(20px)", backdropFilter: "blur(20px)" }}
    >
      <div className="mx-auto flex h-14 max-w-6xl min-w-0 items-center justify-between px-4 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:px-6">
        <MonexityLogo size="sm" label="MONEXITY" className="shrink-0" />

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

        <div className="flex min-w-0 items-center justify-end gap-2">
          <Link
            href={LOGIN_HREF}
            className="rounded-[14px] px-2.5 py-2 text-sm font-medium text-slate-600 transition-[background-color,color] duration-180 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-95 sm:px-4 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <span className="sm:hidden">Entrar</span>
            <span className="hidden sm:inline">Iniciar sesión</span>
          </Link>
          <Link
            href={SIGNUP_HREF}
            className="hidden rounded-[14px] bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-[background-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-95 sm:inline-flex dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Probar gratis
          </Link>
          <div className="hidden sm:block">
            <ThemeToggle compact />
          </div>
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

      <div className="relative mx-auto grid max-w-6xl gap-12">
        <div className="mx-auto max-w-3xl text-center">
          <span className="animate-mx-fade-up inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-center text-xs font-semibold uppercase leading-5 tracking-[0.14em] text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden="true" />
            Para pequeños negocios en Panamá
          </span>

          <h1 id="hero-heading" className="animate-mx-fade-up mt-6 text-balance [animation-delay:60ms] text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.55rem] lg:leading-[1.05] dark:text-white">
            Controla tu negocio desde el celular
          </h1>

          <p className="animate-mx-fade-up mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-slate-500 [animation-delay:120ms] dark:text-slate-400">
            Registra ventas, gastos, cotizaciones y productos para saber cuánto entra, cuánto sale y cuánto te queda. Sin Excel, sin libretas y sin enredos.
          </p>

          <div className="animate-mx-fade-up mt-8 flex flex-col items-stretch justify-center gap-3 [animation-delay:180ms] sm:flex-row">
            <Link
              href={SIGNUP_HREF}
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-[18px] bg-slate-900 px-6 text-sm font-semibold text-white transition-[background-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
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

          <p className="animate-mx-fade-up mt-4 text-sm text-slate-400 [animation-delay:220ms] dark:text-slate-500">
            Sin compromiso. Planes desde $3.99/mes. Pago por Yappy disponible.
          </p>
        </div>

        <div
          role="img"
          aria-label="Vista previa del dashboard de Monexity con datos de ejemplo: cobrado hoy, gastos, balance del mes y últimos movimientos."
          className="animate-mx-fade-up mx-auto w-full max-w-5xl [animation-delay:280ms]"
        >
          <BrowserFrame>
            <DashboardPreview />
          </BrowserFrame>
          <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">Datos de ejemplo</p>
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <section className="px-4 py-16 sm:py-20" aria-labelledby="problem-heading">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div data-reveal="">
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
              data-reveal=""
              data-reveal-step={Math.min(index + 1, 5)}
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
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
      <div data-reveal="" className="mx-auto max-w-3xl text-center lg:text-left">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
          La solución
        </p>
        <h2 id="solution-heading" className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          MONEXITY pone tus números en orden de forma simple.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-500 lg:mx-0 dark:text-slate-400">
          Registra lo importante de tu negocio desde el celular y revisa tu información en un solo lugar. No necesitas ser contador ni usar sistemas complicados.
        </p>
        <Link
          href={SIGNUP_HREF}
          className="group mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-[16px] bg-slate-900 px-5 text-sm font-semibold text-white transition-[background-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          Empezar gratis
          <IconArrow />
        </Link>
      </div>

      <div
        data-reveal="scale"
        data-reveal-step="2"
        role="img"
        aria-label="Vista previa de Monexity en el celular: resumen del día, accesos a nueva venta y nuevo gasto, y últimos movimientos."
      >
        <PhonePreview />
      </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="funciones" className="px-4 py-16 sm:py-20" aria-labelledby="features-heading">
      <div className="mx-auto max-w-6xl">
        <div data-reveal="" className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
            Lo que puedes hacer
          </p>
          <h2 id="features-heading" className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Todo lo básico para entender mejor tu negocio.
          </h2>
        </div>

        <div className="mb-12 space-y-6">
          {SHOWCASES.map(({ title, description, preview, label }) => (
            <div
              key={title}
              data-reveal="scale"
              className="grid items-center gap-6 rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_2px_16px_rgba(15,23,42,0.05)] sm:p-7 lg:grid-cols-[0.75fr_1.25fr] dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <h3 className="text-balance text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h3>
                <p className="mt-2 text-base leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
              </div>
              <div role="img" aria-label={label} className="min-w-0 rounded-[22px] bg-slate-50 p-3 sm:p-4 dark:bg-slate-950/60">
                {preview}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ Icon, title, description, color, preview }, index) => (
            <div
              key={title}
              data-reveal=""
              data-reveal-step={index % 3}
              className="flex flex-col rounded-[24px] border border-slate-200/70 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900"
            >
              <div className={["mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl", color].join(" ")}>
                <Icon />
              </div>
              <h3 className="font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
              {preview ? (
                <div aria-hidden="true" className="mt-4">
                  <MiniPreview kind={preview} />
                </div>
              ) : null}
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
      <div data-reveal="scale" className="mx-auto max-w-5xl rounded-[28px] border border-slate-200/70 bg-white p-6 shadow-[0_2px_16px_rgba(15,23,42,0.06)] sm:p-8 dark:border-slate-800 dark:bg-slate-900">
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
        <div data-reveal="" className="mb-10 text-center">
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
        <div data-reveal="" className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
            Preguntas frecuentes
          </p>
          <h2 id="faq-heading" className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Lo básico antes de empezar.
          </h2>
        </div>

        <div data-reveal="" data-reveal-step="1" className="divide-y divide-slate-200/60 rounded-[28px] border border-slate-200/70 bg-white shadow-[0_2px_16px_rgba(15,23,42,0.05)] dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {FAQS.map(({ q, a }) => (
            <details key={q} className="mx-faq group px-6 py-0">
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
      <div data-reveal="" className="mx-auto max-w-2xl text-center">
        <h2 id="cta-heading" className="text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          Deja de adivinar cómo va tu negocio.
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-slate-500 dark:text-slate-400">
          Prueba MONEXITY gratis por 7 días y empieza a ver tus ventas, gastos y ganancias con más claridad.
        </p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
          <Link
            href={SIGNUP_HREF}
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-[18px] bg-slate-900 px-7 text-sm font-semibold text-white transition-[background-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
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
      <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
        <Link
          href={SIGNUP_HREF}
          className="inline-flex h-11 min-w-0 items-center justify-center rounded-[16px] bg-slate-900 px-3 text-sm font-semibold text-white transition-[background-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          Probar gratis
        </Link>
        <a
          href={WHATSAPP_HREF}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 min-w-0 items-center justify-center rounded-[16px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-[background-color,border-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600"
        >
          WhatsApp
        </a>
      </div>
    </div>
  );
}

type FooterLink = { label: string; href: string; external?: boolean };

// Columnas del footer: solo rutas, anclas y contactos existentes
const FOOTER_COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Producto",
    links: [
      { label: "Funciones", href: "#funciones" },
      { label: "Planes", href: "#planes" },
      { label: "Prueba gratis", href: SIGNUP_HREF },
      { label: "Iniciar sesión", href: LOGIN_HREF },
    ],
  },
  {
    title: "Soporte",
    links: [
      { label: "Preguntas frecuentes", href: "#faq" },
      { label: "WhatsApp", href: WHATSAPP_HREF, external: true },
      ...(LEGAL_ENTITY.supportEmail
        ? [{ label: LEGAL_ENTITY.supportEmail, href: `mailto:${LEGAL_ENTITY.supportEmail}` }]
        : []),
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Términos", href: "/legal/terminos" },
      { label: "Privacidad", href: "/legal/privacidad" },
      { label: "Cookies", href: "/legal/cookies" },
      { label: "Pagos y reembolsos", href: "/legal/pagos" },
      { label: "Aviso legal", href: "/legal/aviso-legal" },
    ],
  },
];

const footerLinkClass =
  "inline-flex min-h-8 max-w-full items-center rounded-md text-sm [overflow-wrap:anywhere] text-slate-500 transition-colors duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-slate-900 active:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 motion-reduce:transition-none dark:text-slate-400 dark:hover:text-white dark:active:text-sky-300 dark:focus-visible:ring-offset-slate-950";

function LandingFooter() {
  return (
    <footer className="border-t border-slate-200/70 bg-white/60 dark:border-slate-800/60 dark:bg-slate-950/40">
      <div className="mx-auto max-w-6xl px-6 pb-10 pt-14 sm:pt-16">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[1.3fr_repeat(3,minmax(0,1fr))] md:gap-8">
          {/* Marca */}
          <div className="col-span-2 max-w-xs md:col-span-1">
            <MonexityLogo size="md" label="MONEXITY" />
            <p className="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Ventas, gastos, cotizaciones e inventario de tu negocio en un solo lugar.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <ThemeToggle compact />
              <span className="text-xs text-slate-400 dark:text-slate-500">Hecho en Panamá</span>
            </div>
          </div>

          {/* Columnas */}
          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title} className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{column.title}</p>
              <ul className="mt-3 space-y-1">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("/") ? (
                      <Link href={link.href} className={footerLinkClass}>
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className={footerLinkClass}
                        {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
                      >
                        {link.label}
                        {link.external ? <span className="sr-only"> (se abre en una pestaña nueva)</span> : null}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Los datos del operador viven en /legal/aviso-legal, no en el footer */}
        <div className="mt-12 border-t border-slate-200/70 pt-6 dark:border-slate-800/60">
          <p className="text-xs leading-5 text-slate-400 dark:text-slate-500">
            © {new Date().getFullYear()} MONEXITY · Panamá
          </p>
        </div>
      </div>
    </footer>
  );
}
