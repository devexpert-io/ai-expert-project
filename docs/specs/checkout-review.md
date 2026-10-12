# Feature Implementation Spec: Revisión del checkout y datos de contacto/envío

## Source Feature

- `id`: `checkout-review`; `area`: checkout; `source`: `feature_list.json`.
- `depends_on`: `cart-manage` (aceptada).
- `status`: `not_started` en `feature_list.json`.

## Goal

Crear `/checkout` para que un invitado revise el `CartView` actual y complete los datos mínimos antes de que exista cuenta o pago. El resumen se calcula en servidor con `cart_guest_token` y se enlaza desde `/cart` cuando hay líneas.

El formulario valida y conserva un borrador efímero para que `checkout-user` pueda retomarlo. Solo contiene `name`, `email`, `phone` y `shippingAddress`; vive en `sessionStorage` durante la pestaña y nunca se escribe en SQLite, cookies, URL, logs ni respuestas públicas.

## Non-Goals

- No usuarios, sesiones, contraseñas, login ni asociación del carrito a `User`.
- No pedidos, líneas, pagos simulados, descuentos, cobro o reserva/descuento de stock; la revalidación antes de pagar pertenece a `checkout-payment`.
- No modelo Prisma, migración, endpoint de checkout ni dependencia nueva.
- No `localStorage`, PII en URL/cookies/servidor ni envío del borrador a una API.

## Job Story

Cuando tengo un carrito como invitado, quiero revisar sus líneas y guardar mis datos de contacto y envío, para estar preparado para crear la cuenta y pagar después.

## Users And Permissions

- Un invitado abre `/checkout` y completa el formulario sin sesión.
- Sin cookie, carrito asociado o líneas, se muestra un vacío y no se crea identidad, cookie, fila ni formulario que parezca pagable.
- El servidor lee con `getGuestCart`, recalcula precio/subtotal y entrega solo el view-model plano; el navegador nunca aporta precio, cantidad o token.

## Acceptance Scenarios

### Scenario 1: entrada y resumen

**Given** existe `cart_guest_token` y al menos una línea **When** se pulsa «Continuar al checkout» en `/cart` **Then** `/checkout` muestra producto, talla, color, cantidad, precio unitario, subtotal de línea y subtotal EUR desde `Variant`.

### Scenario 2: vacío seguro

**Given** falta la cookie, no existe el carrito o está vacío **When** se abre `/checkout` **Then** aparece un estado accesible con enlace a `/cart`/catálogo, sin filas/cookies nuevas y sin formulario accionable.

### Scenario 3: invitado

**Given** el visitante no tiene cuenta **When** abre un checkout con líneas **Then** puede ver resumen y formulario sin login; crear cuenta queda fuera hasta `checkout-user`.

### Scenario 4: validación

**Given** el formulario está visible **When** se guarda con un campo vacío, excedido o email inválido **Then** cada campo conserva su valor y muestra error en español enlazado por `aria-describedby`, sin guardar ni hacer red de red.

### Scenario 5: borrador válido

**Given** los cuatro campos son válidos **When** se pulsa «Guardar datos» y se recarga la misma pestaña **Then** se restaura exactamente el objeto versionado `checkout_draft_v1` de `sessionStorage`, aparece `role="status"` y el parser rechaza JSON manipulado o campos extra.

### Scenario 6: privacidad y alcance

**Given** se guarda el borrador **When** se inspeccionan red, cookies, SQLite y URL **Then** esos datos solo aparecen en `sessionStorage`; no se crea usuario, pedido, pago ni token de carrito, y el resumen no contiene el token.

### Scenario 7: responsive/accesibilidad

**Given** se prueba a 390×844 y 1280×800 **When** se recorre resumen, formulario, errores y vacío **Then** móvil apila y escritorio usa dos columnas, sin overflow, con foco visible, targets ≥44 px y estados `status`/`alert` anunciables.

## Repository Research

### Files Inspected

- `AGENTS.md`, `PROGRESS.md`, `feature_list.json`: flujo, gate y dependencia.
- `CONTEXT.md`, `docs/build-brief.md`, `docs/domain-model.md`, `docs/risks-and-open-questions.md`: invitado, compra y stock.
- `DESIGN.md`, `src/app/globals.css`: tokens, layout, foco y responsive.
- `prisma/schema.prisma`: `User.name/phone/shippingAddress`, `Cart`, `CartItem`; no se requiere migración.
- `src/lib/cart.ts`, `src/lib/server/cart.ts`, `src/app/cart/page.tsx`: contrato `CartView`, cookie, totales, vacío y punto de entrada.
- `src/app/layout.tsx`, `package.json`, `init.sh` y tests: navegación y gate.

### Existing Patterns To Follow

- Prisma queda en `server-only`/Server Components y los clientes reciben view-models planos; usar `formatPrice` para céntimos EUR.
- Reutilizar `CART_COOKIE_NAME`, `getGuestCart` y el estado vacío de `/cart`; no regenerar tokens ni añadir una API GET.
- Componentes cliente pequeños, labels visibles, `aria-live`, foco y estados claros.

### Current Gaps

- No existen `/checkout`, CTA, parser de borrador ni formulario.
- No existe `pnpm test:e2e`; el QA usa `/tmp/ai-expert-browser.mjs` y los nombres de `/tmp/ai-expert-mcp-tools.json`.

## Technical Approach

1. Crear `src/lib/checkout.ts` con `CheckoutDraft`, clave `checkout_draft_v1`, límites, normalización y parser cerrado; los errores no incluyen valores.
2. Crear `/checkout` como Server Component dinámico: leer cookie, llamar a `getGuestCart`, renderizar vacío o resumen y montar `CheckoutForm` solo con líneas.
3. Crear `CheckoutForm` cliente: valores vacíos en SSR, rehidratación en `useEffect` solo si el borrador es válido, validación y escritura exclusiva en `sessionStorage`; «Guardar datos» no hace fetch ni navega a pago.
4. Añadir en `/cart` «Continuar al checkout» solo si hay líneas; no cambiar PATCH/DELETE ni el vacío.
5. Usar tarjeta centrada, dos columnas desde 700 px, apilado móvil, tokens de `DESIGN.md`, `autocomplete`, labels y errores asociados.

## Expected File Changes

- `src/lib/checkout.ts` y `src/lib/checkout.test.ts`: contrato, límites y parser.
- `src/app/checkout/page.tsx`, `checkout-page.module.css` y test: ruta, resumen y vacío.
- `src/components/checkout/CheckoutForm.tsx`, CSS y test: validación y sesión.
- `src/app/cart/page.tsx`, CSS/test: CTA condicionado a líneas.
- `ARCHITECTURE.md`, `CONSTRAINTS.md`, `docs/technical-discovery.md`: frontera server-side y borrador efímero; no tocar schema/seed.

## Visual Design Impact

- UI involved: yes. Design source: `DESIGN.md` y estilos de `/cart`.
- Estados: checkout con líneas, vacío, formulario, errores, rehidratación y éxito; carrito con CTA condicionado.
- New design artifact: no; usar marfil/arena, tinta, terracota y rojo óxido.

## Durable Documentation Impact

- `ARCHITECTURE.md`: update — `/checkout`, resumen server-side y sesión efímera.
- `CONSTRAINTS.md`: update — cuatro campos, sin URL/cookie/DB, sin cuenta/pago.
- `AGENTS.md`: not needed — no cambia workflow ni arranque.
- `docs/technical-discovery.md`: update — contrato consumible por `checkout-user`.
- `docs/domain-model.md`: not needed — no cambian entidades ni estados.
- `feature_list.json`/`PROGRESS.md`: los actualizarán implementador/validator con evidencia; este planner no los modifica.

## Implementation Plan

1. Fijar `CheckoutDraft`, parser y tests.
2. Implementar `/checkout`, resumen, vacío y CTA desde `/cart`.
3. Añadir formulario, sesión, errores accesibles, estilos y documentación.
4. Ejecutar tests, gate, smoke y QA visual; registrar evidencia para validator.

## Implementation Tasks

- [ ] Parser cerrado y límites alineados con `User`.
- [ ] `/checkout` server-side desde el token existente, sin crear carrito/cookie.
- [ ] CTA `/cart` → `/checkout` solo para carritos no vacíos.
- [ ] Formulario con required, errores, rehidratación y solo `sessionStorage`.
- [ ] Responsive, accesibilidad, docs y no regresión de `cart-manage`.

## Verification Plan

- `pnpm test -- src/lib/checkout.test.ts src/components/checkout/CheckoutForm.test.tsx src/app/checkout/page.test.tsx src/app/cart/page.test.tsx` — contrato, estados, sesión y CTA.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` y `CI=true ./init.sh`; `init.sh` no inicia procesos largos.
- Smoke con carrito seeded: CTA, resumen, formulario, recarga/restauración; repetir sin cookie y vacío. QA con `/tmp/ai-expert-browser.mjs` en 390×844/1280×800, consola/red/foco/overflow y capturas; no hay E2E persistente.

## Evidence To Capture

- Tests focalizados y gate con Node 22.23.2/pnpm 10.18.3.
- URL/HTML del resumen y CTA; `sessionStorage` con solo cuatro campos, sin PII en requests, cookies, DB o query params.
- Pasos, esperado/observado, commit, consola limpia y capturas de ambos tamaños.

## Validator Checklist

- [ ] Solo `checkout-review`: sin usuarios, sesiones, pedidos, pagos ni stock.
- [ ] Funciona para invitado, carrito con líneas y vacío seguro; resumen coincide con `CartView`/céntimos actuales.
- [ ] Campos obligatorios, normalizados, accesibles; extras/valores inválidos se rechazan sin red.
- [ ] Borrador versionado solo en `sessionStorage`, listo para `checkout-user`, sin PII en red, cookies, URL, DB o logs.
- [ ] Tests, gate, smoke y QA registrados; sin migración, dependencia nueva ni regresiones de `cart-manage`.
