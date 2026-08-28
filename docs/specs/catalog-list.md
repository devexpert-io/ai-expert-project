# Feature Implementation Spec: Listado de catálogo

## Source Feature

- `id`: `catalog-list`
- `area`: `catalog`
- `depends_on`: `bootstrap-seed` (satisfecha; estado `accepted`)
- `status`: `not_started` (estado al planificar)
- `source`: `feature_list.json`

## Goal

Sustituir la home técnica por el listado principal del catálogo en `/`. La página
debe leer los productos sembrados desde Prisma en el servidor y mostrar una
cuadrícula responsive de tarjetas con imagen, nombre, categoría y precio en
euros. El resultado debe seguir la dirección visual de `DESIGN.md`, ser legible
en móvil y escritorio y no exponer datos de base de datos al cliente más allá
de los campos visibles.

El listado es una vista inicial, no un flujo de compra. Debe ser determinista y
funcionar con el seed local de seis productos; un catálogo vacío debe mostrar un
estado accesible, no una cuadrícula rota.

## Non-Goals

- No crear filtros, ordenación, paginación, búsqueda ni controles de categoría,
  talla, color o precio.
- No crear detalle de producto, enlaces de compra, selección de variantes,
  carrito, checkout, autenticación, pedidos ni llamadas a IA.
- No añadir administración, nuevas tablas, datos de seed, imágenes reales ni
  proveedores de imagen adicionales.
- No convertir la tarjeta en un control interactivo hasta que exista
  `product-detail`; en este slice solo presenta información.

## Job Story

Cuando entro en la tienda como invitado, quiero ver de un vistazo los productos
del catálogo con su imagen, nombre, categoría y precio, para orientarme antes de
usar filtros o abrir el detalle en las siguientes features.

## Users And Permissions

- **Invitado**: puede abrir `/` sin autenticación y consultar todos los productos
  del seed; no puede modificar datos desde este listado.
- **Usuario registrado**: tiene la misma vista pública en este slice; no se
  aplican permisos de cuenta ni datos personalizados.
- **Servidor**: consulta Prisma y entrega únicamente el view-model de tarjeta;
  el navegador no accede a Prisma ni a variables privadas.

## Acceptance Scenarios

### Scenario 1: Listado con datos sembrados

Given la base SQLite migrada y el seed aplicado, when un invitado abre `/`, then recibe HTTP 200, un `h1` de catálogo y una tarjeta por producto. Cada tarjeta contiene imagen con `alt`, nombre, categoría y precio EUR desde `basePriceCents`.

### Scenario 2: Consulta server-side y payload mínimo

Given la página es Server Component, when carga el catálogo, then Prisma consulta en servidor, relaciona `Category.name`, ordena por nombre + desempate estable y selecciona solo `id`, `slug`, `name`, `imageUrl`, `basePriceCents` y categoría. No se serializan variantes, stock, credenciales ni cliente Prisma.

### Scenario 3: Responsive y dirección visual

Given un viewport móvil, tablet o escritorio, when se renderiza la cuadrícula, then tiene 1/2/3/4 columnas según ancho, usando grid de 12 columnas y separación 24px de `DESIGN.md`; mantiene imagen 4:5, radios 6–10px, bordes sutiles, Inter/system y contraste AA.

### Scenario 4: Catálogo vacío

Given la consulta devuelve cero productos, when se renderiza `/`, then aparece un mensaje de estado vacío dentro de `main`, accesible y sin lista inexplicada ni error de React.

### Scenario 5: Alcance cerrado

Given la feature implementada, when se revisan página y tests, then no existen filtros, sort, botones, links de compra, detalle, carrito, checkout, auth, IA ni mutaciones de DB.

## Repository Research

### Files Inspected

- `AGENTS.md`, `PROGRESS.md`, `feature_list.json` — Node 22/pnpm 10.18.3, gate,
  dependencia aceptada y contrato de `catalog-list`.
- `DESIGN.md` — grid 12 columnas, cards, tokens, breakpoints 1–2/2–3/3–4,
  contraste y `alt`; `CONTEXT.md`, `docs/build-brief.md`, `docs/domain-model.md`
  — catálogo público, Producto/Categoría y precio base.
- `ARCHITECTURE.md`, `CONSTRAINTS.md`, `docs/technical-discovery.md` — Next App
  Router, Prisma/SQLite server-side y céntimos.
- `prisma/schema.prisma`, `prisma/seed.ts`, `scripts/verify-seed.mjs` — campos
  `Product`/`Category`, `basePriceCents`, `imageUrl`, 4 categorías/6 productos.
- `package.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx` y
  `src/app/page.test.tsx` — home mínima sin CSS, `/` libre, Next/Image no
  configurado y solo smoke test.

### Existing Patterns To Follow

- Server Components/App Router, TypeScript estricto, Prisma 6 singleton en
  servidor y `pnpm` con `./init.sh` como gate (`db:setup`, `db:verify`, lint,
  typecheck, test, build), sin servicios externos.
- Usar tokens de `DESIGN.md` (`#111827`, `#4B5563`, `#D97706`, `#F3F4F6`,
  radios 6/10px, gap 24px); el seed aporta placeholders HTTPS de `placehold.co`,
  que requiere permitir explícitamente ese host en Next/Image.

### Current Gaps

- `src/app/page.tsx` solo muestra “Tienda de ropa”; faltan consulta, singleton,
  componentes y estilos. `next.config.ts` aún no permite `placehold.co`.
- Faltan tests de tarjeta/cuadrícula/consulta y no hay `pnpm test:e2e` persistente.

## Technical Approach

### Acceso y view-model

Crear `src/lib/server/prisma.ts` como singleton `PrismaClient` con
`import "server-only"` (reutilizado en desarrollo para hot reload) y
`src/lib/server/catalog.ts` con `getCatalogProducts()`. La consulta server-side
usa `product.findMany`, `orderBy: [{ name: "asc" }, { id: "asc" }]` y `select` de
`id`, `slug`, `name`, `imageUrl`, `basePriceCents` y
`category: { select: { name: true } }`; mapear a `CatalogProduct` plano con
`categoryName`, sin variantes, stock, relaciones completas ni cliente Prisma.

Formatear `basePriceCents / 100` como EUR con `Intl.NumberFormat("es-ES", {
style: "currency", currency: "EUR" })`. La tarjeta muestra el precio base (no
el mínimo de variantes, reservado para features posteriores).

### Página y componentes

Hacer `src/app/page.tsx` Server Component async con
`export const dynamic = "force-dynamic"`, `main`, `h1` “Catálogo” y `CatalogGrid`;
crear `src/components/catalog/CatalogGrid.tsx` presentacional con `<ul>`/`<li>`,
`<article>`, `next/image`, `alt`/`sizes` y sin botones/links. Renderizar estado
vacío si no hay productos.

En `catalog.module.css`, usar grid de 12 columnas (12 en móvil, 6 desde 640px,
4 desde 900px, 3 desde 1200px), gap 24px, imagen 4:5, object-fit, superficies,
bordes y tokens de diseño. Añadir `src/app/globals.css` e importarlo desde
`layout.tsx` para reset, `box-sizing`, fondo, tipografía y tokens. Configurar
`next.config.ts` `images.remotePatterns` para HTTPS `placehold.co/**`; no bajar
assets ni añadir UI/dependencias.

### Tests

Actualizar `page.test.tsx` con datos mockeados; añadir `CatalogGrid.test.tsx` para
campos, EUR, semántica y vacío, y `catalog.test.ts` con Prisma mock para select,
relación, orden y view-model. No usar red, DB real ni snapshots de layout.

## Expected File Changes

- `src/app/page.tsx` — modificar placeholder por página de catálogo server-side.
- `src/app/layout.tsx`, `src/app/globals.css` — importar estilos globales y
  conservar metadata/idioma.
- `src/components/catalog/CatalogGrid.tsx` y `catalog.module.css` — crear
  cuadrícula/tarjetas presentacionales y responsive.
- `src/lib/server/prisma.ts`, `src/lib/server/catalog.ts` — crear singleton y
  consulta mínima server-only.
- `src/app/page.test.tsx`, `src/components/catalog/CatalogGrid.test.tsx`,
  `src/lib/server/catalog.test.ts` — ampliar cobertura sin red.
- `next.config.ts` — permitir el host HTTPS `placehold.co` de los placeholders.
- `ARCHITECTURE.md` — documentar acceso server-side/view-model si se consolida
  como patrón; `DESIGN.md` no necesita cambio.
- `PROGRESS.md`/`feature_list.json` — registrar evidencia tras implementar y
  validar, sin cambiar el estado desde esta planificación.
- No cambiar Prisma schema/seed, `package.json` ni añadir dependencias nuevas.

## Visual Design Impact

- UI involved: yes.
- Design source: `DESIGN.md`, fuente de verdad existente; no hace falta generar
  conceptos ni assets nuevos.
- Screens or states affected: `/` como listado de catálogo, tarjetas de
  producto y estado vacío.
- New design artifact required: no. Usar tokens existentes, 12 columnas,
  breakpoints responsive, contraste AA, `alt` descriptivo y `main`/headings.

## Durable Documentation Impact

- `ARCHITECTURE.md`: update si la implementación deja fijado el patrón
  `src/lib/server/catalog.ts` + Prisma singleton; documentar que la UI no accede
  directamente al cliente DB.
- `CONSTRAINTS.md`: not needed — no introduce una regla transversal nueva; debe
  respetar las reglas existentes de SQLite, céntimos y server-only.
- `AGENTS.md`: not needed — no cambia workflow, runtime ni gate.
- `DESIGN.md`: not needed — se aplica la dirección actual sin modificarla.
- `PROGRESS.md`/`feature_list.json`: update después de verificación para capturar
  resultados; el planner no altera el estado.

## Implementation Plan

1. Crear singleton/servicio server-side y tests mock de la consulta mínima.
2. Implementar `CatalogGrid`, estilos tokens/responsive y página `/` dinámica;
   configurar `next/image` para `placehold.co`.
3. Actualizar smoke/component tests, ejecutar gate y revisar manualmente 1/2/3/4
   columnas en viewport móvil/tablet/escritorio.
4. Registrar evidencia y dejar filtros, sort, detalle, compra e IA para sus
   features dependientes.

## Implementation Tasks

- [ ] Crear `prisma` singleton server-only y `getCatalogProducts()` con select,
  relación de categoría y orden estable.
- [ ] Convertir `src/app/page.tsx` en Server Component dinámico con `main`, `h1`
  y estado vacío.
- [ ] Crear `CatalogGrid`/CSS con tarjetas semánticas, imagen, nombre, categoría,
  EUR y grid responsive 12 columnas.
- [ ] Añadir reset/tokens globales y permitir `placehold.co` en `next.config.ts`.
- [ ] Añadir/actualizar tests de consulta, tarjeta/cuadrícula, accesibilidad y
  estado vacío sin red.
- [ ] Comprobar que no aparecen filtros, sort, links, botones, Prisma en cliente,
  stock expuesto ni dependencias nuevas.
- [ ] Ejecutar gate, QA visual y registrar evidencia sin aceptar la feature aún.

## Verification Plan

- `pnpm test -- src/app/page.test.tsx src/components/catalog src/lib/server/catalog.test.ts` — tests mock en verde, sin red ni DB externa.
- `pnpm lint` y `pnpm typecheck` — Server Component, server-only, Next/Image y
  tipos del view-model correctos.
- `pnpm build` con `db:setup` previo — compila sin errores y no requiere IA.
- `./init.sh` — setup/verify de SQLite, lint, typecheck, tests y build en Node
  22/pnpm fijados; sin procesos persistentes.
- `pnpm dev` sin autenticación — `/` responde HTTP 200 y muestra los seis
  productos sembrados; no requiere interacción ni clave de IA.
- QA manual en viewport aproximado 390px, 768px, 1024px y 1440px — verificar
  1/2/3/4 columnas, imagen 4:5, texto legible, contraste, `alt` y ausencia de
  controles fuera de alcance.
- No hay `pnpm test:e2e` persistente; al no existir flujo interactivo, tests
  presentacionales/server-side más la comprobación manual cubren esta feature.

## Evidence To Capture

- Salida de tests de página, grid y consulta, además de lint/typecheck/build.
- Resultado de `./init.sh` y HTTP 200 local con seed visible.
- QA visual documentado para los cuatro anchos y estado vacío mockeado.
- Revisión estática que confirme `select` mínimo, server-only, sin links/acciones
  y sin filtrado/ordenación de usuario.
- `git status` sin `.env`, SQLite, assets remotos descargados ni cambios ajenos;
  registrar evidencia en `feature_list.json`/`PROGRESS.md` tras validar.

## Validator Checklist

- [ ] `/` lista todos los productos sembrados con imagen, alt, nombre, categoría
  y precio EUR correcto.
- [ ] Consulta Prisma ocurre solo en servidor, usa select mínimo y orden estable;
  no se filtran variantes, stock ni secretos al cliente.
- [ ] Grid 12 columnas responde 1/2/3/4 columnas y respeta tokens de `DESIGN.md`.
- [ ] Semántica (`main`, `h1`, `ul`/`li`, `article`), contraste y estado vacío son
  accesibles; imágenes no dependen de descargar fixtures en tests.
- [ ] Tests, lint, typecheck, build, `./init.sh` y comprobación HTTP pasan.
- [ ] No se añadieron filtros, sort, detalle, cart, checkout, auth, IA, mutaciones
  ni dependencias nuevas.
- [ ] Documentación/evidencia actualizadas y estado cambiado solo por validación
  independiente.
