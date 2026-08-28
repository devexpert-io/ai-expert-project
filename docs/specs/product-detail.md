# Feature Implementation Spec: Detalle de producto con selector de variante

## Source Feature

- `id`: `product-detail`
- `area`: `catalog`
- `depends_on`: `catalog-list` (declarada y aceptada en `feature_list.json`)
- `status`: `not_started` en el momento de planificar
- `source`: `feature_list.json`
- Revisión: `e7c1350` (`catalog-sort` aceptada); `catalog-filter` y `catalog-sort`
  son baseline aceptado y deben seguir funcionando.

## Goal

Crear la ficha pública `/products/[slug]`, accesible desde el catálogo, con imagen,
nombre, categoría, descripción, precio y todas las variantes del producto. El usuario
elige talla y color y ve la combinación exacta, su precio y su stock.

La selección usa un formulario GET nativo (`size` + `color`), por lo que URL, recarga y
atrás/adelante funcionan sin JavaScript. `stock = 0` se muestra como `Agotada`, sus
controles quedan deshabilitados y la ficha nunca ofrece una acción de compra.

## Non-Goals

- No añadir carrito, cantidad, checkout, autenticación, pedidos ni mutaciones.
- No añadir try-on, subida de fotos, chatbot, IA, proveedor externo ni recomendaciones.
- No cambiar schema, migraciones, seed/stock/precios persistidos o dependencias.
- No crear galería múltiple, zoom, búsqueda, reviews, wishlist o paginación.
- No introducir estado cliente ni parámetro de retorno; el enlace directo y el
  historial del navegador bastan.

## Job Story

Cuando encuentro una prenda en el catálogo, quiero abrir su ficha y elegir una talla y
color reales, para conocer el precio y el stock de esa variante antes de continuar.

## Users And Permissions

- **Invitado o usuario registrado**: lectura pública sin sesión; no escribe desde la
  ficha.
- **Servidor**: valida slug y query, consulta Prisma por la clave única y entrega solo
  el view-model de producto/categoría/variantes.
- **Navegador**: no recibe Prisma, credenciales, módulos de IA ni campos no usados.

## URL Contract

- Ruta: `/products/<slug>`; el slug canónico debe cumplir
  `^[a-z0-9]+(?:-[a-z0-9]+)*$`. Slug inválido o inexistente => `notFound()`/HTTP 404,
  sin fallback por nombre ni SQL dinámico.
- Selección: `/products/camiseta-basica?size=S&color=Negro`. Cada parámetro debe ser
  un único valor escalar y pertenecer a las variantes de ese producto.
- Duplicados, vacíos, desconocidos o combinaciones inexistentes se ignoran/explican de
  forma segura; nunca se escoge otra variante por aproximación.
- Con una sola dimensión se conserva la selección parcial y se pide la otra. Sin
  selección se muestra `basePriceCents`; con pareja válida, `Variant.priceCents` y
  stock exacto, siempre formateados como EUR desde céntimos enteros.
- “Quitar selección” vuelve a `/products/<slug>` sin query params.

## Acceptance Scenarios

### Scenario 1: ficha existente

**Given** el seed contiene `camiseta-basica` **When** se visita `/products/camiseta-basica`
**Then** hay HTTP 200, `main`, `h1`, imagen con `alt`, nombre, categoría,
descripción, precio EUR y controles basados solo en sus variantes.

### Scenario 2: enlace desde catálogo

**Given** `/` muestra tarjetas filtradas u ordenadas **When** se activa una tarjeta
**Then** existe un único enlace accesible a `/products/<slug>` por producto, sin
botones de compra; filtros/sort del listado siguen intactos y atrás vuelve a su URL.

### Scenario 3: combinación válida

**Given** `camiseta-basica` tiene `S/Negro`, stock 12 y precio 19,90 € **When** se
envía el formulario GET **Then** URL y controles reflejan la pareja y un resumen
accesible muestra `Disponible`, `12` unidades y el precio de la variante.

### Scenario 4: parcial o inexistente

**Given** falta `size` o `color`, o la pareja no existe **When** se renderiza **Then**
se conserva lo conocido, se pide completar/corregir y no se inventa stock ni se usa
otra variante.

### Scenario 5: agotada

**Given** `camiseta-basica?size=M&color=Negro` identifica `stock=0` **When** se carga
**Then** se ve `Agotada`, precio y estado; el control que representa esa combinación
queda `disabled`, el texto no depende solo del color y no existe acción de compra.
Una URL directa agotada sigue siendo visible/verificable.

### Scenario 6: slug inválido/desconocido

**Given** `/products/no-existe` o un segmento no canónico **When** se solicita
**Then** responde 404 sin consulta parecida, error de React ni interpolación SQL.

### Scenario 7: accesibilidad, responsive y no-JS

**Given** teclado, lector de pantalla, JavaScript desactivado y viewports 390/768/1024/
1440 px **When** se usa la ficha **Then** el GET funciona, hay labels/legends, foco
visible, targets >=44 px, contraste AA, estados de stock con texto y `role=status` o
`aria-live`; el layout es una columna en móvil y dos en escritorio.

### Scenario 8: alcance y frontera

**Given** la feature terminada **When** se revisan ruta, UI y tests **Then** no hay
carrito, try-on, IA, auth, pedidos, cambios de schema/seed/dependencias, secretos en
cliente, Prisma en UI cliente ni mutaciones.

## Repository Research

### Files Inspected

- `AGENTS.md`, `PROGRESS.md`, `feature_list.json` — runtime, gate, estados y contrato.
- `DESIGN.md`, `CONTEXT.md`, `docs/build-brief.md`, `docs/domain-model.md`,
  `docs/risks-and-open-questions.md` — dirección visual, roles, estados de variante y
  límites del MVP.
- `prisma/schema.prisma`, `prisma/seed.ts`, `next.config.ts` — `Product.slug @unique`,
  descripción/imagen/precio; `Variant` con talla/color/stock/price y unicidad por
  producto+talla+color; `placehold.co` ya permitido para `next/image`.
- `src/app/page.tsx`, `src/components/catalog/CatalogGrid.tsx`,
  `CatalogFilters.tsx`, `catalog.module.css` — página Server Component dinámica,
  tarjetas aún sin links, formulario GET y tokens/breakpoints existentes.
- `src/lib/server/prisma.ts`, `catalog.ts`, `catalog-filters.ts`, `catalog-sort.ts` y
  sus tests — singleton server-only, view-model mínimo, parsers escalares y consultas
  cerradas; no existe consulta de detalle.
- `ARCHITECTURE.md`, `CONSTRAINTS.md`, `package.json`, `init.sh` — fronteras, reglas
  SQLite/céntimos/server-only y gate; no existe `pnpm test:e2e` persistente.

### Existing Patterns To Follow

- App Router, TypeScript estricto, página server-side con `force-dynamic`, `next/image`,
  `Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" })` y Prisma bajo
  `src/lib/server/` con `import "server-only"`.
- Reutilizar grid/tokens de `DESIGN.md` (12 columnas, gap 24 px, radios 6/10 px,
  foco ámbar, targets >=44 px) y validar query como hacen filtros/sort.

### Current Gaps

- Faltan `src/app/products/[slug]/page.tsx`, servicio/parser de detalle, CSS y tests.
- `CatalogGrid` ya tiene `slug`, pero no enlace; su consulta mínima no incluye
  descripción ni variantes.

## Technical Approach

1. Crear `src/lib/server/product-detail.ts` (`server-only`) con tipos planos,
   `parseProductSlug`, `parseProductSelection` y `getProductDetailBySlug`. Validar
   slug, usar `findUnique({ where: { slug }, select: ... })` y seleccionar producto,
   categoría y variantes (`id`, `size`, `color`, `stock`, `priceCents`) ordenadas por
   `size`, `color`, `id`; incluir agotadas y devolver `null` si falta.
2. Normalizar `size`/`color` contra las variantes cargadas, aceptar solo escalares y
   resolver la pareja exacta. No mezclar productos ni ocultar stock cero.
3. Crear `src/app/products/[slug]/page.tsx` con `force-dynamic`, await de
   `params`/`searchParams`, `notFound()` para slug inválido/nulo y composición server.
4. Crear componente presentacional bajo `src/components/product/` con fieldsets
   accesibles, formulario GET, selección parcial, estado exacto, precio/stock y
   disabled para agotadas; sin `use client`.
5. Enlazar cada tarjeta a `/products/${product.slug}` y añadir solo estilos de link/foco.
   Crear layout de detalle: imagen 4:5, una columna móvil, dos escritorio.
6. Reutilizar o extraer el formateador EUR sin duplicar reglas y documentar la frontera
   en `ARCHITECTURE.md`.

## Expected File Changes

- `src/lib/server/product-detail.ts` — crear parser, tipos y consulta por slug.
- `src/app/products/[slug]/page.tsx` — crear ruta dinámica y 404 seguro.
- `src/components/product/ProductDetail.tsx` y
  `product-detail.module.css` — crear ficha, controles, estados y responsive.
- `src/components/catalog/CatalogGrid.tsx`, `catalog.module.css` y, si conviene,
  `src/lib/format-price.ts` — únicamente enlaces/foco y formatter compartido.
- `src/lib/server/product-detail.test.ts`,
  `src/app/products/[slug]/page.test.tsx`, `src/components/product/ProductDetail.test.tsx`,
  `src/components/catalog/CatalogGrid.test.tsx`, `src/app/page.test.tsx` — query,
  404, URL, precio/stock, disabled, accesibilidad y links.
- `ARCHITECTURE.md` — update de ruta y lectura server-only.
- `CONSTRAINTS.md`, `AGENTS.md`, `DESIGN.md`, `docs/domain-model.md`,
  `docs/technical-discovery.md` — not needed; se aplican reglas existentes.
- `schema.prisma`, migraciones, `seed.ts`, `package.json`, lockfile, `feature_list.json`
  y `PROGRESS.md` — no tocar para implementar; los dos últimos solo se actualizan
  después, por implementación/validación, para registrar evidencia/estado.

## Visual Design Impact

- UI involved: yes. Design source: `DESIGN.md` y tokens de `catalog.module.css`.
- Estados: link de tarjeta, ficha normal, parcial, válida disponible, agotada,
  inexistente y 404.
- New design artifact: no. Usar placeholder existente, `next/image`, imagen 4:5,
  superficies/bordes actuales y tipografía Inter/system.
- En escritorio imagen e información ocupan dos columnas; en móvil se apilan. Stock
  verde/rojo siempre incluye texto y los controles disabled siguen siendo legibles.

## Durable Documentation Impact

- `ARCHITECTURE.md`: update — ruta pública, consulta por slug, view-model y selección GET.
- `CONSTRAINTS.md`: not needed — no regla transversal nueva.
- `AGENTS.md`: not needed — no cambia workflow, runtime, permisos ni gate.
- `DESIGN.md`, `docs/domain-model.md`, `docs/technical-discovery.md`: not needed —
  la dirección, campos y estados ya son suficientes.
- `feature_list.json`/`PROGRESS.md`: update posterior por implementación/validación;
  esta spec no cambia estado.

## Implementation Plan

1. Fijar contrato de slug/query, tipos y reglas de pareja/disabled con tests puros.
2. Implementar consulta server-only y ruta dinámica con 404.
3. Construir formulario GET, estados accesibles/responsive y enlaces mínimos del catálogo.
4. Ejecutar tests/gate, smoke 200/404 y QA responsive/no-JS; registrar evidencia después.

## Implementation Tasks

- [ ] Testear parser de slug/selección: ausencia, válido, parcial, duplicado,
  desconocido e inexistente.
- [ ] Testear `findUnique` por slug, select explícito, orden de variantes y `null`.
- [ ] Crear ruta y probar producto sembrado 200 y slug inválido/desconocido 404.
- [ ] Crear ficha con precio EUR, fieldsets, `role=status`/`aria-live`, stock y
  `disabled` agotado, sin `use client`, compra, try-on o IA.
- [ ] Añadir link por tarjeta, foco y CSS responsive sin alterar filtros/sort.
- [ ] Ejecutar tests, lint, typecheck, build, `./init.sh`, smoke SSR/HTTP y revisión
  estática de alcance.

## Verification Plan

- `pnpm test -- src/lib/server/product-detail.test.ts 'src/app/products/[slug]/page.test.tsx' src/components/product/ProductDetail.test.tsx src/components/catalog/CatalogGrid.test.tsx src/app/page.test.tsx` — query, 404, URL, precio/stock, disabled, semántica y links.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` y `./init.sh` — gate estándar; `init.sh`
  ejecuta install, `db:setup`, `db:verify`, lint, typecheck, test y build, sin dev server.
- Smoke `pnpm dev`: `/products/camiseta-basica` 200; `?size=S&color=Negro` (19,90 €,
  12); `?size=XL&color=Azul` (20,90 €, 5); `?size=M&color=Negro` (Agotada/disabled);
  `/products/no-existe` 404; probar params inválidos/duplicados y atrás/adelante.
- QA en 390/768/1024/1440 px, teclado, foco, alt, contraste y JavaScript desactivado;
  enviar el formulario y comprobar que la URL controla el resultado.
- No hay `pnpm test:e2e`; tests de servidor/página/componente y smoke SSR cubren el
  flujo hasta que exista harness E2E.

## Evidence To Capture

- Salida de tests/gate con Node 22 y pnpm 10.18.3, incluyendo `findUnique` y select.
- HTTP/SSR 200 y 404, pareja válida con precio distinto, agotada, parcial e inválida.
- QA visual/teclado/no-JS y estados `status`/`aria-live`.
- Revisión estática de slug seguro, server-only, sin SQL dinámico, secretos, mutaciones,
  carrito, try-on, IA, schema, seed o dependencias nuevas; `git diff --check` limpio.

## Validator Checklist

- [ ] Slug seguro: producto existente 200; desconocido/inválido 404 sin fallback ni SQL dinámico.
- [ ] Imagen/alt, nombre, categoría, descripción y precio EUR; variante válida usa
  `Variant.priceCents` y stock exactos.
- [ ] Talla/color URL-backed sin JavaScript; selección parcial/inexistente no inventa datos.
- [ ] Agotadas visibles como texto, disabled y sin acción de compra; URL directa verificable.
- [ ] Semántica, labels/legends, foco, contraste, targets, live status y responsive cumplen diseño.
- [ ] Cada tarjeta tiene solo el link mínimo; filtros/sort aceptados no regresan.
- [ ] Tests, lint, typecheck, build, `./init.sh`, smoke 200/404 y QA dejan evidencia.
- [ ] No se tocaron schema, seed, dependencias, carrito, checkout, try-on, IA, auth,
  pedidos, secretos ni workflow.
