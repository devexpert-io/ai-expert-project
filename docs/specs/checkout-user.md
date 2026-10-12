# Feature Implementation Spec: Creación de usuario en el checkout

## Source Feature

- `id`: `checkout-user`; `area`: `checkout`; `source`: `feature_list.json`.
- `depends_on`: `checkout-review` (aceptada, commit `5ca354a`).
- `status`: `not_started` al planificar.

## Goal

Extender `/checkout` para que el comprador convierta el borrador válido de
`checkout-review` en una cuenta: registro con email/contraseña o login de una
cuenta existente. En ambos casos se materializan `name`, `email`, `phone` y
`shippingAddress` en `User` y se establece una sesión autenticada.

La misma transacción debe conservar el carrito. El carrito invitado se asocia al
nuevo usuario o se fusiona con el carrito existente del usuario, sumando líneas
iguales y conservando las demás. Después se invalida el antiguo
`cart_guest_token` en SQLite y se expira su cookie para que no siga siendo un
bearer token. `/cart`, `/checkout` y las APIs de carrito continúan desde la sesión.

## Non-Goals

- Pago simulado, `Order`/`OrderLine`, revalidación/reserva de stock y confirmación:
  pertenecen a `checkout-payment`.
- Pedidos, roles, OAuth, MFA, email verification, reset/cambio de contraseña,
  panel de cuenta, rate limiting o acceso del chatbot a pedidos.
- Tokens en JSON/URL/`localStorage`/logs/HTML, secretos en respuestas, cuentas
  demo, migraciones destructivas o cambios de los contratos de invitado.

## Job Story

Cuando he rellenado los datos de contacto/envío y tengo un carrito,
quiero crear una cuenta o entrar con la que ya tengo,
para continuar sin perder líneas ni exponerlas a otra cuenta.

## Users And Permissions

- Un invitado solo puede asociar el `Cart` identificado por su cookie HTTP-only.
- Una sesión válida autoriza únicamente el `Cart.userId` resuelto en servidor;
  ningún `userId`, precio o token llega desde el cliente.
- Sesión ausente/expirada significa invitado. Una cuenta activa muestra «Cerrar
  sesión»; para cambiar de cuenta se revoca primero la sesión actual.

## Authentication And Session Contract

- `POST /api/auth/checkout`, `application/json`, `Origin` ausente o same-origin;
  origen externo, JSON inválido o body real >8 KiB => `400`. El cuerpo cerrado
  exacto es `{ mode, email, password, name, phone, shippingAddress }`.
- `mode` es `register|login`; email/contacto reutilizan normalización y límites
  de `src/lib/checkout.ts`; `password` es cadena de al menos 8 caracteres y como máximo 72 bytes UTF-8 (límite bcrypt; rechazar sin truncar). Campos
  extra o tipos incorrectos no abren una transacción.
- Registro crea `User` con hash bcrypt (coste fijo 12), email único y contacto.
  Email existente => `409` constante, sin tocar carrito/sesión. Login compara
  bcrypt; credencial inválida => `401` genérico sin enumerar cuentas.
- Éxito => `200 { ok: true }`, sin `userId`, hash, password, token o Prisma. El
  token es aleatorio, se guarda solo como hash SHA-256 en `Session` (`userId`,
  `expiresAt`) y el valor crudo solo viaja en cookie `auth_session`.
- `auth_session`: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=2592000` y
  `Secure` en producción, sin `Domain`. Cada login/registro emite token nuevo; si ya hay sesión válida, la API devuelve 409 y exige cerrar sesión antes de cambiar cuenta. Todas
  las respuestas son `Cache-Control: no-store`; nunca se registran secretos/PII.
- `POST /api/auth/logout` no acepta cuerpo, valida Origin, revoca la sesión actual
  y expira `auth_session` (`Max-Age=0`); sin sesión es idempotente.

## Cart Association And Merge Contract

- Registro/login, actualización de contacto, merge y creación de `Session` son
  atómicos. Un fallo deja usuario, sesión y ambos carritos sin cambios.
- Solo carrito invitado: reutilizar su fila, fijar `userId` y `guestToken=null`,
  conservar líneas. Ambos carritos: transferir líneas, sumar variante repetida y
  mantener distintas; suma > `2_147_483_647` => `409` antes de escribir. Después
  eliminar la fila invitada o dejarla sin token/líneas, nunca resoluble por el
  token antiguo.
- Éxito expira `cart_guest_token` y mantiene solo `auth_session`; respuesta no
  contiene tokens. No se consulta ni descuenta stock; `CartView` sigue saliendo
  de `Variant.priceCents`.
- Con sesión válida, `POST/PATCH/DELETE /api/cart/items`, `/cart` y `/checkout`
  priorizan `userId` y no emiten cookie invitada. Sin sesión conservan exactamente
  los contratos de `cart-add`/`cart-manage`.

## Acceptance Scenarios

### Registro y sesión

**Given** invitado con líneas y borrador válido **When** crea cuenta con password
válido **Then** `User.passwordHash` es bcrypt no reversible, los cuatro datos se
guardan, la cookie tiene los flags indicados y no se filtran secretos.

### Asociación y revocación

**Given** el registro tiene `cart_guest_token` **When** termina **Then** `/cart`
con la sesión muestra las mismas líneas/totales, las mutaciones usan `userId`,
la cookie invitada expira y el token antiguo no lee ni modifica el carrito.

### Login y merge

**Given** cuenta y carrito existentes más carrito invitado **When** login válido
**Then** líneas distintas sobreviven, repetidas suman dentro de Int32, contacto
se actualiza y queda un solo carrito del usuario.

### Errores y atomicidad

**Given** password inválido, email duplicado, body/origen no válido o overflow
de merge **When** se envía la petición **Then** responde `400/401/409` seguro,
sin `Set-Cookie` de sesión ni mutación parcial; el token invitado sigue usable
cuando no hubo éxito.

### Continuidad y aislamiento

**Given** `auth_session` de A **When** A abre/muta `/cart` o añade una variante
**Then** solo toca su carrito y no crea cookie invitada. B nunca puede ver A;
logout revoca sesión, expira cookie y permite entrar como B sin heredar líneas.

### UI

**Given** registro, login, error o sesión activa **When** se prueba a 390×844 y
1280×800 **Then** el checkout se apila/expande según `DESIGN.md`, sin overflow,
con labels, foco, targets ≥44 px y estados `status`/`alert` anunciables.

## Repository Research

### Files Inspected

- `AGENTS.md`, `PROGRESS.md`, `feature_list.json`: flujo, gate y dependencia.
- `CONTEXT.md`, `docs/build-brief.md`, `docs/domain-model.md`,
  `docs/risks-and-open-questions.md`: usuario en checkout, carrito invitado y
  merge esperado.
- `docs/technical-discovery.md`: email/password, bcrypt considerado, SQLite y
  contratos de carrito; `DESIGN.md` y CSS: layout/foco/responsive.
- `prisma/schema.prisma`: `User` ya tiene credenciales/contacto, `Cart.userId`
  único y `Cart.guestToken` nullable/único; falta `Session`.
- `src/lib/checkout.ts`, `CheckoutForm`, `/checkout`: borrador cerrado en
  `sessionStorage` y punto de integración.
- `src/lib/server/cart.ts`, `/api/cart/items`, `/cart`: cookie, `CartView`,
  límites Int32, Origin, `no-store` y operaciones a generalizar.
- `package.json`, `init.sh`, tests y `/tmp/ai-expert-browser.mjs`: gate/QA; no
  existe `pnpm test:e2e` persistente.

### Current Gaps

No hay `Session`, parser auth, hash, endpoints, logout, merge ni owner
autenticado. El formulario solo guarda el borrador; las páginas/APIs solo leen
`cart_guest_token`.

## Technical Approach

1. Añadir `Session` (`tokenHash` único, `userId`, `expiresAt`, timestamps),
   relación `User.sessions` y migración Prisma. Elegir sesión opaca persistida:
   permite revocación/logout y aislamiento sin un secreto de firma; la cookie
   firmada evitaría migración, pero no revoca tokens individuales. Usar bcrypt
   mediante `bcryptjs` (bcrypt sin binario nativo) como única dependencia nueva
   si el lockfile no ofrece otra implementación.
2. Crear contratos puros para body, límites, cookies y mensajes; servicio
   `server-only` para bcrypt, token aleatorio/hash SHA-256, expiración, lookup y
   revocación. Crear `/api/auth/checkout` y `/api/auth/logout` con Origin/body
   cerrado y transacciones de usuario/merge/sesión.
3. Generalizar `src/lib/server/cart.ts` a owner usuario/invitado y actualizar
   route, `/cart` y `/checkout` para priorizar sesión sin romper invitado.
4. Extender `CheckoutForm` con password, modo registro/login, CTA y logout;
   guardar aún solo los cuatro campos de `checkout_draft_v1`, nunca password/token.

## Expected File Changes

- `prisma/schema.prisma`, `prisma/migrations/<timestamp>_checkout_user/`: `Session`
  e índices; no tocar seed de catálogo.
- `package.json`, `pnpm-lock.yaml`: solo `bcryptjs` (o bcrypt ya compatible),
  sin framework auth.
- `src/lib/auth.ts` y tests: parser, límites, cookies y mensajes sin secretos.
- `src/lib/server/auth.ts` y tests: hash/compare, sesión, registro/login/logout,
  merge transaccional y rollback por overflow.
- `src/app/api/auth/checkout/route.ts`, `src/app/api/auth/logout/route.ts` y
  tests: contratos, cookies, códigos y no fuga.
- `src/lib/server/cart.ts`, `/api/cart/items`, `/cart`, `/checkout` y tests:
  owner autenticado, continuidad y no emisión de cookie invitada.
- `src/components/checkout/CheckoutForm.tsx`, CSS y tests: modos, password en
  memoria, estados accesibles y logout.
- `ARCHITECTURE.md`, `CONSTRAINTS.md`, `docs/technical-discovery.md`,
  `docs/domain-model.md`, `docs/risks-and-open-questions.md`: decisión y reglas
  durables. `feature_list.json`/`PROGRESS.md` solo los actualizarán implementador
  y validator con evidencia.

## Visual Design Impact

- UI involucrada: sí. Fuente: `DESIGN.md` y estilos actuales de checkout/carrito.
- Estados: borrador rehidratado, registro, login, password inválido, email
  duplicado, éxito/merge, sesión activa, logout y vacío.
- No requiere artefacto nuevo; conservar tokens marfil/arena/tinta/terracota,
  oliva de éxito y rojo óxido de error, sin depender solo del color.

## Durable Documentation Impact

- `ARCHITECTURE.md`: update — `Session`, bcrypt, cookies y owner del carrito.
- `CONSTRAINTS.md`: update — cookie opaca persistida, merge atómico, revocación y
  prohibición de secretos/PII en respuestas/logs.
- `AGENTS.md`: not needed — workflow/arranque no cambian.
- `docs/technical-discovery.md`: update — cerrar decisión auth y contratos.
- `docs/domain-model.md`: update — relación técnica `User`–`Session` y expiración.
- `docs/risks-and-open-questions.md`: update — cerrar auth; stock queda para pago.

## Implementation Plan

1. Fijar contrato, `Session`, migración, dependencia bcrypt y parsers con tests.
2. Implementar servicio server-only de auth/merge/revocación y endpoints; probar
   credenciales, overflow, cookies e aislamiento.
3. Integrar owner autenticado en carrito/checkout y UI registro/login/logout;
   actualizar docs sin adelantar pago/pedidos.
4. Ejecutar gate, smoke local y QA visual, y dejar evidencia para validator.

## Implementation Tasks

- [ ] Crear `Session`/migración reproducible y mantener seed/setup no destructivo.
- [ ] Parser cerrado de auth, password >=8 caracteres y <=72 bytes UTF-8, email/contacto, Origin y 8 KiB.
- [ ] Bcrypt hash/compare, cookie `auth_session`, rotación y logout revocable.
- [ ] Asociación/merge atómico, suma segura Int32 y revocación del token invitado.
- [ ] Priorizar sesión en `/cart`, `/checkout` y `POST/PATCH/DELETE` de carrito.
- [ ] Añadir registro/login/password/logout a `CheckoutForm` sin persistir password.
- [ ] Cubrir invalid credentials, duplicate email, merge/isolation, old token,
  flags, body/origin, accesibilidad y regresión invitada; actualizar docs.

## Verification Plan

- `pnpm test -- src/lib/auth.test.ts src/lib/server/auth.test.ts
  src/app/api/auth/checkout/route.test.ts src/app/api/auth/logout/route.test.ts
  src/lib/server/cart.test.ts src/app/api/cart/items/route.test.ts
  src/app/cart/page.test.tsx src/app/checkout/page.test.tsx
  src/components/checkout/CheckoutForm.test.tsx`.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, `CI=true ./init.sh` y
  `git diff --check`, con Node 22.23.2/pnpm 10.18.3 y SQLite temporal para
  migración/merge; `init.sh` no arranca servidores.
- Smoke con `/tmp/ai-expert-browser.mjs`: carrito invitado → registro → DB/cookies
  → `/cart` y mutaciones → token antiguo → logout → login como otra cuenta; repetir
  invalid login/duplicate/overflow. QA 390×844/1280×800, consola limpia y red sin
  fallos; no hay E2E persistente.

## Evidence To Capture

- Tests/gate, migración aplicada, SHA y `git diff --check`.
- `passwordHash` y `Session.tokenHash` solo como hashes; `Cart.userId` correcto,
  `guestToken` nulo/ausente tras merge y rollback intacto ante overflow.
- Headers `Set-Cookie` de éxito/logout y respuestas 400/401/409 sin mutación.
- Pasos, URL, esperado/observado y capturas; A no lee B ni token antiguo y logout
  permite cambio de cuenta.

## Validator Checklist

- [ ] Solo `checkout-user`: sin pago/pedidos/stock/reset-password/email verification.
- [ ] Body/Origin/cookies cerrados; invalid credentials no mutan ni filtran secretos.
- [ ] Bcrypt, sesión opaca persistida, expiración/rotación y logout revocable.
- [ ] Carrito se conserva/fusiona atómicamente, overflow hace rollback y token
  antiguo queda revocado; APIs/páginas usan `userId` tras auth.
- [ ] Aislamiento entre cuentas, cambio tras logout y regresión de invitado probados;
  no se emite cookie invitada con sesión válida.
- [ ] Borrador mantiene exactamente cuatro campos y password solo vive en memoria.
- [ ] Tests, gate, smoke, QA y docs registrados por implementador/validator; sin
  cambios no relacionados, seed demo, `localStorage` ni migración destructiva.
