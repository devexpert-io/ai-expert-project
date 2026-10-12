# Feature Implementation Spec: Listado de pedidos del usuario

## Source Feature

- `id`: `orders-list`; `area`: `orders`; `source`: `feature_list.json`.
- `depends_on`: `checkout-payment` (`accepted`, commit `090c109`).
- `status`: `not_started` al planificar.

## Goal

Crear `/orders` para que una persona autenticada vea solo sus pedidos, del más reciente al más antiguo. Cada entrada muestra estado, total en euros y fecha de creación. Debe cubrir `PAID`, `CANCELLED` y `PENDING_PAYMENT`; el detalle queda para `orders-detail`.

La página resolverá `auth_session` en servidor, derivará `userId` con `getSessionUser` y filtrará Prisma por ese propietario antes de construir la vista. El header compartido añadirá «Mis pedidos» con destino `/orders`.

## Non-Goals

- No detalle, `/orders/[id]`, búsqueda, filtros, paginación, cancelación, reembolso, edición ni acciones sobre pedidos.
- No exponer líneas, variantes, cantidades, dirección, email, nombre, tokens, `userId`, `cartId`, idempotency keys u otra PII.
- No API pública de pedidos, pedidos de invitado, roles administrativos, estados de envío, cambios de schema/migración ni cambios al pago.

## Job Story

Cuando he intentado pagar con mi cuenta, quiero abrir «Mis pedidos» y reconocer cada resultado por estado, total y fecha, para consultar mi historial sin ver pedidos de otra cuenta.

## Users And Permissions

- Sesión válida: solo lee pedidos mediante el `id` de `getSessionUser`.
- Cookie ausente, inválida o caducada: no se consulta `Order`; redirigir a `/checkout` (o documentar una guardia server-side equivalente) sin HTML de pedidos ni nuevas filas/cookies.
- No se acepta un usuario desde params, query, formulario o JSON.

## Acceptance Scenarios

### Scenario 1: historial e aislamiento

**Given** `user-a` tiene pedidos en los tres estados y `user-b` tiene otros **When** `user-a` abre `/orders` **Then** la consulta usa `where: { userId: user-a }`, orden `createdAt DESC, id DESC`, y cada tarjeta solo contiene estado, total EUR y fecha de `user-a`.

### Scenario 2: sesión obligatoria

**Given** falta `auth_session` o está caducada **When** se solicita `/orders` **Then** se corta antes de `getUserOrders`/Prisma y se redirige a `/checkout`; no se filtra ningún dato de pedido.

### Scenario 3: vacío

**Given** sesión válida y cero pedidos **When** se renderiza la página **Then** aparece `role="status"` con «Aún no tienes pedidos» y enlace funcional a `/`.

### Scenario 4: estados y formato

**Given** una fila con `PAID`, `CANCELLED` o `PENDING_PAYMENT` **When** se renderiza **Then** muestra respectivamente «Pagado», «Cancelado» o «Pendiente de pago», `formatPrice(totalCents)` y fecha legible en español; el color no es la única señal.

### Scenario 5: navegación responsive

**Given** cualquier página pública **When** se usa el header **Then** «Mis pedidos» enlaza a `/orders`; en 390×844 y 1280×800 no hay overflow horizontal, hay foco visible y los targets son de al menos 44px.

## Repository Research

### Files Inspected

- `AGENTS.md`, `PROGRESS.md`, `feature_list.json` — flujo, gate y dependencia.
- `CONTEXT.md`, `docs/build-brief.md`, `docs/domain-model.md`, `docs/technical-discovery.md`, `docs/risks-and-open-questions.md` — ciclo, estados, sesión obligatoria y privacidad.
- `DESIGN.md`, `src/app/globals.css`, `src/app/layout.tsx` — tokens, header, foco y breakpoints.
- `prisma/schema.prisma` — `Order.userId`, `status`, `totalCents`, `createdAt` e índice por usuario; `OrderLine` no es necesario.
- `src/lib/server/auth.ts`, `src/lib/server/prisma.ts`, `src/app/cart/page.tsx`, `src/app/checkout/page.tsx` — cookies, guardias, Server Components y singleton Prisma.
- `src/lib/format-price.ts`, `package.json`, `init.sh` y tests — EUR y gate; no existe `pnpm test:e2e` persistente.

### Existing Patterns and Gaps

- Reutilizar `cookies()`, `AUTH_COOKIE_NAME`, `getSessionUser`, módulos `server-only`, view-models planos, selección mínima y orden estable.
- Faltan `/orders`, servicio/tests/estilos y el enlace «Mis pedidos»; la fila de utilidades del header debe envolverse en móvil.

## Technical Approach

1. Crear `src/lib/server/orders.ts` con `getUserOrders(userId)`, `import "server-only"`, y `findMany({ where: { userId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id, status, totalCents, createdAt } })`. No incluir `user`/`lines` ni aceptar filtros del cliente. Usar solo estados soportados; un estado desconocido se omite o degrada a texto seguro documentado, nunca se imprime crudo.
2. Crear `src/app/orders/page.tsx` (`force-dynamic`): leer cookie, llamar `getSessionUser`, redirigir/cortar sin sesión y consultar solo después; renderizar encabezado, `<ul>` semántico o vacío. Traducir con mapa cerrado, `formatPrice`, y `Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" })`.
3. Crear CSS local según `DESIGN.md`; modificar `layout.tsx` y, si hace falta, `globals.css` para añadir el enlace y envolver utilidades sin overflow. No crear rutas/enlaces de detalle; el `id` solo puede ser `key` interno.

## Expected File Changes

- `src/lib/server/orders.ts` y `src/lib/server/orders.test.ts` — consulta, tipos y pruebas de filtro, select, orden y estados.
- `src/app/orders/page.tsx`, `src/app/orders/page.test.tsx` y `src/app/orders/orders-page.module.css` — guardia, lista/vacío, formato y UI.
- `src/app/layout.tsx` y posiblemente `src/app/globals.css` — navegación y wrap responsive; añadir test de layout si es viable.
- `ARCHITECTURE.md`/`CONSTRAINTS.md`/docs de discovery: update solo si se fija una regla durable; `feature_list.json`/`PROGRESS.md` solo implementador/validator tras evidencia.

## Visual Design Impact

- UI: sí; fuente: `DESIGN.md` y patrones `/cart`/`/checkout`; estados: lista, vacío, tres badges, foco y redirección de invitado.
- Sin artefacto nuevo: marfil/arena/tinta, oliva para `PAID`, rojo óxido para `CANCELLED`, texto/contraste propio para `PENDING_PAYMENT`; nunca solo color.

## Durable Documentation Impact

- `ARCHITECTURE.md`: update — lectura server-only por `Session.userId`, select mínimo y ausencia de API/detalle.
- `CONSTRAINTS.md`: update — sesión válida y `where.userId`, sin IDs/PII en UI.
- `AGENTS.md`: not needed — workflow/runtime/gate sin cambios.
- `docs/domain-model.md`/`docs/technical-discovery.md`: update si `/orders`, etiquetas o guardia se convierten en contratos; `DESIGN.md`: not needed.

## Implementation Plan

1. Fijar tipos, estados y consulta server-only con pruebas de aislamiento.
2. Implementar guardia, `/orders`, lista/vacío, formato y navegación responsive.
3. Ejecutar gate, smoke con dos usuarios/tres estados y QA Chrome DevTools; registrar evidencia para validator.

## Implementation Tasks

- [ ] `getUserOrders`: `where.userId`, select mínimo, estados cerrados y orden.
- [ ] `/orders`: sesión real desde el inicio, redirección y estado vacío.
- [ ] Renderizar estado/total/fecha sin líneas, IDs visibles, PII ni detalle.
- [ ] Añadir «Mis pedidos» y verificar el header en móvil y escritorio.
- [ ] Tests focalizados y docs durables cuando el contrato quede confirmado.

## Verification Plan

- `pnpm test -- src/lib/server/orders.test.ts src/app/orders/page.test.tsx`: guardia, aislamiento, orden, tres estados, formato, vacío y no PII.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, `CI=true ./init.sh` y `git diff --check`; `init.sh` no inicia procesos persistentes.
- Smoke en SQLite temporal con dos usuarios y pedidos mezclados: cada cookie recibe solo su lista; sin cookie se redirige antes de leer `Order`.
- `chrome-devtools` en URL/commit propios: navegación, lista/empty, estados, overflow, foco, consola sin errores y red sin fallos a 390×844 y 1280×800. No hay `pnpm test:e2e` persistente; este smoke cubre el flujo de navegador.

## Evidence To Capture

- Tests, gate, SHA y `git diff --check`.
- Mock/SQLite que demuestre `where.userId`, select mínimo, orden estable y sin campos ajenos/PII.
- URL, pasos, esperado/observado, consola/network y capturas de ambos viewports; incluir redirección de invitado y estado vacío.

## Risks And Unknowns

- El cuarto enlace puede desbordar el header móvil; resolver wrap y demostrarlo en 390×844 sin cambiar destinos existentes.
- `Order.status` es `String`; estados desconocidos deben omitirse o degradarse a texto seguro, sin renderizar valores crudos. Validator debe fijar esa elección.
- Fijar `Europe/Madrid` evita fechas distintas según máquina/UTC.

## Validator Checklist

- [ ] Solo cubre `orders-list`; no detalle, auth/pago/schema ni acciones nuevas.
- [ ] Sesión real y `userId` server-side; invitado no consulta ni ve pedidos.
- [ ] Query filtrada por propietario y mínima; sin IDs ajenos, líneas ni PII.
- [ ] Estados, total/fecha, orden, vacío y navegación cumplen los escenarios.
- [ ] `/orders` no tiene enlaces rotos de detalle y pasa QA 390×844/1280×800.
- [ ] Tests, gate, smoke, navegador y docs aplicables quedan evidenciados antes de aceptar.
