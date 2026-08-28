# Feature Implementation Spec: Ordenación del catálogo

## Source Feature

- `id`: `catalog-sort`
- `area`: `catalog`
- `depends_on`: `catalog-list` (aceptada; `catalog-filter` también está aceptada y vigente)
- `status`: `not_started` en el momento de planificar
- `source`: `feature_list.json`
- Revisión de referencia: `3b405da`

## Goal

Permitir que el visitante ordene el listado público de `/` por precio ascendente,
precio descendente, novedades o nombre, manteniendo los filtros ya existentes y
representando la selección en la URL para recargar, compartir y usar el historial.

La lectura es server-side: Prisma recibe el `where` validado y un `orderBy`
determinista. No se cambian datos persistidos ni se crea otra fuente de verdad.

## Non-Goals

- Detalle, enlaces de tarjeta, carrito, checkout, autenticación o IA.
- Paginación, búsqueda de texto, múltiples criterios, drag-and-drop o sorting por
  disponibilidad, color, talla o precio de variante.
- Cambiar `Product.createdAt`, añadir un campo de “featured/new” o alterar schema,
  migraciones, seed, dependencias o datos persistidos.

## Job Story

Cuando comparo prendas del catálogo, quiero elegir un criterio de orden y combinarlo
con mis filtros, para encontrar primero las opciones de mi presupuesto, las novedades
o el nombre que busco.

## Users And Permissions

- Visitante anónimo o usuario registrado: puede leer y ordenar el catálogo público.
- No hay escritura ni permiso especial; la configuración de IA no participa.
- El servidor acepta únicamente valores conocidos. Un valor desconocido, vacío o
  duplicado vuelve al default sin excepción ni consulta insegura.

## URL Contract

El parámetro `sort` se combina con los params de `catalog-filter`:

`/?category=camisetas&size=M&minPrice=19.90&sort=price-asc`

Valores: ausencia de `sort` o `sort=name` = nombre A-Z (default); `price-asc` y
`price-desc` = precio base menor/mayor a mayor/menor; `newest` = más recientes.
El mismo formulario GET conserva `category`, `size`, `color`, `minPrice`, `maxPrice`
y `sort`; no requiere JavaScript. Un valor inválido no reescribe la URL: la interfaz
muestra el default y el enlace de limpieza devuelve a `/`.

## Acceptance Scenarios

### Scenario 1: orden predeterminado

**Given** `/` sin `sort` **When** se carga el catálogo **Then** aparece por
`name ASC` e `id ASC`, como en `catalog-list`, y el control muestra “Nombre (A-Z)”.

### Scenario 2: precio ascendente y descendente

**Given** productos de precios distintos **When** envío `sort=price-asc` o
`sort=price-desc` **Then** aparecen por `basePriceCents ASC` o `DESC`, con empates
resueltos por `name ASC` e `id ASC`.

### Scenario 3: novedades

**Given** productos con distintos `Product.createdAt` **When** envío `sort=newest`
**Then** aparecen por `createdAt DESC`, seguido de `name ASC` e `id ASC`; los
empates no dependen del orden accidental de SQLite.

### Scenario 4: nombre

**Given** `sort=name` **When** se ejecuta la consulta **Then** se conserva el orden
A-Z actual (`name ASC`, `id ASC`); no hay nombre descendente en este slice.

### Scenario 5: ordenación con filtros

**Given** cualquier combinación válida de filtros **When** cambio `sort` y aplico
el formulario **Then** los filtros permanecen en la URL y solo cambia el orden del
subconjunto; no aparecen productos fuera de ellos.

### Scenario 6: entrada inválida e historial

**Given** `sort=unknown`, vacío o duplicado **When** se procesa **Then** no falla ni
ejecuta `orderBy` arbitrario: usa `name ASC, id ASC` y muestra el default.

**Given** una URL válida **When** recargo, comparto o uso atrás/adelante **Then** el
criterio, filtros y listado visible coinciden con la URL.

### Scenario 7: accesibilidad y responsive

**Given** navegación por teclado o lector de pantalla **When** se alcanza el control
**Then** hay `label`, foco visible, opciones textuales, target >=44 px y contraste
AA en móvil y escritorio.

## Repository Research

### Files Inspected

- `feature_list.json` y `PROGRESS.md` — contrato, dependencia aceptada y siguiente
  feature.
- `src/app/page.tsx` — Server Component dinámico que resuelve `searchParams`,
  valida filtros y llama a `getCatalogProducts`.
- `src/lib/server/catalog-filters.ts` y `src/lib/server/catalog.ts` — parser
  server-only, `where` Prisma, selección mínima y orden actual `name ASC, id ASC`.
- `src/components/catalog/CatalogFilters.tsx` y `catalog.module.css` — formulario
  GET, accesibilidad, chips, foco, targets y breakpoints donde convivirá el sort.
- `prisma/schema.prisma` — `Product.basePriceCents` y `Product.createdAt` ya existen;
  no se necesita migración.
- Tests de página, formulario y catálogo — mocks y cobertura persistente a ampliar.
- `DESIGN.md`, `docs/domain-model.md`, `ARCHITECTURE.md` y `CONSTRAINTS.md` —
  visual, escenario catálogo y límites durables.

### Existing Patterns To Follow

- Mantener `/` dinámico, `server-only` y el orden en Prisma; nunca ordenar tarjetas
  en el navegador ni importar Prisma en UI cliente.
- Reutilizar formulario GET, resumen `aria-live`, foco, grid y view-model mínimo;
  añadir un `select` de orden con etiqueta visible. `createdAt` solo sirve para
  `orderBy`, no hace falta exponerlo en la tarjeta.
- Usar Vitest + Testing Library y los scripts de calidad fijados por `init.sh`.

### Current Gaps

- No existe parser/tipo de ordenación; `catalog.ts` solo recibe filtros y fija
  `name ASC, id ASC`. `CatalogFilters` no tiene control `sort`.
- No existe `pnpm test:e2e`; tests unitarios/de página y comprobación manual/SSR
  cubren el flujo en el estado actual.

## Technical Approach

1. Crear `src/lib/server/catalog-sort.ts` con la unión cerrada, default `name`,
   opciones UI y parser para `searchParams` (solo un valor escalar válido).
2. Extender `getCatalogProducts(filters, sort)` con un mapa cerrado a `orderBy`:
   `name ASC + id ASC`, `basePriceCents ASC/DESC + name ASC + id ASC` o
   `createdAt DESC + name ASC + id ASC`. Nunca usar texto de URL como columna/dirección.
3. En `page.tsx`, parsear sort y pasarlo junto a filtros; el rango inválido sigue
   evitando la consulta y el estado vacío/limpieza no cambia.
4. Añadir “Ordenar por” al formulario GET actual. El mismo submit conserva filtros,
   sin hidden inputs duplicados; mantener textos, `aria-live`, breakpoints y sin JS.

## Expected File Changes

- `src/lib/server/catalog-sort.ts` — crear tipos, opciones y parser seguro.
- `src/lib/server/catalog.ts` y `src/app/page.tsx` — añadir sort manteniendo
  `where`, select mínimo, view-model y rango inválido.
- `src/components/catalog/CatalogFilters.tsx`/`catalog.module.css` — selector
  accesible y layout solo si hace falta.
- `src/lib/server/catalog-sort.test.ts` — crear tests del parser; ampliar
  `catalog.test.ts`, `page.test.tsx` y `CatalogFilters.test.tsx` para query/URL/UI.
- `ARCHITECTURE.md` — documentar unión validada y desempates deterministas.
- `CONSTRAINTS.md` y `AGENTS.md` — no necesarios; no hay regla durable/workflow nuevo.
- `PROGRESS.md`/`feature_list.json` — solo implementación/validación añade evidencia
  y cambia estado; esta spec no los modifica.

## Visual Design Impact

- UI involucrada: sí; fuente `DESIGN.md` y superficie de filtros existente.
- Estados: formulario con sort predeterminado/seleccionado, resultados ordenados y
  estado vacío existente.
- Usar superficie, tipografía y tokens actuales, contraste AA, foco ámbar y altura
  >=44 px. En móvil se apila; en escritorio comparte la barra/grid sin reducir las
  tarjetas.
- Nuevo artefacto visual: no; no hay assets ni imágenes nuevas.

## Durable Documentation Impact

- `ARCHITECTURE.md`: update — parser de sort y mapa cerrado a `orderBy` con
  desempates estables.
- `CONSTRAINTS.md`: not needed — usa reglas existentes.
- `AGENTS.md`: not needed — no cambia comandos, permisos ni workflow.
- `docs/domain-model.md`: not needed — el escenario ya contempla ordenar.
- `PROGRESS.md`/`feature_list.json`: update posterior a implementación/validación,
  nunca como parte de esta spec.

## Implementation Plan

1. Fijar unión, contrato URL, labels y precedencia con tests.
2. Implementar parser/mapa `orderBy` y extender la consulta conservando `where` y
   default de `catalog-filter`.
3. Integrar selector, estilos responsive, documentación y ejecutar tests/gate.

## Implementation Tasks

- [ ] Añadir unión/parser y tests de ausencia, valores válidos, duplicados y desconocidos.
- [ ] Añadir `orderBy` Prisma por opción y tests con filtros; rango inválido no consulta.
- [ ] Integrar selector GET y verificar submit, recarga, compartir e historial.
- [ ] Cubrir valor seleccionado, accesibilidad/responsive y actualizar arquitectura;
  no introducir nombre descendente ni alcance adicional.

## Verification Plan

- `pnpm test -- src/lib/server/catalog-sort.test.ts src/lib/server/catalog.test.ts src/app/page.test.tsx src/components/catalog/CatalogFilters.test.tsx` — parser, query, URL y UI.
- `pnpm lint`, `pnpm typecheck` y `pnpm build` — calidad y Server Components en verde.
- `./init.sh` — gate no bloqueante (install, `db:setup`, `db:verify`, lint,
  typecheck, test, build); no inicia procesos largos ni `pnpm dev`.
- Smoke SSR/manual de `/`, las cuatro opciones y URL combinada: orden observable,
  empates, refresh, historial, teclado/foco y viewports. No hay `pnpm test:e2e`;
  tests de server/page más esta comprobación cubren el flujo.

## Evidence To Capture

- Tests/gates con Node 22 y pnpm 10.18.3; assertions de cada `orderBy`, desempates
  y `where` intacto con filtros.
- Resultado SSR/manual de cuatro opciones, URL combinada, inválida e historial,
  incluyendo orden observable de tarjetas.
- Revisión estática: sin sorting cliente, SQL dinámico, migraciones, dependencias,
  seed, acciones de tarjeta o IA.

## Validator Checklist

- [ ] `sort` acepta solo valores documentados; inválido cae al default sin `orderBy` arbitrario.
- [ ] Precio asc/desc, novedades y nombre son estables (`name`/`id` desempatan).
- [ ] Filtros se mantienen y aplican antes de ordenar; rango invertido conserva su estado.
- [ ] Selección accesible, responsive, visible al recargar y representada en URL; sin nombre DESC.
- [ ] Tests, lint, typecheck, build e `./init.sh` pasan y dejan evidencia posterior.
- [ ] Sin schema, seed, dependencias, detalle, carrito, IA ni cambio de estado durante esta spec.
