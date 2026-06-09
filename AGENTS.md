# AGENTS.md

## Proyecto
Monexity es una app SaaS para pequeños negocios en Panamá.

## Stack
- Next.js App Router
- Supabase
- Server Components
- Server Actions

## Contexto base
- UI estilo iOS, limpia, moderna y premium
- Mobile first
- RLS activo
- Tablas principales: `companies`, `memberships`, `profiles`
- Roles: `admin`, `owner`, `seller`

## Reglas generales
- Responde en español.
- Haz cambios mínimos.
- No hagas refactor grande sin justificarlo.
- No cambies arquitectura, tablas ni nombres sin justificarlo.
- Reutiliza la base existente.
- No inventes archivos, helpers o hooks sin necesidad.
- Si algo depende de RLS, RPC o Storage, dilo claramente.
- Si un cambio toca frontend y backend, sepáralo por pasos.
- Prioriza un MVP sólido.
- Respeta el aislamiento por `company_id`.

## Código
- Entrega código completo y listo para pegar.
- Si corriges algo, parte del código actual.
- Di solo qué archivos tocarás.
- Luego entrega el código final por archivo.
- Agrega SQL solo si aplica.
- No expliques de más.
- No reescribas todo sin necesidad.

## UI y motion
- Prioriza CSS sobre JS si logra el mismo resultado.
- Hover solo en elementos clicables.
- Usa `180ms` y `cubic-bezier(0.16, 1, 0.3, 1)` para interacciones.
- Usa una curva de salida rápida si aplica.
- No uses `transition: all`.
- Siempre define `hover`, `active` y `focus-visible`.
- Respeta `prefers-reduced-motion`.
- Evita animaciones pesadas, blur excesivo y efectos que causen lag.
- Mantén animaciones sutiles, rápidas y consistentes.
- No rediseñes pantallas completas solo por mejorar motion.

## Forma de trabajo
- Primero inspecciona los archivos reales implicados.
- No adivines estructura ni nombres.
- Si revisas código existente, corrígelo sobre esa base.
- Mantén compatibilidad con App Router, Server Components, Server Actions y Supabase.
- No expongas secretos ni `service_role` al cliente.
- Si hay varias opciones, recomienda la mejor para MVP.

## Salida por defecto
- Sé breve.
- No des teoría innecesaria.
- No expliques causa raíz salvo que se pida explícitamente.