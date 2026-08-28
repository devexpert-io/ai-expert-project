# Registro de progreso

## Estado verificado actual

- Raíz del repositorio: `/Users/antonio/Projects/devexpert-io/ai-expert-project`
- Ruta estándar de arranque: `./init.sh`
- Ruta estándar de verificación: `./init.sh` (gate: install + lint + typecheck + test + build; no bloqueante, sin dev servers)
- Arranque local: `pnpm dev`
- Siguiente feature lista: `catalog-sort`
- Bloqueador actual: ninguno
- Última verificación: `feature-validator` independiente en `accept` y gate exacto de `catalog-filter` en verde, 2026-08-28

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
