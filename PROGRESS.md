# Registro de progreso

## Estado verificado actual

- Raíz del repositorio: `/Users/antonio/Projects/devexpert-io/ai-expert-project`
- Ruta estándar de arranque: `./init.sh`
- Ruta estándar de verificación: `./init.sh` (gate: install + lint + typecheck + test + build; no bloqueante, sin dev servers)
- Arranque local: `pnpm dev`
- Siguiente feature lista: `ai-provider-config`
- Bloqueador actual: ninguno
- Última verificación: `feature-validator` independiente en `accept` y gate exacto con Node v22.23.2/pnpm 10.18.3 en verde, 2026-08-28

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
