# Feature Implementation Spec: Control de acceso a pedidos

## Source Feature

- `id`: `order-access-control`; `area`: `orders`; `source`: `feature_list.json`.
- `depends_on`: `orders-list` (`accepted`, `4930929`); `orders-detail` también está aceptada (`2ba8ca6`) y es el baseline de esta revisión.
- `status`: `not_started` al planificar.
- Verificación fuente: un invitado no ve pedidos y una cuenta no puede acceder a los pedidos de otra.

## Goal

Cerrar con evidencia adversarial la autorización ya existente en `/orders`, `/orders/[id]` y `POST /api/checkout/payment`. Una cookie ausente, inválida, caducada o revocada no debe leer pedidos ni crear uno; una sesión válida solo puede operar con el `userId` que el servidor obtiene de `auth_session`.

La sesión opaca conserva el contrato actual: token aleatorio solo en cookie HTTP-only, hash SHA-256 en `Session`, expiración por `expiresAt` y revocación mediante logout. Las páginas siguen siendo dinámicas y no deben servir HTML/RSC de una cuenta al cambiar de cookie o después de logout.

## Non-Goals

- No crear otro proveedor de auth, middleware, rol, endpoint, tabla, migración ni abstracción centralizadora.
- No aceptar `userId`, `cartId`, pedido o identidad desde URL, query, body, formulario o cabeceras controlables.
- No cambiar el contrato de checkout, estados, snapshots, UI, navegación o pago autorizado.
- No añadir pedidos de invitado, administración, cancelación, reembolso ni cambios de schema.

## Job Story

Cuando cambio de cuenta, cierro sesión o recibo un enlace ajeno, quiero que el historial y el pago sigan ligados a mi sesión actual, para que ningún pedido privado se muestre ni se cree bajo otra identidad.

## Users And Permissions

- Invitado o sesión inválida/caducada/revocada: `/orders` y `/orders/[id]` redirigen a `/checkout` antes de consultar `Order`; el pago responde `401` y no llama al servicio de pago.
- Usuario A autenticado: lista solo sus filas y puede abrir solo sus detalles; la consulta de detalle de B y la de un ID inexistente producen el mismo `404`.
- El servidor deriva siempre `userId` de `getSessionUser`; el cliente solo aporta el ID opaco del detalle y el resultado/outcome de pago permitido.

## Acceptance Scenarios

### Scenario 1: sesión obligatoria y creación bloqueada

**Given** no hay cookie, el token no existe, `expiresAt <= now` o la fila fue revocada **When** se solicita lista, detalle o pago **Then** lista/detalle redirigen `307 → /checkout`, pago responde `401`, no se consulta `Order` y no se crea pedido.

### Scenario 2: aislamiento de lista y detalle

**Given** A y B tienen pedidos distintos **When** A abre `/orders` y `/orders/<id-A>` **Then** solo aparecen filas/líneas de A; `/orders/<id-B>` y `/orders/<id-missing>` tienen respuesta 404 indistinguible y sin HTML de pedido.

### Scenario 3: identidad no controlable por el navegador

**Given** una sesión de A **When** se añade `userId: B` a query, params o JSON de pago **Then** la página ignora esa identidad y el endpoint rechaza el cuerpo cerrado antes de `processPayment`; nunca se usa B para leer o crear.

### Scenario 4: cambio de cookie, logout y caché

**Given** se carga una respuesta autenticada de A **When** se repite la petición con cookie de B, se hace logout o se usa el token antiguo **Then** cada respuesta refleja solo la sesión actual, el token antiguo redirige y las respuestas de lista/detalle/pago llevan política privada/no-store en producción.

## Repository Research

### Files Inspected

- `AGENTS.md`, `PROGRESS.md`, `feature_list.json` — flujo, gate y dependencias.
- `CONTEXT.md`, `docs/domain-model.md`, `docs/technical-discovery.md`, `ARCHITECTURE.md`, `CONSTRAINTS.md` — contrato de sesión, propietario y privacidad.
- `src/lib/server/auth.ts` — hash, expiración y `revokeSession`.
- `src/app/orders/page.tsx`, `src/app/orders/[id]/page.tsx`, `src/lib/server/orders.ts`, `src/lib/server/order-detail.ts` — guardias y filtros owner-scoped.
- `src/app/api/checkout/payment/route.ts`, `src/lib/server/payment.ts` — sesión antes de crear pedidos, idempotencia y `no-store`.
- Tests de auth, páginas, servicios y pago; `package.json`, `init.sh`, `prisma/schema.prisma` — Vitest/SQLite y ausencia de `pnpm test:e2e` persistente.

### Existing Patterns And Gaps

- Conservar `cookies()`, `AUTH_COOKIE_NAME`, `getSessionUser`, `dynamic = "force-dynamic"`, `findMany({ where: { userId } })`, `findFirst({ where: { id, userId } })` y respuestas JSON `no-store`.
- Los tests actuales cubren cookie ausente/`null`, filtros simulados y la guardia de usuario; no prueban directamente hash+caducidad+revocación, los cuatro estados de identidad frente al pago, `userId` inyectado ni el cambio de cookie/logout en una respuesta de producción.
- Una comprobación `next start` en SQLite temporal ya muestra `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`; no añadir otra capa si el smoke final conserva ese comportamiento.

## Technical Approach

1. Mantener las guardias actuales simples y antes de Prisma/`processPayment`; corregir solo una regresión demostrada por las pruebas.
2. Ampliar `auth.test.ts`, tests de ambas páginas y `payment/route.test.ts` con casos parametrizados de ausencia, token desconocido, expirado y revocado; probar hash SHA-256, ausencia de consultas posteriores y cuerpo con `userId`.
3. Añadir un smoke persistente `scripts/verify-order-access-control.mjs`: base SQLite única bajo `/tmp`, dos usuarios/sesiones/pedidos y carrito; levantar solo el `next start` hijo propio, ejercitar lista/detalle/pago/logout con cookies A/B y limpiar el artefacto temporal con `trash` en `finally`.
4. Si el smoke de producción detecta una respuesta cacheable, aplicar el ajuste mínimo en la página afectada y cubrirlo con una aserción; no introducir middleware ni refactor de auth.

## Expected File Changes

- `src/lib/server/auth.test.ts` — regresiones de token hasheado, expiración y revocación.
- `src/app/api/checkout/payment/route.test.ts` — no-cookie/expirado/revocado, `userId` extra y no creación.
- `scripts/verify-order-access-control.mjs` — smoke SQLite/HTTP reproducible; solo soporte de verificación.
- `src/app/orders/page.tsx`, `src/app/orders/[id]/page.tsx`, `src/app/api/checkout/payment/route.ts` — modificar únicamente si una prueba reproduce una fuga o una guardia rota; la cobertura existente de guardia/lista/detalle se conserva.
- `feature_list.json` y `PROGRESS.md` — solo implementador/validator tras evidencia; el planner no los toca.

## Visual Design Impact

- UI involucrada: sí, solo estados ya existentes (redirect, 404, lista propia, detalle propio).
- Fuente: `DESIGN.md` y CSS actual; no hay artefacto nuevo ni cambios visuales previstos.
- QA debe confirmar 390×844 y 1280×800 sin overflow, consola limpia, red sin fallos y targets/foco existentes.

## Durable Documentation Impact

- `ARCHITECTURE.md`, `CONSTRAINTS.md`, `docs/domain-model.md`, `docs/technical-discovery.md`: `not needed` si se conserva el contrato documentado; actualizar solo si una corrección cambia una regla observable.
- `AGENTS.md`, `DESIGN.md`: `not needed`; no cambia el flujo ni el sistema visual.

## Implementation Plan

1. Añadir primero las regresiones unitarias/route y hacer explícitos sus invariantes de identidad.
2. Ejecutar el smoke real con DB/servidor aislados y ajustar solo el soporte necesario.
3. Repetir gate, diff-check y QA de navegador; registrar comandos, SHA, URL, respuestas y limpieza para validator.

## Verification Plan

- `pnpm exec vitest run src/lib/server/auth.test.ts src/app/orders/page.test.tsx 'src/app/orders/[id]/page.test.tsx' src/app/api/checkout/payment/route.test.ts`.
- `pnpm exec node scripts/verify-order-access-control.mjs` tras `pnpm build`: A/B, invitado, expirado, revocado, pago sin creación, 404 común, cambio de cookie, logout y cabeceras cache-control; la DB temporal no puede ser `dev.db`.
- `CI=true ./init.sh`, `pnpm lint`, `pnpm typecheck`, `pnpm build` y `git diff --check`; `init.sh` no arranca servidores persistentes.
- Chrome DevTools contra el servidor/DB propios: redirect bloqueado, lista/detalle de A, intento de B/missing, logout y recarga; repetir 390×844/1280×800 y guardar capturas, consola y red.

## Evidence To Capture

- Tests y gate con conteos, SHA y `git diff --check`.
- Smoke: ruta de DB temporal, códigos/headers, conteo de `Order` antes/después y evidencia de `trash`/proceso detenido.
- QA: URL, cookie/actor, pasos, esperado/observado, 307/401/404/200 y capturas de ambos viewports.

## Risks And Unknowns

- El cliente RSC puede conservar navegación previa aunque HTTP sea `no-store`; verificar recarga y cambio de cookie, sin asumir que un 200 previo prueba aislamiento.
- El smoke debe matar solo su hijo y nunca truncar la base del repo; cualquier fallo de cleanup queda reportado con la ruta exacta.
- No convertir una consulta directa de servicio con `userId` explícito en API pública: la frontera a validar son las páginas y la route de pago.

## Validator Checklist

- [ ] Invitado, desconocido, expirado y revocado quedan fuera de lista/detalle/pago sin crear pedidos.
- [ ] A ve solo A; B y missing comparten 404; no hay `userId`/token/PII filtrados.
- [ ] Token crudo solo cookie; lookup por hash y `expiresAt` comprobados; logout invalida el token.
- [ ] Cambio de cookie/RSC y producción mantienen `private/no-store`; no se añadió refactor innecesario.
- [ ] Tests focales, smoke SQLite con cleanup, gate, `diff --check`, Chrome 390/1280 y evidencia durable están presentes.
