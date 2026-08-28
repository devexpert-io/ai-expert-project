# Spec: Filtrado del catálogo

## Metadatos

- Feature: `catalog-filter`
- Título: Filtrado del catálogo
- Estado: `not_started` (la spec no modifica `feature_list.json`)
- Dependencia aceptada: `catalog-list`
- Revisión de referencia: `50b5b1c`
- Fuente: `feature_list.json`, `DESIGN.md`, `docs/domain-model.md`, `docs/build-brief.md`

## Objetivo

Extender la página pública `/`, que ya muestra el catálogo sembrado, con filtros combinables
por categoría, talla, color y rango de precio. La selección debe vivir en la URL para que se
pueda recargar, compartir y recorrer con atrás/adelante del navegador. La consulta se ejecuta
en el servidor mediante Prisma y el resultado conserva el orden estable del catálogo actual.

## Fuera de alcance

- Ordenación, paginación, detalle de producto, enlaces de producto, carrito, checkout o cuenta.
- Recomendaciones, chat, IA o cualquier integración de proveedor de inferencia.
- Edición de productos, cambios de stock, migraciones de esquema, seed nuevo o dependencias.
- Selección múltiple dentro de una misma dimensión; cada categoría, talla y color es un valor.
- Filtrar por disponibilidad: un producto no se excluye por `stock` en esta feature.

## Job story

Cuando estoy explorando el catálogo, quiero combinar criterios que conozco (categoría, talla,
color y presupuesto) para reducir la lista y entender rápidamente si existe una prenda que me
encaje, sin perder esos criterios al recargar o compartir la página.

## Usuarios, permisos y seguridad

- Cualquier visitante, autenticado o no, puede leer y filtrar el catálogo.
- No se crean sesiones ni se escriben datos; el acceso a Prisma continúa siendo exclusivamente
  server-side a través de `src/lib/server/prisma.ts`.
- Los valores recibidos por query string se validan contra las opciones actuales de la base de
  datos y contra un parser de precios acotado. Valores desconocidos, duplicados o malformados
  se ignoran de forma segura; nunca se interpolan en SQL ni llegan sin validar a Prisma.
- Un rango con mínimo mayor que máximo se marca inválido, evita una consulta contradictoria y
  muestra un estado explicativo con opción de limpiar filtros.

## Contrato de URL y semántica

La forma canónica usa query params omitidos cuando no están seleccionados:

`/?category=camisetas&size=M&color=Negro&minPrice=19.90&maxPrice=59.90`

- `category` es el `Category.slug`; `size` y `color` son valores de `Variant`.
- `minPrice` y `maxPrice` son euros con punto decimal y hasta dos decimales. Se convierten a
  céntimos sin usar aritmética de coma flotante antes de construir el filtro Prisma.
- El rango es inclusivo y se aplica a `Product.basePriceCents`, que es el precio mostrado en la
  tarjeta; no se filtra por el precio particular de una variante.
- Las dimensiones se combinan con AND. Categoría filtra `category.slug`; talla y color requieren
  una misma variante que cumpla los valores seleccionados (`variants.some`). El rango se añade
  también con AND.
- El formulario usa navegación GET nativa hacia `/`; no depende de JavaScript para conservar el
  estado. Los controles se vuelven a pintar con los valores válidos de la URL y “Limpiar filtros”
  enlaza a `/`.

## Criterios de aceptación

### Escenario 1: catálogo sin filtros

**Dado** que visito `/` sin query params
**Cuando** se carga la página
**Entonces** veo los seis productos sembrados, el formulario de filtros y ningún control de
ordenación.

### Escenario 2: categoría

**Dado** que envío `category=camisetas`
**Cuando** el servidor consulta el catálogo
**Entonces** solo aparecen productos cuya categoría tiene ese slug, y la categoría permanece
seleccionada en el formulario.

### Escenario 3: filtros combinados

**Dado** que envío categoría, talla, color y/o mínimo y máximo de precio
**Cuando** se carga la URL resultante
**Entonces** solo aparecen productos que cumplen todos los criterios activos; talla y color se
evalúan sobre una variante relacionada que cumpla ambos valores.

### Escenario 4: precio y validación

**Dado** que envío un rango válido con decimales
**Cuando** se ejecuta la consulta
**Entonces** los límites se comparan inclusivamente en céntimos contra `basePriceCents`.

**Dado** que envío texto, negativos, más de dos decimales, un valor no seguro, una opción que no
existe o un rango invertido
**Cuando** se procesa la URL
**Entonces** no hay error ni consulta insegura: el valor inválido se descarta (o se muestra el
estado de rango inválido para el caso invertido), manteniendo una interfaz comprensible.

### Escenario 5: sin coincidencias

**Dado** que una combinación válida no coincide con ningún producto
**Cuando** se muestran los resultados
**Entonces** veo un estado vacío específico, con el formulario y el enlace “Limpiar filtros”
visible; el mensaje no atribuye el problema a un fallo técnico.

### Escenario 6: URL y accesibilidad

**Dado** que aplico un filtro y uso recargar, compartir o atrás/adelante
**Cuando** vuelve a renderizarse `/`
**Entonces** el estado visible y la consulta corresponden a la URL.

**Dado** que navego solo con teclado o lector de pantalla
**Cuando** recorro los controles
**Entonces** cada grupo tiene `label`/`legend` semántico, foco visible, selección perceptible sin
depender solo del color y objetivos táctiles de al menos 44 px.

## Investigación del repositorio

- `src/app/page.tsx` es un Server Component dinámico (`force-dynamic`) que hoy llama a
  `getCatalogProducts()` y renderiza `CatalogGrid`; debe leer `searchParams` y orquestar opciones,
  filtros y resultados.
- `src/lib/server/catalog.ts` selecciona campos públicos y ordena por nombre e ID. Su view model
  (`CatalogProduct`) debe mantenerse; la consulta puede aceptar un estado de filtros validado.
- `prisma/schema.prisma` define `Product.basePriceCents`, relación `category` y `Variant.size`,
  `Variant.color`, `Variant.priceCents` y `stock`; no hace falta cambiar el esquema.
- `src/components/catalog/CatalogGrid.tsx` ya tiene estado vacío accesible y tarjetas sin acciones;
  conviene permitir un mensaje contextual sin romper el mensaje por defecto.
- `src/components/catalog/catalog.module.css` ya establece grid de 12 columnas y breakpoints 640,
  900 y 1200 px. `DESIGN.md` pide filtros desplegables en móvil, chips para talla/color, AA y
  controles con foco visible.
- Los tests persistentes existentes son `src/app/page.test.tsx`,
  `src/components/catalog/CatalogGrid.test.tsx` y `src/lib/server/catalog.test.ts`; no existe
  `pnpm test:e2e`.

## Enfoque técnico

1. Añadir un módulo puro `src/lib/server/catalog-filters.ts` con `CatalogFilterState`, opciones y
   parser de `searchParams`. Debe aceptar solo escalares, normalizar espacios/case según la
   opción almacenada, convertir precios con parsing decimal exacto y devolver una marca de rango
   inválido sin lanzar excepciones.
2. Extender `src/lib/server/catalog.ts` para recibir el estado ya validado y construir un único
   `where` Prisma: categoría por slug, una condición `variants.some` para talla/color y rango
   inclusivo sobre `basePriceCents`. Añadir `getCatalogFilterOptions()` server-side para categorías
   con productos, tallas/colores disponibles y mínimos/máximos de precio; ordenar opciones de forma
   estable y seleccionar solo los campos necesarios.
3. Crear `src/components/catalog/CatalogFilters.tsx` como Server Component. Usar `<form method="get">`,
   select accesible para categoría, fieldsets de radios estilizados como chips para talla/color,
   inputs numéricos en euros para mínimo/máximo, botón “Aplicar filtros” y enlace para limpiar.
   Mostrar selección actual, límites de precio como ayuda y un resumen de resultados con `role=status`
   o `aria-live` sin anunciar cada tarjeta.
4. Actualizar `page.tsx` para resolver `searchParams`, cargar opciones, parsear y consultar. Para
   rango inválido no ejecutar un `where` imposible; renderizar el estado de validación. Actualizar
   `CatalogGrid` solo para aceptar un mensaje vacío contextual y conservar la API actual por defecto.
5. Mantener las tarjetas, orden, imagen remota, tokens y breakpoints de `catalog-list`. El panel de
   filtros debe apilarse en móvil, usar el grid en escritorio y mantener contraste AA/foco visible.

## Cambios esperados

- `src/app/page.tsx` — leer query state y renderizar filtros/resultados.
- `src/lib/server/catalog-filters.ts` — tipos y validación pura de URL.
- `src/lib/server/catalog.ts` — opciones y consulta filtrada server-side.
- `src/components/catalog/CatalogFilters.tsx` y CSS de catálogo — controles responsive accesibles.
- `src/components/catalog/CatalogGrid.tsx` — mensaje vacío contextual, sin nuevas acciones de tarjeta.
- Tests unitarios de parser/consulta y componente/página: ampliar los tres tests existentes o añadir
  `CatalogFilters.test.tsx` y `catalog-filters.test.ts` según el tamaño final.
- `ARCHITECTURE.md` — documentar que la URL se valida en server y que Prisma aplica filtros.
- `CONSTRAINTS.md` — solo si se incorpora una regla durable de formato de query; no añadir una
  migración ni dependencias para esta feature.

## Plan de implementación

1. Confirmar tipos Prisma y fixtures de `prisma/seed.ts`; fijar contrato de params y casos inválidos.
2. Implementar parser puro con tests de URL vacía, cada dimensión, combinación, precio y errores.
3. Implementar opciones y `where` Prisma; probar que todos los filtros se combinan y que el orden
   nombre/ID se mantiene.
4. Construir el formulario server-rendered y conectar página, resultados, estado vacío y limpieza.
5. Ajustar CSS con tokens existentes, responsive y estados de foco/selección; actualizar docs durable.

## Verificación y evidencia requerida

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test` (incluye parser, query, página, controles y estado vacío)
- `pnpm build`
- `./init.sh` como gate del repositorio si el entorno está preparado; no usarlo como sustituto de
  los tests específicos durante el desarrollo.
- Revisión manual de `/`, una URL combinada, rango sin resultados, URL malformada, atrás/adelante,
  teclado/foco y viewport móvil/escritorio. Registrar URLs y resultado observado en la evidencia de
  la feature; no marcarla aceptada solo por un HTTP 200.

## Checklist de validación

- [ ] Solo se modifican los archivos previstos; no hay cambios de esquema, seed, secretos o IA.
- [ ] Query params tienen nombres y semántica documentados, se preservan al recargar y se limpian.
- [ ] Prisma recibe un estado validado y combina AND correctamente.
- [ ] Precio usa `basePriceCents`, límites inclusivos y conversión exacta a céntimos.
- [ ] Formulario, chips, foco, teclado y responsive cumplen `DESIGN.md`.
- [ ] Estado vacío distingue “sin coincidencias” de error y ofrece limpiar filtros.
- [ ] Tests y gate dejan evidencia reproducible; sorting, detalle, carrito e IA siguen fuera de scope.
