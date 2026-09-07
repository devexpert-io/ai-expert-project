# Feature Implementation Spec: Recomendación de productos del chatbot

## Source Feature

- `id`: `chatbot-recommend`
- `area`: `chatbot`
- `depends_on`: `chatbot-conversation` (aceptada en `feature_list.json`)
- `status`: `not_started` al planificar
- `source`: `feature_list.json`

## Goal

Cuando una pregunta del visitante pide ayuda para elegir una prenda, el chatbot
debe devolver una respuesta explicativa y hasta tres recomendaciones estructuradas.
Cada recomendación se resuelve contra el catálogo vigente en el servidor y se
presenta como una tarjeta navegable al producto existente, con la variante exacta
(si el modelo propuso una) y su precio/stock actuales.

Las preguntas informativas que no piden recomendaciones deben conservar el
comportamiento de `chatbot-conversation`: respuesta textual, sin tarjetas y sin
cambiar el historial público del widget.

## Non-Goals

- Búsqueda vectorial, embeddings, índices persistentes, RAG o una nueva dependencia;
  el catálogo pequeño se inyecta directamente en el prompt.
- Recomendaciones basadas en pedidos, datos personales, sesión, carrito o historial
  persistido.
- URLs, nombres, precios, imágenes o variantes aceptados directamente desde el
  modelo; tampoco links a dominios externos.
- Crear/modificar productos, variantes, schema Prisma, seed, carrito, checkout o
  try-on.
- Garantizar una preferencia subjetiva del modelo; sí garantizar que los elementos
  mostrados pertenecen al catálogo y que sus datos visibles son de servidor.

## Job Story

Cuando no sé qué prenda o talla elegir, quiero pedir una recomendación en el chat
y recibir opciones reales del catálogo que pueda abrir, para comparar rápidamente y
continuar con la compra.

## Users And Permissions

- Invitado y usuario: pueden pedir recomendaciones sin iniciar sesión.
- El cliente solo envía mensaje e historial según el contrato existente; no puede
  elegir modelo, prompt, producto, variante ni URL.
- El servidor lee únicamente campos públicos de `Product`, `Category` y `Variant`.
  No se consultan pedidos, usuarios ni carritos.

## Acceptance Scenarios

### Scenario 1: recomendación válida con enlace

Given el catálogo sembrado y el widget abierto, When el visitante pregunta qué
prenda le conviene y el modelo devuelve IDs/slug de candidatos existentes, Then la
respuesta muestra texto y como máximo tres tarjetas con nombre, categoría, precio,
imagen y enlace interno `/products/<slug>`.

### Scenario 2: variante exacta

Given una recomendación que contiene el ID de una variante disponible, When se
construye la respuesta, Then la tarjeta muestra talla, color, precio y stock de esa
misma variante y enlaza a `/products/<slug>?size=<size>&color=<color>` con valores
codificados y canónicos.

### Scenario 3: candidato inválido o agotado

Given que el modelo inventa un slug/ID, repite un candidato, propone una variante
de otro producto o propone stock cero, When el servidor valida la salida, Then ese
candidato se descarta sin error público, sin crear URL libre y sin mostrarlo como
disponible; los candidatos válidos restantes se conservan.

### Scenario 4: pregunta normal y catálogo vacío

Given una pregunta sobre precio/talla o un catálogo vacío, When se procesa, Then la
respuesta textual sigue disponible, `recommendations` es `[]` cuando no hay una
recomendación validada y no aparece una sección vacía de tarjetas ni se inventan
productos.

### Scenario 5: salida malformada o fallo de IA

Given JSON incompleto, texto no parseable, respuesta vacía, falta de clave, cupo
agotado o error de proveedor/DB, When se envía el mensaje, Then la API conserva los
códigos y mensajes seguros de `chatbot-conversation`, la UI sale de carga y no
renderiza recomendaciones parciales no verificadas.

### Scenario 6: continuidad y seguridad de presentación

Given un turno de recomendación exitoso, When el visitante hace una pregunta de
seguimiento, Then el historial enviado conserva solo pares exitosos de texto y el
modelo recibe contexto fresco; el contenido textual y los nombres se renderizan
como texto React escapado, sin HTML/Markdown ni URLs proporcionadas por el modelo.

## Repository Research

### Files Inspected

- `feature_list.json`, `PROGRESS.md`, `AGENTS.md`: dependencia aceptada, flujo y gate.
- `docs/specs/chatbot-conversation.md`: contrato público, límites, memoria en cliente,
  errores y separación server-only ya implementados.
- `src/lib/chat.ts`, `src/app/api/chat/route.ts`: entrada/salida compartida, lectura
  de cuerpo, códigos HTTP y `Cache-Control: no-store`.
- `src/lib/server/ai/chat.ts`, `src/lib/server/ai/provider.ts`: prompt actual,
  modelo configurable `chat`, timeout de 30 s, `maxRetries: 0` y degradaciones.
- `src/lib/server/chat-catalog.ts`: consulta explícita de producto, categoría y
  variantes; hoy falta exponer `id`/`slug` para resolver candidatos.
- `src/components/chat/ChatWidget.tsx`, `chat.module.css`, `src/app/layout.tsx`:
  widget global cliente, historial en memoria, tarjetas aún inexistentes.
- `src/lib/server/product-detail.ts`, `src/components/catalog/CatalogGrid.tsx`:
  slug canónico, selección exacta talla/color y patrón de links internos.
- `prisma/schema.prisma`, `ARCHITECTURE.md`, `CONSTRAINTS.md`, `DESIGN.md`:
  relaciones, precios en céntimos, fronteras y dirección visual.
- `package.json`, tests de chat existentes y `vitest.setup.ts`: Vitest/Testing
  Library disponibles; no existe `pnpm test:e2e` ni harness E2E persistente.

### Existing Patterns To Follow

- App Router + TypeScript; Prisma y proveedor de IA solo en módulos server-only.
- El servidor devuelve view-models planos y la UI usa CSS Modules y links de
  `next/link`; los precios persistidos son enteros en céntimos.
- El proveedor existente debe seguir siendo la única frontera externa, sin retries,
  secretos ni errores crudos en respuestas.
- La conversación actual envía historial alterno de hasta cinco pares recientes,
  conserva solo turnos exitosos y se reinicia al recargar.

### Current Gaps

- La respuesta pública solo tiene `{ ok, reply }`; falta un contrato opcional y
  serializable para recomendaciones.
- El contexto actual no incluye IDs, slugs ni imágenes, por lo que el modelo no
  puede proponer referencias resolubles.
- El widget solo renderiza párrafos; necesita un bloque accesible de tarjetas y
  validación defensiva del nuevo payload.
- No hay E2E persistente; la cobertura deberá ser Vitest más smoke manual/local.

## Technical Approach

1. Extender el contexto server-side con `product.id`, `product.slug`, `imageUrl` y
   `variant.id`, sin eliminar los campos actuales. Mantener orden estable por nombre,
   ID y talla/color. El contexto sigue siendo datos no confiables separados de las
   instrucciones del sistema.
2. Extender el prompt para pedir un objeto JSON estricto con `{ reply, recommendations }`.
   Cada candidato usa solo `productId` y opcionalmente `variantId`; máximo tres,
   sin nombres/precios/URLs generados. Para una consulta no recomendatoria debe
   devolver una lista vacía. El modelo continúa usando `models.chat`, no `chat-pro`.
3. En un servicio server-only, parsear y validar la salida. Resolver todos los IDs
   contra el mismo catálogo fresco (o un mapa derivado de él), exigir que la variante
   pertenezca al producto, descartar duplicados y stock cero, y limitar a tres. La
   respuesta pública debe reconstruir desde servidor `name`, `slug`, `imageUrl`,
   `categoryName`, `size`, `color`, `priceCents` y `stock`; nunca copiar esos campos
   del modelo. Si `reply` o el objeto son inválidos, degradar de forma segura.
4. Mantener compatibilidad con el flujo normal: la ruta responde `{ ok: true,
   reply, recommendations }`; el widget acepta `recommendations` ausente como `[]`
   durante una transición local. En errores, conservar status/mensaje del contrato
   existente y no devolver candidatos.
5. Renderizar después de cada respuesta exitosa una sección etiquetada, con tarjetas
   `article`/`ul`, imagen con alt, precio EUR, disponibilidad y `Link`. Para producto
   sin variante, el link solo usa el slug; para variante, usa query params canónicos.
   No se permite HTML, Markdown ni URL externa en la respuesta del modelo.
6. Mantener accesibilidad y responsive de `DESIGN.md`: foco visible, targets >=44px,
   `aria-live` para respuesta/errores, wrap de textos y panel usable a 390 px sin
   desbordamiento. Las tarjetas no deben ocultar el formulario ni romper el scroll.

## Expected File Changes

- `src/lib/chat.ts` — modificar tipos de respuesta y tipos serializables de
  recomendación; mantener límites y parser de entrada existentes.
- `src/lib/server/chat-catalog.ts` — modificar select/view-model para incluir IDs,
  slugs, imagen y datos de variantes necesarios para validación.
- `src/lib/server/ai/chat.ts` — modificar prompt, parser de salida y resolución
  server-side; conservar timeout, modelo y degradaciones.
- `src/app/api/chat/route.ts` — adaptar éxito a `recommendations`; errores idénticos.
- `src/components/chat/ChatWidget.tsx`, `chat.module.css` — renderizar tarjetas,
  links internos y estados accesibles/responsive.
- Tests de `src/lib/server/ai/chat.test.ts`, `chat-catalog.test.ts`, `route.test.ts`
  y `ChatWidget.test.tsx` — añadir casos de IDs válidos, invalidación, stock cero,
  duplicados, payload malformado, links y regresiones de conversación.
- `ARCHITECTURE.md`, `CONSTRAINTS.md`, `docs/technical-discovery.md` — actualizar
  límites de la frontera de recomendaciones y contrato resultante.
- `feature_list.json`, `PROGRESS.md` — actualizar solo tras implementación y
  verificación; el implementador deja la feature `passing`, el validador decide
  aceptación.

No se prevén cambios en `prisma/schema.prisma`, migraciones, seed, dependencias,
`init.sh` ni autenticación.

## Visual Design Impact

- UI involved: sí.
- Design source: `DESIGN.md` y tokens existentes de `chat.module.css`.
- Screens/states: widget flotante en catálogo y detalle; respuesta con cero, una,
  dos o tres recomendaciones; loading/error; móvil estrecho y teclado.
- New design artifact required: no; las tarjetas reutilizan imagen, superficie,
  borde, terracota e ink del diseño existente.

## Durable Documentation Impact

- `ARCHITECTURE.md`: actualizar — flujo de salida estructurada, validación por IDs,
  reconstrucción de datos y links internos.
- `CONSTRAINTS.md`: actualizar — el modelo nunca controla URL/datos visibles; solo
  se muestran recomendaciones validadas, disponibles y limitadas a tres.
- `AGENTS.md`: no necesario — workflow y gate no cambian.
- `docs/technical-discovery.md`: actualizar — decisión de inyección directa para
  este catálogo y contrato de recomendaciones; embeddings siguen fuera de alcance.
- `docs/risks-and-open-questions.md`: actualizar — investigación de embeddings queda
  resuelta como innecesaria para el tamaño actual; calidad semántica real continúa
  siendo una limitación de pruebas mock.
- `DESIGN.md`: no necesario — no se introduce un sistema visual nuevo.

## Implementation Plan

1. Fijar tipos de recomendación y ampliar el view-model de catálogo con referencias
   internas que el modelo pueda devolver.
2. Implementar prompt estructurado, parseo seguro y validación contra catálogo
   fresco; cubrir primero proveedor/servicio/ruta con fakes sin red.
3. Adaptar el contrato cliente y construir tarjetas navegables con datos recibidos
   del servidor; cubrir interacción, escape, estados y responsive en Testing Library.
4. Ejecutar gate, smoke con mock OpenAI y revisión manual de enlaces/variantes; solo
   entonces registrar evidencia y dejar la feature lista para `feature-validator`.

## Implementation Tasks

- [x] Definir el tipo serializable de recomendación y el contrato `{ reply,
  recommendations }` sin aceptar campos privilegiados del cliente.
- [x] Añadir IDs/slugs/imagen al contexto server-side y mantener selección mínima
  y orden estable.
- [x] Implementar salida JSON del modelo, validación de forma, límite de tres,
  pertenencia producto-variante, deduplicación y exclusión de stock cero.
- [x] Reconstruir nombres, precios, imagen, categoría y links desde catálogo fresco;
  codificar talla/color en query params solo cuando existe variante.
- [x] Adaptar ruta y widget; renderizar tarjetas accesibles y conservar preguntas
  normales, errores, abort/carga e historial actual.
- [x] Añadir tests focalizados, ejecutar gate y smoke local con mock; actualizar docs,
  `feature_list.json` y `PROGRESS.md` con evidencia real.

## Verification Plan

- `pnpm test -- src/lib/server/ai/chat.test.ts src/lib/server/chat-catalog.test.ts
  src/app/api/chat/route.test.ts src/components/chat/ChatWidget.test.tsx`: fakes
  verifican prompt/IDs, respuesta estructurada, resolución de datos server-side,
  invalidación de candidatos y continuidad de historial.
- Casos mínimos: tres candidatos válidos; producto sin variante; slug/ID inventado;
  variante de otro producto; stock cero; duplicados; JSON malformado; catálogo
  vacío; falta de clave/429/DB; texto con HTML; campos del modelo con precio o URL
  manipulados que deben ignorarse.
- Smoke manual con `pnpm dev` y mock HTTP OpenAI-compatible: pedir recomendación,
  abrir cada link y verificar ficha 200 con la pareja talla/color; repetir pregunta
  normal y comprobar que no aparece tarjeta. No detener el dev server existente.
- Revisar UI en escritorio y viewport de 390 px: foco, scroll del panel, alt,
  nombres de enlaces, targets táctiles y ausencia de desbordamiento.
- No existe `pnpm test:e2e` persistente; Vitest + smoke manual cubren el contrato
  porque el repositorio aún no tiene harness E2E. `CI=true ./init.sh` debe seguir
  ejecutando el gate sin iniciar procesos de larga duración.

## Evidence To Capture

- Número de tests y exit codes de tests focalizados, lint, typecheck, build e
  `./init.sh`, con Node 22/pnpm 10.18.3.
- Resultado del fake: candidatos reales, variante exacta, stock cero descartado,
  duplicado/ID inventado descartados y datos visibles reconstruidos del servidor.
- Smoke de dos turnos y apertura de links de producto, indicando mock frente a
  proveedor real; no registrar claves, prompts privados ni conversaciones reales.
- Screenshot o nota de revisión UI móvil/escritorio, docs actualizados y riesgos
  pendientes; no declarar `accepted` desde implementación.

## Validator Checklist

- [ ] Solo se implementó recomendación estructurada dentro del chatbot; no embeddings,
  carrito, pedidos, try-on ni persistencia.
- [ ] Toda tarjeta corresponde a producto/variante existente, disponible y validada;
  links son internos, canónicos y navegables.
- [ ] El modelo no controla nombres, precios, imágenes, stock, HTML ni URLs visibles.
- [ ] Preguntas normales y errores mantienen el contrato conversacional existente.
- [ ] Secretos server-only, cero retries, límites y mensajes seguros se conservan.
- [ ] UI accesible/responsive, tests y smoke ejecutados; ausencia de E2E justificada.
- [ ] `feature_list.json`/`PROGRESS.md` contienen evidencia coherente y el diff no
  incluye archivos ajenos, secretos, bases SQLite ni procesos.
