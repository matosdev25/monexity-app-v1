# Monexity

SaaS para pequeños negocios en Panamá: ventas, gastos, inventario, cotizaciones y facturas desde un solo lugar.

La fuente de verdad del producto (alcance, arquitectura, branding y reglas) es [`PROJECT.md`](./PROJECT.md). Las reglas para agentes están en `AGENTS.md` y `claude.md`.

## Stack

- Next.js 16 (App Router, Server Components, Server Actions) — `proxy.ts` para sesión y rutas protegidas.
- Supabase (Auth, PostgreSQL con RLS, Storage).
- Tailwind CSS 4.

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:3000
npm run lint
npm run build
```

El proyecto usa `chatg` para la orquestación local.

## Variables de entorno

Definidas en `.env.local` (nunca se suben al repositorio). Solo las `NEXT_PUBLIC_*` llegan al navegador; `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` y las credenciales de pago son exclusivamente de servidor.

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Cliente de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Operaciones de servidor (admin client) |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL` | URLs públicas (correos, retornos de pago) |
| `BILLING_ADMIN_EMAILS` | Correos con acceso al admin global (`/admin`) |
| `CRON_SECRET` | Autoriza los cron de `vercel.json` |
| `WAITLIST_MODE` | `true` limita el sitio a la homepage y legales |
| `YAPPY_PHONE_NUMBER`, `NEXT_PUBLIC_WHATSAPP_NUMBER` | Pago por Yappy y contacto |
| `PAGUELOFACIL_*`, `TILOPAY_*` | Pasarelas de pago |

## Base de datos

Los archivos `supabase-*.sql` de la raíz documentan las migraciones aplicadas en el proyecto de Supabase (cada encabezado indica su estado). Antes de cambiar tablas, RLS o RPC, verificar el estado remoto.

## Tareas programadas (`vercel.json`)

- `/api/cron/expire-intents` — expira intentos de pago vencidos y depura cobros conservados cuyo plazo terminó.
- `/api/cron/purge-unconfirmed-signups` — elimina registros que no confirmaron el correo en 7 días.

<!-- Nota: documentación informativa; no afecta el comportamiento de la app. -->
