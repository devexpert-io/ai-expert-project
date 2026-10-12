# Feature Implementation Spec: Pago simulado y creación del pedido

## Source Feature

- `id`: `checkout-payment`; `area`: `checkout`; `source`: `feature_list.json`.
- `depends_on`: `checkout-user` (aceptada en `0db9a20`).
- `status`: `not_started` al planificar.

## Goal

Completar el checkout de una sesión autenticada con una pasarela local
simulada. `POST /api/checkout/payment` relee en SQLite las líneas del carrito,
el stock y el precio actual de cada `Variant`; el navegador nunca aporta
cantidades, precios, total, `userId` ni `cartId`. Cada intento crea un `Order` y
`OrderLine` con snapshot de producto, talla, color, cantidad, precio unitario y
total en céntimos.

`approved` marca `PAID`, descuenta stock condicionalmente y vacía el carrito en
una transacción. `rejected` crea `CANCELLED`, no descuenta stock y conserva el
carrito para reintentar con otra clave. No se procesa dinero ni se usa red.

## Non-Goals

- Pasarela real, tarjetas, webhooks, reembolsos, descuentos, impuestos, envío,
  aleatoriedad, estados pendientes o cola de pago.
- Pago de invitado, creación de usuarios/sesiones, cambio del contrato de
  `checkout-user`, o modificaciones al carrito invitado.
- `orders-list`, `orders-detail`, `order-access-control`, administración y
  cualquier acceso futuro a pedidos distinto del resultado inmediato.

## Job Story

Cuando tengo una cuenta autenticada y un carrito preparado, quiero simular un
pago y conocer el resultado, para obtener un pedido consistente o reintentarlo
sin perder el carrito.

## Users And Permissions

- Solo una sesión válida de `auth_session` puede pagar; la API deriva el dueño
  con `getSessionUser` y resuelve `Cart.userId`.
- Invitado/sesión caducada recibe `401`, sin pedido, stock ni mutación.
- Una misma `Idempotency-Key` representa una operación única: el primer resultado
  persiste y cualquier replay devuelve ese pedido, incluso con otro `outcome`.

## Acceptance Scenarios

### Approved

**Given** sesión válida y carrito con stock suficiente **When** se envía
`outcome=approved` con clave nueva **Then** se crea `Order.status=PAID`, las
líneas son el snapshot actual, `totalCents` es la suma exacta, cada stock baja
con condición `stock >= quantity` y se eliminan las líneas del carrito en una
única transacción.

### Rejected and retry

**Given** sesión válida y stock suficiente **When** se envía `rejected`
**Then** se crea `Order.status=CANCELLED`, se conserva el snapshot/total, no se
descuenta stock, el carrito queda igual y la UI muestra «Pago simulado — no se
ha realizado ningún cargo». «Reintentar» genera una clave nueva y otro pedido;
el cancelado no se modifica.

### Stale stock and server prices

**Given** la cantidad supera el stock actual, o el resumen del navegador está
obsoleto **When** llega cualquier intento **Then** responde `409` antes de crear
pedido; no muta carrito/stock. Si procede, usa exclusivamente precio/nombre/
talla/color actuales y rechaza campos extra (`priceCents`, `totalCents`,
`lines`, `userId`).

### Idempotency and concurrency

**Given** doble click, pérdida de respuesta o dos requests con la misma key
**When** llegan secuencial o concurrentemente **Then** hay como máximo un
pedido para `(userId, hash(key))`, mismo resultado/total, un único decremento y
como máximo un vaciado. Dos usuarios que compiten por la última unidad dejan un
solo `PAID`, el otro recibe `409` y nunca hay stock negativo.

### UI

**Given** `/checkout` tiene líneas **When** hay sesión **Then** aparece el
simulador determinista aprobado/rechazado, notice visible, carga, éxito con
`orderId`/total y «Seguir comprando», o rechazo con cancelación y reintento. Sin
sesión no aparece CTA de pago. A 390×844 y 1280×800 no hay overflow/errores;
labels, foco, targets >=44px y `role=status`/`role=alert` son correctos.

### Seed after sale

**Given** una compra aprobada reduce stock **When** se repite `pnpm db:setup`
**Then** el seed no repone una SKU existente; solo asigna stock al crearla.
`db:verify` sigue siendo de solo lectura y tolera que, tras pedidos, cambie la
mezcla disponible/agotada.

## Repository Research

### Files Inspected

- `AGENTS.md`, `PROGRESS.md`, `feature_list.json` — flujo, gate y dependencia.
- `CONTEXT.md`, `docs/build-brief.md`, `docs/domain-model.md`,
  `docs/risks-and-open-questions.md` — estados, compra autenticada y riesgo de
  stock entre carrito y pago.
- `docs/technical-discovery.md`, `ARCHITECTURE.md`, `CONSTRAINTS.md`, `DESIGN.md`
  — Prisma/SQLite, céntimos, auth, seed y UI.
- `prisma/schema.prisma`/migrations — `Order`/`OrderLine` existen sin clave de
  idempotencia; `Variant.stock` es `Int`; `Cart.userId` es único.
- `prisma/seed.ts`, `scripts/db-setup.mjs`, `scripts/verify-seed.mjs` — el
  `update` actual repone stock al arrancar.
- `src/lib/auth.ts`, `src/lib/server/auth.ts`, `src/lib/cart.ts`,
  `src/lib/server/cart.ts`, `/checkout` y sus tests — contratos reutilizables.
- `package.json`, `init.sh`, `/tmp/ai-expert-browser.mjs`,
  `/tmp/ai-expert-mcp-tools.json` — gate y helper MCP; no hay E2E persistente.

### Existing Patterns and Gaps

Seguir rutas Node con body/origen/content-type cerrados, 8 KiB, `no-store`,
mensajes constantes y servicios `src/lib/server`. Reutilizar `getSessionUser`,
owners de carrito, `$transaction`, céntimos enteros y CSS modular de checkout.
Faltan parser/servicio/route de pago, UI, clave idempotente y corrección de
seed/verify.

## Technical Approach

1. Añadir `Order.idempotencyKeyHash String?` y `@@unique([userId,
   idempotencyKeyHash])`. Nullable evita romper pedidos históricos; todo pedido
   nuevo guarda SHA-256 de `Idempotency-Key`, nunca la key cruda.
2. Crear `src/lib/payment.ts`: body exacto `{ outcome: "approved" | "rejected" }`,
   key ASCII de longitud acotada, estados, mensajes y respuestas. Rechazar
   método/origen/content-type/body/key inválidos antes de Prisma.
3. Crear `src/lib/server/payment.ts`: en una transacción consultar primero el
   hash existente (replay incluso con carrito vacío), hacer write-lock benigno
   del `Cart.userId`, leer variantes/productos actuales, validar cantidades,
   stock y sumas seguras, y crear snapshot + total. En `approved`, usar por línea
   `updateMany(stock >= quantity, decrement)` y después borrar `CartItem`; un
   fallo revierte pedido, líneas, stock y carrito. En `rejected`, no mutar stock
   ni carrito. Resolver `P2002` leyendo el pedido ganador y reintentar solo
   conflictos transitorios SQLite de forma acotada.
4. Crear `POST /api/checkout/payment`: validar transporte, leer cookie
   `auth_session`, llamar `getSessionUser`, mapear ausencia a `401`, stock/carrito
   a `409` y fallo interno a `503`; devolver únicamente `ok`, `outcome`,
   `orderId`, `orderStatus` y `totalCents`, siempre `no-store`.
5. Integrar una isla `SimulatedPayment` (o equivalente) en `CheckoutForm` solo
   cuando `isAuthenticated`. Generar una key por intento con
   `crypto.randomUUID()`, conservarla para reintento de red y generar otra para
   «Reintentar» tras rechazo. No guardar key/resultado en `sessionStorage`; el
   borrador conserva exactamente sus cuatro campos.
6. En `prisma/seed.ts`, quitar `stock` del `update` de SKU existente. En
   `verify-seed.mjs`, exigir mezcla disponible/agotada solo sin pedidos y, luego,
   únicamente stock no negativo/variantes presentes.

## Expected File Changes

- `prisma/schema.prisma`, `prisma/migrations/<timestamp>_checkout_payment/` —
  campo nullable e índice de idempotencia, migración no destructiva.
- `src/lib/payment.ts`, `src/lib/server/payment.ts` y tests — contrato,
  snapshot, suma, transacción, stock, idempotencia y concurrencia.
- `src/app/api/checkout/payment/route.ts` y tests — auth, transporte, códigos y
  no filtración.
- `src/app/checkout/page.tsx`, `CheckoutForm`, componente/CSS/tests de pago —
  simulador autenticado, estados accesibles y CTA siguiente.
- `prisma/seed.ts`, `scripts/verify-seed.mjs` — stock runtime persistente.
- `ARCHITECTURE.md`, `CONSTRAINTS.md`, `docs/technical-discovery.md`,
  `docs/domain-model.md`, `docs/risks-and-open-questions.md` — reglas durables.
- `feature_list.json`/`PROGRESS.md`: solo implementador/validator, con evidencia.

## Visual Design Impact

- UI involved: sí. Design source: `DESIGN.md` y checkout existente.
- Estados: bloqueado sin sesión; selector/carga; aprobado; rechazado/cancelado;
  reintento; stock cambiado; error/red; vacío.
- Artefacto nuevo: no. Reutilizar marfil/arena/tinta, oliva/rojo óxido, foco y
  semántica; nunca comunicar el estado solo con color.

## Durable Documentation Impact

- `ARCHITECTURE.md`: update — servicio, snapshot, decremento/limpieza atómicos e
  idempotencia por hash.
- `CONSTRAINTS.md`: update — sesión obligatoria, no confiar en importes,
  no-oversell, replay y seed no reponedor.
- `AGENTS.md`: not needed — workflow sin cambios.
- `docs/technical-discovery.md`: update — contrato simulado y migración.
- `docs/domain-model.md`: update — rechazo termina `CANCELLED`, carrito intacto,
  reintento como otro pedido.
- `docs/risks-and-open-questions.md`: update — cerrar stock/pago simulado.

## Implementation Plan

1. Fijar contrato, hash, migración y mensajes; probarla en SQLite limpio y con
   pedidos históricos.
2. Implementar servicio/route con rollback, guardas de stock, replay y
   concurrencia; después integrar la isla UI.
3. Corregir seed/verify, actualizar docs, ejecutar gate, smoke MCP y QA; dejar
   evidencia para validator.

## Implementation Tasks

- [ ] Migración `idempotencyKeyHash` nullable/única y parser de pago.
- [ ] Servicio transaccional y endpoint autenticado con 400/401/409/503,
  replay y no filtración.
- [ ] Tests de aprobado/rechazado/retry, stale stock/precio, rollback,
  same-key y última unidad concurrente.
- [ ] UI notice/simulador/éxito/rechazo/reintento, key por intento y QA.
- [ ] Seed no reponedor, verify tolerante al stock postventa y docs durables.

## Verification Plan

- Vitest focalizado para parser, servicio, route, checkout y componente: aprobado,
  rechazo, retry con key nueva, stock/precio stale, sin sesión, body/header/
  origin inválidos, doble envío same-key y dos compradores sobre última unidad.
- `prisma validate`, `pnpm db:setup`, `pnpm db:verify`, `pnpm lint`, `pnpm
  typecheck`, `pnpm test`, `pnpm build`, `CI=true ./init.sh`, `git diff --check`
  con Node 22.23.2/pnpm 10.18.3; `init.sh` no arranca servidores.
- Smoke con `/tmp/ai-expert-browser.mjs` en puerto propio: login, pago aprobado,
  rechazo/retry, stock cambiado, cookie ausente, replay secuencial/paralelo.
- QA MCP 390×844/1280×800: notice, selector, estados, errores y vacío; consola
  sin errores ni peticiones fallidas. No existe `pnpm test:e2e` persistente.
- Repetir `pnpm db:setup` tras venta y comparar stock; en base nueva verify aún
  exige disponible/agotada y en base con pedidos solo no-negatividad.

## Evidence To Capture

- Migración/`prisma validate`, gate, SHA y `git diff --check`.
- Filas `PAID` y `CANCELLED` con líneas snapshot/total, stock antes/después y
  carrito; respuestas 401/409; misma key = un `orderId`/decremento.
- Concurrencia de última unidad sin stock negativo; capturas/pasos/URL/commit de
  QA 390/1280; prueba de `db:setup` que conserva stock vendido.

## Validator Checklist

- [ ] Alcance solo `checkout-payment`; sin pasarela real ni features de pedidos.
- [ ] Sesión/owner derivados en servidor; body/header cerrados y `no-store`.
- [ ] Snapshot y total en céntimos; aprobación decrementa/limpia atómicamente;
  rechazo `CANCELLED` conserva stock/carrito.
- [ ] Guardas y transacciones evitan oversell; precios/stock son frescos.
- [ ] Key hasheada/única por usuario; replay no duplica pedido/stock; retry usa
  key nueva de forma explícita.
- [ ] Seed no repone stock y verify es solo lectura/tolera ventas.
- [ ] UI autenticada con notice, aprobado/rechazado/reintento y QA responsive;
  tests, gate, smoke, QA y docs quedan registrados con evidencia.
