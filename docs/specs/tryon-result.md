# Feature Implementation Spec: Generación y muestra del resultado de la prueba virtual

## Source Feature

- `id`: `tryon-result`
- `area`: `tryon`
- `depends_on`: `tryon-upload`, `ai-provider-config` (ambas `accepted`)
- `status`: `not_started` al planificar
- `source`: `feature_list.json`
- Comportamiento: enviar la foto y ver la prenda puesta, o un error claro.

## Goal

Conectar la isla `TryOnUpload` de `/products/[slug]` a DevExpert Inference para
generar y mostrar la prenda sobre la foto del visitante. El envío ocurre solo
con foto válida y consentimiento; durante la llamada hay un estado accesible de
procesamiento; el resultado o un error controlado reemplazan ese estado sin
romper la ficha.

La calidad visual realista no se garantiza: el resultado es una aproximación
generada. Este slice cierra el destino de la imagen *generada* como efímera
(data URL en memoria). No persiste `TryonImage` ni la foto de entrada.

## Non-Goals

- No persistir foto, resultado ni fila `TryonImage`; no escribir disco, `public/`,
  cookies ni `localStorage`. Recargar descarta todo.
- No exigir talla/color para generar; no bloquear por stock; no añadir al carrito.
- No usar `images/generations`, embeddings, chatbot, auth, schema, seed ni
  dependencias nuevas. No cambiar `package.json` ni el lockfile.
- No convertir `ProductDetail` ni la página en Client Component.
- No medir ni garantizar fidelidad fotográfica del proveedor real.

## Job Story

When tengo una foto válida y he aceptado el aviso en la ficha,
I want generar la prueba virtual y ver la prenda sobre mi imagen,
so I can decidir si la prenda me encaja visualmente o reintentar si falla.

## Users And Permissions

- **Invitado o usuario**: misma acción pública, sin sesión.
- **Navegador**: envía `FormData` a `/api/tryon`; no importa `src/lib/server/ai/`.
- **Servidor**: revalida archivo y consentimiento, resuelve el producto, construye
  el prompt y llama a `aiProvider`. El cliente no elige modelo, URL ni prompt.

## Generation Contract

- `POST /api/tryon`, runtime Node, `Cache-Control: no-store`. Multipart:
  `photo` (File), `productSlug`, `consent=true`, `size` y `color` opcionales.
  Rechazar campos extra. Límite efectivo de cuerpo: 6 MiB (foto ≤ 5 MiB +
  overhead). No confiar solo en `Content-Length`.
- Revalidar con `validateTryonFile`. Sin consentimiento o slug inválido/ausente:
  400 y mensaje constante. Origin explícito ajeno: 400, sin CORS permisivo.
- Lookup con `getProductDetailBySlug`. Producto inexistente: 400, sin proveedor.
  `size`/`color` de la selección URL-backed de la ficha (props, no radios sin
  enviar). Si la pareja es variante exacta, el prompt incluye color y talla;
  si no, se genera a nivel de producto. Stock no bloquea.
- Prompt fijo en servidor (español): editar la foto para vestir esa prenda,
  conservar persona/fondo/pose, usar nombre, categoría, descripción y variante
  resuelta. Sin texto libre del cliente. Sin imagen de catálogo como segundo
  input.
- `aiProvider.run` → `client.images.edit` con `models.image`
  (`DEVEXPERT_IMAGE_MODEL`, default `image-edit`), `n: 1`,
  `response_format: "b64_json"`, timeout 60 s, `maxRetries: 0`. Extraer
  `data[0].b64_json`. Si solo hay `url`, no exponerla ni fetchearla (SSRF):
  `provider_error`.
- Éxito 200 `{ ok: true, imageDataUrl }` (`data:image/png;base64,...` o jpeg).
  Cupo 429; degradación 503; entrada 400/413. Mensajes:
  `AI_DEGRADATION_MESSAGES` o constantes try-on. Sin secretos ni errores crudos.
- Estados de dominio `Solicitado→Generado|Error` solo en la petición/UI.

## Acceptance Scenarios

### Scenario 1: generar con foto y consentimiento

Given preview válida y checkbox marcado en `/products/camiseta-basica`
When pulsa «Generar prueba virtual»
Then el botón se habilita solo en ese estado, se envía multipart (foto + slug +
`consent=true` + size/color de la selección actual si existen) y, si el
proveedor responde `b64_json`, aparece el resultado con `alt` descriptivo.

### Scenario 2: procesando

Given un envío en curso
When se observa la sección
Then un `role=status`/`aria-live` anuncia «Generando la prueba virtual…», el
botón queda `disabled` y no hay un segundo fetch concurrente.

### Scenario 3: fallo controlado

Given falta de clave, 429, 401/403, red, timeout, respuesta sin `b64_json` o
error de catálogo
When termina la operación
Then se muestra el mensaje seguro, la ficha sigue usable, la preview se
conserva y se puede reintentar a mano. Sin stack ni clave.

### Scenario 4: validación de servidor

Given GIF, > 5 MiB, sin consentimiento, slug desconocido, Origin ajeno o cuerpo
> 6 MiB
When llega el POST
Then 400/413 antes del proveedor, con mensaje constante.

### Scenario 5: expectativas y limpieza

Given un resultado visible
When se lee la sección
Then un aviso indica que es una aproximación generada, no un encaje real.
«Quitar foto» o recargar elimina preview y resultado.

### Scenario 6: alcance y accesibilidad

Given teclado y viewports 390/1440
When se usa la sección
Then labels, foco, targets ≥ 44 px y contraste AA. Diff sin Prisma writes,
schema/seed/dependencias, carrito, auth ni `use client` en la ficha.

## Repository Research

### Files Inspected

- `AGENTS.md`, `PROGRESS.md`, `feature_list.json`, `docs/specs/tryon-upload.md`
- `CONTEXT.md`, `docs/build-brief.md`, `docs/domain-model.md`,
  `docs/technical-discovery.md`, `docs/risks-and-open-questions.md`, `DESIGN.md`
- `ARCHITECTURE.md`, `CONSTRAINTS.md`, `.env.example`, `package.json`,
  `prisma/schema.prisma` (`TryonImage` existe; no usarla)
- `src/lib/tryon-upload.ts` (+ tests), `src/components/tryon/*`
- `src/components/product/ProductDetail.tsx` (+ test; monta `<TryOnUpload />`)
- `src/lib/server/product-detail.ts`, `src/app/products/[slug]/page.tsx`
- `src/lib/server/ai/config.ts`, `provider.ts`, `chat.ts`
- `src/app/api/chat/route.ts` (+ test): Origin, límite real, `no-store`
- `src/lib/chat.ts`, `node_modules/openai/resources/images.d.ts` (`images.edit`,
  `b64_json`)
- No existe `pnpm test:e2e`. No se inspeccionó el portal DevExpert en vivo.

### Existing Patterns To Follow

- Isla cliente + contrato compartido + ruta Node + `aiProvider.run`.
- Validación MIME/tamaño ya en `tryon-upload.ts`; reutilizarla en servidor.
- Tokens de `DESIGN.md`: terracota CTA, óxido error, oliva éxito, `aria-live`.

### Current Gaps

- El botón de generar está siempre `disabled`; no hay `POST /api/tryon`.
- `TRYON_STATUS_READY` dice que la generación no está conectada.
- Destino de la imagen generada estaba abierto: este spec lo cierra como efímero.

## Technical Approach

1. Extender `src/lib/tryon-upload.ts` (o `src/lib/tryon.ts` compartido) con
   límite de cuerpo, textos de procesando/resultado/aproximación y el contrato
   `{ ok: true, imageDataUrl } | { ok: false, message }`. Actualizar
   `TRYON_STATUS_READY` a «La foto está lista para generar la prueba virtual.»
2. Crear `src/lib/server/ai/tryon.ts` (`server-only`): validar input ya parseado,
   resolver producto, construir prompt, `images.edit` como arriba. Tests con
   fake OpenAI y fake de detalle; sin red.
3. Crear `src/app/api/tryon/route.ts` (`runtime = "nodejs"`): leer bytes con
   tope 6 MiB, parsear `FormData`, Origin, mapear códigos a 400/413/429/503.
   `maxDuration = 60` si el runtime lo admite. No cachear.
4. Extender `TryOnUpload` con props `{ productSlug, size, color }` desde
   `ProductDetail`. Habilitar generar si foto+consentimiento y no hay envío.
   `fetch` relativo, `AbortController` al limpiar/desmontar, ignorar respuestas
   obsoletas. Resultado en `<img>` nativo (no `next/image`).
5. No importar el adapter en el cliente. No tocar schema, seed ni dependencias.

## Expected File Changes

- `src/lib/tryon.ts` — crear (o extender `tryon-upload.ts`): contrato y textos.
- `src/lib/server/ai/tryon.ts` — crear servicio de edición.
- `src/app/api/tryon/route.ts` — crear endpoint.
- `src/components/tryon/TryOnUpload.tsx` + CSS — habilitar envío, procesando,
  resultado, aviso de aproximación.
- `src/components/product/ProductDetail.tsx` — pasar slug y selección.
- Tests: contrato, servicio, ruta, isla y montaje/regresión de ficha.
- `ARCHITECTURE.md`, `CONSTRAINTS.md`, `docs/technical-discovery.md`,
  `docs/risks-and-open-questions.md` — update.
- `AGENTS.md`, `DESIGN.md`, schema, seed, `package.json`, lockfile — no tocar.
- `feature_list.json`, `PROGRESS.md` — solo en implementación/validación.

## Visual Design Impact

- UI involved: yes. Design source: `DESIGN.md`.
- Estados: listo, procesando, resultado, error, limpiar. Sección apilada, no
  gaveta. Preview y resultado contenidos (máx. ~320 px), resultado debajo.
- New design artifact: no.

## Durable Documentation Impact

- `ARCHITECTURE.md`: update — `POST /api/tryon`, servicio, resultado efímero.
- `CONSTRAINTS.md`: update — MUST NOT persistir foto ni resultado; MUST usar
  `images.edit` vía adapter; MUST exigir consentimiento en servidor.
- `AGENTS.md`: not needed — no cambia gate ni arranque.
- Other: `docs/technical-discovery.md` y `docs/risks-and-open-questions.md` —
  cerrar almacenamiento de la imagen generada; mantener riesgo de calidad.
  `init.sh` no cambia: gate no bloqueante, sin `pnpm dev`.

## Implementation Plan

1. Contrato, textos y tests puros (límites, consentimiento, data URL).
2. Servicio + ruta con fakes (modelo configurable, timeout, Origin, cupo).
3. Habilitar la isla, props desde la ficha, procesando/resultado/abort.
4. Gate, smoke y docs; evidencia sin secretos.

## Implementation Tasks

- [ ] Contrato compartido, `TRYON_STATUS_READY` actualizado y tope 6 MiB.
- [ ] Servicio `images.edit` con prompt de servidor, fake SDK y sin clave.
- [ ] `POST /api/tryon` con Origin, bytes reales, 400/413/429/503 y `no-store`.
- [ ] Props slug/size/color; botón enabled; un solo fetch; abort al limpiar.
- [ ] UI de procesando, resultado, aproximación y error reintentable.
- [ ] Docs durables; tests, lint, typecheck, build y `CI=true ./init.sh`.

## Verification Plan

- `pnpm test -- src/lib/tryon-upload.test.ts src/lib/tryon.ts src/lib/server/ai/tryon.test.ts src/app/api/tryon/route.test.ts src/components/tryon/TryOnUpload.test.tsx src/components/product/ProductDetail.test.tsx`
  (ajustar si el contrato vive en otro path): fakes sin red; modelo
  `DEVEXPERT_IMAGE_MODEL`; timeout 60 s; Origin; cuerpo real; consentimiento;
  slug; MIME; 429/sin clave; `b64_json`; UI enabled/procesando/resultado/error.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` y `CI=true ./init.sh` — gate
  estándar. `./init.sh` no arranca `pnpm dev`.
- Smoke `pnpm dev` en `/products/camiseta-basica`: ready→enabled; mock
  OpenAI-compatible o clave local opcional; sin clave, error seguro. Detener el
  proceso propio. No imprimir la clave.
- QA 390/1440, teclado, `aria-live`. No hay `pnpm test:e2e`: Vitest + smoke
  bastan. Un mock no demuestra calidad visual real.

## Evidence To Capture

- Tests/gate con Node 22 y pnpm 10.18.3; recuento de tests.
- Smoke: procesando, resultado o degradación, aviso de aproximación; mock vs real.
- Revisión: sin persistencia, sin secretos en cliente, `git diff --check` limpio.

## Validator Checklist

- [ ] Alcance solo generación/muestra; sin persistencia, carrito ni schema.
- [ ] Escenarios: enabled, procesando, resultado, errores, validación servidor.
- [ ] Adapter server-only, `image-edit` configurable, cero reintentos, 60 s.
- [ ] Consentimiento revalidado; foto y resultado efímeros.
- [ ] Accesibilidad/responsive y tokens de `DESIGN.md`.
- [ ] Tests, gate, smoke y docs; E2E ausente justificado.
- [ ] `feature_list.json` y `PROGRESS.md` actualizados tras implementar.
- [ ] Sin cambios a `package.json` / lockfile ni calidad visual inferida de mocks.
