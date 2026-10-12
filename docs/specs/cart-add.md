# Feature Implementation Spec: Añadir variante al carrito

## Source Feature

- `id`: `cart-add`
- `area`: `cart`
- `depends_on`: `product-detail` (aceptada en `feature_list.json`)
- `status`: `not_started` en el momento de planificar
- `source`: `feature_list.json`

## Goal

Permitir que un invitado añada al carrito la variante exacta que ha seleccionado en
la ficha de producto, indicando una cantidad positiva. El carrito se guarda en la
base SQLite existente mediante `Cart`/`CartItem` y una identidad anónima estable en
una cookie HTTP-only, por lo que sobrevive a recargas y no requiere cuenta.

La operación debe volver a comprobar la variante y su stock en el servidor. Una
variante agotada no se puede añadir. El carrito no reserva unidades: si la cantidad
acumulada supera el stock disponible, se conserva como intención del comprador y
`cart-manage`/checkout deberá revalidarla antes de cobrar.

## Non-Goals

- No crear todavía la página `/cart`, edición de cantidades, eliminación ni checkout;
  corresponden a `cart-manage` y a las features de checkout.
- No registrar, autenticar ni asociar un usuario; este slice solo usa identidad de
  invitado y deja preparada la asociación futura del modelo `Cart.userId`.
- No reservar, descontar ni mutar `Variant.stock`, crear pedidos o simular pagos.
- No usar `localStorage`, datos de carrito en el cliente, una base remota ni una
  dependencia nueva; el estado durable vive en SQLite.
- No añadir el flujo de autenticación, merge de carritos, promociones, envío, moneda
  múltiple ni una página de resumen del carrito.

## Job Story

Cuando he elegido una talla y un color disponibles en la ficha,
quiero indicar cuántas unidades y añadirlas al carrito,
para continuar comprando sin crear una cuenta y encontrar el carrito intacto al volver.

## Users And Permissions

- **Invitado**: puede añadir una variante disponible sin sesión. Su carrito se
  identifica exclusivamente con un token opaco emitido por el servidor en cookie.
- **Servidor**: no confía en precio, stock, producto ni nombre enviados por el
  navegador; resuelve `variantId` en Prisma dentro de la mutación y solo persiste la
  cantidad validada.
- **Cliente**: envía únicamente la variante seleccionada y la cantidad, muestra el
  resultado y no recibe Prisma, secretos, tokens legibles ni lógica de autorización.

## Cart Mutation Contract

- Ruta: `POST /api/cart/items`, runtime Node.js, `Content-Type: application/json`.
- Cuerpo exacto: `{ "variantId": string, "quantity": number }`. `variantId` debe
  ser no vacío y `quantity` un entero `1 <= quantity <= 2_147_483_647`, el máximo
  de `CartItem.quantity` en Prisma/SQLite. Campos extra, JSON inválido, cuerpos de
  más de 8 KiB y números fraccionarios, inseguros o fuera de ese rango se rechazan
  (`413` para el cuerpo excesivo).
- El servidor acepta `Origin` ausente (smoke/curl) o igual al origen de la petición;
  un `Origin` externo devuelve error de entrada sin mutar la base. La respuesta usa
  `Cache-Control: no-store`.
- Si no existe `cart_guest_token`, el servidor genera un token aleatorio y lo emite
  como cookie `HttpOnly`, `SameSite=Lax`, `Path=/`, con caducidad de 30 días y
  `Secure` en producción. Nunca se acepta el token en el cuerpo. Una cookie sin una
  fila asociada crea un carrito nuevo con ese mismo token.
- La transacción busca la variante por `id` y selecciona solo `id`, `stock` y los
  campos públicos necesarios para la respuesta. Variante inexistente => `404`;
  `stock = 0` => `409`; entrada inválida/origen ajeno => `400`. Ninguno crea
  `CartItem`.
- Para una variante disponible, se crea `Cart` (con `guestToken`) si hace falta y
  se hace `upsert` por `@@unique([cartId, variantId])`. Si ya existe, se incrementa
  la cantidad solicitada; no se crean duplicados y no se limita artificialmente la
  suma al stock vigente. Si la suma supera `2_147_483_647`, se devuelve `400` sin
  crear ni modificar `Cart`/`CartItem`. La operación debe ser segura ante
  reintentos concurrentes dentro de la transacción SQLite.
- Éxito => `200` y `{ ok: true, item: { variantId, quantity }, itemCount }`, donde
  `quantity` es la cantidad acumulada de esa variante y `itemCount` la suma de
  unidades del carrito. No se exponen precio ni datos que el cliente haya enviado.

## Acceptance Scenarios

### Scenario 1: añade una variante disponible

**Given** `camiseta-basica` tiene la variante `S/Negro` disponible **When** el
invitado selecciona esa pareja, introduce `2` y pulsa «Añadir al carrito» **Then**
la UI muestra confirmación, el endpoint devuelve `200` y el carrito anónimo contiene
un `CartItem` de esa variante con cantidad `2`.

### Scenario 2: acumula la misma variante

**Given** el mismo token ya tiene `S/Negro` con cantidad `2` **When** vuelve a añadir
`1` **Then** sigue existiendo un solo `CartItem`, su cantidad pasa a `3` y
`itemCount` refleja la suma actual del carrito.

### Scenario 3: persiste como invitado

**Given** la primera respuesta emitió `cart_guest_token` **When** se recarga la
ficha o se realiza otra petición con las cookies del navegador **Then** el servidor
resuelve el mismo `Cart` y conserva sus líneas, sin crear `User` ni pedir login.

### Scenario 4: variante agotada

**Given** la ficha identifica `M/Negro` con `stock = 0` **When** se muestra la
selección o se intenta llamar directamente al endpoint **Then** el botón está
deshabilitado, el estado anuncia «Agotada» y la API responde `409` sin crear ni
incrementar un `CartItem`.

### Scenario 5: entrada no confiable

**Given** un `variantId` inexistente, una cantidad `0`, decimal, negativa, mayor que
`2_147_483_647` o un campo adicional **When** se envía la petición **Then** se devuelve `400`/`404` con
mensaje seguro, no se modifica el carrito y no se filtran errores de Prisma.

### Scenario 6: UI accesible y responsive

**Given** una variante disponible y viewport de 390×844 o 1280×800 **When** se
usa teclado o táctil para elegir cantidad y enviar **Then** el control numérico y
el CTA tienen al menos 44 px, foco visible, labels y estado `role=status`/`role=alert`;
la columna de información de la ficha no desborda y los errores se entienden sin
depender solo del color.

### Scenario 7: frontera de alcance

**Given** la feature implementada **When** se revisan ruta, servicio, UI y tests
**Then** no hay página de carrito, checkout, auth, reserva/descuento de stock,
`localStorage`, secretos en cliente, mutaciones de schema/seed ni dependencia nueva.

## Repository Research

### Files Inspected

- `AGENTS.md`, `PROGRESS.md`, `feature_list.json` — flujo, gate, dependencia aceptada
  y contrato de la feature.
- `CONTEXT.md`, `docs/build-brief.md`, `docs/domain-model.md` — carrito de invitado,
  cantidad, persistencia y revalidación de stock en checkout.
- `docs/risks-and-open-questions.md`, `docs/technical-discovery.md` — la elección
  pendiente cookie/localStorage y la frontera SQLite/Next que esta spec resuelve.
- `DESIGN.md`, `src/app/globals.css`, `src/components/product/product-detail.module.css`
  — CTA, tokens, layout, foco y targets táctiles.
- `prisma/schema.prisma` — `Cart.guestToken`, `Cart.userId`, `CartItem.quantity` y
  unicidad `cartId + variantId` ya existen en la migración aceptada.
- `src/app/products/[slug]/page.tsx`, `src/components/product/ProductDetail.tsx`,
  `src/lib/server/product-detail.ts` — selección URL-backed y frontera server/client
  que debe conservarse.
- `src/app/api/chat/route.ts`, `src/app/api/tryon/route.ts`, `src/lib/chat.ts`,
  `src/lib/tryon.ts` — patrón de route handler Node, validación, Origin y respuestas
  JSON seguras.
- `ARCHITECTURE.md`, `CONSTRAINTS.md`, `package.json`, `init.sh` — límites server-only,
  scripts y gate reproducible.

### Existing Patterns And Gaps

- Seguir route handlers `POST` Node con `Response.json`, `Cache-Control: no-store`,
  Origin y errores públicos constantes; usar el singleton Prisma en un módulo
  `server-only` que devuelve tipos planos.
- Mantener `ProductDetail` como Server Component y aislar solo el formulario cliente;
  usar Vitest + Testing Library y el gate de `./init.sh` sin servidor persistente.
- No hay parser, servicio, endpoint, UI, página `/cart` ni contador. La spec deja la
  confirmación/`itemCount` listos para `cart-manage`; no existe `pnpm test:e2e`, así
  que el flujo tendrá tests Vitest y smoke con el MCP de `opencode.json`.

## Technical Approach

1. Crear `src/lib/cart.ts` con límite de cuerpo, constantes de mensajes y un parser
   cerrado para `{variantId, quantity}`. Rechazar campos extra, entradas no escalares
   y cantidades fuera de `1..2_147_483_647`.
2. Crear `src/lib/server/cart.ts` (`import "server-only"`) con tipos planos y una
   operación `addGuestCartItem({ guestToken, variantId, quantity })`. En una
   transacción, resolver la variante, rechazar `stock <= 0`, crear/recuperar `Cart`,
   incrementar el `CartItem` único y calcular `itemCount`. No enviar Prisma al cliente.
3. Crear `src/app/api/cart/items/route.ts`: limitar/parsear el cuerpo, comprobar
   Origin, leer `cart_guest_token` con `cookies()`, generar token si falta, llamar al
   servicio y establecer la cookie segura en la respuesta. Mapear 400/404/409/413/500
   a mensajes constantes y `no-store`; no incluir detalles de Prisma.
4. Crear `src/components/cart/CartAddForm.tsx` y estilos acotados. Recibir la
   `variantId` ya resuelta por `ProductDetail`, mostrar cantidad inicial `1`,
   deshabilitar mientras envía, hacer `fetch` same-origin y presentar confirmación o
   error en `role=status`/`role=alert`. El estado no debe escribirse en storage.
5. Integrar la isla en `ProductDetail`: mostrarla solo para pareja exacta disponible;
   para selección parcial/ inválida mantener el mensaje existente; para agotada,
   explicar el estado y no montar un CTA enviable. Mantener try-on, enlaces y query
   GET sin regresiones.
6. Actualizar documentación durable elegida y añadir tests antes de ejecutar el gate.

## Expected File Changes

- `src/lib/cart.ts` — crear parser, límites y mensajes seguros de la API.
- `src/lib/server/cart.ts` — crear servicio `server-only` para cookie/Cart/CartItem,
  transacción, stock y cantidades acumuladas.
- `src/app/api/cart/items/route.ts` — crear endpoint POST de invitado y cookie.
- `src/components/cart/CartAddForm.tsx`, `src/components/cart/cart-add.module.css` —
  crear isla cliente, cantidad, CTA y estados accesibles.
- `src/components/product/ProductDetail.tsx`,
  `src/components/product/ProductDetail.test.tsx` — integrar el CTA sin cambiar la
  selección de variante ni el alcance de try-on.
- `src/lib/cart.test.ts`, `src/lib/server/cart.test.ts`, `src/app/api/cart/items/route.test.ts`,
  `src/components/cart/CartAddForm.test.tsx` — parser, transacción, cookie/status,
  errores y UI; ampliar ProductDetail para disponibilidad.
- `ARCHITECTURE.md` — update: identidad de invitado, endpoint y frontera server-only.
- `CONSTRAINTS.md` — update: token HTTP-only, validación server-side y no reservar
  stock en el carrito.
- `docs/technical-discovery.md` y `docs/risks-and-open-questions.md` — update para
  resolver la elección SQLite + cookie y retirar esa pregunta abierta.
- `prisma/schema.prisma`, migraciones, `prisma/seed.ts`, `package.json`, lockfile,
  `feature_list.json` y `PROGRESS.md` — no tocar para implementar; los dos últimos
  solo se actualizan después con evidencia real.

## Visual Design Impact

- UI involved: yes.
- Design source: `DESIGN.md`, tokens de `src/app/globals.css` y estilos de la ficha.
- Screens/states: ficha sin selección, variante disponible con cantidad/CTA,
  petición pendiente, confirmación con unidades acumuladas, error de red/entrada y
  agotada; móvil 390×844 y escritorio 1280×800.
- New design artifact required: no. Usar botón primario tinta, superficie marfil,
  oliva para éxito, rojo óxido para error, borde/foco terracota y targets ≥44 px.

## Durable Documentation Impact

- `ARCHITECTURE.md`: update — servicio server-only, `POST /api/cart/items`, cookie
  anónima y persistencia SQLite.
- `CONSTRAINTS.md`: update — token HTTP-only/opaco, validación server-side y carrito
  sin reserva ni descuento de stock.
- `AGENTS.md`: not needed — no cambian runtime, workflow ni permisos del repositorio.
- `docs/technical-discovery.md`: update — fijar cookie/SQLite frente a localStorage.
- `docs/risks-and-open-questions.md`: update — cerrar la decisión y conservar el
  riesgo de revalidación de stock en checkout.
- `docs/domain-model.md`: not needed — ya define carrito de invitado persistente,
  cantidades y revalidación al checkout.
- `feature_list.json`/`PROGRESS.md`: update posterior — solo implementador/validator
  pueden registrar `passing`/`accepted` y evidencia.

## Implementation Plan

1. Fijar parser, mensajes, cookie y códigos de error con tests puros.
2. Implementar servicio transaccional SQLite y route handler con cookie, Origin y
   respuestas seguras; probar creación, acumulación, persistencia y agotada.
3. Construir la isla de cantidad/CTA e integrarla en la ficha para selección válida,
   parcial e invalidada sin afectar try-on ni query params.
4. Actualizar documentación durable y ejecutar tests focalizados, gate, smoke SSR/API
   y QA de navegador; registrar evidencia antes de que validator decida aceptación.

## Implementation Tasks

- [ ] Definir parser cerrado y límites de `variantId`/`quantity`; cubrir JSON inválido,
  campos extra, decimales, negativos, cero, máximo Int32 y desbordamiento.
- [ ] Crear `addGuestCartItem` con `Cart` por token, transacción, `upsert` único,
  cantidad acumulada, `itemCount`, variante inexistente y `stock=0`.
- [ ] Crear `POST /api/cart/items` con Origin, body limit, cookie HTTP-only y mapeo
  200/400/404/409/413/500 sin errores crudos ni cache.
- [ ] Añadir `CartAddForm` con cantidad accesible, estado pendiente/éxito/error y
  desmontaje para selección parcial o agotada; usar `credentials: "same-origin"` y no
  `localStorage`.
- [ ] Cubrir ProductDetail y route con tests de CTA, selección, sold-out, cookie y
  no regresión del try-on.
- [ ] Actualizar `ARCHITECTURE.md`, `CONSTRAINTS.md`, technical discovery y riesgos;
  ejecutar lint, typecheck, tests, build y `./init.sh`.

## Verification Plan

- `pnpm test -- src/lib/cart.test.ts src/lib/server/cart.test.ts
  src/app/api/cart/items/route.test.ts src/components/cart/CartAddForm.test.tsx
  src/components/product/ProductDetail.test.tsx` — parser, transacción, códigos,
  cookie, acumulación, stock agotado, estados accesibles y regresiones.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` y `CI=true ./init.sh` — gate estándar;
  `init.sh` debe ejecutar setup/verificación y no iniciar `pnpm dev`.
- Smoke local en un puerto propio: abrir `/products/camiseta-basica`, elegir
  `S/Negro`, introducir `2`, añadir, recargar y añadir `1`; conservar la cookie y
  comprobar en la respuesta/SQLite cantidad acumulada `3`. Repetir con `M/Negro`
  agotada y comprobar CTA disabled/`409` sin `CartItem`.
- QA navegador con el MCP `chrome-devtools` de `opencode.json` (o su transporte
  stdio disponible): 390×844 y 1280×800, teclado/foco, consola sin errores y red
  sin peticiones fallidas. Registrar URL, commit, pasos, esperado y observado en
  `PROGRESS.md`/`feature_list.json` cuando implemente/valide el agente.
- No existe `pnpm test:e2e`; los tests de route/servicio/componente y el smoke de
  navegador cubren esta mutación hasta que el repo incorpore un arnés E2E persistente.

## Evidence To Capture

- Salida de tests/gate con Node 22.23.2/pnpm 10.18.3 y `git diff --check` limpio.
- `Set-Cookie` con flags esperados, dos peticiones con el mismo token y snapshot SQLite
  con una sola fila `Cart`/`CartItem`, suma de cantidades y ningún `User`.
- Casos disponible/repetición/recarga, inexistente, inválido y agotado sin mutación;
  registro de 390×844/1280×800, foco/labels/status, consola limpia y red esperada.
- Revisión estática: no `localStorage`, no secretos/Prisma en cliente, Origin/body
  limitados, cookie HttpOnly/SameSite/Secure, sin schema/seed/dependencias ni checkout.

## Validator Checklist

- [ ] Solo `product-detail` aceptada se usa como dependencia; no se adelantan
  `cart-manage`, checkout, auth, pedidos o pagos.
- [ ] Variante válida disponible crea un `CartItem` con la cantidad indicada y el
  segundo añadido acumula la misma fila de forma transaccional sin superar el
  máximo Int32; el desbordamiento devuelve `400` sin mutación.
- [ ] `cart_guest_token` es aleatorio, HTTP-only, SameSite=Lax, Path=/, con caducidad
  y Secure en producción; recarga conserva el mismo carrito de invitado.
- [ ] El servidor resuelve variante/stock por ID; no confía en precio/nombre/stock del
  cliente ni permite añadir `stock=0`; cantidades inválidas no mutan la base.
- [ ] La suma puede superar el stock sin descontarlo ni reservarlo; la spec/evidencia
  deja la revalidación para checkout.
- [ ] Respuestas 200/400/404/409/413/500 son seguras, `no-store`, sin errores de
  Prisma ni secretos; Origin externo no muta.
- [ ] UI solo ofrece CTA para pareja exacta disponible, tiene cantidad, estados
  accesibles, foco/targets y funciona en 390×844 y 1280×800 sin regresiones del detalle.
- [ ] Tests focalizados, lint, typecheck, build, `./init.sh`, smoke API/SQLite y QA
  navegador dejan evidencia reproducible; no hay procesos de larga vida abandonados.
- [ ] Documentación durable actualizada y `feature_list.json`/`PROGRESS.md` registran
  evidencia/estado solo después de implementación y validación independiente.
