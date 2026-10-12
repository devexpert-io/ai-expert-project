# Technical Discovery

## Product Surface

Web app responsive (móvil + escritorio). El foco es el navegador; sin apps nativas en el MVP.

## Candidate Stack

- **Frontend/Backend**: Next.js (React) con API routes / server actions. Monolito simple.
- **Lenguaje**: TypeScript.
- **Persistencia**: SQLite vía **Prisma** (decisión tomada; ver `ARCHITECTURE.md`). Cero configuración externa; se ajusta al requisito de lanzar en local con un comando. `DATABASE_URL="file:./dev.db"`.
- **Seed data**: migración y carga idempotente de catálogo al iniciar. La
  migración inicial crea `User`, `Product`, `Variant`, `Category`, `Cart`,
  `CartItem`, `Order`, `OrderLine`, `Chat` y `TryonImage`; `prisma/seed.ts`
  aporta 4 categorías, 6 productos y 24 variantes de ejemplo, sin usuarios ni
  pedidos demo.

## Data and Storage

- SQLite local, inicializada con seed (productos, categorías, variantes, stock).
- Tablas principales: `User`, `Product`, `Variant`, `Category`, `Cart`/`CartItem`, `Order`, `OrderLine`, `Chat`, `TryonImage`.
- Los archivos de imagen del try-on no se persisten en este MVP.
- **Foto de entrada (`tryon-upload`)**: solo memoria del navegador
  (`File` + `URL.createObjectURL`). No se escribe en disco, `public/`,
  cookies, `localStorage` ni la fila `TryonImage`.
- **Imagen generada (`tryon-result`)**: data URL efímera en memoria
  (`data:image/png|jpeg;base64,...`). Recargar o «Quitar foto» la descarta.
  No hay disco local, URL temporal persistida ni fila `TryonImage`.

## Integrations

Toda la IA se sirve desde **DevExpert Inference**, un gateway compatible con OpenAI (no se llama a OpenAI directamente). Es parte de la formación AI Expert: cada estudiante usa **su propia** `DEVEXPERT_API_KEY` (personal e intransferible, se muestra una sola vez al crearla en el portal).

- **URL base**: `https://inference.devexpert.io/v1`.
- **Clave**: variable de entorno `DEVEXPERT_API_KEY` (no commitear; usar `.env` y `.env.example`). Sin clave, las funciones de IA degradan con un mensaje claro.
- **Configuración**: `DEVEXPERT_BASE_URL` (por defecto `https://inference.devexpert.io/v1`), `DEVEXPERT_CHAT_MODEL` (`chat`), `DEVEXPERT_CHAT_PRO_MODEL` (`chat-pro`), `DEVEXPERT_IMAGE_MODEL` (`image-edit`) y `DEVEXPERT_EMBEDDING_MODEL` (`embedding`). Los valores se recortan y la base URL debe ser absoluta HTTP(S).
- **Compatibilidad**: al ser OpenAI-compatible, funciona con el cliente oficial `openai` (SDK TypeScript/Python) solo cambiando `apiKey` y `baseURL`.
- **Límites**: cada clave tiene un uso semanal que se repone solo; al llegar al 100% las peticiones se rechazan hasta el reseteo. La app debe manejar el error 429/uso y mostrarlo con claridad.
- **Frontera**: `src/lib/server/ai/config.ts` y `provider.ts` son módulos `server-only`; el cliente se crea de forma lazy, no se llama durante construcción y usa `maxRetries: 0`. El adapter no devuelve la clave ni errores crudos.
- **Degradación**: `missing_api_key`, `invalid_configuration`, `invalid_api_key`, `quota_exhausted`, `provider_unavailable` y `provider_error`, con mensajes constantes aptos para usuario. No se reintenta automáticamente.

### Chatbot IA
- Endpoint `POST /chat/completions` (OpenAI-compatible).
- Modelo diario: `chat`. Para tareas complejas: `chat-pro`.
- Inyectar directamente el catálogo pequeño en el prompt para recomendar productos válidos; la salida usa JSON con IDs y se reconstruye en servidor, sin embeddings/RAG por ahora.
- La búsqueda semántica vía embeddings queda fuera mientras el catálogo siga siendo pequeño; la calidad subjetiva del modelo real sigue pendiente de probar con una clave real.

### Try-on (prueba virtual)
- Uso de edición de imagen con imagen de entrada: `POST /images/edits`, modelo `image-edit` (enviar en `multipart/form-data` la foto del usuario + prompt con la prenda).
- Alternativa: generación pura `POST /images/generations`, modelo `image`.
- **La ruta de proveedor/modelo debe ser configurable** (por env), no cableada a un único endpoint.
- La foto del usuario viaja al gateway: tratar como dato personal; avisar al usuario y no persistirla innecesariamente.
- `POST /api/tryon` envía la foto y un prompt de servidor a
  `POST /images/edits` (`image-edit` configurable). El resultado vive solo
  como data URL en el navegador.

### Pasarela de pago
- Simulada internamente. Sin integración de terceros en el MVP.
- `POST /api/checkout/payment` exige una sesión válida, `Idempotency-Key` ASCII
  acotada y `{ outcome: "approved" | "rejected" }` sin campos adicionales; todas
  las respuestas son `no-store` y no devuelven userId, token, precios enviados por
  el navegador ni datos de Prisma.
- El servicio relee en SQLite el `Cart.userId`, las cantidades y el precio/stock de
  cada `Variant`, y crea en la misma transacción un `Order` y sus `OrderLine` con
  snapshots. `approved` usa decrementos condicionales y elimina el carrito;
  `rejected` crea `CANCELLED` y conserva carrito/stock. El hash SHA-256 de la
  clave queda en `Order.idempotencyKeyHash` con unicidad por usuario para replay y
  concurrencia. Las claves nuevas permiten reintentar un rechazo.

## Authentication and Authorization

- Sesión de invitado anónima mediante cookie HTTP-only para el carrito; el estado durable vive en SQLite y no en `localStorage`.
- Registro/login de usuario en el checkout vía credenciales (email + password). `bcryptjs` con coste fijo 12 guarda solo `User.passwordHash`; se rechazan passwords de menos de 8 caracteres o de más de 72 bytes UTF-8 sin truncar.
- `Session` guarda `tokenHash` SHA-256, `userId` y `expiresAt`; el token aleatorio crudo solo vive en `auth_session` (HttpOnly, SameSite=Lax, Path=/, 30 días, Secure en producción). Logout borra la fila y expira la cookie.
- `POST /api/auth/checkout` acepta solo `{ mode, email, password, name, phone, shippingAddress }`, valida Origin/body cerrado y realiza usuario/contacto, merge del carrito y sesión en una transacción. Email duplicado, credencial inválida, sesión activa y overflow responden sin mutación parcial ni secretos.
- Con sesión válida, `/cart`, `/checkout` y las APIs del carrito resuelven el `Cart` por `userId`; el carrito invitado se asocia o fusiona sumando líneas y el `cart_guest_token` antiguo se revoca y expira. Sin sesión se conserva exactamente el contrato invitado.
- Los pedidos solo son visibles para el usuario propietario.

## Deployment and Operations

- Local: un solo comando (`pnpm dev` o `pnpm start` + `pnpm db:setup`
  automático). El setup copia `.env.example` solo si falta `.env`, genera el
  cliente, aplica migraciones pendientes y ejecuta el seed sin borrar filas.
  Se prefiere `pnpm`.
- Sin despliegue en la nube en el MVP (no obstante, el stack local es portable).
- Variables de entorno en `.env` (claves de IA), con `.env.example`.

## Testing and Verification

- Tests unitarios del dominio (catálogo, carrito, checkout, estados de pedido).
- Smoke test del flujo de compra y de las funciones de IA con clave real o mock.
- Gate local reproducible: `pnpm db:setup`, `pnpm db:verify`, lint +
  typecheck + tests + build desde `./init.sh`.

### Contrato implementado de creación de usuario en checkout (`checkout-user`)

- `src/lib/auth.ts` mantiene el parser cerrado, límites de body/password,
  mensajes constantes y serialización de cookies sin secretos. El password solo
  se mantiene en memoria de `CheckoutForm`; el borrador de `sessionStorage` sigue
  teniendo exactamente los cuatro campos de contacto.
- `src/lib/server/auth.ts` usa bcryptjs, tokens aleatorios con hash SHA-256,
  expiración/revocación de `Session` y merge atómico. La suma de líneas se valida
  antes de mutar y una sesión activa fuerza logout antes de cambiar de cuenta.
- `POST /api/auth/checkout` y `POST /api/auth/logout` responden `no-store`,
  validan Origin y no devuelven userId, hash, token ni datos Prisma. Los errores
  de credenciales se mantienen genéricos.
- La identidad del carrito es una unión de `guestToken`/`userId` en
  `src/lib/server/cart.ts`; con sesión se prioriza el usuario y no se emite una
  cookie invitada nueva. `POST /api/checkout/payment` es el único consumidor de
  pago/stock: relee la identidad y las variantes en servidor, crea snapshots y
  aplica las transiciones atómicas descritas arriba.

### Contrato implementado de pago simulado (`checkout-payment`)

- `src/lib/payment.ts` valida el contrato cerrado y la clave ASCII; la ruta Node
  valida Origin, JSON, límite de cuerpo y sesión antes de delegar en
  `src/lib/server/payment.ts`.
- `Order.idempotencyKeyHash` nullable permite conservar pedidos previos a este
  slice. La combinación `(userId, idempotencyKeyHash)` es única; el servicio
  resuelve primero un replay, serializa la fila del carrito y reintenta conflictos
  SQLite acotados.
- `CheckoutForm` monta `SimulatedPayment` solo con sesión. La UI muestra el aviso
  «Pago simulado — no se ha realizado ningún cargo», conserva la clave para un
  reintento de red, crea otra después de `CANCELLED`, y no guarda clave ni resultado
  en `sessionStorage`.

## Contrato implementado del carrito anónimo (`cart-add`)

- `POST /api/cart/items` recibe únicamente `{ variantId, quantity }` como JSON;
  el cuerpo se limita a 8 KiB, se rechazan campos extra, cantidades no enteras o
  no positivas y `Origin` explícito ajeno. Todas las respuestas llevan
  `Cache-Control: no-store`.
- El servidor genera `cart_guest_token` cuando falta y lo emite como cookie
  `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=2592000` y `Secure` en producción.
  La cookie se reutiliza al recargar y una fila sin carrito asociado se crea con el
  mismo token.
- `src/lib/server/cart.ts` resuelve la variante y su stock dentro de una transacción,
  rechaza inexistentes (`404`) y agotadas (`409`), y hace `upsert` de la única línea
  `(cartId, variantId)` acumulando cantidad. Acepta cantidades de 1 a `2_147_483_647`
  y devuelve `400` antes de escribir si la suma de una línea desbordaría ese máximo.
  No devuelve precios ni datos de Prisma, no reserva stock y no crea usuarios.

## Contrato implementado de gestión del carrito (`cart-manage`)

- `/cart` lee `cart_guest_token` en un Server Component. Sin cookie o sin fila
  asociada devuelve un estado vacío sin crear identidad. Con cookie devuelve un
  snapshot plano ordenado de forma estable con producto, slug, imagen, talla,
  color, precio unitario, cantidad, subtotal de línea, `itemCount` y
  `subtotalCents`, calculados desde `Variant.priceCents`.
- `PATCH /api/cart/items` recibe exactamente `{ variantId, quantity }` y
  `DELETE /api/cart/items` exactamente `{ variantId }`; ambos mantienen el límite
  efectivo de 8 KiB, validan `Origin` y `Content-Type`, responden `no-store` y
  requieren una cookie existente. Una línea ausente devuelve `404`; cantidades
  inválidas devuelven `400`; ningún handler emite `Set-Cookie` ni crea `Cart`.
- Las mutaciones son transacciones Prisma que actualizan o eliminan la línea
  `(cartId, variantId)`, conservan una fila `Cart` vacía y devuelven el snapshot
  recalculado. No consultan ni reservan stock: la revalidación corresponde al
  checkout. La UI refresca el Server Component tras un éxito y no usa
  `localStorage`.

## Contrato implementado de revisión del checkout (`checkout-review`)

- `/checkout` es un Server Component dinámico. Lee el token existente con
  `cookies()` y reutiliza `getGuestCart`; no acepta precios, cantidades ni tokens
  del cliente. Sin cookie, carrito asociado o líneas muestra un vacío accesible
  con enlaces a carrito/catálogo y no crea filas, cookies ni formulario.
- Con líneas, el resumen muestra producto, talla, color, cantidad, precio unitario,
  subtotal de línea, unidades y subtotal EUR a partir de `CartView`. El CTA
  `Continuar al checkout` solo aparece en `/cart` cuando hay líneas.
- `CheckoutForm` es la única isla cliente de este slice. Sus cuatro campos
  obligatorios (`name`, `email`, `phone`, `shippingAddress`) se normalizan y
  validan con contrato cerrado y límites seguros. El borrador exacto vive solo
  como JSON en `sessionStorage["checkout_draft_v1"]` durante la pestaña; se
  rehidrata tras recarga solo si `parseCheckoutDraft` rechaza campos extra,
  valores inválidos o JSON manipulado. Guardar no hace peticiones de red.
- Este slice no crea usuarios/sesiones, pedidos, pagos ni reservas de stock. El
  borrador queda como contrato de entrada para `checkout-user`; la revalidación de
  disponibilidad pertenece a `checkout-payment`.

## Observability

- Logs claros en el flujo de pago y de los errores de las APIs de IA (sin exponer claves).
- Manejo visible de fallos del try-on y del chatbot.

## Constraints

- **Debe ejecutarse en local con un comando**: sin servicios externos obligatorios, sin base de datos remota.
- **Formación / AI Expert**: cada estudiante trae su propia `DEVEXPERT_API_KEY`. La app debe leerla de env y funcionar sin ella (degradación controlada de las funciones de IA).
- Claves de IA externas: opcionales para arrancar; si no hay clave, las funciones de IA deben degradar con un mensaje claro (fallo controlado) y manejar el límite de uso semanal.
- **Uso semanal limitado**: no abusar de `chat-pro` ni de generaciones de imagen; dar mensajes claros cuando se agote el cupo.
- Privacidad de la foto del try-on: se sube al gateway `inference.devexpert.io`; documentar y tratar como dato personal.

## Referencias

- Documentación de DevExpert Inference: https://portal.devexpert.io/docs
  - Empezar / variable de entorno: https://portal.devexpert.io/docs/start
  - Endpoint y modelos: https://portal.devexpert.io/docs/endpoint
  - Chat: https://portal.devexpert.io/docs/chat
  - Imagen: https://portal.devexpert.io/docs/images
  - Embeddings: https://portal.devexpert.io/docs/embeddings

## Contrato implementado de conversación (`chatbot-conversation`)

- `POST /api/chat`: JSON `{ message, history }`, historial alterno user/assistant
  en pares completos. Mensaje 1–2000 caracteres; hasta 10 mensajes de historial de
  1–4000 caracteres cada uno; cuerpo limitado durante lectura a 64 KiB reales.
  Campos extra y roles privilegiados se rechazan. Origin explícito ajeno se rechaza.
- Éxito 200 `{ ok: true, reply, recommendations }`; cada recomendación es una tarjeta reconstruida por servidor desde IDs de catálogo y puede incluir una variante exacta disponible. Errores 400/413 de entrada, 429 de cupo y 503
  de configuración/red/DB/proveedor con `{ ok: false, message }` constante seguro.
  Todas estas respuestas llevan `Cache-Control: no-store`.
- Catálogo fresco por envío, inyección JSON directa de los 6 productos/24 variantes,
  precios en céntimos de EUR y stock incluso cero. Chat usa `DEVEXPERT_CHAT_MODEL`,
  `stream: false`, máximo 800 tokens y timeout de 30 segundos; cero reintentos.
- Widget público global, no modal, en catálogo y detalle. Historial en memoria;
  cierra/reabre y navega sin perderlo, recarga lo reinicia. Errores conservan borrador
  para reenvío manual y no entran en el contexto. No se escribe en la tabla `Chat`.
- Prueba local: activar Node de `.nvmrc`, `CI=true ./init.sh`, `pnpm dev`; abrir
  `http://localhost:3000`, pulsar «Abrir chat», preguntar por tallas/precios y luego
  «¿Y en azul?». Con `DEVEXPERT_API_KEY` válida en `.env` se usa el gateway real.
  Sin clave: `DEVEXPERT_API_KEY='' pnpm dev` muestra degradación segura al enviar.
  Se debe reiniciar el servidor tras cambiar variables. El gate no usa red de IA.
- Verificación offline: tests Vitest de endpoint, servicio, consulta y widget con
  fakes; smoke real local mediante mock HTTP compatible con OpenAI. Esto verifica
  integración/contexto, pero no demuestra calidad semántica del modelo real.
