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
- Los archivos de imagen del try-on se gestionan como referencia (URL) o upload temporal; decidir en implementación.
- **Foto de entrada (`tryon-upload`)**: solo memoria del navegador
  (`File` + `URL.createObjectURL`). No se escribe en disco, `public/`,
  cookies, `localStorage` ni la fila `TryonImage`. El destino de la imagen
  *generada* sigue abierto para `tryon-result`.

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
- En `tryon-upload` la foto de entrada permanece en memoria del navegador; la
  generación (`POST /images/edits`) queda para `tryon-result`.

### Pasarela de pago
- Simulada internamente. Sin integración de terceros en el MVP.

## Authentication and Authorization

- Sesión de invitado anónima (cookie/localStorage) para el carrito.
- Registro/login de usuario en el checkout vía credenciales (email + password). Considerar almacenar hash (p. ej. bcrypt) y sesión con cookie.
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
