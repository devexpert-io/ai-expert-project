# Feature Implementation Spec: Página de carrito y gestión de cantidades

## Source Feature

- `id`: `cart-manage`; `area`: carrito; `source`: `feature_list.json`.
- `depends_on`: `cart-add` (aceptada; commit `a29a2df`).
- `status`: `not_started` en la planificación.

## Goal

Crear `/cart` para que un invitado lea su carrito persistido, vea cada variante con producto, talla/color, precio unitario y cantidad, y ajuste o elimine líneas. El servidor recalcula líneas y subtotal desde `Variant.priceCents`, en céntimos enteros, usando el mismo `cart_guest_token` HTTP-only de `cart-add`.

El enlace «Carrito» será visible desde catálogo y ficha mediante el header compartido. La UI funciona sin cuenta, sin `localStorage` y sin adelantar checkout.

## Non-Goals

- No checkout, usuario, login, pedidos, pago, envío, asociación a `User` ni CTA de pago.
- No reservar/descontar stock; una cantidad puede superar el stock vigente y checkout lo revalidará.
- No cambiar schema/seed, el contrato `POST /api/cart/items`, ni añadir promociones, impuestos, moneda múltiple o dependencia nueva.
- No hace falta una API GET pública: `/cart` puede leer en servidor; las mutaciones sí tienen contrato HTTP.

## Job Story

Cuando ya he añadido variantes como invitado, quiero revisar, corregir o quitar líneas para conocer exactamente qué comprar y cuánto suma antes del futuro checkout.

## Users And Permissions

- **Invitado con cookie válida**: solo puede consultar/mutar el `Cart` asociado a `cart_guest_token`; nunca envía ni recibe el token en JSON.
- **Sin cookie/carrito**: `/cart` muestra vacío; mutar una línea inexistente devuelve `404` sin crear `Cart` ni cookie.
- **Servidor**: resuelve precios/variantes en Prisma, valida `1..2_147_483_647`, calcula totales y devuelve view-model plano sin errores internos.

## Acceptance Scenarios

### Scenario 1: líneas y total

**Given** el token tiene dos `CartItem` existentes **When** se abre `/cart` **Then** se ve una línea por variante con producto enlazable, talla/color, precio, cantidad y subtotal; el resumen muestra `itemCount` y subtotal EUR exactos sin crear otra cookie.

### Scenario 2: vacío

**Given** falta cookie o no hay líneas **When** se abre `/cart` **Then** aparece estado vacío accesible con enlace al catálogo y no se crea identidad.

### Scenario 3: actualizar

**Given** una línea tiene cantidad `2` **When** se introduce `5` y se confirma «Actualizar» **Then** `PATCH /api/cart/items` persiste `5`, devuelve snapshot recalculado y no duplica la línea.

### Scenario 4: eliminar

**Given** existe una línea **When** se pulsa «Eliminar» **Then** `DELETE /api/cart/items` la borra, conserva las demás y recalcula cantidad/subtotal, mostrando vacío si era la última.

### Scenario 5: entrada/línea inválida

**Given** hay campos extra, cantidad decimal/`0`/negativa/mayor que Int32 o la línea no pertenece al token **When** se llama PATCH/DELETE **Then** responde `400`/`404` con mensaje constante y `Cache-Control: no-store`, sin mutación ni error de Prisma.

### Scenario 6: navegación y responsive

**Given** catálogo o ficha en 390×844 y 1280×800 **When** se usa la navegación y se abre el carrito **Then** «Carrito» es visible, no hay overflow, los controles tienen foco y targets ≥44 px, y carga/error usan roles accesibles.

### Scenario 7: stock sin reserva

**Given** una variante queda agotada tras entrar al carrito **When** se consulta o ajusta **Then** se conserva la intención guardada; no se reserva/descuenta stock ni aparece checkout.

## Repository Research

### Files Inspected

- `AGENTS.md`, `PROGRESS.md`, `feature_list.json` — flujo, gate y dependencia aceptada.
- `CONTEXT.md`, `docs/build-brief.md`, `docs/domain-model.md`, `docs/risks-and-open-questions.md` — ciclo del carrito y revalidación futura.
- `DESIGN.md`, `src/app/globals.css`, `src/components/product/product-detail.module.css` — tokens, header, foco y targets.
- `prisma/schema.prisma` — `Cart.guestToken`, `CartItem.quantity`, unicidad y `Variant.priceCents`; no se requiere migración.
- `src/lib/cart.ts`, `src/lib/server/cart.ts`, `src/app/api/cart/items/route.ts` — cookie, límite 8 KiB, Origin, errores, transacción y POST existente.
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/components/product/ProductDetail.tsx` — navegación y puntos de acceso.
- `package.json`, `init.sh` y tests — gate Vitest; no existe `pnpm test:e2e` persistente.

### Existing Patterns To Follow

- Mantener Prisma en módulos `server-only` y devolver view-models planos.
- Reutilizar parser/límite de cuerpo, Origin, mensajes seguros y `no-store` de `cart-add`.
- Hacer `/cart` Server Component dinámico por `cookies()` y aislar PATCH/DELETE en una isla cliente con `credentials: "same-origin"` y `router.refresh()`.

### Current Gaps

- Faltan `/cart`, lectura del carrito, contratos PATCH/DELETE, controles y enlace de navegación.
- Falta E2E persistente; se usará Vitest y `/tmp/ai-expert-browser.mjs` con los nombres de herramienta de `/tmp/ai-expert-mcp-tools.json`.

## Technical Approach

1. Ampliar `src/lib/cart.ts` con tipos `CartView` (`items`, `itemCount`, `subtotalCents`), parser exacto para `{variantId, quantity}`, parser para `{variantId}` y mensajes. Mantener POST sin cambios.
2. Ampliar `src/lib/server/cart.ts` con `getGuestCart`, `updateGuestCartItem` y `removeGuestCartItem`. Seleccionar solo producto/imagen/slug/talla/color/precio; ordenar establemente; calcular `lineTotalCents` y subtotal con enteros y `Number.isSafeInteger`. No crear carrito al leer ni borrar `Cart` al quitar la última línea.
3. Extender `src/app/api/cart/items/route.ts` con `PATCH` y `DELETE`. Ambos aceptan JSON ≤8 KiB, Origin ausente o same-origin, leen cookie existente y devuelven `{ok:true, cart}`. PATCH exige cantidad 1..Int32; DELETE solo `variantId`; línea ausente `404`, entrada `400`, fallo interno `500`; nunca emiten cookie nueva.
4. Crear `src/app/cart/page.tsx` y `CartItemControls` cliente: estado vacío, lista semántica, enlaces a `/products/[slug]?size=…&color=…`, cantidad, actualizar y eliminar. Deshabilitar mientras espera, anunciar `role=status`/`role=alert` y refrescar Server Component tras éxito.
5. Añadir «Carrito» a `src/app/layout.tsx`, ajustar gap responsive y cubrir `/` y `/products/[slug]`.

## Expected File Changes

- `src/lib/cart.ts`, `src/lib/server/cart.ts` — tipos/parsers, lectura y mutaciones.
- `src/app/api/cart/items/route.ts` — PATCH/DELETE sin romper POST.
- `src/app/cart/page.tsx`, `src/components/cart/CartItemControls.tsx` y estilos — página y controles.
- `src/app/layout.tsx`, `src/app/globals.css` — enlace y responsive.
- Tests de lib/servicio/route/página/controles — contratos, totales, cookie, errores y navegación.
- `ARCHITECTURE.md`, `CONSTRAINTS.md`, `docs/technical-discovery.md` — solo decisiones durables nuevas; no tocar `feature_list.json`/`PROGRESS.md` hasta tener evidencia.

## Visual Design Impact

- UI involved: yes. Design source: `DESIGN.md`, tokens globales y estilos de producto.
- Estados: header con enlace, vacío, una/múltiples líneas, pending, error y última eliminación.
- New design artifact required: no; usar marfil/arena, tinta, terracota para foco, oliva éxito y rojo óxido error.

## Durable Documentation Impact

- `ARCHITECTURE.md`: update — lectura server-only, snapshot y mutaciones.
- `CONSTRAINTS.md`: update — cookie exclusiva, Int32, céntimos y sin reserva de stock.
- `AGENTS.md`: not needed — no cambia workflow ni arranque.
- `docs/technical-discovery.md`: update — PATCH/DELETE y página server-side; `docs/domain-model.md`: not needed salvo cambio del modelo.
- `feature_list.json`/`PROGRESS.md`: update posterior por implementador/validator con evidencia.

## Implementation Plan

1. Fijar tipos/parsers y pruebas de snapshot, sumas y límites.
2. Implementar lectura/mutaciones y handlers PATCH/DELETE con tests de cookie, Origin, línea ausente y errores seguros.
3. Construir `/cart`, controles y header; ejecutar gate y QA visual/API en ambos tamaños antes del validator.

## Implementation Tasks

- [ ] Definir `CartView`, parsers cerrados, mensajes y pruebas de campos/cantidades.
- [ ] Consultar líneas con precio de variante; calcular subtotales/total exactos con guardas de entero seguro.
- [ ] Añadir PATCH/DELETE transaccionales sin crear cookie/cart huérfanos y conservar POST.
- [ ] Crear `/cart` y controles con refresco, estados accesibles y enlaces a producto.
- [ ] Integrar header, responsive, tests y docs; no adelantar checkout/auth.

## Verification Plan

- `pnpm test -- src/lib/cart.test.ts src/lib/server/cart.test.ts src/app/api/cart/items/route.test.ts src/app/cart/page.test.tsx src/components/cart/CartItemControls.test.tsx` — contratos, sumas, mutaciones, cookie, errores, accesibilidad y no regresión POST.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` y `CI=true ./init.sh`; `init.sh` no inicia `pnpm dev`.
- Smoke local: añadir dos variantes, abrir `/cart`, actualizar, eliminar, recargar y comprobar cantidades/subtotal en SQLite/HTML; repetir sin cookie para vacío.
- QA con `/tmp/ai-expert-browser.mjs`: app en puerto propio, `/` y `/products/camiseta-basica`, enlace «Carrito», 390×844/1280×800, snapshot, foco, `list_console_messages`, `list_network_requests` y capturas; no existe `pnpm test:e2e`.

## Evidence To Capture

- Tests focalizados, gate completo y `git diff --check` con Node 22.23.2/pnpm 10.18.3.
- Respuestas 200/400/404/500 de PATCH/DELETE sin `Set-Cookie` inesperado y subtotal en céntimos.
- URL, commit, pasos, esperado/observado y capturas `/cart` en ambos tamaños; consola sin errores ni peticiones fallidas.

## Validator Checklist

- [ ] Solo `cart-manage`; POST, checkout y auth no cambian.
- [ ] Pasan escenarios de lectura, actualización, eliminación, total, vacío, límites y navegación.
- [ ] Cookie sigue HTTP-only/server-only y no se usa `localStorage`.
- [ ] Evidencia de tests, gate y QA registrada en `PROGRESS.md`/`feature_list.json` por agentes correspondientes.
- [ ] Sin migración, dependencia ni comportamiento ajeno al alcance.
