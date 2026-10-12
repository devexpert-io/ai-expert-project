# Feature Implementation Spec: Detalle de un pedido

## Source Feature

- `id`: `orders-detail`; `area`: `orders`; source: `feature_list.json`.
- `depends_on`: `orders-list` (`accepted`, commit `4930929`).
- `status`: `not_started` al planificar.

## Goal

Una persona con sesión válida abre `/orders/[id]` desde «Mis pedidos» y ve estado, fecha, total y líneas históricas: producto, talla, color, cantidad, precio unitario y total de línea. El propietario se resuelve en servidor con `where: { id, userId }`; un ID inexistente o ajeno produce el mismo `404`, sin HTML que revele si existe.

## Non-Goals

- No API, cancelar/reembolsar/editar, pago, reintento, envío, administración, cambios de estado, schema ni migración.
- No consultar catálogo actual, stock, imágenes, `Variant`, usuario, dirección o contacto; no recalcular un pedido con esos datos.
- No mostrar PII, `userId`, tokens, hashes, `cartId`, `variantId`, idempotency keys ni IDs internos como texto/label accesible. El ID opaco solo aparece en el segmento de ruta/href y como clave técnica.
- No implementar `order-access-control`; esta ruta sí exige sesión y propietario.

## Job Story

Cuando he comprado con mi cuenta, quiero abrir un pedido concreto y reconocer qué compré y a qué precio aunque el catálogo haya cambiado.

## Users And Permissions

- Sesión `auth_session` válida: `getSessionUser` aporta el único `userId`.
- Cookie ausente, inválida o caducada: redirigir a `/checkout` antes de Prisma, igual que `/orders`.
- Sesión válida + ID inexistente/ajeno: `findFirst` devuelve `null` y `notFound()`; ambos casos son el mismo `404`.

## Acceptance Scenarios

### Scenario 1: detalle e historial

**Given** `user-a` tiene un pedido con líneas **When** pulsa «Ver detalle del pedido» **Then** `/orders/<opaque-id>` muestra estado, fecha, líneas, precios y total, sin imprimir el ID.

### Scenario 2: sesión y aislamiento

**Given** falta la sesión o el ID pertenece a `user-b`/no existe **When** se solicita la ruta **Then** el visitante recibe `/checkout`; con sesión válida los dos últimos casos terminan en el mismo `404`, sin datos ajenos.

### Scenario 3: snapshot histórico

**Given** una línea guarda nombre, talla, color y precio antiguos **When** se modifica `Product`/`Variant` **Then** el detalle conserva `OrderLine` y no lee relación ni precio del catálogo.

### Scenario 4: total y estados

**Given** líneas válidas **When** se renderiza **Then** cada total es `quantity * unitPriceCents` con enteros seguros y la suma coincide con `Order.totalCents`; `PAID`, `CANCELLED`, `PENDING_PAYMENT` son «Pagado», «Cancelado», «Pendiente de pago». Estado desconocido, vacío, datos inválidos o suma distinta producen `404` seguro, nunca texto interno.

### Scenario 5: navegación y responsive

**Given** un detalle válido **When** se usa en móvil/escritorio **Then** hay «Volver a Mis pedidos» (`/orders`), lista/resumen semánticos, foco visible, targets >=44 px, estados con señal textual y cero overflow en 390×844/1280×800.

## Repository Research

### Files Inspected

- `AGENTS.md`, `PROGRESS.md`, `feature_list.json`: workflow, gate y dependencia.
- `CONTEXT.md`, `docs/build-brief.md`, `docs/domain-model.md`, `docs/technical-discovery.md`, `docs/risks-and-open-questions.md`: dominio, compra autenticada y estados.
- `DESIGN.md`, `src/app/globals.css`, `src/app/layout.tsx`: tokens, header, foco y breakpoints.
- `prisma/schema.prisma`: `Order.userId/status/totalCents` y `OrderLine` con `productName`, `size`, `color`, `quantity`, `unitPriceCents`; no existen `productNameSnapshot`, `sizeSnapshot`, `colorSnapshot`, `qty` ni `lineTotalCents` persistidos.
- `src/lib/server/orders.ts`, `/orders` y tests: guardia, mapa cerrado, fechas, select mínimo y vacío aceptados; auth/payment/product page fijan patrones.
- `package.json`, `init.sh`: gate; no existe `pnpm test:e2e` persistente.
### Existing Patterns And Gaps

- Reutilizar Server Components `force-dynamic`, `cookies()`, `AUTH_COOKIE_NAME`, `getSessionUser`, `redirect`, `notFound`, `server-only`, Prisma singleton, `select` explícito, `formatPrice` y CSS modular.
- Faltan servicio, ruta dinámica, UI/tests y links en `/orders`; navegador se verificará manualmente con servidor/SQLite aislados.

## Technical Approach

1. Crear `src/lib/server/order-detail.ts` con `getUserOrderDetail(userId, orderId)`. Usar `prisma.order.findFirst({ where: { id: orderId, userId }, select: { status, totalCents, createdAt, lines: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { productName, size, color, quantity, unitPriceCents } } } })`; nunca seleccionar `variant`, `user`, `variantId`, `id`, `userId` o `idempotencyKeyHash`.
2. Validar estado con `ORDER_STATUS_LABELS`, cantidades/precios como enteros seguros positivos, derivar `lineTotalCents` y sumar sin overflow. Devolver `null` para estado desconocido, vacío, inválido o suma distinta de `Order.totalCents`; no mutar la base.
3. Crear `src/app/orders/[id]/page.tsx` dinámico: resolver sesión antes del servicio, `notFound()` ante `null`, renderizar estado/fecha, líneas, total y «Volver a Mis pedidos» con `formatPrice`.
4. Modificar `/orders`: cada pedido soportado tendrá `Link` a ID opaco con texto «Ver detalle del pedido», sin imprimir ID y conservando vacío/estados.

## Expected File Changes

- `src/lib/server/order-detail.ts` y `.test.ts`: query owner-scoped, snapshots, aritmética, estados y seguridad.
- `src/app/orders/[id]/page.tsx`, `page.test.tsx`, `orders-detail-page.module.css`: guardia, 404, detalle, responsive/foco.
- `src/app/orders/page.tsx`, `page.test.tsx` y CSS existente: links y regresión de no mostrar IDs.
- `ARCHITECTURE.md`, `CONSTRAINTS.md`, `docs/domain-model.md`, `docs/technical-discovery.md`: actualizar contrato al implementar. `AGENTS.md`, `DESIGN.md`, `feature_list.json`, `PROGRESS.md`: planner no los toca.

## Visual Design Impact

- UI: sí. Fuente: `DESIGN.md` y `/orders`/`/cart`; estados: líneas/total, `PAID`, `CANCELLED`, `PENDING_PAYMENT`, 404 y retorno.
- Artefacto nuevo: no; conservar marfil/arena/tinta, oliva/rojo óxido, jerarquía editorial, contraste, foco y targets táctiles.

## Durable Documentation Impact

- `ARCHITECTURE.md`: update — ruta, query `id + userId`, snapshots y suma sin relación al catálogo.
- `CONSTRAINTS.md`: update — owner filter, no IDs/PII visibles, no recálculo actual y rechazo seguro de snapshots inconsistentes.
- `docs/domain-model.md`: update — nombres reales de snapshot y subtotal derivado; `docs/technical-discovery.md`: update — `/orders/[id]` y `404`.
- `AGENTS.md`, `DESIGN.md`: not needed; workflow y tokens no cambian.

## Implementation Plan

1. Implementar consulta, validaciones aritméticas y tests de aislamiento.
2. Implementar ruta/UI, 404/guardia y enlaces desde `/orders`.
3. Ejecutar gate, smoke SQLite con dos usuarios y catálogo mutable, QA de ambos viewports y actualizar docs/evidencia para validator.

## Implementation Tasks

- [ ] `findFirst` con `id + userId`, select sin relaciones/campos internos.
- [ ] Subtotales/suma seguros; rechazar estado, snapshot o total inválidos.
- [ ] `/orders/[id]`, retorno, estados accesibles y 404 común.
- [ ] Links en `/orders` sin IDs visibles y vacío conservado.
- [ ] Tests, gate, SQLite real, navegador y documentación.

## Verification Plan

- `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm exec vitest run src/lib/server/order-detail.test.ts 'src/app/orders/[id]/page.test.tsx' src/lib/server/orders.test.ts src/app/orders/page.test.tsx`: query, auth, 404, links, estados, snapshot y suma.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, `CI=true ./init.sh` y `git diff --check`; `init.sh` no inicia un proceso persistente.
- SQLite temporal real con dos usuarios/sesiones, pedidos `PAID`, `CANCELLED`, `PENDING_PAYMENT` y snapshots antiguos: mutar catálogo; A conserva snapshots, B obtiene `404` para A, inexistente el mismo `404`, visitante `307 → /checkout`, total igual a la suma.
- Chrome DevTools en servidor propio: lista→detalle→lista, ambos viewports, overflow/foco, consola sin errores y red sin fallos. No hay E2E persistente; este smoke manual cubre la ruta observable.

## Evidence To Capture

- Tests focales, gate, `git diff --check`, SHA y archivos modificados.
- Argumentos `findFirst`/select, dos usuarios, catálogo mutado y snapshots.
- URL, pasos, esperado/observado, HTTP/redirect/404, consola/network y capturas 390×844/1280×800, incluyendo ida y vuelta.

## Risks And Unknowns

- «Snapshot» es semántico: Prisma usa cinco campos actuales; no aliasar ni migrar. `lineTotalCents` se deriva solo en lectura.
- `variantId` puede apuntar a catálogo cambiado; omitir relación mantiene el histórico. Estado desconocido, vacío o suma inconsistente acaba en 404 seguro.

## Validator Checklist

- [ ] Solo `orders-detail` y el enlace mínimo desde `orders-list`; sin pago, cancelación, API, schema ni administración.
- [ ] Sesión antes de Prisma; query contiene `id` y `userId`; ajeno/inexistente es el mismo 404.
- [ ] Select usa `productName/size/color/quantity/unitPriceCents`, sin catálogo, PII, tokens o IDs visibles; no se recalcula desde `Product`/`Variant`.
- [ ] Líneas, subtotal, total, fecha, estados, retorno, vacío/inconsistente y `CANCELLED`/`PENDING_PAYMENT` cumplen escenarios.
- [ ] Tests, gate, SQLite, QA 390×844/1280×800, `diff --check` y docs quedan evidenciados antes de aceptar.
