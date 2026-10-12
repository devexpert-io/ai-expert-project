# Registro de progreso

## Estado verificado actual

- Raíz del repositorio: `/Users/antonio/Projects/devexpert-io/ai-expert-project`
- Ruta estándar de arranque: `./init.sh`
- Ruta estándar de verificación: `./init.sh` (gate: install + lint + typecheck + test + build; no bloqueante, sin dev servers)
- Arranque local: `pnpm dev`
- Siguiente paso: planificar `orders-detail` con `feature-spec`
- Bloqueador actual: ninguno
- Última verificación: `orders-list` aceptada por validator independiente (2026-10-12); gate258 tests y QA390×844/1280×800.

## Registro de sesión

### Sesión 001

- Fecha: 2026-08-26
- Objetivo: Crear el harness inicial mínimo del repositorio.
- Completado: `AGENTS.md`, `init.sh`, `PROGRESS.md` y `feature_list.json` creados.
- Verificación ejecutada: validación JSON de `feature_list.json`; comprobación de dependencias (referencias válidas, sin ciclos, sin auto-referencias).
- Evidencia capturada: 19 features sesionables, sin features en estado `in_progress`, sin epic/milestone sin trocear.
- Archivos o artefactos actualizados: `AGENTS.md`, `init.sh`, `PROGRESS.md`, `feature_list.json`.
- Riesgo o cuestión no resuelta: el stack aún no está inicializado; `init.sh` es provisional hasta el bootstrap técnico.
- Siguiente mejor paso: ejecutar la feature `bootstrap-stack` (Next.js + TypeScript + SQLite + pnpm con gate de lint/typecheck/tests).

### Sesión 002 — `bootstrap-stack`

- Fecha: 2026-08-26
- Objetivo: dejar el repo arrancando como app Next.js/TypeScript con pnpm, gate de calidad desde `./init.sh` y persistencia (SQLite + Prisma) cableada de forma mínima.
- Completado:
  - Scaffold manual de Next.js 15 (App Router) + TypeScript: `package.json`, `tsconfig.json`, `eslint.config.mjs`, `next.config.ts`, `next-env.d.ts`, `src/app/layout.tsx`, `src/app/page.tsx`.
  - Testing con Vitest + Testing Library + jsdom: `vitest.config.ts`, `vitest.setup.ts`, `src/app/page.test.tsx` (1 test de humo).
  - ORM Prisma 6 + SQLite: `prisma/schema.prisma` (datasource + generator, sin modelos), `.env` (no commiteado), `.env.example` (commiteado, con `DATABASE_URL` y hueco para `DEVEXPERT_API_KEY`).
  - `.npmrc` con `public-hoist-pattern[]=*` (para que ESLint flat config resuelva los plugins bajo pnpm) y `pnpm.onlyBuiltDependencies` en `package.json` (build scripts de esbuild/prisma/engines).
  - `init.sh` reescrito a gate real no bloqueante (node/pnpm check → install → lint → typecheck → test → build).
- Verificación ejecutada y evidencia:
  - `pnpm install` → OK (next 15.5.24, react 19.2.8, prisma 6.19.3, vitest 3.2.7; lockfile generado).
  - `pnpm lint` → exit 0.
  - `pnpm typecheck` → exit 0.
  - `pnpm test` → exit 0 (1 test).
  - `pnpm build` → exit 0.
  - `pnpm exec prisma validate` → exit 0.
  - `./init.sh` → exit 0.
  - `pnpm dev` → home responde HTTP 200 ("Tienda de ropa"); proceso detenido tras la comprobación.
- Archivos o artefactos actualizados: `AGENTS.md` (sección "Stack y verificación estándar"), `ARCHITECTURE.md` (nuevo), `CONSTRAINTS.md` (nuevo), `docs/technical-discovery.md` (decisión ORM), `docs/risks-and-open-questions.md` (research task ORM resuelta), `feature_list.json`, `PROGRESS.md`, `.gitignore`.
- Riesgo o cuestión no resuelta: `@prisma/client` aún sin `prisma generate` (sin modelos; se generará el cliente en `bootstrap-seed` cuando existan modelos). Build scripts de `@prisma/client` ignorados por pnpm a propósito (no necesarios aún).
- Estado: feature `bootstrap-stack` en `accepted` (validación independiente vía `feature-validator`: veredicto `accept`).
- Siguiente mejor paso: validación independiente de `bootstrap-stack`; después, feature `bootstrap-seed` (modelo de datos + seed del catálogo).

### Sesión 003 — `bootstrap-seed`

- Fecha: 2026-08-28
- Objetivo: definir el modelo Prisma/SQLite, migración, fixture idempotente y preparación verificable del catálogo local.
- Completado:
  - Diez modelos de dominio con relaciones, unicidades, índices y precios en céntimos en `prisma/schema.prisma`.
  - Migración reproducible `prisma/migrations/20260828100000_bootstrap_seed/` y fixture de 4 categorías, 6 productos y 24 variantes en `prisma/seed.ts`.
  - `scripts/db-setup.mjs` (fallback no destructivo de `.env`, generate, migrate deploy y seed) y `scripts/verify-seed.mjs` (comprobación de solo lectura); scripts/hooks integrados en `package.json` e `init.sh`.
  - Documentación durable actualizada en `ARCHITECTURE.md`, `CONSTRAINTS.md`, `docs/technical-discovery.md` y `docs/risks-and-open-questions.md`.
- Verificación ejecutada y evidencia:
  - `PATH=/opt/homebrew/opt/node@22/bin:$PATH npx --yes --package=pnpm@10.18.3 --call './init.sh'` → exit 0 (Node v22.23.2, pnpm 10.18.3; install, db:setup, db:verify, lint, typecheck, test y build).
  - `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm exec prisma validate` y `pnpm exec prisma format --check` → exit 0.
  - Dos ciclos sobre SQLite limpio aislado → conteos estables (4/6/24; 23 disponibles, 1 agotada), SKU sin duplicados y verificación en verde.
  - Con filas ajenas de usuario/carrito/pedido/línea/chat/try-on insertadas entre ciclos, el segundo setup conservó conteos y contenido; `.env` existente también se conservó byte a byte.
  - `git diff --check` → exit 0; `.env`, `*.db` y diarios permanecen ignorados y no rastreados.
- Validación independiente: `feature-validator` → `accept`; repitió migración/seed, sentinels, restricciones relacionales, degradación negativa de stock, arranque HTTP 200, seguridad acotada y gate completo sin findings.
- Estado: `bootstrap-seed` en `accepted`.
- Riesgo o cuestión no resuelta: ninguna para esta feature; `@prisma/client` muestra el warning conocido de build scripts ignorados/deprecación de configuración Prisma durante `pnpm install`, pero `prisma generate` y el gate completo pasan.
- Siguiente mejor paso: ejecutar `feature-validator` sobre `bootstrap-seed`; después continuar con `ai-provider-config`.

### Sesión 004 — `ai-provider-config`

- Fecha: 2026-08-28
- Objetivo: crear la frontera server-only de DevExpert Inference con configuración por entorno y degradación segura para consumers futuros.
- Completado:
  - Añadidas las variables de endpoint/modelos a `.env.example`, manteniendo `DEVEXPERT_API_KEY` vacía y `.env` ignorado.
  - Añadidas `openai` 7.8.0 y `server-only` 0.0.1 con lockfile actualizado.
  - Creado `src/lib/server/ai/config.ts` con defaults, trim, validación HTTP(S), estado sin clave y objeto público sin secretos.
  - Creado `src/lib/server/ai/provider.ts` con cliente lazy, `maxRetries: 0`, `AiResult`, clasificación 401/403/429/5xx/red/configuración y mensajes constantes sin errores crudos.
  - Tests fake sin red en `config.test.ts` y `provider.test.ts`; no se añadieron consumers, rutas, UI, chatbot ni try-on.
  - Documentación durable actualizada en `ARCHITECTURE.md`, `CONSTRAINTS.md` y `docs/technical-discovery.md`.
- Verificación ejecutada y evidencia:
  - `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm test -- src/lib/server/ai` → exit 0 (12 tests; Vitest también confirmó el smoke test existente).
  - `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm lint` y `pnpm typecheck` → exit 0.
  - `PATH=/opt/homebrew/opt/node@22/bin:$PATH npx --yes --package=pnpm@10.18.3 --call './init.sh'` → exit 0 (Node v22.23.2/pnpm 10.18.3; install, setup/verify de DB, lint, typecheck, tests y build).
  - No hubo llamadas de red de DevExpert; pruebas usan fake OpenAI. Revisión `rg` confirma server-only y ausencia de `NEXT_PUBLIC_DEVEXPERT_API_KEY`.
- Validación independiente: `feature-validator` → `accept`; 12 tests y gate completo repetidos, boundary server-only, no-retry, clasificación segura y revisión de secretos/scope sin findings.
- Estado: `ai-provider-config` en `accepted`.
- Riesgo o cuestión no resuelta: ninguna para esta feature; pnpm muestra el warning ya existente de `onlyBuiltDependencies` en `package.json` y Prisma la deprecación de `package.json#prisma`, sin impacto en el gate.
- Siguiente mejor paso: ejecutar `feature-validator` sobre `ai-provider-config`; después continuar con `catalog-list`.

### Sesión 005 — `catalog-list`

- Fecha: 2026-08-28
- Objetivo: sustituir la home técnica por el listado público del catálogo, leyendo los seis productos sembrados desde Prisma en servidor y mostrando una cuadrícula responsive de tarjetas.
- Completado:
  - Creado el singleton Prisma server-only y `getCatalogProducts()` con consulta mínima de producto/categoría, orden estable nombre+id y view-model plano sin variantes ni stock.
  - Convertida `/` en Server Component dinámico con `main`, `h1` «Catálogo», estado vacío accesible y `CatalogGrid` semántico (`ul`/`li`/`article`) con imagen, alt, nombre, categoría y precio EUR.
  - Añadidos estilos globales y de tarjetas según `DESIGN.md`: grid 12 columnas, 1/2/3/4 columnas en 12/640/900/1200px, gap 24px, imagen 4:5, tokens de color y tipografía system/Inter.
  - Permitido el host HTTPS `placehold.co` para `next/image`; no se cambiaron schema/seed ni se añadieron dependencias.
  - Añadidos tests de consulta, página, semántica, precios y estado vacío.
- Verificación ejecutada y evidencia:
  - `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm test -- src/app/page.test.tsx src/components/catalog src/lib/server/catalog.test.ts` → exit 0 (5 archivos, 16 tests).
  - `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm lint && pnpm typecheck` → exit 0.
  - `PATH=/opt/homebrew/opt/node@22/bin:$PATH npx --yes --package=pnpm@10.18.3 --call './init.sh'` → exit 0 con Node v22.23.2/pnpm 10.18.3 (install, db:setup, db:verify, lint, typecheck, 16 tests y build).
  - `pnpm dev` → `/` respondió HTTP 200 en servidor local; SSR incluyó «Catálogo», «Productos del catálogo» y los productos sembrados; proceso detenido tras la comprobación.
  - `git diff --check` → exit 0; revisión estática confirmó server-only, payload mínimo y ausencia de filtros, sort, links, botones, variantes, stock, IA y dependencias nuevas.
- Archivos o artefactos actualizados: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/catalog/CatalogGrid.tsx`, `src/components/catalog/catalog.module.css`, `src/lib/server/prisma.ts`, `src/lib/server/catalog.ts`, tests de página/grid/consulta, `next.config.ts`, `ARCHITECTURE.md`, `feature_list.json`, `PROGRESS.md`, `vitest.setup.ts`.
- Validación independiente: `feature-validator` → `accept`; repitió tests/gate/HTTP 200, confirmó 6 artículos, consulta mínima server-only, semántica accesible, grid 12/6/4/3 y ausencia de alcance adelantado.
- Estado: feature `catalog-list` en `accepted`.
- Riesgo o cuestión no resuelta: ninguno conocido para este slice; permanecen los warnings conocidos de pnpm/Prisma sin impacto en el gate.
- Siguiente mejor paso: ejecutar `feature-validator` sobre `catalog-list`; después continuar con `catalog-filter`.

### Sesión 006 — `catalog-filter`

- Fecha: 2026-08-28
- Objetivo: añadir filtros combinables por categoría, talla, color y rango de precio con estado persistido en la URL y consulta segura server-side.
- Completado:
  - Creado `catalog-filters.ts` con tipos de opciones/estado, validación contra categorías/variantes actuales, normalización de espacios/case y parser decimal exacto a céntimos sin coma flotante; duplicados, desconocidos, negativos, más de dos decimales y valores fuera de rango se ignoran.
  - Extendido `catalog.ts` para cargar opciones actuales y construir un único `where` Prisma con AND: categoría, una misma variante para talla+color y límites inclusivos sobre `basePriceCents`; se conserva el orden nombre+id y no se filtra por stock.
  - Añadido formulario Server Component GET con select, fieldsets/legend de radios estilo chip, precios, foco visible, targets táctiles >=44px, resumen accesible y enlace de limpieza; la página conserva la selección al recargar/compartir y distingue rango invertido y cero coincidencias.
  - Manteniendo `CatalogGrid` sin acciones de tarjeta; no se tocaron schema/seed/dependencias ni se adelantaron sorting, detalle, carrito o IA.
- Verificación ejecutada y evidencia:
  - `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm test -- src/lib/server/catalog-filters.test.ts src/lib/server/catalog.test.ts src/components/catalog/CatalogFilters.test.tsx src/app/page.test.tsx src/components/catalog/CatalogGrid.test.tsx` → exit 0 (7 archivos, 29 tests).
  - `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm lint && pnpm typecheck` → exit 0.
  - `PATH=/opt/homebrew/opt/node@22/bin:$PATH npx --yes --package=pnpm@10.18.3 --call './init.sh'` → exit 0 con Node v22.23.2/pnpm 10.18.3 (install, db:setup, db:verify, lint, typecheck, 29 tests y build).
  - Smoke SSR: `/` → HTTP 200/6 productos; `?category=camisetas` → 2; combinación `camisetas+M+Negro+19.90–19.90` → 1; combinación sin coincidencias → 0; valores inválidos → catálogo completo sin error.
  - `git diff --check` → exit 0; revisión estática confirmó frontera server-only, validación de URL, query parametrizada, ausencia de stock/filtros de disponibilidad y alcance cerrado.
- Archivos o artefactos actualizados: `src/app/page.tsx`, `src/lib/server/catalog-filters.ts`, `src/lib/server/catalog.ts`, `src/components/catalog/CatalogFilters.tsx`, `src/components/catalog/catalog.module.css`, `src/components/catalog/CatalogGrid.tsx`, tests de parser/consulta/formulario/página, `ARCHITECTURE.md`, `feature_list.json`, `PROGRESS.md`.
- Validación independiente: `feature-validator` → `accept`; repitió 18 tests focalizados, gate con 29 tests y matriz SSR, confirmando precios exactos, misma variante talla+color, params seguros, accesibilidad y alcance sin findings.
- Estado: feature `catalog-filter` en `accepted`.
- Riesgo o cuestión no resuelta: ninguno conocido para este slice; permanecen los warnings conocidos de pnpm/Prisma sin impacto en el gate.
- Siguiente mejor paso: ejecutar `feature-validator` sobre `catalog-filter`; después continuar con `catalog-sort`.

### Sesión 007 — `catalog-sort`

- Fecha: 2026-08-28
- Objetivo: añadir ordenación pública por nombre, precio ascendente/descendente y novedades, manteniendo filtros y estado en la URL.
- Completado:
  - Creado `catalog-sort.ts` con unión cerrada de valores (`name`, `price-asc`, `price-desc`, `newest`) y parser que rechaza vacíos, desconocidos y duplicados con fallback seguro a nombre.
  - Extendido `getCatalogProducts()` con un mapa cerrado de `orderBy` Prisma: nombre+id, precio+nombre+id y createdAt+nombre+id; se conserva el `where` de filtros y el rango inválido no consulta.
  - Añadido selector GET accesible «Ordenar por» al formulario existente; conserva categoría/talla/color/precio, permite recarga/compartir/historial sin JavaScript y mantiene la UI responsive/foco/targets.
  - No se cambiaron schema/seed/dependencias ni se adelantaron detalle, carrito o IA.
- Verificación ejecutada y evidencia:
  - `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm test -- src/lib/server/catalog-sort.test.ts src/lib/server/catalog.test.ts src/app/page.test.tsx src/components/catalog/CatalogFilters.test.tsx` → exit 0 (8 archivos, 34 tests).
  - `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm lint && pnpm typecheck` → exit 0.
  - `PATH=/opt/homebrew/opt/node@22/bin:$PATH npx --yes --package=pnpm@10.18.3 --call './init.sh'` → exit 0 con Node v22.23.2/pnpm 10.18.3 (install, db:setup, db:verify, lint, typecheck, 34 tests y build).
  - Smoke SSR: `/` → nombre A-Z; `?sort=price-asc` y `?sort=price-desc` → precios asc/desc; `?sort=newest` → novedades; filtros+sort conserva subconjunto y orden; `?sort=unknown` → nombre A-Z; todas respondieron HTTP 200.
  - `git diff --check` → exit 0; revisión estática confirmó parser cerrado, orderBy parametrizado fijo, desempates deterministas y ausencia de sorting en cliente/alcance adelantado.
- Archivos o artefactos actualizados: `src/lib/server/catalog-sort.ts`, `src/lib/server/catalog-sort.test.ts`, `src/lib/server/catalog.ts`, `src/lib/server/catalog.test.ts`, `src/app/page.tsx`, `src/app/page.test.tsx`, `src/components/catalog/CatalogFilters.tsx`, `src/components/catalog/CatalogFilters.test.tsx`, `src/components/catalog/catalog.module.css`, `ARCHITECTURE.md`, `feature_list.json`, `PROGRESS.md`.
- Validación independiente: `feature-validator` → `accept`; repitió 15 tests focalizados, gate con 34 tests y SSR de las cuatro opciones/filtros/fallback, confirmando orderBy cerrado, accesibilidad y alcance sin findings.
- Estado: feature `catalog-sort` en `accepted`.
- Riesgo o cuestión no resuelta: ninguno conocido para este slice; permanecen los warnings conocidos de pnpm/Prisma sin impacto en el gate.
- Siguiente mejor paso: ejecutar `feature-validator` sobre `catalog-sort`; después continuar con `product-detail`.

### Sesión 008 — `product-detail`

- Fecha: 2026-08-28
- Objetivo: añadir la ficha pública de producto y resolver talla/color contra una variante exacta con precio y stock URL-backed.
- Completado:
  - Creado servicio `product-detail.ts` server-only con slug canónico, `findUnique`, select explícito y parser escalar de talla/color sin aproximaciones.
  - Creada `/products/[slug]` con 404 seguro, ficha responsive 4:5/una-dos columnas y formulario GET sin estado cliente.
  - Precio base sin pareja; precio/stock exactos con pareja válida; selección parcial o inexistente explicada; agotada visible y deshabilitada sin acción de compra.
  - Cada tarjeta del catálogo enlaza una sola vez a su detalle; filtros y ordenación existentes permanecen intactos.
- Verificación ejecutada y evidencia:
  - Tests focalizados → exit 0 (11 archivos, 48 tests): parser/consulta, 404, ruta, UI, stock, disabled y enlaces, además de regresiones existentes.
  - `./init.sh` con Node v22.23.2/pnpm 10.18.3 → exit 0 (install, DB, lint, typecheck, 48 tests y build con `/products/[slug]`).
  - Smoke SSR local → 200 para base, disponible S/Negro (19,90 €, 12), precio alternativo XL/Azul (20,90 €, 5), agotada M/Negro (0/disabled), parcial e inexistente; 404 para slug desconocido y no canónico.
  - Revisión estática: GET/labels/legends/foco/targets >=44px/status accesible y responsive; sin carrito, checkout, try-on, IA, auth, schema, seed, dependencias o mutaciones.
- Archivos o artefactos actualizados: ruta/tests bajo `src/app/products/[slug]/`, servicio/tests `src/lib/server/product-detail*`, ficha/tests/CSS bajo `src/components/product/`, formatter compartido, enlaces/tests del catálogo, `ARCHITECTURE.md`, `feature_list.json`, `PROGRESS.md` y spec planificada.
- Validación independiente: `feature-validator` → `accept`; repitió 48 tests, gate completo y smoke SSR 200/404, y confirmó lookup seguro, precio/stock exactos, agotadas disabled, accesibilidad y alcance sin hallazgos bloqueantes.
- Estado: feature `product-detail` en `accepted`.
- Riesgo o cuestión no resuelta: no existe harness E2E persistente; el flujo observable se cubrió con tests server/página/componente y smoke SSR/HTTP. Los warnings conocidos de pnpm/Prisma no afectan al gate.
- Siguiente mejor paso: cerrar esta fase con verificación acumulada y decidir qué feature de IA abre el módulo 5.

### Sesión 009 — `chatbot-conversation`

- Fecha: 2026-09-07
- Objetivo: añadir conversación pública del chatbot con contexto real del catálogo y degradación segura del proveedor IA.
- Completado:
  - Widget global accesible en catálogo y detalle, con historial en memoria, foco, Escape, estado de carga, errores reintentables y diseño responsive.
  - `POST /api/chat` con contrato validado, límite efectivo de 64 KiB, control de Origin, respuestas no cacheadas y errores seguros.
  - Contexto Prisma fresco de productos, categorías y variantes con precio exacto y stock; adapter de chat configurado con timeout 30 s y cero reintentos.
  - Recomendaciones estructuradas, enlaces, try-on, pedidos y persistencia de chats quedan fuera de esta feature.
- Verificación ejecutada y evidencia:
  - `CI=true ./init.sh` → exit 0 con Node v22.23.2/pnpm 10.18.3, incluyendo install, db:setup, db:verify, lint, typecheck, 84 tests y build.
  - Tests focalizados y revisión independiente `feature-validator` → `accept` (15 archivos, 84 tests), cubriendo endpoint, límites, seguridad, catálogo, proveedor, UI y accesibilidad.
  - Smoke local con mock OpenAI → dos turnos HTTP 200; contexto de 6 productos/24 variantes y stock cero; comprobación UI a escritorio y 390x844, cierre por Escape, foco y continuidad al navegar al detalle.
  - Repetición posterior del gate no fue posible: la reinstalación de dependencias encontró ENOTFOUND y la escalación fue rechazada por el límite de uso del entorno; no contradice el gate completado antes.
- Archivos o artefactos actualizados: endpoint, servicio/contexto de chat, contrato compartido, widget/CSS/layout, tests focalizados, documentación durable, spec y estados de feature.
- Validación independiente: `accept`; sin findings de seguridad, alcance o arquitectura.
- Estado: feature `chatbot-conversation` en `accepted`.
- Riesgo o cuestión no resuelta: calidad semántica del modelo real no se midió con una clave real; el smoke usa mock local y la degradación sin clave queda cubierta por tests.
- Siguiente mejor paso: ejecutar `feature-spec` para `chatbot-recommend`.

### Sesión 010 — `chatbot-recommend`

- Fecha: 2026-09-07
- Objetivo: añadir recomendaciones estructuradas del chatbot con tarjetas navegables y datos reconstruidos desde el catálogo vigente.
- Completado:
  - Contrato compartido ampliado a `{ ok: true, reply, recommendations }`; el cliente conserva únicamente pares de texto en el historial.
  - Contexto server-only ampliado con IDs, slug, imagen y `Variant.id`; el prompt exige JSON limitado con candidatos por IDs.
  - Servicio server-only parsea la salida, limita el JSON, descarta IDs inventados, variantes ajenas, stock cero y productos sin ninguna variante disponible, deduplica y reconstruye precio/nombre/categoría/imagen/variante desde catálogo fresco.
  - Widget accesible con hasta tres tarjetas, `Link` interno, query params canónicos para talla/color, disponibilidad, imagen/alt, foco y rechazo defensivo de payloads malformados.
  - Actualizados `ARCHITECTURE.md`, `CONSTRAINTS.md`, `docs/technical-discovery.md` y `docs/risks-and-open-questions.md`; no se tocaron Prisma, seed, dependencias ni autenticación.
- Verificación ejecutada y evidencia:
  - `PATH=/private/tmp/node-v22.23.2-darwin-arm64/bin:$PATH pnpm test -- src/lib/server/ai/chat.test.ts src/lib/server/chat-catalog.test.ts src/app/api/chat/route.test.ts src/components/chat/ChatWidget.test.tsx` → exit 0 (15 archivos, 90 tests), incluyendo persistencia de tarjetas tras seguimiento fallido y rechazo de `recommendations` no-array.
  - `PATH=/private/tmp/node-v22.23.2-darwin-arm64/bin:$PATH pnpm lint` → exit 0; `pnpm typecheck` → exit 0.
  - `PATH=/private/tmp/node-v22.23.2-darwin-arm64/bin:$PATH CI=true ./init.sh` → exit 0 con Node v22.23.2/pnpm 10.18.3; DB setup/verify, lint, typecheck, 90 tests y build en verde. Log: `/private/tmp/recommend-finish-gate.log`.
  - El primer intento del gate fue bloqueado por `ENOTFOUND` al recrear dependencias; la repetición con acceso de red completó todas las comprobaciones. El servidor del usuario en 3000 no se detuvo ni se usó.
- Estado: feature `chatbot-recommend` en `accepted` por decisión explícita del usuario; se omitió el rol validator.
- Smoke del orquestador: build en 4340 y mock OpenAI en 4339; ID inventado y duplicado descartados, dos tarjetas válidas. CUA confirmó Camiseta básica L/Blanco (19,90 €, 8 unidades) y Abrigo ligero (89,90 €) al abrir sus enlaces; seguimiento informativo conserva tarjetas previas. UI revisada a 1280x900 y 390x844 con scroll y controles alcanzables; viewport restaurado.
- Riesgo o cuestión no resuelta: no existe harness E2E persistente; pruebas offline y smoke con mock verifican integración, sin medir calidad semántica del proveedor real.
- Siguiente mejor paso: continuar con `tryon-upload` mediante `feature-spec`.

### Sesión 011 — `tryon-upload`

- Fecha: 2026-09-07
- Objetivo: añadir en el detalle la subida local de foto con preview, validación y aviso de privacidad, sin generación ni persistencia.
- Completado:
  - Contrato `src/lib/tryon-upload.ts`: MIME JPG/PNG/WebP, 5 MiB, mensajes constantes, textos de privacidad.
  - Isla `TryOnUpload` con input etiquetado, preview `<img>`, object URLs revocadas, checkbox, «Quitar foto» y «Generar prueba virtual» siempre `disabled`.
  - Montaje al final de `ProductDetail` sin convertir ficha ni página a Client Component.
  - Docs: `ARCHITECTURE.md`, `CONSTRAINTS.md`, `docs/technical-discovery.md`, `docs/risks-and-open-questions.md`.
- Verificación ejecutada y evidencia:
  - Tests focalizados + suite: 103 tests en verde (Node v22.23.2 / pnpm 10.18.3) antes del fallo de install.
  - `pnpm lint` y `pnpm typecheck` en verde; `git diff --check` limpio.
  - Smoke en `/products/camiseta-basica`: preview válida, error GIF, aviso `inference.devexpert.io`, botón disabled, sin fetch.
  - `CI=true ./init.sh` falló al recrear dependencias: EPERM `mkdir .../iconv-lite_tmp_*/.idea`. `node_modules` quedó sin `next`/`@prisma/client`. `pnpm build` no se ejecutó. El servidor de desarrollo existente pasó a HTTP 500 al recargar.
- Estado: `tryon-upload` en `in_progress` (implementada, gate incompleto). No `passing` ni `accepted`.
- Riesgo o cuestión no resuelta: hay que restaurar dependencias fuera de este sandbox (`pnpm install`) y repetir `./init.sh`. La generación sigue en `tryon-result`.
- Siguiente mejor paso: restaurar `node_modules`, repetir `CI=true ./init.sh` y validar con `feature-validator`.

### Sesión 012 — `tryon-upload` restore/gate

- Fecha: 2026-09-07
- Objetivo: restaurar `node_modules` y completar `CI=true ./init.sh` sin cambiar producto.
- Completado: ningún restore exitoso. `PATH=.../node@22:... pnpm install --frozen-lockfile` (Node v22.23.2, pnpm 10.18.3) sigue ejecutándose en sandbox y falla con `EPERM mkdir .../iconv-lite_tmp_*/.idea`. No se relanzó `./init.sh` porque `next` y `@prisma/client` siguen ausentes.
- Estado: `tryon-upload` permanece `in_progress`. No `passing` ni `accepted`.
- Riesgo: el Shell de este agente no aplica ejecución unrestricted; el orquestador o un operador local debe correr `pnpm install` y `CI=true ./init.sh` fuera del sandbox.
- Siguiente mejor paso: install + gate fuera del sandbox; si exit 0, marcar `passing` con esa evidencia.

### Sesión 013 — `tryon-upload` accepted

- Fecha: 2026-09-07
- Objetivo: pulir visualmente el selector de foto y cerrar la feature por decisión del usuario.
- Completado:
  - El input nativo queda oculto; la etiqueta es una zona dashed editorial (esquinas rectas, marfil/arena, hint JPG/PNG/WebP).
  - Botones de la sección alineados con la ficha (radio 0, terracota para el CTA de IA).
  - `tryon-upload` pasa a `accepted` por petición explícita; se omiten implementer restante, `./init.sh` y validator.
- Estado: feature `tryon-upload` en `accepted`.
- Riesgo o cuestión no resuelta: el gate completo no se reejecutó en esta sesión; la generación sigue en `tryon-result`.
- Siguiente mejor paso: ejecutar `feature-spec` para `tryon-result`.

### Sesión 014 — `tryon-result`

- Fecha: 2026-09-07
- Objetivo: conectar `TryOnUpload` a DevExpert Inference y mostrar el resultado o un error claro.
- Completado:
  - Contrato compartido en `src/lib/tryon.ts`: tope 6 MiB, data URL png/jpeg, parseo multipart, textos de procesando/aproximación. `TRYON_STATUS_READY` actualizado.
  - Servicio `src/lib/server/ai/tryon.ts`: lookup de producto, prompt fijo en español, `images.edit` con `DEVEXPERT_IMAGE_MODEL`, timeout 60 s, `n: 1`, `b64_json`; URL-only → `provider_error` sin fetch.
  - `POST /api/tryon` (Node, `maxDuration` 60, `no-store`): Origin, bytes reales, consentimiento, 400/413/429/503.
  - Isla habilitada con props `productSlug`/`size`/`color` desde `ProductDetail` (sigue Server Component). Un fetch, abort al limpiar/desmontar, resultado `<img>` nativo efímero.
  - Docs: `ARCHITECTURE.md`, `CONSTRAINTS.md`, `docs/technical-discovery.md`, `docs/risks-and-open-questions.md`.
- Verificación ejecutada y evidencia:
  - Tests focalizados + suite: 132 tests, exit 0 (Node v22.12.0 / pnpm 10.18.3).
  - `pnpm lint` y `pnpm typecheck` exit 0; `git diff --check` limpio.
  - `CI=true ./init.sh` falló al recrear dependencias: EPERM `mkdir .../iconv-lite@0.6.3/.../iconv-lite_tmp_*/.idea` (el paquete publica `.idea/`). `node_modules` quedó incompleto. `pnpm build` y smoke `pnpm dev` no se ejecutaron.
- Estado: `tryon-result` en `in_progress` (implementada, gate incompleto). No `passing` ni `accepted`.
- Riesgo o cuestión no resuelta: hay que restaurar dependencias fuera de este sandbox (`CI=true pnpm install --frozen-lockfile`) y repetir `./init.sh`.
- Siguiente mejor paso: install + gate fuera del sandbox; si exit 0, marcar `passing` y validar con `feature-validator`.

### Sesión 015 — `tryon-result` accepted

- Fecha: 2026-09-07
- Objetivo: cerrar la feature por decisión del usuario tras prueba manual.
- Completado:
  - El usuario confirmó que envío, procesando, resultado y error controlado funcionan en la ficha.
  - `tryon-result` pasa a `accepted` por petición explícita; se omiten `./init.sh` y el rol validator.
- Estado: feature `tryon-result` en `accepted`.
- Riesgo o cuestión no resuelta: el gate completo no se reejecutó en esta sesión; la calidad visual real del `image-edit` no se midió.
- Siguiente mejor paso: ejecutar `feature-spec` para `cart-add`.

### Sesión 016 — `cart-add`

- Fecha: 2026-10-12
- Objetivo: permitir que un invitado añada una variante exacta disponible al carrito, acumulando cantidades y conservando el carrito mediante cookie HTTP-only y SQLite.
- Completado:
  - `src/lib/cart.ts`: contrato cerrado `{ variantId, quantity }`, límite de 8 KiB y mensajes seguros.
  - `src/lib/server/cart.ts`: resolución server-only de variante/stock, `Cart` por `guestToken`, `CartItem` único con `upsert` incremental y total de unidades dentro de una transacción.
  - `src/app/api/cart/items/route.ts`: `POST` Node, control de Origin, cookie `cart_guest_token` HttpOnly/SameSite=Lax/Path=/Max-Age=2592000/Secure en producción, `no-store`, estados 400/404/409/413/500.
  - `CartAddForm` cliente accesible integrado únicamente para una pareja exacta disponible; agotada, parcial o inexistente no monta CTA. Añadido `src/app/icon.svg` para eliminar el 404 de favicon durante QA.
  - Actualizados `ARCHITECTURE.md`, `CONSTRAINTS.md`, `docs/technical-discovery.md`, `docs/risks-and-open-questions.md`, tests focalizados y evidencia de feature.
- Verificación ejecutada y evidencia:
  - `CI=true ./init.sh` → exit 0 con Node v22.23.2/pnpm 10.18.3; DB setup/verify, lint, typecheck, 24 archivos y 163 tests, build. Log: `/tmp/ai-expert-cart-add-gate-20261012.log`.
  - `git diff --check` → exit 0; sin `localStorage`, secretos, token en JSON, mutación de stock, auth, checkout ni cambios de schema/seed/dependencias.
  - Smoke navegador con helper MCP y servidor propio `http://localhost:4317`: a 390x844 se añadieron 2 unidades, se recargó y se añadió 1 con la cookie persistida; las respuestas fueron 200 (`quantity=3`, `itemCount=3`) y SQLite mostró una sola línea `CAM-BAS-S-NEGRO` de cantidad 3 para el token probado. M/Negro agotada: CTA ausente y API directa 409 sin línea.
  - QA a 390x844 y 1280x800: sin overflow horizontal, labels/foco/targets/status correctos; navegación limpia con consola sin errores y peticiones 200. Capturas: `/tmp/cart-add-390.png` y `/tmp/cart-add-1280.png`.
- Estado: `cart-add` en `passing`, pendiente de validación independiente; no `accepted`.
- Riesgo o cuestión no resuelta: el carrito no reserva ni descuenta stock; `cart-manage`/checkout debe revalidar cantidades antes de cobrar. Los avisos conocidos de pnpm/Prisma no afectan al gate.
- Siguiente mejor paso: ejecutar `feature-validator` sobre `cart-add` y, tras su aceptación, planificar `cart-manage`.

### Sesión 017 — `cart-add` reparación de overflow

- Fecha: 2026-10-12
- Motivo: el validator detectó que una cantidad por encima del rango Int32 de `CartItem.quantity`, o una suma acumulada que lo excediera, podía terminar en un error 500 de Prisma.
- Completado:
  - `CART_QUANTITY_MAX = 2_147_483_647` aplicado al parser, servicio server-only y atributo `max` del formulario.
  - Validación de la cantidad inicial y de `existing + quantity` antes de cualquier `Cart`/`CartItem` write; el endpoint responde 400 seguro con `Cache-Control: no-store`.
  - Tests de máximo válido, máximo+1 inicial y overflow acumulado; spec y documentación actualizadas con el límite.
- Verificación ejecutada y evidencia:
  - `CI=true ./init.sh` → exit 0 con Node v22.23.2/pnpm 10.18.3, 24 archivos y 169 tests, lint, typecheck y build. Log: `/tmp/ai-expert-cart-add-overflow-gate-20261012.log`.
  - Endpoint real aislado en `http://localhost:4327` con DB temporal `/tmp/ai-expert-cart-overflow-20261012.db`: `quantity=2_147_483_647` → 200; el mismo token con `+1` → 400 no-store sin `Set-Cookie` y la fila quedó en el máximo; `quantity=2_147_483_648` → 400 sin crear fila.
  - El smoke visual anterior a 390x844/1280x800 sigue siendo válido: la reparación solo añade el límite coherente del control de cantidad, sin cambiar el flujo ni el layout.
- Estado: `cart-add` en `passing`, pendiente de revalidación independiente; no `accepted`.
- Riesgo: el carrito no reserva ni descuenta stock; `cart-manage`/checkout debe revalidar disponibilidad y cantidades antes de cobrar.
- Siguiente mejor paso: ejecutar `feature-validator` sobre `cart-add`.

### Aceptación independiente — `cart-add`

- Fecha: 2026-10-12. Validator: `accept` tras reparación del overflow Int32.
- Verificación independiente: 42 tests focalizados; gate post-fix inspeccionado (169 tests); endpoint concurrente sobre max−1 dio 200/400 y fila final max; agregado de dos líneas max correcto.
- UI validada a 390×844 y 1280×800 en localhost:4317 sobre cambios de esta feature; aceptación antes del commit.
- Estado: `cart-add` accepted. Siguiente: `cart-manage`.

### Sesión 018 — `cart-manage`

- Fecha: 2026-10-12
- Objetivo: crear `/cart` para leer el carrito de invitado, ajustar cantidades y eliminar líneas conservando totales exactos y la cookie existente.
- Completado:
  - `src/lib/cart.ts`: `CartView`, líneas planas y parsers cerrados para PATCH/DELETE con límite Int32.
  - `src/lib/server/cart.ts`: lectura server-only y mutaciones transaccionales por `guestToken`; precios desde `Variant.priceCents`, subtotales enteros seguros y Cart vacío conservado.
  - `src/app/api/cart/items/route.ts`: PATCH/DELETE con Origin, cuerpo ≤8 KiB, `no-store`, 400/404/500 seguros y sin emitir cookie nueva; POST existente preservado.
  - `src/app/cart/page.tsx` + estilos: estado vacío, líneas enlazables con talla/color, resumen, cantidad y eliminación; `CartItemControls` accesible usa `credentials: same-origin` y `router.refresh()`.
  - Header global con «Carrito» y documentación durable actualizada en `ARCHITECTURE.md`, `CONSTRAINTS.md` y `docs/technical-discovery.md`.
- Verificación ejecutada y evidencia:
  - `CI=true ./init.sh` → exit 0 con Node v22.23.2/pnpm 10.18.3; `db:setup`, `db:verify`, lint, typecheck, 26 archivos y 202 tests, build incluyendo `/cart`. Log: `/tmp/ai-expert-cart-manage-gate-20261012.log`.
  - `git diff --check` → exit 0; sin cambios de schema/seed/dependencias, checkout, auth, stock ni `localStorage`.
  - Smoke API con helper MCP y servidor propio `http://localhost:4347`: POST 200 creó dos líneas; PATCH 200 `2→5` devolvió `lineTotalCents=9950` y `subtotalCents=9950`; DELETE 200 dejó snapshot vacío; línea ausente 404; cantidad `0` 400. Todas las respuestas `Cache-Control: no-store`; no hubo `Set-Cookie` en PATCH/DELETE.
  - Smoke UI en `/cart`: 390×844 y 1280×800; enlace global visible, subtotal 120,40 € tras actualización, eliminación dejó una línea a 20,90 €, `scrollWidth` igual al viewport. Capturas: `/tmp/cart-manage-390.png` y `/tmp/cart-manage-1280.png`. Navegación normal: solo mensaje informativo de React DevTools, sin errores ni peticiones fallidas.
- Estado: `cart-manage` en `passing`, pendiente de validación independiente; no `accepted`.
- Riesgo: el carrito conserva cantidades aunque cambie el stock; checkout debe revalidar disponibilidad antes de cobrar.
- Siguiente mejor paso: ejecutar `feature-validator` sobre `cart-manage`.

### Aceptación independiente — `cart-manage`

- Fecha:2026-10-12. Validator:`accept`; 67 tests focalizados, gate202 tests y QA390×844/1280×800 verificados.
- Smoke aislado localhost:4348: vacío sin cookie, dos líneas60,70€, PATCH120,40€, DELETE y errores400/404; no-store/sin Set-Cookie. JSON con claves únicas.
- Estado:accepted. Siguiente:`checkout-review`.

### Sesión 019 — `checkout-review`

- Fecha: 2026-10-12
- Objetivo: crear `/checkout` para que un invitado revise su `CartView` y guarde un borrador efímero de contacto/envío antes de cuenta y pago.
- Completado:
  - `src/lib/checkout.ts`: contrato cerrado `checkout_draft_v1`, normalización, límites, validación de cuatro campos y parser/serializador que rechazan JSON manipulado o campos extra.
  - `src/app/checkout/page.tsx` + estilos: lectura server-side por `cart_guest_token`, resumen desde `getGuestCart`/`Variant.priceCents`, vacío seguro sin cookie/líneas y formulario solo con líneas.
  - `src/components/checkout/CheckoutForm.tsx` + estilos: required, `autocomplete`, errores en español con `aria-describedby`, status/alert, rehidratación y escritura exclusiva en `sessionStorage`; guardar no hace red.
  - `/cart`: CTA «Continuar al checkout» condicionado a líneas; tests de contrato, página, CTA y formulario.
  - Actualizados `ARCHITECTURE.md`, `CONSTRAINTS.md` y `docs/technical-discovery.md`; sin schema/migración/dependencia nueva ni cuentas, pedidos, pagos o stock.
- Verificación ejecutada:
  - `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm test -- src/lib/checkout.test.ts src/components/checkout/CheckoutForm.test.tsx src/app/checkout/page.test.tsx src/app/cart/page.test.tsx` → exit 0; 29 archivos y 217 tests.
  - `PATH=/opt/homebrew/opt/node@22/bin:$PATH CI=true ./init.sh` → exit 0 con Node v22.23.2/pnpm 10.18.3; DB setup/verify, lint, typecheck, 217 tests y build con `/checkout`. Log: `/tmp/ai-expert-checkout-review-gate-20261012-final.log`.
  - `git diff --check` → exit 0; `feature_list.json` válido, 19 IDs únicos y comprobación de claves duplicadas OK.
  - Smoke browser con helper MCP en servidor propio `http://localhost:4367`: vacío sin cookie no creó carrito/cookie ni formulario; variante seeded CAM-BAS-S-NEGRO quantity=2 → POST 200/itemCount=2; resumen mostró talla S, Negro, 2 unidades, 19,90 €/ud, 39,80 € de línea y subtotal.
  - QA emulada 390×844/1280×800: móvil apilado y escritorio en dos columnas, `scrollWidth === clientWidth`, consola solo aviso informativo de React DevTools, peticiones 200, roles/labels/required/foco inspeccionados. Capturas: `/tmp/checkout-review-390.png`, `/tmp/checkout-review-1280.png`.
  - Borrador real: `sessionStorage` contiene solo `checkout_draft_v1` con `name`, `email`, `phone`, `shippingAddress`; guardar anunció `role=status` sin fetch y recarga restauró valores. JSON con campo extra fue rechazado y eliminado.
- Estado: `checkout-review` en `passing`, pendiente de validación independiente; no `accepted`.
- Riesgo: el carrito no reserva ni descuenta stock; `checkout-payment` debe revalidar antes de cobrar. Los avisos conocidos de pnpm/Prisma no afectan al gate.
- Siguiente mejor paso: ejecutar `feature-validator` sobre `checkout-review`.

### Aceptación independiente — `checkout-review`

- Fecha:2026-10-12. Validator:`accept`; 217 tests, lint/typecheck, gate/build y QA390×844/1280×800 verificados.
- GET aislado localhost:4381 sin cookie mostró vacío200 sin formulario ni Set-Cookie; borrador con cuatro campos, privacidad y parser cerrado comprobados.
- Estado:accepted. Siguiente:`checkout-user`.

### Sesión 020 — `checkout-user`

- Fecha: 2026-10-12
- Objetivo: permitir registro/login desde checkout, asociar el carrito invitado a la cuenta y mantener sesiones revocables sin cambiar pagos ni pedidos.
- Completado:
  - Añadidos `User.sessions`, `Session.tokenHash/expiresAt` y la migración `prisma/migrations/20261012130000_checkout_user`; la migración es aditiva y conserva los datos existentes.
  - Servicio server-only con bcryptjs coste 12, token opaco hasheado con SHA-256, expiración de 30 días, validación de contraseña de 8 caracteres y 72 bytes UTF-8, sesión válida con 409 al intentar cambiar de cuenta, registro/login/logout y revocación.
  - Registro/login combina el carrito invitado con el carrito del usuario en una transacción, valida overflow antes de escribir, elimina el carrito guest y prioriza la sesión válida en `/api/cart/items`, `/cart` y `/checkout`.
  - UI de checkout con modos «Crear cuenta»/«Ya tengo cuenta», estado de sesión, logout, mensajes accesibles y password solo en memoria; no se incluye payment/order.
  - Actualizados `ARCHITECTURE.md`, `CONSTRAINTS.md`, `docs/domain-model.md`, `docs/technical-discovery.md` y `docs/risks-and-open-questions.md`.
- Verificación ejecutada y evidencia:
  - `PATH=/opt/homebrew/opt/node@22/bin:$PATH CI=true ./init.sh` -> exit 0 con Node v22.23.2/pnpm 10.18.3; db setup/verify, lint, typecheck, 33 archivos y 236 tests, build con las rutas de auth, carrito y checkout.
  - `git diff --check` -> exit 0; `prisma migrate status` indicó base al día; cuentas y tokens de prueba se eliminaron de la base local tras el smoke.
  - Tests cubren contrato cerrado, normalización, bcrypt, límite UTF-8 sin truncado, cookies, expiración/revocación, credenciales inválidas, sesión activa, merge/overflow, aislamiento por usuario y UI sin password persistida.
  - Smoke real en `http://localhost:3107`: registro y login/logout, asociación del guest, aislamiento entre cuentas, 409 al cambiar de cuenta con sesión válida y 404 del guest revocado.
  - QA DevTools MCP en `/checkout` emulado a 390x844 y 1280x800: sin overflow horizontal; móvil apilado y escritorio en dos columnas; consola solo aviso informativo de React DevTools y red sin peticiones fallidas. Capturas `/tmp/checkout-user-qa-390.png` y `/tmp/checkout-user-qa-1280.png`.
- Estado: `checkout-user` en `passing`, pendiente de validación independiente; no `accepted`.
- Riesgo o cuestión no resuelta: la sesión se valida en cada lectura de carrito y caduca por `expiresAt`; el validator debe comprobar de forma independiente los contratos de cookie, merge y revocación sobre una base aislada.
- Siguiente mejor paso: ejecutar `feature-validator` sobre `checkout-user`.

### Aceptación independiente — `checkout-user`

- Fecha:2026-10-12. Validator:`accept`; gate236 tests, migración/DB/build y QA390×844/1280×800 verificados.
- SQLite aislado: overflow login conserva contacto/carritos/sesiones, merge válido conserva repetidas6/distintas2 y revoca guest; sesión expirada/revocada devuelve null. Cookies producción seguras y sin secretos en cliente.
- Estado:accepted. Siguiente:`checkout-payment`.

### Sesión 021 — `checkout-payment`

- Fecha: 2026-10-12
- Objetivo: cobrar mediante simulador aprobado/rechazado para crear pedidos con snapshot de precios, validar stock vigente y hacer replay idempotente por usuario.
- Completado:
  - `Order.idempotencyKeyHash` nullable con índice único compuesto `[userId, idempotencyKeyHash]` en `prisma/migrations/20261012133000_checkout_payment`; seed preserva el stock de variantes existentes.
  - Servicio server-only `src/lib/server/payment.ts`: precios/nombres/cantidades leídos del servidor, líneas y total snapshot, PAID con decremento condicional y vaciado de carrito en una transacción, CANCELLED conserva stock/carrito, conflictos de SQLite reintentables y replay por hash incluso con carrito ya vacío.
  - `POST /api/checkout/payment`: sesión válida obligatoria, contrato cerrado `{outcome}`, `Idempotency-Key` ASCII acotada, Origin/content-type/body limit, respuestas seguras 401/409/413/503 y `Cache-Control: no-store`.
  - `SimulatedPayment` integrado tras autenticación en checkout: aviso fijo de no cobro, aprobado/rechazado determinista, retry con clave nueva tras rechazo y sin persistir clave/resultado en cliente.
  - `scripts/verify-seed.mjs` tolera mezcla de variantes agotadas después de pedidos y exige agotada/disponible solo en una base sin pedidos. Documentación actualizada en `ARCHITECTURE.md`, `CONSTRAINTS.md`, `docs/domain-model.md`, `docs/technical-discovery.md` y `docs/risks-and-open-questions.md`.
- Verificación ejecutada y evidencia:
  - `PATH=/opt/homebrew/opt/node@22/bin:$PATH CI=true ./init.sh` -> exit 0 con Node v22.23.2/pnpm 10.18.3; migración, db:setup/verify, lint, typecheck, 37 archivos y 252 tests, build con `/api/checkout/payment`. Log: `/tmp/ai-expert-checkout-payment-gate-20261012.log`.
  - `git diff --check` -> exit 0; no se añadieron dependencias ni claves JSON duplicadas.
  - Smoke aislado en `http://localhost:4369` con `DATABASE_URL=file:/tmp/ai-expert-checkout-payment-20261012.db`: aprobado creó PAID con total/line snapshot, descontó stock y vació carrito; mismo key replayó sin duplicado; rechazado creó CANCELLED conservando stock/carrito; nueva clave aprobó el retry; ausencia de sesión devolvió 401; stock cambiado devolvió 409 y conservó carrito.
  - Concurrencia real sobre última unidad: dos usuarios en paralelo produjeron exactamente un 200 PAID y un 409 de stock, stock final 0 y un solo pedido PAID. Misma clave en paralelo (outcomes approved/rejected) devolvió a ambos el mismo PAID/orderId, un único pedido, carrito vacío y stock 10→9.
  - Reejecución de `DATABASE_URL=file:/tmp/ai-expert-checkout-payment-20261012.db pnpm db:setup` no restauró stock vendido (variante seguía en 0); `pnpm db:verify` pasó con mezcla `disponibles=22, agotadas=2` y 4 pedidos.
  - QA Chrome DevTools MCP en `/checkout`: 390x844 y 1280x800 sin overflow (`scrollWidth=clientWidth`), aviso de simulación visible, flujo aprobado y rechazo CANCELLED con retry; consola solo info de React DevTools y POST de pago 200. Capturas vigentes se sustituyen en la reparación del validator.
- Estado: `checkout-payment` en `passing`, pendiente de validación independiente; no `accepted`.
- Riesgo o cuestión no resuelta: el pago sigue siendo un simulador local sin pasarela externa; el validator debe comprobar de forma independiente el contrato de replay y la atomicidad sobre una base aislada.
- Siguiente mejor paso: ejecutar `feature-validator` sobre `checkout-payment`.

### Reparación validator — `checkout-payment`

- Fecha: 2026-10-12
- Motivo: el validator detectó una frase obsoleta en `CheckoutForm` y que el botón de retry rechazado volvía a enviar `outcome=rejected` sin permitir elegir un nuevo resultado.
- Correcciones:
  - La nota general del checkout ahora solo indica que los datos se guardan para retomarlos; el aviso de no cobro queda en el bloque `Pago simulado`.
  - `Reintentar pago` limpia el pedido cancelado y abre de nuevo el selector. El usuario puede elegir `Aprobar pago` o `Rechazar pago`; al enviar se genera una clave nueva. Los reintentos de red conservan la clave del intento que no obtuvo respuesta.
  - Regresión de componente cubre rechazo → retry → selección aprobada → PAID sin recarga y comprueba body/key nuevos; el test de red conserva la misma key.
- Verificación ejecutada:
  - `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm test -- src/components/checkout/SimulatedPayment.test.tsx src/components/checkout/CheckoutForm.test.tsx` (Vitest ejecuta 37 archivos/252 tests) -> exit 0.
  - `PATH=/opt/homebrew/opt/node@22/bin:$PATH CI=true ./init.sh` -> exit 0 con Node v22.23.2/pnpm 10.18.3, 37 archivos/252 tests y build. Log: `/tmp/ai-expert-checkout-payment-gate-20261012-repair.log`.
  - QA MCP en `http://localhost:4379/checkout`: 390x844 mostró CANCELLED, `Reintentar pago`, selector y PAID sin reload; 1280x800 tuvo PAID visible en la captura desktop independiente. Ambas sin overflow, consola solo info React DevTools y POST de pago 200. Capturas reparadas: `/tmp/checkout-payment-repair-rejected-390.png`, `/tmp/checkout-payment-repair-retry-390.png`, `/tmp/checkout-payment-repair-success-390.png`, `/tmp/checkout-payment-repair-success-1280.png`.
- Estado: `checkout-payment` permanece en `passing`, pendiente de nueva validación independiente; no `accepted`.

### Aceptación independiente — `checkout-payment`

- Validator: **ACCEPT** después de reparar el texto y el reintento; 9 tests focales, lint/typecheck/diff-check OK. Gate final252 tests y capturas de pago aprobado390/1280, rechazo y selector revisadas.
- Evidencia previa válida: stock/carrito atómicos, snapshot, 401/409, replay y concurrencia sobre última unidad; seed conserva stock vendido.
- Estado: `accepted`. Siguiente: `orders-list`.

### Sesión 022 — `orders-list`

- Fecha: 2026-10-12
- Objetivo: permitir que una persona autenticada consulte `/orders` con solo sus pedidos, mostrando estado, total EUR y fecha sin adelantar el detalle.
- Completado:
  - Añadido `src/lib/server/orders.ts` con consulta server-only filtrada por `userId`, selección mínima (`id`, `status`, `totalCents`, `createdAt`), orden estable descendente y mapa cerrado de estados; estados desconocidos se omiten.
  - Añadido `/orders` como Server Component dinámico con guardia `auth_session`/`getSessionUser`, redirección a `/checkout`, estado vacío accesible, tarjetas semánticas y fecha `es-ES` en `Europe/Madrid`.
  - Añadidos estilos responsive y tests focales; el header global incluye «Mis pedidos» y los targets de utilidades tienen mínimo 44px con wrap móvil.
  - Actualizados `ARCHITECTURE.md`, `CONSTRAINTS.md`, `docs/domain-model.md`, `docs/technical-discovery.md` y la evidencia de `feature_list.json`.
- Verificación ejecutada y evidencia:
  - `PATH=/opt/homebrew/opt/node@22/bin:$PATH CI=true ./init.sh` → exit 0 con Node v22.23.2/pnpm 10.18.3; DB setup/verify, lint, typecheck, 39 archivos/258 tests y build con `/orders`. Log final tras la reparación de targets del header: `/tmp/ai-expert-orders-list-gate-20261012-final-repair.log`.
  - Prueba focal `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm exec vitest run src/lib/server/orders.test.ts src/app/orders/page.test.tsx` → 2 archivos/6 tests, exit 0.
  - `git diff --check` → exit 0; SHA base de trabajo `090c109179ed1f8d4ad929a1b2f1ad33abd2cf52`; no se añadieron dependencias, schema ni migraciones.
  - Smoke aislado en SQLite temporal con dos usuarios, cookies de sesión, pedidos mezclados y estado desconocido: invitado `307 → /checkout`; cada usuario recibió solo su historial y la UI no mostró IDs, estado interno ni PII. La base temporal y el servidor propio se detuvieron/limpiaron al terminar.
  - QA Chrome DevTools MCP en `http://127.0.0.1:4468/orders`: emulación exacta `390x844x1,mobile,touch` y `1280x800`; ambos `scrollWidth === clientWidth`, todos los anchors visibles del header (wordmark, navegación y utilidades) midieron `minHeight=44px` y foco visible, peticiones GET/CSS/chunks/icon 200 y consola solo info React DevTools. Capturas revisadas: `/tmp/orders-list-repair-390.png`, `/tmp/orders-list-repair-1280.png`; servidor propio detenido y DB temporal limpiada al terminar.
- Estado: `orders-list` en `passing`, pendiente de validación independiente; no `accepted`.
- Riesgo o cuestión no resuelta: la página usa un mapa cerrado y omite estados desconocidos; el detalle, enlaces por pedido y cualquier API permanecen fuera de alcance. Los avisos conocidos de pnpm/Prisma no afectan al gate.
- Siguiente mejor paso: ejecutar `feature-validator` sobre `orders-list`.

### Aceptación independiente — `orders-list`

- Validator: **ACCEPT** tras reparar targets44px de todo el header. Gate258 tests; focal6 tests/diff-check OK, capturas390/1280 revisadas.
- Validó aislamiento por propietario, select mínimo, estados desconocidos omitidos, vacío en navegador e invitado307→checkout.
- Estado:`accepted`. Siguiente:`orders-detail`.
