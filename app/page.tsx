import Link from "next/link";
import { MonexityLogo } from "@/components/monexity-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { WaitlistForm } from "@/components/waitlist-form";

// Fuerza renderizado dinámico para que WAITLIST_MODE se lea por request
export const dynamic = "force-dynamic";

// ── Waitlist mode flag ────────────────────────────────────────────────────────
// Activar: WAITLIST_MODE=true en .env.local | Desactivar: eliminar o =false
const WL = process.env.WAITLIST_MODE === "true";
const SIGNUP_HREF = WL ? "#waitlist" : "/auth/sign-up";
const LOGIN_HREF = WL ? "#waitlist" : "/auth/login";

// ── Icons ─────────────────────────────────────────────────────────────────────

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

function IconClosure() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3V6M16 3V6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M4 10H20" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 15L11 17L15.5 12.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
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

function IconBusiness() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M5 19V8.5C5 7.67 5.67 7 6.5 7H10V5.5C10 4.67 10.67 4 11.5 4H17.5C18.33 4 19 4.67 19 5.5V19" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 19H20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 11H8.01M8 14.5H8.01M13 8.5H13.01M16 8.5H16.01M13 12H13.01M16 12H16.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function IconInventory() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M4 7.5C4 6.67 4.67 6 5.5 6H18.5C19.33 6 20 6.67 20 7.5V9H4V7.5Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 9H20V18.5C20 19.33 19.33 20 18.5 20H5.5C4.67 20 4 19.33 4 18.5V9Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 13H15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 20C6.5 17.1 9.04 16 12 16C14.96 16 17.5 17.1 18.5 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true">
      <path d="M3 8.5L6 11.5L13 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconMinus() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" aria-hidden="true">
      <path d="M4 8H12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

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

// ── Data ──────────────────────────────────────────────────────────────────────

const TRUST_ITEMS = [
  "Sin tarjeta de crédito",
  "7 días gratis",
  "Pago con Yappy (Próximamente)",
  "Cancela cuando quieras",
  "Datos seguros",
];

const STEPS = [
  {
    number: "01",
    Icon: IconUser,
    color: "text-sky-600 bg-sky-50 dark:text-sky-300 dark:bg-sky-500/10",
    title: "Crea tu cuenta en 2 minutos",
    description:
      "Sin tarjeta, sin configuración complicada. Solo tu email y el nombre de tu negocio.",
  },
  {
    number: "02",
    Icon: IconSales,
    color: "text-violet-600 bg-violet-50 dark:text-violet-300 dark:bg-violet-500/10",
    title: "Registra ventas y gastos",
    description:
      "Desde el celular, al instante. Efectivo, Yappy (Próximamente), tarjeta o transferencia — como cobra Panamá.",
  },
  {
    number: "03",
    Icon: IconClosure,
    color: "text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10",
    title: "Cierra el mes y conoce tus números",
    description:
      "Con un clic ves cuánto vendiste, cuánto gastaste y cuánto te quedó. Sin calculadora.",
  },
];

const FEATURES = [
  {
    Icon: IconSales,
    title: "Ventas",
    description:
      "Registra cada venta en segundos. Efectivo, tarjeta, Yappy (Próximamente) o transferencia — como funciona en Panamá.",
    color: "text-sky-600 bg-sky-50 dark:text-sky-300 dark:bg-sky-500/10",
  },
  {
    Icon: IconExpenses,
    title: "Gastos",
    description:
      "Control de gastos por categoría: inventario, transporte, planilla, alquiler. Con estado y proveedor.",
    color: "text-violet-600 bg-violet-50 dark:text-violet-300 dark:bg-violet-500/10",
  },
  {
    Icon: IconClosure,
    title: "Cierre del período",
    description:
      "Resumen financiero completo al cerrar el mes. Lo que vendiste, lo que gastaste y cuánto te quedó.",
    color: "text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10",
  },
  {
    Icon: IconInventory,
    title: "Inventario",
    description:
      "Productos, stock y movimientos. Sabe cuándo se te acaba algo antes de que el cliente te lo diga.",
    color: "text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10",
  },
  {
    Icon: IconTeam,
    title: "Equipo y roles",
    description:
      "Dueño, administrador, vendedor. Cada quien ve y hace lo que le corresponde, nada más.",
    color: "text-rose-600 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/10",
  },
  {
    Icon: IconBusiness,
    title: "Tu negocio",
    description:
      "Configura tu negocio: nombre, logo, métodos de pago aceptados y todo lo que lo identifica.",
    color: "text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-500/10",
  },
];

const PLANS = [
  {
    id: "emprende",
    name: "Emprende",
    tagline: "Para servicios sin inventario",
    price: "$ 3.99",
    annual: "$ 39.99/año",
    savings: "Ahorra $ 7.89",
    highlighted: false,
    features: [
      { label: "Ventas y gastos ilimitados", included: true },
      { label: "Cierre del período", included: true },
      { label: "1 usuario", included: true },
      { label: "Descarga y comparte facturas en PDF.", included: true },
      { label: "Inventario de productos", included: false },
      { label: "Equipo con múltiples usuarios", included: false },
    ],
  },
  {
    id: "control",
    name: "Control",
    tagline: "Para negocios con productos",
    price: "$ 8.99",
    annual: "$ 89.99/año",
    savings: "Ahorra $ 17.89",
    highlighted: true,
    features: [
      { label: "Ventas y gastos ilimitados", included: true },
      { label: "Cierre del período", included: true },
      { label: "1 usuario", included: true },
      { label: "Descarga y comparte facturas en PDF.", included: true },
      { label: "Inventario de productos", included: true },
      { label: "Equipo con múltiples usuarios", included: false },
    ],
  },
  {
    id: "equipo",
    name: "Equipo",
    tagline: "Para negocios con vendedores",
    price: "$ 14.99",
    annual: "$ 149.99/año",
    savings: "Ahorra $ 29.89",
    highlighted: false,
    features: [
      { label: "Ventas y gastos ilimitados", included: true },
      { label: "Cierre del período", included: true },
      { label: "Usuarios ilimitados", included: true },
      { label: "Descarga y comparte facturas en PDF.", included: true },
      { label: "Inventario de productos", included: true },
      { label: "Roles: dueño, administrador, vendedor", included: true },
    ],
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Antes cerraba el mes en una planilla que siempre me daba diferente. Ahora lo hago en 5 minutos desde el teléfono.",
    name: "Pedro M.",
    business: "Tienda de ropa · Ciudad de Panamá",
    initial: "P",
    color: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  },
  {
    quote:
      "Lo que más me convenció fue que se podrá pagar con Yappy (Próximamente). Sin tarjeta, sin complicaciones. Y funciona exactamente como lo necesito.",
    name: "Ana R.",
    business: "Restaurante familiar · La Chorrera",
    initial: "A",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  },
  {
    quote:
      "Tengo tres vendedores y cada uno registra sus ventas. Yo veo todo desde mi teléfono sin tener que preguntar nada.",
    name: "Carlos S.",
    business: "Distribuidora · Chitré",
    initial: "C",
    color: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  },
];

const FAQS = [
  {
    q: "¿Necesito tarjeta de crédito para empezar?",
    a: "No. Los 7 días de prueba son completamente gratis y no requieren ningún dato de pago. Solo creas tu cuenta y empiezas.",
  },
  {
    q: "¿Cómo pago cuando termine el período de prueba?",
    a: "Yappy (Próximamente) será una opción de pago. Por ahora verás las opciones disponibles dentro de la app.",
  },
  {
    q: "¿Puedo usar Monexity desde el celular?",
    a: "Sí, está diseñado mobile first. Funciona desde el navegador de tu celular sin necesidad de descargar ninguna aplicación.",
  },
  {
    q: "¿Qué pasa si tengo más de un negocio?",
    a: "Puedes crear y manejar múltiples negocios desde una sola cuenta. Cada negocio es completamente independiente con sus propios datos.",
  },
  {
    q: "¿Puedo cambiar de plan después?",
    a: "Sí. Puedes subir o bajar de plan cuando quieras. El cambio aplica al siguiente período de facturación.",
  },
  {
    q: "¿Mis datos están seguros?",
    a: "Sí. Los datos se almacenan con cifrado y control de acceso individual por usuario y negocio. Nadie puede ver tu información sin que tú lo autorices.",
  },
];

// ── Landing ───────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <LandingHeader />
      <main>
        <HeroSection />
        <TrustStripSection />
        <HowItWorksSection />
        <FeaturesSection />
        <PricingSection />
        <TestimonialsSection />
        <FAQSection />
        <PersonalSection />
        {WL && <WaitlistSection />}
        <AboutSection />
        <ContactSection />
        <FinalCTASection />
      </main>
      <LandingFooter />
    </div>
  );
}

// ── Waitlist ──────────────────────────────────────────────────────────────────

function WaitlistSection() {
  return (
    <section
      id="waitlist"
      className="border-t border-slate-200/60 px-4 py-20 sm:py-28 dark:border-slate-800/60"
      aria-labelledby="waitlist-heading"
    >
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-sm font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M8 1.5a.75.75 0 0 1 .692.46l1.261 2.927 3.155.461a.75.75 0 0 1 .416 1.279l-2.284 2.226.539 3.143a.75.75 0 0 1-1.088.79L8 10.933l-2.691 1.853a.75.75 0 0 1-1.088-.79l.539-3.143L2.476 6.627a.75.75 0 0 1 .416-1.279l3.155-.461L7.308 1.96A.75.75 0 0 1 8 1.5Z" />
            </svg>
            25% de descuento al lanzamiento
          </span>
        </div>

        <div className="text-center">
          <h2
            id="waitlist-heading"
            className="text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white"
          >
            Sé de los primeros
            <br />
            en usar Monexity.
          </h2>
          <p className="mx-auto mt-4 max-w-sm text-slate-500 dark:text-slate-400">
            Únete a la lista de espera y recibe un <strong className="font-semibold text-slate-700 dark:text-slate-300">25% de descuento</strong> en cualquier plan cuando abramos acceso.
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_2px_24px_rgba(15,23,42,0.07)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_2px_24px_rgba(2,6,23,0.24)]">
          <WaitlistForm />
        </div>
      </div>
    </section>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function LandingHeader() {
  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white/80 dark:border-slate-800/60 dark:bg-slate-950/80"
      style={{ WebkitBackdropFilter: "blur(20px)", backdropFilter: "blur(20px)" }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 sm:grid sm:grid-cols-[1fr_auto_1fr]">
        <MonexityLogo size="sm" />

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
          {!WL && (
            <Link
              href={LOGIN_HREF}
              className="hidden rounded-[14px] px-4 py-2 text-sm font-medium text-slate-600 transition-[background-color,color] duration-180 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 active:scale-95 sm:block dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              Iniciar sesión
            </Link>
          )}
          <Link
            href={SIGNUP_HREF}
            className="rounded-[14px] bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-[background-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-95 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            {WL ? "Unirse a la lista" : "Empezar gratis"}
          </Link>
          <ThemeToggle compact />
        </div>
      </div>
    </header>
  );
}

// ── 1. Hero ───────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section
      className="relative overflow-hidden px-4 pb-16 pt-20 text-center sm:pb-20 sm:pt-28"
      aria-labelledby="hero-heading"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 flex justify-center"
      >
        <div className="h-120 w-225 rounded-full bg-sky-100/40 blur-3xl dark:bg-sky-500/5" />
      </div>

      <div className="relative mx-auto max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden="true" />
          Monexity · Negocios
        </span>

        <h1
          id="hero-heading"
          className="mt-6 text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1] dark:text-white"
        >
          Controla tus ventas, gastos{" "}
          <br className="hidden sm:block" />
          y cierre en un solo lugar.
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-balance text-lg leading-relaxed text-slate-500 dark:text-slate-400">
          Para pequeños negocios en Panamá. Sin planillas, sin cálculos manuales, sin perder el control de tu dinero.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={SIGNUP_HREF}
            className="inline-flex h-12 items-center gap-2 rounded-[18px] bg-slate-900 px-6 text-sm font-semibold text-white transition-[background-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            {WL ? "Unirme a la lista — 25% off" : "Empezar gratis — 7 días"}
            <IconArrow />
          </Link>
          <a
            href={WL ? "#waitlist" : "#planes"}
            className="inline-flex h-12 items-center rounded-[18px] border border-slate-200 bg-white px-6 text-sm font-medium text-slate-700 transition-[background-color,border-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
          >
            {WL ? "Ver beneficios" : "Ver planes"}
          </a>
        </div>
      </div>
    </section>
  );
}

// ── 2. Trust strip ────────────────────────────────────────────────────────────

function TrustStripSection() {
  return (
    <div className="border-y border-slate-200/60 bg-white/60 dark:border-slate-800/60 dark:bg-slate-900/40">
      <div className="mx-auto max-w-6xl overflow-x-auto px-4">
        <ul className="flex min-w-max items-center justify-center gap-0 sm:min-w-0">
          {TRUST_ITEMS.map((item, i) => (
            <li
              key={item}
              className={[
                "flex items-center gap-2 px-5 py-3.5 text-sm text-slate-500 dark:text-slate-400",
                i < TRUST_ITEMS.length - 1
                  ? "border-r border-slate-200/60 dark:border-slate-700/60"
                  : "",
              ].join(" ")}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"
                aria-hidden="true"
              />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── 3. Cómo funciona ──────────────────────────────────────────────────────────

function HowItWorksSection() {
  return (
    <section
      className="px-4 py-20 sm:py-24"
      aria-labelledby="how-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
            Cómo funciona
          </p>
          <h2
            id="how-heading"
            className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white"
          >
            En tres pasos tienes{" "}
            <br className="hidden sm:block" />
            tu negocio bajo control.
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map(({ number, Icon, color, title, description }) => (
            <div
              key={number}
              className="relative rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900"
            >
              <span className="absolute right-5 top-5 font-mono text-3xl font-bold text-slate-100 dark:text-slate-800">
                {number}
              </span>
              <div
                className={[
                  "mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl",
                  color,
                ].join(" ")}
              >
                <Icon />
              </div>
              <h3 className="font-semibold tracking-tight text-slate-900 dark:text-white">
                {title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── 4. Funcionalidades ────────────────────────────────────────────────────────

function FeaturesSection() {
  return (
    <section
      id="funciones"
      className="px-4 py-20 sm:py-24"
      aria-labelledby="features-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
            Funcionalidades
          </p>
          <h2
            id="features-heading"
            className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white"
          >
            Todo lo que necesita{" "}
            <br className="hidden sm:block" />
            tu negocio hoy.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-slate-500 dark:text-slate-400">
            Sin módulos que no usas. Sin configuraciones complejas. Solo lo esencial, funcionando desde el día uno.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ Icon, title, description, color }) => (
            <div
              key={title}
              className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.05)] transition-[border-color,box-shadow,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_6px_24px_rgba(15,23,42,0.09)] motion-reduce:transition-none dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
            >
              <div
                className={[
                  "mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl",
                  color,
                ].join(" ")}
              >
                <Icon />
              </div>
              <h3 className="font-semibold tracking-tight text-slate-900 dark:text-white">
                {title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── 5. Pricing ────────────────────────────────────────────────────────────────

function PricingSection() {
  return (
    <section
      id="planes"
      className="px-4 py-20 sm:py-24"
      aria-labelledby="pricing-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
            Planes
          </p>
          <h2
            id="pricing-heading"
            className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white"
          >
            Un precio justo para{" "}
            <br className="hidden sm:block" />
            cada tipo de negocio.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-slate-500 dark:text-slate-400">
            Prueba Monexity gratis por 7 días. Al finalizar, podrás continuar pagando tu plan mensual o anual.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={[
                "relative flex flex-col rounded-[28px] p-6",
                plan.highlighted
                  ? "border-2 border-sky-500 bg-white shadow-[0_8px_40px_rgba(14,165,233,0.16)] dark:border-sky-400 dark:bg-slate-900"
                  : "border border-slate-200/80 bg-white shadow-[0_2px_16px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900",
              ].join(" ")}
            >
              {plan.highlighted && (
                <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
                  <span className="rounded-full bg-sky-500 px-4 py-1 text-xs font-semibold text-white shadow-sm dark:bg-sky-400 dark:text-slate-900">
                    Más popular
                  </span>
                </div>
              )}

              <div>
                <p className="font-semibold tracking-tight text-slate-900 dark:text-white">
                  {plan.name}
                </p>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  {plan.tagline}
                </p>
                <div className="mt-5 flex items-end gap-1">
                  <span className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {plan.price}
                  </span>
                  <span className="mb-1 text-sm text-slate-400">/mes</span>
                </div>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  {plan.annual} ·{" "}
                  <span className="text-emerald-600 dark:text-emerald-400">{plan.savings}</span>{" "}
                  al pagar anual
                </p>
              </div>

              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map(({ label, included }) => (
                  <li key={label} className="flex items-start gap-2.5">
                    {included ? <IconCheck /> : <IconMinus />}
                    <span
                      className={[
                        "text-sm",
                        included
                          ? "text-slate-700 dark:text-slate-300"
                          : "text-slate-300 dark:text-slate-600",
                      ].join(" ")}
                    >
                      {label}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={SIGNUP_HREF}
                className={[
                  "mt-8 inline-flex h-11 w-full items-center justify-center rounded-[18px] text-sm font-semibold transition-[background-color,border-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-[0.98]",
                  plan.highlighted
                    ? "bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400"
                    : "border border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:border-slate-600",
                ].join(" ")}
              >
                {WL ? "Reservar mi lugar →" : "Empezar gratis"}
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-slate-400 dark:text-slate-500">
          ¿No sabes cuál elegir? Empieza con{" "}
          <span className="font-medium text-slate-600 dark:text-slate-300">Emprende</span>{" "}
          y cambia cuando lo necesites.
        </p>
      </div>
    </section>
  );
}

// ── 6. Testimonios ────────────────────────────────────────────────────────────

function TestimonialsSection() {
  return (
    <section
      className="px-4 py-20 sm:py-24"
      aria-labelledby="testimonials-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
            Testimonios
          </p>
          <h2
            id="testimonials-heading"
            className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white"
          >
            Lo que dicen los primeros{" "}
            <br className="hidden sm:block" />
            negocios en usarlo.
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {TESTIMONIALS.map(({ quote, name, business, initial, color }) => (
            <figure
              key={name}
              className="flex flex-col rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900"
            >
              <svg
                viewBox="0 0 24 16"
                fill="currentColor"
                className="mb-4 h-5 w-7 text-slate-200 dark:text-slate-700"
                aria-hidden="true"
              >
                <path d="M0 16V9.455C0 4.09 3.27 1.09 9.818 0l1.09 1.818C8.09 2.545 6.546 4 6 6.545h3.818V16H0Zm12.727 0V9.455C12.727 4.09 16 1.09 22.545 0l1.091 1.818c-2.818.727-4.363 2.182-4.909 4.727H22.545V16H12.727Z" />
              </svg>
              <blockquote className="flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {quote}
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    color,
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {initial}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{business}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── 7. FAQ ────────────────────────────────────────────────────────────────────

function FAQSection() {
  return (
    <section
      id="faq"
      className="px-4 py-20 sm:py-24"
      aria-labelledby="faq-heading"
    >
      <div className="mx-auto max-w-2xl">
        <div className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
            Preguntas frecuentes
          </p>
          <h2
            id="faq-heading"
            className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white"
          >
            Todo lo que quieres saber{" "}
            <br className="hidden sm:block" />
            antes de empezar.
          </h2>
        </div>

        <div className="divide-y divide-slate-200/60 rounded-3xl border border-slate-200/70 bg-white shadow-[0_2px_16px_rgba(15,23,42,0.05)] dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {FAQS.map(({ q, a }) => (
            <details
              key={q}
              className="group px-6 py-0"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-medium text-slate-900 [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500 dark:text-white">
                {q}
                <IconChevronDown />
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── 8. Monexity Personal — próximamente ───────────────────────────────────────

function PersonalSection() {
  return (
    <section
      className="px-4 py-20 sm:py-24"
      aria-labelledby="personal-heading"
    >
      <div className="mx-auto max-w-5xl">
        <div className="relative overflow-hidden rounded-4xl border border-slate-200/50 bg-linear-to-br from-slate-50 to-slate-100/60 p-8 sm:p-12 dark:border-slate-800 dark:from-slate-900 dark:to-slate-800/60">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-violet-100/60 blur-3xl dark:bg-violet-500/5"
          />

          <div className="relative">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300">
                Muy pronto
              </span>
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Monexity · Personal
              </span>
            </div>

            <h2
              id="personal-heading"
              className="mt-5 text-balance text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white"
            >
              Finanzas personales,
              <br />
              tan claras como las de tu negocio.
            </h2>

            <p className="mt-4 max-w-lg text-slate-500 dark:text-slate-400">
              Próximamente: control de gastos personales, ahorro y presupuesto mensual. Para la misma persona que controla su negocio con Monexity.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {["Gastos del hogar", "Ahorro mensual", "Presupuesto", "Metas financieras"].map(
                (item) => (
                  <span
                    key={item}
                    className="rounded-full border border-slate-200 bg-white/80 px-3.5 py-1.5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400"
                  >
                    {item}
                  </span>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 9. Sobre Monexity ─────────────────────────────────────────────────────────

function AboutSection() {
  return (
    <section
      id="sobre"
      className="border-t border-slate-200/60 px-4 py-20 sm:py-28 dark:border-slate-800/60"
      aria-labelledby="about-heading"
    >
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">
          Sobre Monexity
        </p>
        <h2
          id="about-heading"
          className="mt-4 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white"
        >
          Hecho en Panamá, para negocios panameños.
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-500 dark:text-slate-400">
          Monexity nació de una necesidad real: los pequeños negocios en Panamá no tenían una herramienta financiera diseñada para ellos. Las opciones existentes eran demasiado complejas, demasiado caras o simplemente no encajaban con la forma en que funcionan los negocios locales.
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-500 dark:text-slate-400">
          Construimos Monexity para el dueño de tienda que lleva las cuentas desde el celular, para el equipo pequeño que necesita orden sin procesos complicados, y para quien quiere tomar decisiones con números reales, no con suposiciones.
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-500 dark:text-slate-400">
          Simple, rápido y pensado para Panamá.
        </p>
      </div>
    </section>
  );
}

// ── 10. Contacto ──────────────────────────────────────────────────────────────

function ContactSection() {
  return (
    <section
      id="contacto"
      className="border-t border-slate-200/60 px-4 py-20 sm:py-28 dark:border-slate-800/60"
      aria-labelledby="contact-heading"
    >
      <div className="mx-auto max-w-xl text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">
          Contáctanos
        </p>
        <h2
          id="contact-heading"
          className="mt-4 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white"
        >
          ¿Tienes preguntas?
        </h2>
        <p className="mt-5 text-slate-500 dark:text-slate-400">
          Escríbenos directamente. Respondemos en menos de 24 horas, de lunes a viernes.
        </p>
        <a
          href="mailto:admin@monexity-app.com"
          className="mt-8 inline-flex h-12 items-center gap-2.5 rounded-[18px] bg-slate-900 px-7 text-sm font-semibold text-white transition-[background-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
            <path d="M3 8.5L10.5 13.5C11.38 14.05 12.62 14.05 13.5 13.5L21 8.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          admin@monexity-app.com
        </a>
        <p className="mt-5 text-xs text-slate-400 dark:text-slate-600">
          También puedes escribirnos para soporte, colaboraciones o prensa.
        </p>
      </div>
    </section>
  );
}

// ── 11. CTA final ─────────────────────────────────────────────────────────────

function FinalCTASection() {
  return (
    <section
      className="px-4 py-20 sm:py-28"
      aria-labelledby="cta-heading"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2
          id="cta-heading"
          className="text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white"
        >
          Tu negocio merece más
          <br />
          que una hoja de cálculo.
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-slate-500 dark:text-slate-400">
          Prueba Monexity gratis por 7 días. Al finalizar, podrás continuar pagando tu plan mensual o anual.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={SIGNUP_HREF}
            className="inline-flex h-12 items-center gap-2 rounded-[18px] bg-slate-900 px-7 text-sm font-semibold text-white transition-[background-color,transform] duration-180 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            {WL ? "Reservar mi 25% de descuento" : "Empezar gratis — 7 días"}
            <IconArrow />
          </Link>
          {!WL && (
            <Link
              href={LOGIN_HREF}
              className="inline-flex h-12 items-center rounded-[18px] px-6 text-sm font-medium text-slate-500 transition-colors duration-180 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-slate-400 dark:hover:text-white"
            >
              Ya tengo cuenta →
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function LandingFooter() {
  return (
    <footer className="border-t border-slate-200/60 dark:border-slate-800/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <MonexityLogo size="sm" />

        <nav
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2"
          aria-label="Footer"
        >
          {[
            { label: "Funciones", href: "#funciones" },
            { label: "Planes", href: "#planes" },
            { label: "FAQ", href: "#faq" },
            { label: "Sobre Monexity", href: "#sobre" },
            { label: "Contacto", href: "#contacto" },
            { label: "Iniciar sesión", href: "/auth/login" },
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
          © {new Date().getFullYear()} Monexity · Panamá
        </p>
      </div>
    </footer>
  );
}
