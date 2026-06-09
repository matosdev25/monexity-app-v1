# CLAUDE.md

## Monexity
- SaaS para pequeños negocios en Panamá
- Stack: Next.js App Router + Supabase
- UI: iOS, limpia, moderna, premium
- Mobile first

## Base técnica
- Usar App Router, Server Components y Server Actions
- Tablas: `companies`, `memberships`, `profiles`
- Roles: `admin`, `owner`, `seller`
- RLS activo

## Reglas generales
- Responde en español
- Haz cambios mínimos
- No cambies arquitectura, tablas ni nombres sin justificarlo
- Reutiliza la base existente
- No inventes archivos, helpers o hooks sin necesidad
- Si algo depende de RLS, RPC o Storage, dilo claro
- Si toca frontend y backend, sepáralo por pasos
- Prioriza MVP sólido

## Código
- Entrega código completo y listo para pegar
- Si corriges algo, parte del código actual
- Di solo qué archivos tocarás
- Luego entrega el código final por archivo
- Agrega SQL solo si aplica
- No expliques de más

## Motion UI
- Prioriza CSS sobre JS si logra el mismo resultado
- Hover solo en elementos clicables
- Usar `180ms` y `cubic-bezier(0.16, 1, 0.3, 1)` para interacciones
- Usar curva de salida rápida si aplica
- No usar `transition: all`
- Siempre definir hover, active y focus-visible
- Respetar `prefers-reduced-motion`
- Evitar animaciones pesadas, blur excesivo y efectos que causen lag
- Mantener animaciones sutiles, rápidas y consistentes
- No rediseñar pantallas completas por mejorar motion

## Salida por defecto
- Sé breve
- No des teoría innecesaria
- No expliques causa raíz salvo que yo la pida
- No reescribas todo sin necesidad