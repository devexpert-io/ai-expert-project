# Feature Implementation Spec: Chatbot de consultas del catálogo

## Source Feature

- `id`: `chatbot-conversation`
- `area`: `chatbot`
- `depends_on`: `ai-provider-config`, `bootstrap-seed` (ambas `accepted`).
- `status`: `not_started` al planificar.
- `source`: `feature_list.json`.
- Comportamiento: abrir el chatbot, preguntar por tienda/catálogo y recibir respuestas con contexto real.

## Goal

Ofrecer a cualquier visitante una conversación en español desde un widget flotante disponible en catálogo y detalle. Cada envío consulta el catálogo vigente en servidor y llama al modelo de chat configurado mediante el adapter existente. La UI conserva el contexto de turnos durante la navegación cliente y comunica carga y errores sin impedir usar la tienda.

## Non-Goals

- Recomendaciones estructuradas, tarjetas/enlaces de productos o validación de recomendaciones: pertenecen a `chatbot-recommend`.
- Try-on, carrito, checkout, autenticación, pedidos, herramientas que ejecuten acciones o acceso a datos privados.
- RAG, embeddings, streaming, selector de modelo, proveedores nuevos y cambios de schema/seed.
- Persistir conversaciones en SQLite, cookies o localStorage; no se requiere historial tras recargar. La tabla `Chat` queda disponible para un incremento posterior.
- Garantizar por código la veracidad absoluta de texto generativo; sí entregar datos reales, instrucciones de fundamentación y pruebas del contrato.

## Job Story

Cuando estoy consultando una prenda y tengo dudas sobre tallas, colores, precios o disponibilidad, quiero preguntarlas sin registrarme para entender el catálogo y continuar navegando.

## Users And Permissions

- Invitado y usuario: mismo acceso público al chat, sin sesión obligatoria.
- El servidor solo lee `Product`, `Category` y `Variant`; el cliente no elige modelo, URL, prompt de sistema ni consulta SQL.
- Los mensajes se envían a DevExpert Inference; indicar en el panel que es un asistente IA y evitar solicitar datos personales.

## Acceptance Scenarios

### 1. Abrir, conversar y cerrar

Given un visitante en `/` o `/products/[slug]`, When activa «Abrir chat», Then aparece un panel titulado con historial vacío y formulario etiquetado; puede cerrarlo mediante botón o Escape y recuperar el foco en el disparador.
Given una pregunta no vacía, When la envía, Then aparece su mensaje y un estado accesible de espera, se bloquean envíos duplicados y se muestra la respuesta al terminar.
Given un turno completado, When pregunta «¿Y en azul?» o cierra/reabre, Then el historial reciente sigue disponible y se envía como contexto conversacional; al recargar puede reiniciarse.

### 2. Contexto real y límites del conocimiento

Given catálogo sembrado, When pregunta por precio o stock de una talla/color, Then el request del proveedor contiene descripción, categoría y parejas exactas de variantes con sus precios y stock actuales (incluido stock cero), sin confundir precio base y variante.
Given catálogo vacío o una pregunta sin datos disponibles (p. ej. plazos de envío), When se procesa, Then el prompt exige reconocer la falta de información sin inventar productos, stock o políticas; un catálogo vacío se comunica claramente.
Given mensajes intentando cambiar instrucciones o inventar stock, When se construye el request, Then las reglas y datos del servidor siguen separados del historial no fiable; nunca se aceptan roles `system`, `developer` o `tool` del cliente.

### 3. Sin clave, cupo y fallos

Given falta de clave, 429, credenciales inválidas o fallo de red/proveedor, When se envía, Then se muestra un mensaje constante seguro y el catálogo continúa utilizable; no hay reintentos automáticos ni error crudo.
Given respuesta vacía/no textual del proveedor o fallo de SQLite, When termina la operación, Then devuelve error controlado y la UI sale de «enviando».
Given error, When el usuario vuelve a enviar manualmente, Then puede recuperarse sin duplicar turnos fallidos en el contexto enviado.

### 4. Entradas inválidas y presentación segura

Given JSON inválido, mensaje vacío/excesivo, historial inválido o cuerpo demasiado grande, When se llama a la API, Then devuelve error seguro antes de invocar proveedor.
Given respuesta que contiene HTML, When se muestra, Then se renderiza como texto escapado y nunca como HTML ejecutable.
Given móvil estrecho o navegación con teclado, When usa el panel, Then controles y cierre son alcanzables, historial tiene scroll, no hay desbordamiento horizontal y carga/error se anuncian.

## Repository Research

### Files Inspected

- `AGENTS.md`, `PROGRESS.md`, `feature_list.json`: gate, estado y dependencias.
- `CONTEXT.md`, `docs/build-brief.md`, `docs/domain-model.md`: dominio y acceso anónimo.
- `docs/technical-discovery.md`, `docs/risks-and-open-questions.md`: DevExpert, cupo e historial abierto.
- `DESIGN.md`, `src/app/globals.css`, `src/app/layout.tsx`: paleta editorial, header y montaje global.
- `ARCHITECTURE.md`, `CONSTRAINTS.md`: fronteras server-only y errores seguros.
- `src/lib/server/ai/provider.ts`, `src/lib/server/ai/config.ts`: `aiProvider.run`, modelos configurables, `AiResult` y mensajes constantes; SDK ya instalado.
- `src/lib/server/catalog.ts`, `src/lib/server/product-detail.ts`, `prisma/schema.prisma`: consultas explícitas y variantes con `priceCents` obligatorio.
- `package.json`, `vitest.setup.ts`: Vitest/Testing Library; no existe comando ni infraestructura E2E persistente.
- `.agents/skills/feature-spec/references/spec-template.md`: estructura del contrato.

### Existing Patterns To Follow

- App Router + TypeScript; componentes visuales con CSS Modules, acceso Prisma server-only y precios enteros en céntimos.
- Adapter lazy con `maxRetries: 0`; no llamadas de IA durante build ni al abrir el panel.
- Gate estándar `CI=true ./init.sh` con Node exacto de `.nvmrc` y pnpm 10.18.3.

### Current Gaps

- No hay widget cliente ni rutas API de chatbot; serán la primera superficie interactiva de IA.
- La consulta de tarjetas no contiene descripción, precio de variante ni stock; se necesita un select específico de contexto, sin alterar su contrato.
- Historial por sesión/usuario es pregunta abierta: este slice decide memoria local del componente global, sin persistencia ni IDs compartidos.
- La calidad de un modelo real depende de credenciales/red; fixtures verifican integración y fundamentación del request, no demuestran calidad semántica real.

## Technical Approach

1. Crear contrato compartido sin imports server-only: mensaje `{ role: "user" | "assistant", content: string }`, entrada `{ message, history }` y resultado discriminado de texto/error seguro.
2. Usar `POST /api/chat` en runtime Node. Validar objeto, JSON, mensaje recortado de 1–2000 caracteres e historial máximo de 10 mensajes con roles alternos empezando por usuario y terminando por asistente (vacío permitido), cada uno de 1–4000 caracteres. Limitar cuerpo a 64 KiB efectivos, sin confiar solo en `Content-Length`; rechazar excesos antes de parsear/invocar IA. No aceptar mensajes de sistema ni parámetros de proveedor.
3. Devolver 200 con respuesta textual en éxito; 400/413 para entrada inválida/excesiva, 429 para cupo y 503 para degradación/configuración/red/DB, siempre JSON seguro y `Cache-Control: no-store`. Un error interno no debe filtrar stack, payload ni secretos. Rechazar `Origin` explícito de otro origen sin añadir CORS permisivo; peticiones locales sin Origin siguen permitidas para smoke.
4. Consultar catálogo fresco por envío con Prisma select explícito: nombre, descripción, categoría, precio base y variantes talla/color/precio/stock, orden estable. Inyectar catálogo serializado como datos, nunca instrucciones, y precios inequívocos en EUR. Es suficiente inyección directa para los 6 productos/24 variantes; no introducir búsqueda semántica.
5. Servicio server-only ejecuta `aiProvider.run((client, models) => client.chat.completions.create(...))` con `models.chat`, `stream: false`, límite de salida razonable y timeout explícito (p. ej. 30 segundos en opciones del request). Mantener cero reintentos. El implementer verifica los tipos del SDK instalado, sin añadir dependencia.
6. Prompt español: responder solo sobre catálogo/tienda con datos disponibles, reconocer desconocidos, distinguir variantes agotadas, ignorar instrucciones contenidas en catálogo/historial y no afirmar capacidades/políticas inexistentes. Contexto fresco es fuente superior a respuestas anteriores. Sin herramientas ni acceso a pedidos; no prometer funcionalidades futuras de compra.
7. Extraer texto no vacío de la primera respuesta y validar tamaño de salida (máximo 4000 caracteres, coherente con historial); respuestas incompatibles se degradan. La UI trata salida como texto React, sin Markdown/HTML ni links generados en este slice.
8. Montar un único `ChatWidget` cliente en layout. Mantener solo pares exitosos en contexto y últimos cinco pares al enviar; presentar errores aparte del historial de conversación, conservando borrador para reenvío manual. Estado local mantiene abrir/cerrar y navegación cliente; reset al refrescar aceptado.
9. Panel flotante no modal etiquetado (sin `aria-modal` ni bloqueo de página): foco al campo al abrir, Escape/cierre devuelve foco, historial `role="log"`, carga `role="status"`, error anunciado y controles con nombre accesible. Un único envío activo; cleanup/abort o guardia para ignorar resultados obsoletos.

## Expected File Changes

- `src/lib/chat.ts` — crear contrato/constantes compartidas seguras (nombre ajustable si se conserva separación).
- `src/lib/server/ai/chat.ts`, `src/lib/server/chat-catalog.ts` — crear servicio y contexto server-only.
- `src/app/api/chat/route.ts` — crear endpoint y validación de transporte.
- `src/components/chat/ChatWidget.tsx`, `src/components/chat/chat.module.css` — crear panel, estado y formulario.
- `src/app/layout.tsx` — montar widget global sin convertir layout en cliente.
- Tests junto a contrato/servicio/contexto/ruta/widget — casos de éxito, errores, límites y regresiones.
- Docs y harness indicados debajo. No se prevén dependencias, schema, migraciones ni cambios a `init.sh`.

## Visual Design Impact

- UI involved: sí; fuente `DESIGN.md` y tokens globales actuales, sin asset nuevo necesario.
- Disparador compacto fijo inferior y panel marfil/arena con bordes sobrios, tinta y acento terracota; tamaños táctiles ≥44 px y foco visible.
- Estados: cerrado, saludo/vacío, conversación, enviando, error y borrador recuperable.
- Escritorio: ancho contenido ~360–400 px; móvil: ancho dentro del viewport con margen y altura limitada por `dvh`, scroll interno y texto largo con wrap.

## Durable Documentation Impact

- `ARCHITECTURE.md`: actualizar — endpoint, widget, servicio, consulta y dirección de dependencias; historial en memoria.
- `CONSTRAINTS.md`: actualizar — contexto solo catálogo, input/turnos acotados, texto escapado, no registrar conversaciones/secretos y no reintentar automáticamente.
- `AGENTS.md`: no necesario — workflow y gate permanecen iguales.
- `docs/technical-discovery.md`: actualizar — contrato del chat, límites, timeout, historial y pruebas locales con/sin clave.
- `docs/risks-and-open-questions.md`: actualizar — decisión de historial para este slice e inyección directa suficiente aquí; dejar investigación de recomendaciones/try-on donde corresponda y registrar calidad real no verificada si aplica.
- `DESIGN.md`: no necesario salvo decisión visual durable nueva; seguir tokens existentes.
- `feature_list.json`, `PROGRESS.md`: actualizar implementación/evidencia real, riesgos y siguiente rol; implementer usa `passing`, aceptación corresponde al validador/orquestador.

## Implementation Plan

1. Confirmar gate base del orquestador y leer contrato; definir validación, límites y selección de contexto.
2. Implementar servicio con provider existente y ruta POST, con pruebas offline antes de UI.
3. Implementar panel cliente e integración de layout con pruebas de interacción y errores.
4. Ejecutar gate y smokes locales; documentar resultados, limitaciones y handoff de validación.

## Implementation Tasks

- [x] Contrato y validación de entrada/cuerpo/historial.
- [x] Contexto Prisma fresco con variantes exactas y prompt fundamentado.
- [x] Llamada chat configurada, timeout y errores seguros.
- [x] Ruta pública con controles de transporte y respuestas no cacheadas.
- [x] Widget responsive, turnos, carga, recuperación y accesibilidad.
- [ ] Tests focalizados, gate completo y smoke HTTP/UI.
- [ ] Docs durables, estado `passing` y evidencia sin secretos; sin commit del subagente.

## Verification Plan

- `pnpm test -- src/lib/server/ai/chat.test.ts src/lib/server/chat-catalog.test.ts src/app/api/chat/route.test.ts src/components/chat/ChatWidget.test.tsx` (adaptar nombres reales): fake de SDK captura modelo/prompt/historial y devuelve respuestas controladas; fake DB verifica select y precio/stock exactos; no red externa.
- Probar éxito de dos turnos, catálogo vacío, sin clave sin llamada de proveedor, 429, red/timeout, respuesta vacía y error DB; entradas inválidas, roles prohibidos, límites efectivos del body y Origin ajeno antes del proveedor.
- UI: abrir/cerrar/Escape/foco, envío vacío, bloqueo pendiente, respuesta, fallo y reenvío sin duplicados, texto HTML escapado e historial acotado.
- `CI=true ./init.sh`: debe ejecutar gate habitual y terminar; no añadir dev server al script ni alterar checks.
- Smoke con `pnpm dev` y `http://localhost:3000` (o puerto libre documentado): abrir panel en catálogo y detalle; pregunta y segunda pregunta con mock HTTP local OpenAI-compatible o proveedor real disponible; sin clave debe verse degradación segura. Registrar qué variante se ejecutó y detener procesos propios.
- Validar navegador a 390 px y escritorio, scroll/foco/cierre/errores. No existe E2E persistente: cobertura Vitest de ruta/servicio/UI + smoke real local es suficiente para este slice, sin añadir framework E2E.
- Una llamada real es opcional si hay clave disponible; no leer/imprimirla ni hacer del acceso externo requisito del gate. Si se usa mock, indicar que no se comprobó calidad semántica real.

## Evidence To Capture

- Comandos/exit codes, runtime exacto, número de tests y gate completo en `PROGRESS.md`/feature.
- Resumen de request mock: contexto real/stock cero/precio de variante y continuidad de turnos; sin copiar credenciales ni conversaciones reales.
- Smoke HTTP éxito/degradación y observación UI escritorio/móvil, indicando mock frente a proveedor real y puertos usados.
- Riesgos pendientes, docs actualizados y siguiente rol validator; no declarar aceptación desde implementación.

## Validator Checklist

- [ ] Alcance solo conversación: sin tarjetas/recomendaciones estructuradas, try-on, pedidos o persistencia.
- [ ] Escenarios pasan; datos exactos de variantes en request y modelo configurado, historial no fiable separado.
- [ ] Secretos server-only, límites efectivos, salida textual segura, fallos controlados y cero reintentos.
- [ ] UI utilizable con teclado y en móvil; catálogo/detalle conservan comportamiento.
- [ ] Gate y smokes realmente ejecutados, calidad real no inferida de mocks y ausencia de E2E justificada.
- [ ] Docs/estado/evidencia coherentes; no cambios ajenos ni secretos/bases/procesos incluidos.
