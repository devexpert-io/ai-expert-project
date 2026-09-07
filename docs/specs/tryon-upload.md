# Feature Implementation Spec: Subida de foto para la prueba virtual

## Source Feature

- `id`: `tryon-upload`
- `area`: `tryon`
- `depends_on`: `product-detail` (aceptada en `feature_list.json`)
- `status`: `not_started` al planificar
- `source`: `feature_list.json`
- Comportamiento: en el detalle, subir una foto con preview, validación y aviso de privacidad.

## Goal

Añadir en `/products/[slug]` una sección pública de prueba virtual donde el visitante
elige una foto, ve una preview local y recibe un error controlado si el archivo no
es válido. El aviso de privacidad debe ser visible antes de cualquier envío futuro
al proveedor: la foto es un dato personal, viajará a `inference.devexpert.io` y no
se guarda en la tienda.

Esta feature deja la foto lista en memoria del navegador. No llama a DevExpert, no
persiste `TryonImage` y no escribe el archivo en disco.

## Non-Goals

- No generar ni mostrar la prenda puesta; eso es `tryon-result`.
- No crear `POST /api/tryon`, server actions, `images/edits` ni usar `aiProvider`.
- No persistir la foto ni el trabajo: ni tabla `TryonImage`, ni `public/`, ni
  cookies, ni `localStorage`.
- No cambiar schema, migraciones, seed, dependencias, carrito, checkout, auth,
  pedidos ni el contrato del chatbot.
- No exigir talla/color para subir; el vínculo con variante queda para `tryon-result`.
- No convertir `ProductDetail` ni la página en Client Component.

## Job Story

When veo una prenda en su ficha,
I want subir mi foto, comprobar que es válida y leer el aviso de privacidad,
so I can decidir si la envío después al proveedor de prueba virtual.

## Users And Permissions

- **Invitado o usuario**: misma sección pública, sin sesión.
- **Navegador**: elige el archivo, valida, muestra preview y conserva el `File` en
  memoria. No recibe Prisma, clave ni módulos de `src/lib/server/ai/`.
- **Servidor**: no recibe la foto en este slice. `tryon-result` deberá revalidar.

## Upload Contract

- Tipos: `image/jpeg`, `image/png`, `image/webp`. Rechazar HEIC, GIF, SVG, PDF y
  cualquier otro MIME. `accept` del input coincide con esa lista.
- Tamaño máximo: `5 * 1024 * 1024` bytes (5 MiB). Cero bytes es inválido.
- Validar MIME y tamaño; no confiar en la extensión. Si el archivo no se puede
  mostrar como imagen, tratarlo como inválido.
- Mensajes constantes, en español, sin nombres de archivo ni detalles internos:
  - tipo: `Usa una foto JPG, PNG o WebP.`
  - tamaño: `La foto supera el máximo de 5 MB.`
  - vacía/irreconocible: `Esa imagen no es válida.`
- Preview solo con `URL.createObjectURL`; revocar al cambiar, limpiar o desmontar.
  Usar `<img>` nativo, no `next/image`.
- Recargar la ficha pierde la foto.

## Acceptance Scenarios

### Scenario 1: sección en la ficha

Given `/products/camiseta-basica` **When** se renderiza **Then** hay una sección
«Prueba virtual» debajo del estado de variante, con input de archivo etiquetado,
aviso de privacidad visible y control de generación deshabilitado.

### Scenario 2: preview válida

Given un JPG/PNG/WebP ≤ 5 MiB **When** se selecciona **Then** aparece preview con
`alt` descriptivo, se limpia el error y un estado accesible confirma que la foto
es válida. La foto no sale del navegador.

### Scenario 3: imagen no válida

Given HEIC, GIF, SVG, PDF, vacío, > 5 MiB o bytes no decodificables **When** se
elige **Then** se anuncia el mensaje constante, no hay preview y se revoca cualquier
object URL previo.

### Scenario 4: aviso de privacidad

Given la sección visible **When** se lee el aviso **Then** indica que la foto es un
dato personal, se enviará a `inference.devexpert.io` y no se guarda en la tienda.
Hay un checkbox «Entiendo que mi foto se enviará al proveedor de IA», desmarcado
por defecto y asociado a su label.

### Scenario 5: listo sin envío

Given preview válida y checkbox marcado **When** se observa el control **Then** el
estado indica que la foto está lista y que la generación aún no está conectada.
El botón «Generar prueba virtual» permanece `disabled`. No hay fetch, FormData ni
escritura Prisma.

### Scenario 6: limpiar y recargar

Given una preview **When** se pulsa «Quitar foto» **Then** desaparece la preview,
se revoca el object URL, el checkbox vuelve a no marcado y el input queda vacío.
Recargar también pierde la foto.

### Scenario 7: accesibilidad y responsive

Given teclado, lector y viewports 390/768/1024/1440 px **When** se usa la sección
**Then** labels, foco visible, targets ≥ 44 px, contraste AA y `role=status` o
`aria-live` en error/éxito. En móvil es una sección apilada, no gaveta.

### Scenario 8: alcance

Given la feature terminada **When** se revisa el diff **Then** no hay API de try-on,
llamadas IA, persistencia, schema/seed/dependencias nuevas, carrito, auth ni
`use client` en `ProductDetail` o la página.

## Repository Research

### Files Inspected

- `AGENTS.md`, `PROGRESS.md`, `feature_list.json` — gate, estado y contrato.
- `CONTEXT.md`, `docs/build-brief.md`, `docs/domain-model.md`,
  `docs/technical-discovery.md`, `docs/risks-and-open-questions.md` — try-on,
  privacidad y estados `Solicitado→Generado|Error` (solo para `tryon-result`).
- `DESIGN.md`, `src/app/globals.css`, `src/components/product/*` — ficha Server
  Component, tokens, columna de información; try-on aún no existe. Pregunta
  abierta de gaveta vs sección: se decide sección.
- `prisma/schema.prisma` — `TryonImage` existe; no usarla aquí.
- `src/lib/server/ai/config.ts`, `provider.ts` — frontera server-only lista; no
  importarla desde el cliente.
- `src/lib/chat.ts`, `src/components/chat/ChatWidget.tsx` — patrón de contrato
  compartido + isla `use client` montada desde servidor.
- `package.json` — Vitest/Testing Library; no existe `pnpm test:e2e`.
- `ARCHITECTURE.md`, `CONSTRAINTS.md` — capas y reglas de IA/privacidad.

### Existing Patterns To Follow

- App Router, TypeScript, CSS Modules y tokens de `DESIGN.md` ( terracota para CTA
  de IA, oliva/óxido para estados, foco ámbar, targets ≥ 44 px).
- Isla cliente mínima, como `ChatWidget`; el resto de la ficha sigue en servidor.
- Constantes y validador puros en `src/lib/` (sin `server-only`) para tests y
  reutilización futura en servidor.
- Gate `CI=true ./init.sh` con Node de `.nvmrc` y pnpm 10.18.3.

### Current Gaps

- No hay UI, validador ni estilos de try-on.
- `technical-discovery.md` deja abierto el almacenamiento; este slice lo cierra
  como memoria del navegador, sin persistir.

## Technical Approach

1. Crear `src/lib/tryon-upload.ts` con MIME permitidos, `TRYON_MAX_BYTES`,
   mensajes constantes, `validateTryonFile(file)` y textos de privacidad.
2. Crear `src/components/tryon/TryOnUpload.tsx` (`use client`) con input file,
   checkbox, preview `<img>`, «Quitar foto», estado `aria-live` y botón de
   generación siempre `disabled`. Revocar object URLs en un `useEffect` de limpieza.
3. Montar la isla al final de `ProductDetail` información, sin convertir la ficha
   a cliente. Estilos en `tryon-upload.module.css` reutilizando tokens.
4. No añadir ruta API, no importar `src/lib/server/ai/*`, no tocar Prisma.
5. Tests puros del validador y de la isla (File + `URL.createObjectURL` mockeado);
   extender `ProductDetail.test.tsx` para afirmar que la sección existe.

## Expected File Changes

- `src/lib/tryon-upload.ts` — crear contrato y validador.
- `src/lib/tryon-upload.test.ts` — crear tests de MIME, tamaño y vacíos.
- `src/components/tryon/TryOnUpload.tsx` — crear isla cliente.
- `src/components/tryon/tryon-upload.module.css` — crear sección, preview y estados.
- `src/components/tryon/TryOnUpload.test.tsx` — crear preview, error, privacidad y disabled.
- `src/components/product/ProductDetail.tsx` — modificar; montar la isla.
- `src/components/product/ProductDetail.test.tsx` — modificar; afirmar la sección.
- `src/app/products/[slug]/page.tsx` — no cambiar salvo que el montaje lo exija;
  la página permanece Server Component.
- `ARCHITECTURE.md` — update: isla, memoria, sin proveedor.
- `CONSTRAINTS.md` — update: foto como dato personal y no persistirla.
- `docs/technical-discovery.md` — update: almacenamiento de la foto de entrada
  (memoria; sin disco ni fila) en este slice.
- `docs/risks-and-open-questions.md` — update: aviso + no persistir la foto de
  entrada; el destino de la imagen *generada* sigue abierto para `tryon-result`.
- `AGENTS.md`, `DESIGN.md`, schema, seed, `package.json` — not needed / no tocar.
- `feature_list.json`, `PROGRESS.md` — solo después, por implementación/validación.

## Visual Design Impact

- UI involved: yes. Design source: `DESIGN.md`.
- Screens or states: ficha con sección vacía, preview válida, error, listo sin
  envío, limpiar. No estado «procesando» ni resultado generado.
- New design artifact: no. Sección en la columna de información, no gaveta.
- Preview contenida, radio 6/10 px, CTA terracota deshabilitada, error `#8B2C22`
  con texto. Una columna en 390 px; no desbordar el layout 1/2 columnas de la ficha.

## Durable Documentation Impact

- `ARCHITECTURE.md`: update — isla try-on, frontera cliente/servidor y no persistencia.
- `CONSTRAINTS.md`: update — MUST tratar la foto como dato personal; MUST mostrar
  el aviso antes de enviar; MUST NOT persistirla innecesariamente ni importar el
  adapter de IA desde el cliente.
- `AGENTS.md`: not needed — no cambia arranque, gate ni workflow.
- Other docs: `docs/technical-discovery.md` y `docs/risks-and-open-questions.md`
  — update acotado a almacenamiento/privacidad de la foto de entrada.
- No duplicar el flujo de generación; `tryon-result` sigue pendiente.

## Implementation Plan

1. Fijar constantes, mensajes y `validateTryonFile` con tests puros.
2. Construir la isla, preview, privacidad, limpieza de object URL y estilos.
3. Montarla en `ProductDetail` y cubrir sección/errores/disabled.
4. Ejecutar tests/gate y smoke visual; registrar evidencia después.

## Implementation Tasks

- [ ] Crear `src/lib/tryon-upload.ts` y tests de JPEG/PNG/WebP, HEIC/GIF/SVG,
  > 5 MiB, 0 bytes y ausencia de archivo.
- [ ] Crear `TryOnUpload` con input etiquetado, preview `<img>`, checkbox, quitar
  foto, `aria-live` y botón siempre disabled.
- [ ] Revocar object URLs al cambiar, limpiar y desmontar; mockear
  `URL.createObjectURL`/`revokeObjectURL` en tests.
- [ ] Montar la isla en `ProductDetail` sin `use client` en la ficha.
- [ ] Añadir CSS según tokens; comprobar 390/768/1024/1440 px y foco/targets.
- [ ] Actualizar `ARCHITECTURE.md`, `CONSTRAINTS.md`,
  `docs/technical-discovery.md` y `docs/risks-and-open-questions.md`.
- [ ] Ejecutar tests, lint, typecheck, build, `./init.sh` y smoke de la ficha.

## Verification Plan

- `pnpm test -- src/lib/tryon-upload.test.ts src/components/tryon/TryOnUpload.test.tsx src/components/product/ProductDetail.test.tsx` —
  contrato, preview, errores, privacidad, disabled y montaje.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` y `CI=true ./init.sh` — gate
  estándar. `./init.sh` ejecuta install, `db:setup`, `db:verify`, lint, typecheck,
  test y build; no arranca `pnpm dev`.
- Smoke `pnpm dev`: abrir `/products/camiseta-basica`, subir un JPG válido (preview),
  un archivo inválido (error), marcar el aviso (botón sigue disabled) y recargar
  (la foto desaparece). No usar clave ni red de IA.
- QA teclado/foco/contrast/targets y viewports 390/1440. Sin `pnpm test:e2e`
  persistente: Vitest + smoke cubren el flujo hasta que exista harness E2E.

## Evidence To Capture

- Salida de tests/gate con Node 22 y pnpm 10.18.3.
- Smoke: preview válida, error controlado, aviso con `inference.devexpert.io`,
  botón disabled y foto ausente tras recargar.
- Revisión estática: sin API/IA/Prisma/schema/seed/dependencias; sin secretos en
  cliente; object URLs revocados; `git diff --check` limpio.

## Validator Checklist

- [ ] La ficha muestra la sección, preview, validación y aviso; el alcance no
  incluye generación ni API.
- [ ] JPEG/PNG/WebP ≤ 5 MiB previsualizan; HEIC/GIF/otros/tamaño/vacío fallan
  con mensajes constantes.
- [ ] El aviso nombra dato personal, `inference.devexpert.io` y no persistir;
  el checkbox existe y el botón de generar está `disabled`.
- [ ] No se escribe `TryonImage`, disco, cookies ni `localStorage`.
- [ ] `ProductDetail` y la página siguen en servidor; la isla no importa IA.
- [ ] Accesibilidad, responsive y tokens de `DESIGN.md` se cumplen.
- [ ] Tests, lint, typecheck, build, `./init.sh` y smoke dejan evidencia.
- [ ] `feature_list.json` y `PROGRESS.md` se actualizan tras implementar/validar.
- [ ] No se añadieron carrito, checkout, auth, pedidos ni trabajo de `tryon-result`.
