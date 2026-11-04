# Monexity — PROJECT.md

> **Este archivo es la fuente de verdad operativa del proyecto Monexity.**
>
> Todo agente de IA que trabaje en este repositorio debe leerlo antes de planificar, revisar, construir o modificar cualquier parte del sistema.

---

# 0. Jerarquía de autoridad y estados

Este archivo utiliza distintos niveles de autoridad. Cuando exista conflicto entre dos instrucciones, decisiones o estados, debe aplicarse la siguiente jerarquía.

## 0.1 Jerarquía de autoridad

De mayor a menor prioridad:

### 1. Instrucción explícita más reciente del propietario

Una instrucción nueva dada directamente por el propietario prevalece sobre cualquier decisión anterior de este archivo.

Ejemplo:

Si `PROJECT.md` indica que una pantalla utiliza determinado flujo y el propietario solicita explícitamente cambiarlo, la nueva instrucción prevalece.

Después de implementar una decisión permanente, `PROJECT.md` debería actualizarse para reflejarla.

---

### 2. Decisiones obligatorias de `PROJECT.md`

Son decisiones aprobadas que deben considerarse fijas mientras el propietario no indique lo contrario.

Incluyen, entre otras:

- producto;
- branding;
- arquitectura;
- roles;
- planes;
- UX;
- seguridad;
- alcance;
- reglas financieras;
- flujo de trabajo.

Un agente no puede reinterpretarlas como simples sugerencias.

---

### 3. Comportamiento actual confirmado del proyecto

Cuando este archivo indica que debe respetarse la “implementación vigente”, el agente debe inspeccionar primero el código, base de datos y configuración actuales.

El comportamiento existente tiene autoridad operativa cuando:

- `PROJECT.md` no define exactamente un detalle;
- existen múltiples implementaciones posibles;
- una funcionalidad ya está construida y no se pidió rediseñarla.

Esto **no autoriza** a conservar un comportamiento que contradiga una decisión obligatoria.

---

### 4. Recomendaciones vigentes

Son direcciones aprobadas, pero no reglas rígidas.

Pueden adaptarse si:

- la implementación actual requiere otra solución;
- existe una alternativa técnicamente mejor;
- se mantiene el mismo objetivo;
- no se contradicen decisiones obligatorias.

No deben utilizarse para justificar cambios innecesarios.

---

### 5. Pendientes de definir

Son áreas donde todavía no existe una decisión definitiva.

Un agente debe:

- mantener la implementación existente si existe;
- evitar inventar valores o reglas;
- no tomar una decisión permanente por iniciativa propia.

Si una tarea requiere necesariamente resolver uno de estos pendientes, debe reportarlo antes de convertirlo en una decisión estructural.

---

## 0.2 Estados utilizados dentro de este archivo

Cada decisión documentada debe interpretarse según uno de estos estados:

### `OBLIGATORIO`

Decisión aprobada y vinculante.

No modificar sin instrucción explícita.

---

### `ACTUAL`

Describe el estado o comportamiento actualmente confirmado del proyecto.

Puede cambiar como consecuencia de una tarea explícita.

---

### `RECOMENDADO`

Dirección preferida, pero adaptable.

Debe respetarse salvo que exista una razón técnica o de producto mejor.

---

### `PENDIENTE`

Todavía no existe una decisión definitiva.

No inventar.

---

### `HISTÓRICO`

Información útil para entender compatibilidad, errores anteriores, promociones pasadas o decisiones que ya no necesariamente siguen activas.

No debe interpretarse automáticamente como comportamiento actual.

---

## 0.3 Regla de interpretación

Si una sección no indica explícitamente un estado:

- una frase como **“debe”, “no debe”, “usar siempre”, “regla”** se considera `OBLIGATORIO`;
- una descripción de estructura, tabla o comportamiento comprobado se considera `ACTUAL`;
- una frase como **“se recomienda”, “preferir”, “dirección”** se considera `RECOMENDADO`;
- cualquier elemento marcado **“Pendiente de definir”** se considera `PENDIENTE`;
- códigos promocionales, errores anteriores y configuraciones antiguas claramente fechadas o descritas como pasadas se consideran `HISTÓRICO`.

---

## 0.4 Roles de los agentes

### Codex

Debe usar `PROJECT.md` para:

- analizar;
- planificar;
- diagnosticar;
- validar;
- revisar;
- detectar riesgos.

### Claude Code

Debe usar `PROJECT.md` para:

- implementar;
- modificar archivos;
- ejecutar tareas técnicas;
- validar la implementación.

### Regla común

Ninguna IA puede cambiar decisiones de branding, UX, estructura, alcance o lógica de negocio documentadas como obligatorias sin una instrucción explícita del propietario.

---

## 0.5 Git y despliegue

`OBLIGATORIO`

Ninguna IA debe hacer:

- commit;
- push;
- Pull Request;
- merge;
- deploy;

salvo que el flujo de `chatg` lo autorice explícitamente.

Nunca hacer merge automático a `main`.

---

# 1. Proyecto

## Nombre

`OBLIGATORIO`

**Monexity**

## Dominio

`ACTUAL`

`https://monexity-app.com`

## Tipo

`OBLIGATORIO`

SaaS web para gestión simple de pequeños negocios.

## Objetivo

`OBLIGATORIO`

Permitir que pequeños negocios controlen desde una sola interfaz:

- ventas;
- gastos;
- productos e inventario;
- cotizaciones;
- facturas PDF;
- pagos y abonos;
- ventas por cuotas;
- equipo;
- actividad reciente;
- métricas y gráficos;
- periodos y cierres;
- configuración del negocio;
- estado del plan y facturación.

Monexity está pensado para negocios que todavía trabajan con libretas, notas, memoria, WhatsApp, Excel o procesos manuales dispersos.

No debe sentirse como un ERP pesado ni como un software contable complejo.

---

# 2. Público objetivo

`OBLIGATORIO`

## Público prioritario

- barberías;
- salones de belleza;
- nail studios;
- negocios de lashes y estética;
- tiendas pequeñas;
- revendedores;
- emprendimientos que venden por Instagram o WhatsApp;
- negocios de comida;
- food trucks;
- freelancers;
- profesionales independientes;
- negocios de servicios;
- microempresas.

## Usuario principal

El dueño del negocio.

Debe poder entender Monexity sin conocimientos contables ni técnicos.

---

# 3. Posicionamiento y propuesta de valor

`OBLIGATORIO`

## Propuesta principal

> **Controla tu negocio desde el celular, sin Excel, sin libretas y sin enredos.**

## Posicionamiento

Monexity debe venderse como una herramienta simple para que el dueño entienda y controle su negocio.

Debe comunicar principalmente:

- cuánto vende;
- cuánto gasta;
- cuánto cobra;
- cuánto le deben;
- qué productos o servicios mueve;
- qué está pasando en el negocio.

## Mensaje complementario

> **El control básico que todo pequeño negocio necesita antes de crecer.**

## No posicionar como

- ERP;
- software contable avanzado;
- plataforma fiscal;
- sistema empresarial complejo.

---

# 4. Principios del producto

`OBLIGATORIO`

Monexity debe ser:

- simple;
- rápido;
- mobile-first;
- económico;
- visual;
- confiable;
- fácil de entender;
- usable por personas no técnicas.

Regla principal:

> Priorizar claridad y utilidad sobre cantidad de funciones.

No convertir Monexity en un ERP complejo sin una decisión explícita.

---

# 5. Stack tecnológico

## Stack aprobado

`OBLIGATORIO`

- **Next.js**
- **App Router**
- **React**
- **Tailwind CSS**
- **Supabase**
- **PostgreSQL vía Supabase**
- **Supabase Auth**
- **Row Level Security / RLS**
- **Vercel**

## Estado reciente del entorno

`HISTÓRICO`

El proyecto estuvo usando Next.js `16.1.7`.

Se detectó un panic interno de Turbopack:

```text
FATAL: An unexpected Turbopack error occurred.
```

También se comprobó que:

```text
next dev --no-turbopack
```

no era una opción válida para esa versión.

## Regla para cambios de entorno

`OBLIGATORIO`

Antes de cambiar bundler o versión:

1. revisar `package.json`;
2. revisar `next.config.*`;
3. verificar la versión real instalada;
4. usar únicamente opciones soportadas;
5. no cambiar Next.js arbitrariamente.

---

# 6. Supabase

## Proyecto oficial

`OBLIGATORIO`

Nombre:

**Monexi**

Project ID:

```text
mnwzltvkwfxlpxuwshfo
```

URL:

```text
https://mnwzltvkwfxlpxuwshfo.supabase.co
```

No confundir con otros proyectos Supabase de la misma cuenta.

## Tablas confirmadas

`ACTUAL`

```text
public.companies
public.company_invites
public.company_payment_methods
public.company_services
public.discount_codes
public.expenses
public.memberships
public.payment_amount_slots
public.payment_audit_logs
public.payment_intents
public.period_closure_exports
public.period_closure_issues
public.period_closures
public.products
public.profiles
public.quotation_items
public.quotations
public.quotes
public.sale_installments
public.sale_items
public.sale_payment_plans
public.sale_payments
public.sales
public.waitlist
```

Supabase Auth:

```text
auth.users
auth.identities
```

## Tablas principales

### `profiles`

`ACTUAL`

```text
id
full_name
email
created_at
username
phone
```

### `companies`

`ACTUAL`

```text
id
name
created_at
owner_user_id
contact_footer
logo_url
needs_inventory
subscription_status
subscription_plan
trial_starts_at
trial_ends_at
current_period_starts_at
current_period_ends_at
subscription_billing_cycle
is_blocked
blocked_reason
next_invoice_number
invoice_ruc
invoice_dv
invoice_address
invoice_email
invoice_phone
```

### `memberships`

`ACTUAL`

```text
id
company_id
user_id
role
created_at
```

Constraint único:

```text
(company_id, user_id)
```

---

# 7. Seguridad y acceso a datos

`OBLIGATORIO`

## Supabase

- nunca exponer `SUPABASE_SERVICE_ROLE_KEY` en frontend;
- usar service role solo server-side, local o administrativo;
- no insertar manualmente usuarios de producción en `auth.users`;
- para creación administrativa usar la API oficial de Supabase Auth;
- mantener RLS activo;
- no desactivar RLS para resolver errores;
- no usar `user_metadata` como fuente de autorización;
- evitar `SECURITY DEFINER` salvo necesidad real y revisión;
- toda consulta debe respetar empresa, usuario y permisos.

## Datos

- no modificar negocios ajenos durante pruebas;
- no usar datos reales en cuentas demo;
- no duplicar pagos o ingresos;
- no cambiar esquemas o tablas fuera del alcance;
- no crear migraciones innecesarias;
- no eliminar ni consolidar tablas sin instrucción explícita.

---

# 8. Organización y roles

## Roles válidos

`OBLIGATORIO`

```text
owner
admin
seller
```

## Owner

`OBLIGATORIO`

- control completo del negocio;
- debe existir un dueño principal;
- no implementar “transferir negocio” sin instrucción explícita.

## Admin

`OBLIGATORIO`

- permisos superiores a seller;
- no equivale al owner.

## Seller

`OBLIGATORIO`

Permisos reducidos.

Decisiones conocidas:

- puede registrar ventas;
- puede registrar gastos cuando la lógica actual lo permita;
- no debe tener acceso libre a configuración sensible;
- no debe tener privilegios completos sobre inventario, cierres o administración del negocio.

Los detalles no documentados deben respetar la implementación vigente.

---

# 9. Planes y trial

## Planes

### Emprende

`OBLIGATORIO`

```text
$3.99 / mes
```

### Control

`OBLIGATORIO`

```text
$8.99 / mes
```

### Equipo

`ACTUAL`

Plan superior orientado a equipos y vendedores.

Decisión conocida:

- vendedores ilimitados.

Precio:

`PENDIENTE`

No inventarlo.

## Trial

`OBLIGATORIO`

Duración estándar:

```text
7 días
```

Campos actuales relevantes:

```text
subscription_status
subscription_plan
trial_starts_at
trial_ends_at
```

Estados detectados actualmente:

```text
trialing
active
```

No inventar estados como `expired` salvo que ya existan en el código.

## Comportamiento esperado

### Trial activo

`OBLIGATORIO`

- acceso normal según plan;
- cambio de plan permitido si la lógica actual lo soporta.

### Trial vencido

`OBLIGATORIO`

- el usuario puede iniciar sesión;
- Monexity detecta el vencimiento;
- se dirige a facturación/pago;
- no puede usar normalmente áreas protegidas;
- no debe considerarse `active` sin pago válido.

La forma técnica exacta de detectar el vencimiento debe seguir la implementación actual mientras cumpla estas reglas.

---

# 10. Cuenta demo

`ACTUAL`

Cuenta interna de pruebas:

```text
Email: demo.test@monexity-app.com
Password: DemoTest2026!
Nombre: Demo Test
```

Negocio:

```text
Negocio Demo Temporal
```

Configuración prevista:

```text
subscription_plan = control
subscription_status = trialing
subscription_billing_cycle = monthly
role = owner
needs_inventory = true
is_blocked = false
```

Puede usarse para probar:

- trial activo;
- trial vencido;
- pago requerido;
- acceso bloqueado por suscripción.

Regla:

`OBLIGATORIO`

No tratarla como cliente real ni usarla para modificar datos de terceros.

---

# 11. Onboarding y autenticación

## Flujo conceptual

`OBLIGATORIO`

```text
Crear cuenta
→ Elegir plan
→ Crear/configurar negocio
→ Trial o pago
→ Dashboard
```

La implementación concreta puede variar mientras conserve este objetivo.

## Requisitos

`OBLIGATORIO`

- registro;
- login;
- logout;
- manejo de sesión;
- acceso por empresa;
- acceso por rol;
- control por trial/suscripción.

## Cierre de sesión

Toda pantalla de bloqueo por trial o facturación debe permitir:

> **Cerrar sesión**

## Inactividad

`ACTUAL / POR VERIFICAR`

Se solicitó cierre de sesión por inactividad.

Verificar primero si ya existe antes de modificarlo.

---

# 12. Facturación del SaaS

## Estados funcionales

`OBLIGATORIO`

La sección de Facturación/Billing debe distinguir correctamente entre:

- trial activo;
- trial vencido;
- suscripción activa;
- pago pendiente;
- acceso pausado o bloqueado cuando corresponda.

Estos son **estados funcionales de negocio**.

No deben confundirse necesariamente con valores literales de `subscription_status`.

El código puede representar algunos mediante fechas, flags o combinaciones de campos.

## Integraciones de pago

### Tilopay

`OBLIGATORIO`

- Proveedor principal para pagos con tarjeta y cobros recurrentes.
- Yappy permanece como método alternativo.
- Cubo fue descartado y no debe reintroducirse.
- Toda llamada a Tilopay es server-side; credenciales solo en variables de entorno del servidor (`TILOPAY_API_BASE_URL`, `TILOPAY_API_USER`, `TILOPAY_API_PASSWORD`, `TILOPAY_API_KEY`, `TILOPAY_EXPECTED_ENV`).
- El redirect del navegador nunca acredita: un pago solo se acredita tras `POST /api/v1/consult` validado contra la intención local (orden, monto, USD, aprobación y entorno).
- La verificación de firma de los webhooks recurrentes está pendiente solo de confirmar el secreto/firma con Tilopay. Mientras falte, los webhooks se auditan pero no cambian estado de negocio, la recurrencia queda deshabilitada y la integración **no es producción-ready**.

`PENDIENTE` — Discrepancia documentada (no resuelta):

- La documentación pública de webhooks (https://tilopay.com/developers/api/webhooks) indica que la única verificación de origen disponible es `OrderHash`, cuyo algoritmo no es público.
- Soporte de Tilopay informó para nuestra cuenta que los webhooks recurrentes llevan headers `hash-tilopay` y `unix-timestamp` firmados con HMAC-SHA256 y un secreto compartido, sin confirmar cómo se obtiene el secreto ni la cadena firmada.
- Hasta que Tilopay confirme por escrito cuál mecanismo aplica y su especificación completa, no se implementa ninguno y la confirmación de pagos se hace siempre con `POST /api/v1/consult`.

### PagueloFácil

`ACTUAL`

Integración considerada/solicitada.

No asumir recurrencia automática completa si no está implementada.

### Yappy

`ACTUAL`

Flujo manual contemplado:

- registrar intención;
- revisar;
- aprobar o denegar;
- activar plan.

## Tablas relacionadas

`ACTUAL`

```text
payment_intents
payment_amount_slots
payment_audit_logs
company_payment_methods
```

## Descuentos

Tabla actual:

```text
discount_codes
```

Campos conocidos:

```text
code
description
discount_type
discount_value
applies_to
starts_at
expires_at
max_uses
used_count
is_active
```

Reglas:

`OBLIGATORIO`

- no permitir descuentos del 100%;
- respetar el mínimo de cobro;
- mínimo definido: `$1.50`.

## Código histórico

`HISTÓRICO`

```text
LANZAMIENTO25
```

Beneficio comunicado:

```text
25% de descuento en el primer mes o primer año
```

No asumir que sigue activo.

---

# 13. Dashboard y actividad financiera

`OBLIGATORIO`

El dashboard debe mostrar de forma simple:

- métricas;
- gráficos;
- ventas;
- gastos;
- actividad reciente;
- balance del mes;
- resumen del negocio.

## Actividad reciente

Los abonos y pagos a ventas por cuotas son actividad financiera relevante y deben reflejarse donde corresponda.

## Balance mensual

Debe considerar correctamente:

- ventas;
- pagos recibidos;
- gastos;
- cuotas y abonos.

No duplicar ingresos.

No contar automáticamente el total de una venta a cuotas como efectivo recibido si la lógica vigente diferencia entre venta y cobro.

---

# 14. Ventas, cuotas y pagos

## Estructura actual

`ACTUAL`

```text
sales
sale_items
sale_payment_plans
sale_installments
sale_payments
```

## Funcionalidad

`OBLIGATORIO`

Debe soportar:

- ventas;
- venta por cuotas;
- plan de pagos;
- cuotas pendientes;
- abonos;
- pagos registrados;
- saldo restante;
- próxima cuota.

---

# 15. Facturas PDF

`OBLIGATORIO`

Las facturas deben reflejar correctamente:

- venta;
- cliente cuando corresponda;
- productos o servicios;
- subtotal;
- descuento;
- total;
- datos del negocio;
- número de factura;
- información de cuotas cuando aplique.

## Descuento

Si existe descuento:

> **Debe mostrarse explícitamente en la factura.**

## Venta por cuotas

Debe reflejar:

- cuotas pendientes;
- saldo restante;
- próxima cuota;
- pagos y abonos.

Se detectó históricamente que estos datos no siempre se actualizaban correctamente.

---

# 16. Cotizaciones

## Estructura actual

`ACTUAL`

```text
quotations
quotation_items
quotes
```

## Regla estructural

`OBLIGATORIO`

La coexistencia de `quotations` y `quotes` debe investigarse antes de cualquier modificación estructural.

No consolidar, borrar ni migrar estas tablas sin instrucción explícita.

Mantener exportación PDF si ya existe.

---

# 17. Productos e inventario

## Estructura actual

`ACTUAL`

```text
products
```

Campo de empresa:

```text
needs_inventory
```

## Regla UX

`OBLIGATORIO`

No todos los negocios necesitan inventario.

La UX no debe forzar gestión de stock a negocios de servicios que no lo requieran.

---

# 18. Gastos

`OBLIGATORIO`

Los gastos deben:

- registrarse fácilmente;
- afectar las métricas correctas;
- aparecer en reportes y gráficos pertinentes;
- asociarse a la empresa correcta;
- respetar RLS.

Tabla actual:

```text
expenses
```

---

# 19. Periodos y cierres

## Estructura actual

```text
period_closures
period_closure_exports
period_closure_issues
```

## Reglas

`OBLIGATORIO`

- no alterar esta lógica sin revisar dependencias;
- roles limitados no deben obtener acceso indebido a cierres.

---

# 20. Equipo e invitaciones

## Estructura actual

```text
memberships
company_invites
```

## Flujo

`OBLIGATORIO`

- invitaciones mediante código de un solo uso;
- no permitir membresías duplicadas para el mismo usuario y empresa.

CTA previsto:

> **Crear invitación**

---

# 21. Mi negocio y Mi cuenta

`OBLIGATORIO`

Esta área debe centralizar:

- información del negocio;
- logo;
- datos fiscales;
- información de factura;
- equipo;
- cuenta;
- plan;
- pagos;
- configuración.

Plan y pagos deben concentrarse claramente en:

```text
Mi negocio → Mi cuenta
```

o en la estructura equivalente más reciente.

Evitar duplicar información de suscripción.

## Rendimiento

`HISTÓRICO`

Se detectó lentitud en esta sección.

Las optimizaciones deben preservar permisos y comportamiento.

---

# 22. Admin global

`OBLIGATORIO`

Debe existir una administración global separada de los roles de empresa.

Funciones contempladas:

- ver empresas;
- ver usuarios;
- revisar pagos;
- aprobar pagos manuales;
- denegar pagos manuales;
- gestionar códigos de descuento;
- supervisar suscripciones.

No usar `memberships.role` para representar admin global.

Se contempló una lista de correos autorizados.

---

# 23. Soporte

`OBLIGATORIO`

Debe existir una experiencia sencilla con:

- FAQ;
- acceso rápido a ayuda;
- WhatsApp.

No convertir soporte en una sección técnica compleja.

Contactos oficiales del proyecto (definidos por el propietario):

- Correo para todo lo relacionado con Monexity (soporte, privacidad, remitente de correos): `admin@monexity-app.com`.
- WhatsApp oficial de soporte y ventas: `+507 6745-9439`.

Fuente única en código: `lib/legal/entity.ts` (`LEGAL_ENTITY`). No duplicar números ni correos en otros archivos.

Identidad legal del operador (Aviso de Operación N.° 3-737-2051-2026-574457907, MICI): titular Martin Matos Peñafiel, establecimiento MatosDev, RUC 3-737-2051 DV 65. El documento original se guarda fuera de Git en `.private/legal/` y nunca debe subirse al repositorio, a `public/` ni a Storage.

---

# 24. Dirección visual

## Estilo

`OBLIGATORIO`

Monexity debe sentirse:

- moderno;
- limpio;
- premium;
- simple;
- mobile-first;
- inspirado en interfaces actuales de iOS;
- visualmente ordenado.

## Componentes

`RECOMENDADO`

- cards;
- bordes suaves;
- buen espaciado;
- controles modernos;
- componentes táctiles cómodos;
- jerarquía clara.

## Colores

`OBLIGATORIO`

Base de marca:

- verde;
- azul;
- blanco.

Los tonos exactos deben salir del sistema visual existente.

No inventar HEX nuevos si ya existen tokens o colores definidos.

## Logo

`OBLIGATORIO`

Usar siempre el logo oficial.

No:

- recrearlo;
- deformarlo;
- sustituirlo;
- reinterpretarlo.

## Tipografía

`PENDIENTE`

Mantener la tipografía actual mientras no exista una nueva decisión.

---

# 25. Responsive y layout

`OBLIGATORIO`

Monexity es mobile-first y debe funcionar correctamente en:

- mobile;
- tablet;
- laptop;
- desktop.

## Reglas

- no permitir overflow horizontal de página;
- evitar anchos fijos innecesarios;
- contener gráficos;
- evitar cards deformadas;
- mantener padding y márgenes consistentes;
- permitir scroll horizontal interno solo cuando sea realmente necesario.

## Mobile

- cards apiladas;
- inputs cómodos;
- botones accesibles;
- gráficos contenidos;
- tablas con scroll interno si aplica.

## Tablet

- reorganizar columnas progresivamente.

## Desktop

- aprovechar el espacio sin estirar excesivamente la interfaz;
- mantener legibilidad;
- usar contenedores limitados cuando corresponda.

## Facturación

`ACTUAL / PROBLEMA CONOCIDO`

La pantalla de Facturación presentó un layout excesivamente alargado en PC.

Revisar especialmente:

```text
w-screen
min-w-*
width fijo
grid-cols-*
overflow
```

## Problemas históricos

`HISTÓRICO`

También existieron:

- contenedores desbordados;
- gráficos fuera del viewport;
- problemas de dimensiones en mobile.

---

# 26. UX

## Principios

`OBLIGATORIO`

- no mostrar información técnica al usuario;
- usar mensajes claros;
- evitar callejones sin salida;
- proporcionar estados vacíos útiles;
- mantener CTA principal reconocible;
- dar feedback después de acciones;
- evitar acciones duplicadas;
- proteger acciones destructivas;
- mantener consistencia entre módulos.

## Formularios

- validar;
- mostrar errores cerca del campo;
- conservar valores cuando sea posible;
- indicar loading;
- evitar doble submit.

## Estados de datos

Todo flujo remoto debe contemplar:

- loading;
- success;
- empty;
- error.

No dejar pantallas en blanco.

No mostrar errores internos de Supabase directamente al usuario.

---

# 27. Formatos

`OBLIGATORIO`

## Fecha

```text
dd/mm/aaaa
```

## Moneda

```text
$ 0.00
```

Moneda operativa:

```text
USD / Balboa equivalente
```

---

# 28. Landing pública

## Objetivo

`OBLIGATORIO`

Que el visitante:

1. entienda Monexity en menos de 10 segundos;
2. comprenda para quién es;
3. vea el beneficio;
4. empiece el trial;
5. pueda contactar por WhatsApp.

## Hero

Copy principal:

> **Controla tu negocio desde el celular, sin Excel, sin libretas y sin enredos.**

CTA principal:

> **Probar gratis 7 días**

CTA secundario recomendado:

- WhatsApp;
- conocer cómo funciona.

## Mensajes aprobados

`RECOMENDADO`

> Controla ventas, gastos y cotizaciones desde tu celular.

> Tu negocio vende, pero ¿sabes cuánto realmente estás ganando?

> Deja de manejar tu negocio en libretas y notas de WhatsApp.

## Tono

`OBLIGATORIO`

- claro;
- cercano;
- latino;
- natural;
- profesional;
- no corporativo en exceso.

## Estructura

`RECOMENDADO`

1. Hero
2. Problema
3. Solución
4. Funciones principales
5. Para quién es
6. Beneficios
7. Planes
8. FAQ
9. CTA final

Antes de reorganizar, revisar la landing actual.

## Copy

`OBLIGATORIO`

Vender beneficios antes que características.

Evitar lenguaje técnico sobre:

- arquitectura;
- APIs;
- bases de datos;
- ERP;
- automatización empresarial compleja.

---

# 29. Marketing y contenido

## Canales prioritarios

`RECOMENDADO`

- Instagram Reels;
- TikTok;
- WhatsApp;
- clientes de MatosDev;
- alianzas;
- contenido educativo;
- demostraciones cortas.

## Enfoque

No publicar solo funciones.

Crear contenido basado en problemas reales.

Ejemplos:

- “3 señales de que tu negocio necesita dejar Excel”
- “Si no sabes cuánto gastaste este mes, no estás controlando tu negocio”
- “Tu negocio vende, pero ¿realmente deja ganancia?”
- “Errores que cometen los emprendedores al manejar ventas por WhatsApp”

## YouTube

`ACTUAL`

Existe una línea de tutoriales del sistema.

La voz puede generarse con IA.

Temas:

- crear cuenta;
- configurar negocio;
- dashboard;
- ventas;
- gastos;
- productos;
- cotizaciones;
- facturas;
- cuotas;
- equipo;
- planes y pagos.

## Instagram

Perfil:

```text
@monexity_app
```

Dirección:

`OBLIGATORIO`

- 3 carruseles anclados;
- luego priorizar Reels;
- evitar estrategia basada en “tutorial 1, 2, 3”.

Usar siempre branding y capturas reales del producto.

---

# 30. Integración con MatosDev

`RECOMENDADO`

Monexity es independiente, pero puede aprovechar la cartera de MatosDev.

Usos aprobados:

- ofrecerlo a clientes de MatosDev;
- combinarlo con proyectos web;
- ofrecerlo como herramienta complementaria.

No fusionar visualmente ambas marcas salvo campaña explícita.

---

# 31. Assets y referencias

## Assets

`OBLIGATORIO`

Conservar y reutilizar:

- logo oficial;
- variantes del logo;
- capturas reales;
- screenshots mobile;
- screenshots dashboard;
- imágenes promocionales;
- assets de landing;
- favicon;
- iconografía actual.

## Organización

`RECOMENDADO`

Si no existe una estructura mejor:

```text
/public/brand/monexity/
```

para branding.

```text
/public/screenshots/
```

para capturas públicas.

No mover assets si hacerlo rompe rutas.

## Referencia visual principal

`OBLIGATORIO`

> **La UI real y actual de Monexity.**

No crear dashboards ficticios que puedan confundirse con el producto real.

---

# 32. SEO, performance y accesibilidad

## SEO

`OBLIGATORIO`

La landing debe incluir como mínimo:

- `<title>`;
- meta description;
- Open Graph;
- favicon;
- canonical cuando corresponda;
- HTML semántico;
- headings correctos;
- contenido indexable.

Keywords naturales:

- control de negocio;
- ventas;
- gastos;
- cotizaciones;
- inventario;
- pequeños negocios;
- emprendedores;
- Panamá.

No hacer keyword stuffing.

## Performance

`OBLIGATORIO`

Priorizar:

- menos JavaScript innecesario;
- evitar fetches duplicados;
- evitar renders innecesarios;
- optimizar consultas Supabase;
- no cargar datos no usados;
- optimizar imágenes;
- mantener layout estable.

## Accesibilidad

`OBLIGATORIO`

Como mínimo:

- labels;
- `aria-label` cuando corresponda;
- contraste legible;
- foco visible;
- navegación por teclado razonable;
- áreas táctiles adecuadas;
- no depender solo del color.

Especificación WCAG formal:

`PENDIENTE`

---

# 33. Animaciones

## Dirección

`RECOMENDADO`

Usar solo animaciones:

- discretas;
- rápidas;
- funcionales;
- no intrusivas.

Motion system o librería:

`PENDIENTE`

---

# 34. Integraciones y alcance futuro

## Integraciones actuales o contempladas

`ACTUAL`

- Supabase;
- Vercel;
- Tilopay (tarjetas y recurrencia; proveedor principal);
- PagueloFácil (histórico);
- Yappy (alternativo);
- WhatsApp.

## Pendientes

`PENDIENTE`

- facturación electrónica oficial;
- integración fiscal completa;
- contabilidad formal;
- integraciones bancarias;
- API pública;
- app Android;
- app iOS;
- app Windows;
- app macOS.

El producto actual sigue siendo una aplicación web.

---

# 35. Reglas unificadas para agentes

`OBLIGATORIO`

## Antes de trabajar

1. leer `PROJECT.md`;
2. inspeccionar el estado real del repositorio;
3. identificar el alcance exacto;
4. comprobar qué decisiones son obligatorias, actuales, recomendadas o pendientes;
5. revisar dependencias antes de cambiar arquitectura, esquema o flujo.

## Durante el trabajo

No:

- rediseñar Monexity por iniciativa propia;
- cambiar branding;
- cambiar navegación arbitrariamente;
- inventar planes, precios, roles o estados;
- cambiar lógica financiera sin revisar impacto;
- eliminar o consolidar tablas;
- crear migraciones innecesarias;
- desactivar RLS;
- exponer service role;
- modificar datos ajenos;
- refactorizar áreas no relacionadas;
- decidir permanentemente elementos pendientes;
- pedir al propietario que edite manualmente archivos si el agente puede hacerlo.

Sí:

- hacer el cambio mínimo necesario;
- reutilizar patrones existentes;
- preservar compatibilidad;
- mantener seguridad;
- respetar la jerarquía de este archivo;
- validar la funcionalidad afectada;
- reportar solo cambios verificables.

---

# 36. Flujo con `chatg`

`ACTUAL`

`chatg` orquesta Codex + Claude Code.

## Codex

Responsable de:

- análisis;
- diagnóstico;
- planificación;
- revisión;
- validación;
- detección de riesgos.

## Claude Code

Responsable de:

- implementación;
- cambios de archivos;
- ejecución técnica;
- validación práctica.

## Comandos conocidos

```text
chatg status
chatg diff
chatg review
chatg test
chatg session
chatg session reset
chatg push "mensaje"
```

No sustituir `chatg push` por comandos Git manuales dentro del flujo habitual.

---

# 37. Validación obligatoria

`OBLIGATORIO`

Después de cualquier cambio técnico relevante:

1. revisar archivos afectados;
2. comprobar TypeScript;
3. ejecutar lint si existe;
4. ejecutar tests relacionados si existen;
5. levantar el proyecto cuando aplique;
6. probar el flujo afectado;
7. comprobar regresiones cercanas;
8. validar responsive si hubo cambios visuales;
9. validar permisos si hubo cambios de acceso;
10. reportar resultado y pendientes.

---

# 38. Decisiones obligatorias resumidas

Esta sección funciona como índice rápido. En caso de duda, prevalece la sección detallada correspondiente.

`OBLIGATORIO`

- Producto: **Monexity**
- SaaS para pequeños negocios.
- Mobile-first.
- Next.js.
- Supabase.
- Vercel.
- Emprende: `$3.99 / mes`.
- Control: `$8.99 / mes`.
- Trial: `7 días`.
- Roles:
  - `owner`
  - `admin`
  - `seller`
- Propuesta:
  > **Controla tu negocio desde el celular, sin Excel, sin libretas y sin enredos.**
- Branding:
  - verde;
  - azul;
  - blanco.
- Usar logo oficial.
- No convertir Monexity en ERP.
- `PROJECT.md` es la fuente de verdad.
- No hacer Git/deploy sin autorización explícita.

---

# 39. Recomendaciones vigentes

`RECOMENDADO`

- limitar ancho en desktop cuando una vista quede excesivamente extendida;
- centralizar plan y pagos en Mi negocio/Mi cuenta;
- priorizar CTA de trial;
- simplificar copy;
- usar WhatsApp como canal comercial y soporte;
- mostrar capturas reales;
- crear contenido basado en problemas;
- reutilizar componentes y patrones existentes;
- utilizar la cuenta demo para probar estados.

---

# 40. Pendientes de definir

`PENDIENTE`

## Producto

- precio del plan Equipo;
- límites exactos de cada plan;
- funciones exclusivas definitivas por plan;
- alcance de facturación electrónica;
- contabilidad formal;
- integraciones futuras.

## Branding

- HEX oficiales documentados;
- tipografía oficial documentada;
- sistema de spacing;
- motion system.

## Marketing

- promoción permanente;
- programa de referidos;
- estrategia definitiva de ads.

## Infraestructura

- estrategia definitiva frente a Turbopack;
- versión objetivo definitiva de Next.js;
- suite automatizada de tests si aún no existe.

---

# 41. Definition of Done

Una tarea solo se considera terminada cuando:

- [ ] `PROJECT.md` fue leído antes de iniciar.
- [ ] Se identificó correctamente la jerarquía aplicable.
- [ ] El cambio cumple exactamente el alcance solicitado.
- [ ] No se modificaron decisiones `OBLIGATORIO` sin autorización.
- [ ] No se convirtieron elementos `PENDIENTE` en decisiones permanentes sin autorización.
- [ ] Los elementos `ACTUAL` fueron verificados antes de asumirlos.
- [ ] Las recomendaciones no se trataron como requisitos rígidos cuando no correspondía.
- [ ] No hubo cambios fuera de alcance.
- [ ] No se introdujo refactor innecesario.
- [ ] Seguridad, RLS y aislamiento por empresa siguen correctos.
- [ ] No se expuso `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Roles y permisos siguen funcionando.
- [ ] Trial y facturación funcionan si fueron afectados.
- [ ] Cálculos financieros siguen siendo correctos si fueron afectados.
- [ ] No se duplican ingresos, pagos o membresías.
- [ ] Facturas y cotizaciones mantienen datos correctos si fueron afectadas.
- [ ] No se modificaron datos reales durante pruebas.
- [ ] No existe overflow horizontal no intencional.
- [ ] Se validó mobile cuando hubo cambios visuales.
- [ ] Se validó tablet cuando hubo cambios visuales.
- [ ] Se validó desktop cuando hubo cambios visuales.
- [ ] Se consideraron loading, empty y error cuando aplicaba.
- [ ] TypeScript no presenta errores nuevos.
- [ ] Lint no presenta errores nuevos relevantes.
- [ ] Tests relevantes pasan si existen.
- [ ] El proyecto levanta correctamente cuando aplica.
- [ ] La funcionalidad modificada fue probada.
- [ ] No se hizo commit, push, PR, merge o deploy sin autorización.
- [ ] El agente reportó únicamente resultados verificables.