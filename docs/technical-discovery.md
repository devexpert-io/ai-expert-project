# Technical Discovery

## Product Surface

Web app responsive (móvil + escritorio). El foco es el navegador; sin apps nativas en el MVP.

## Candidate Stack

- **Frontend/Backend**: Next.js (React) con API routes / server actions. Monolito simple.
- **Lenguaje**: TypeScript.
- **Persistencia**: SQLite (vía ORM tipo Prisma o Drizzle). Cero configuración externa; se ajusta al requisito de lanzar en local con un comando.
- **Seed data**: carga de catálogo/modelo al iniciar.

## Data and Storage

- SQLite local, inicializada con seed (productos, categorías, variantes, stock).
- Tablas principales: `User`, `Product`, `Variant`, `Category`, `Cart`/`CartItem`, `Order`, `OrderLine`, `Chat`, `TryonImage`.
- Los archivos de imagen del try-on se gestionan como referencia (URL) o upload temporal; decidir en implementación.

## Integrations

Toda la IA se sirve desde **DevExpert Inference**, un gateway compatible con OpenAI (no se llama a OpenAI directamente). Es parte de la formación AI Expert: cada estudiante usa **su propia** `DEVEXPERT_API_KEY` (personal e intransferible, se muestra una sola vez al crearla en el portal).

- **URL base**: `https://inference.devexpert.io/v1`.
- **Clave**: variable de entorno `DEVEXPERT_API_KEY` (no commitear; usar `.env` y `.env.example`). Sin clave, las funciones de IA degradan con un mensaje claro.
- **Compatibilidad**: al ser OpenAI-compatible, funciona con el cliente oficial `openai` (SDK TypeScript/Python) solo cambiando `apiKey` y `baseURL`.
- **Límites**: cada clave tiene un uso semanal que se repone solo; al llegar al 100% las peticiones se rechazan hasta el reseteo. La app debe manejar el error 429/uso y mostrarlo con claridad.

### Chatbot IA
- Endpoint `POST /chat/completions` (OpenAI-compatible).
- Modelo diario: `chat`. Para tareas complejas: `chat-pro`.
- Inyectar contexto del catálogo en el prompt (o RAG con embeddings) para recomendar productos válidos.
- Opcional: búsqueda semántica del catálogo vía embeddings (modelo `embedding`, endpoint `POST /embeddings`).

### Try-on (prueba virtual)
- Uso de edición de imagen con imagen de entrada: `POST /images/edits`, modelo `image-edit` (enviar en `multipart/form-data` la foto del usuario + prompt con la prenda).
- Alternativa: generación pura `POST /images/generations`, modelo `image`.
- **La ruta de proveedor/modelo debe ser configurable** (por env), no cableada a un único endpoint.
- La foto del usuario viaja al gateway: tratar como dato personal; avisar al usuario y no persistirla innecesariamente.

### Pasarela de pago
- Simulada internamente. Sin integración de terceros en el MVP.

## Authentication and Authorization

- Sesión de invitado anónima (cookie/localStorage) para el carrito.
- Registro/login de usuario en el checkout vía credenciales (email + password). Considerar almacenar hash (p. ej. bcrypt) y sesión con cookie.
- Los pedidos solo son visibles para el usuario propietario.

## Deployment and Operations

- Local: un solo comando (p. ej. `pnpm dev` o `pnpm start` + seed automático). Se prefiere `pnpm`.
- Sin despliegue en la nube en el MVP (no obstante, el stack local es portable).
- Variables de entorno en `.env` (claves de IA), con `.env.example`.

## Testing and Verification

- Tests unitarios del dominio (catálogo, carrito, checkout, estados de pedido).
- Smoke test del flujo de compra y de las funciones de IA con clave real o mock.
- CI ligero (lint + typecheck + tests).

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
