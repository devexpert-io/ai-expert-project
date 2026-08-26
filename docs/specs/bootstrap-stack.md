# Feature Implementation Spec: Bootstrap técnico (Next.js + TypeScript + SQLite + pnpm)

## Source Feature

- `id`: `bootstrap-stack`
- `area`: `bootstrap`
- `depends_on`: `[]` (satisfecho; sin prerequisitos)
- `status`: `not_started`
- `source`: `feature_list.json`

## Goal

Dejar el repositorio arrancando como app Next.js/TypeScript con `pnpm`, con un gate de calidad reproducible (`lint`, `typecheck`, `test`) ejecutable desde `./init.sh`, y con la decisión de persistencia (SQLite + ORM) tomada y cableada de forma mínima. El resultado es una app mínima ejecutable en local con `pnpm dev` que imprime contenido en la home, más la infraestructura de verificación que usarán el resto de features.

## Non-Goals

- No definir el modelo de dominio (tablas `User`, `Product`, `Variant`, `Category`, `Cart`, `Order`, `Chat`, `TryonImage`) ni migraciones ni seed: eso es `bootstrap-seed`.
- No crear páginas de catálogo, carrito, checkout, pedidos ni funciones de IA.
- No configurar despliegue en la nube ni CI remoto (solo scripts locales).
- No cablear `DEVEXPERT_API_KEY` ni el proveedor de IA (feature `ai-provider-config`).
- No arrancar un dev server persistente desde `init.sh`.

## Job Story

When quiero iniciar el desarrollo de la tienda desde un repo verde (sin stack todavía),
I want to arrancar la app con un único comando y poder validar cambios con lint/typecheck/tests,
so I can construir las features de producto sobre una base estable y verificable.

## Users And Permissions

- **Desarrollador/agente**: único actor en este slice. Ejecuta `./init.sh` para verificar la base y `pnpm dev` para ver la app mínima. No hay usuarios finales ni control de acceso en este feature.

## Acceptance Scenarios

### Scenario 1: Instalación reproducible

Given un repo sin `node_modules` ni `pnpm-lock.yaml`
When el desarrollador ejecuta `pnpm install`
Then se instalan las dependencias sin errores y se genera `pnpm-lock.yaml`.

### Scenario 2: Gate de calidad pasa

Given la app bootstrapped
When el desarrollador ejecuta `pnpm lint` y `pnpm typecheck`
Then ambos comandos terminan con código de salida 0 sin errores.

### Scenario 3: Test de humo

Given la app bootstrapped
When el desarrollador ejecuta `pnpm test`
Then se ejecuta al menos un test de humo y termina en verde (código 0).

### Scenario 4: Arranque estándar

Given el repo limpio en estado bootstrapped
When el desarrollador ejecuta `./init.sh`
Then el script ejecuta la verificación base (install + lint + typecheck + test) de forma no bloqueante, sale con código 0, y no deja ningún proceso dev corriendo.

### Scenario 5: App mínima ejecutable

Given la app bootstrapped
When el desarrollador ejecuta `pnpm dev`
Then la app sirve una home mínima renderizable en el navegador (código HTTP 200).

## Repository Research

### Files Inspected

- `AGENTS.md` — flujo de arranque (`./init.sh`) y reglas de trabajo/verificación.
- `PROGRESS.md` — estado pre-bootstrap; `init.sh` es provisional hasta esta feature.
- `feature_list.json` — definición y verificación de `bootstrap-stack`.
- `init.sh` — script provisional que hoy solo imprime orientación; hay que reescribirlo al gate real.
- `CONTEXT.md` — glosario del dominio (no afecta al bootstrap técnico).
- `docs/technical-discovery.md` — stack candidato (Next.js + TS, SQLite vía ORM Prisma/Drizzle, pnpm) y requisito "ejecutar en local con un comando".
- `docs/build-brief.md` — non-goals y slice MVP (contexto, no aplica a código aún).
- `docs/domain-model.md`, `docs/risks-and-open-questions.md` — research task abierta: "Decidir ORM y configuración SQLite para arrancar en local con pnpm".
- `DESIGN.md` — dirección visual (no aplica a este slice; no hay UI nueva más allá de una home mínima).
- `.gitignore` — ya cubre `node_modules/`, `dist/`, `.env` (suficiente para no commitear claves).

Nota: no existen `docs/mvp-scope.md`, `docs/product-brief.md`, `docs/user-and-access-model.md`, `docs/specs/*` ni `docs/adr/*` en el repo actual.

### Existing Patterns To Follow

- Tooling decidido en discovery: **Next.js (App Router) + TypeScript + pnpm**.
- Gate de CI ligero esperado en `technical-discovery.md`: lint + typecheck + tests.
- Regla de harness: `init.sh` ejecuta checks no bloqueantes y no debe arrancar dev servers.
- Entorno local verificado: Node v22.12.0, pnpm 10.18.3.

### Current Gaps

- No hay `package.json`, `tsconfig.json`, `eslint.config.*`, `vitest.config.*`, ni carpeta `src/`.
- No hay ORM ni driver de SQLite instalados.
- `init.sh` solo imprime texto; no ejecuta verificación real.
- No hay decisión registrada de ORM (Prisma vs Drizzle).

## Technical Approach

1. **Scaffold** Next.js App Router + TypeScript con `pnpm create next-app` (flags: `--ts --eslint --app --src-dir --no-tailwind --import-alias "@/*"`) en la raíz del repo. Evitar regen docs/product docs; mantener el repo existente.
2. **Scripts** en `package.json`: `dev` (next dev), `build` (next build), `start`, `lint` (next lint o `eslint`), `typecheck` (`tsc --noEmit`), `test` (vitest run).
3. **Testing**: añadir Vitest + (opcional) `@testing-library/react`/`jsdom` para un test de humo que importe/renderice la home o verifique un módulo trivial. Un solo test es suficiente para la verificación.
4. **ORM/SQLite**: tomar la decisión aquí y registrarla. Recomendado: **Prisma 6 + `@prisma/client`** con `DATABASE_URL="file:./dev.db"` en `.env`/`.env.example` (SQLite). Alternativa igual de válida: Drizzle + `better-sqlite3`. Lo que se elija debe quedar cableado de forma mínima (dependencia + datasource + `.env.example`), **sin** definir esquema ni migraciones (eso es `bootstrap-seed`). Si se opta por Drizzle, documentar el equivalente.
5. **`init.sh`**: reescribir para (a) verificar `node`/`pnpm`, (b) `pnpm install` (o `--frozen-lockfile` si existe lockfile), (c) `pnpm lint`, (d) `pnpm typecheck`, (e) `pnpm test`, con `set -euo pipefail` y salida clara por paso. No arrancar `pnpm dev`. Al final imprimir comandos manuales (`pnpm dev`).
6. **Home mínima**: `src/app/page.tsx` que renderice un título/cabecera simple (sin diseño de marca). No se persigue estética aquí.

## Expected File Changes

Rutas provisionales (app no bootstrapped todavía); se listan las esperadas tras el scaffold:

- `package.json` — create/modify; scripts y dependencias (next, react, typescript, eslint, vitest, ORM).
- `pnpm-lock.yaml` — create; lockfile generado por `pnpm install`.
- `tsconfig.json` — create; config TypeScript (incluir `noEmit` para typecheck si procede).
- `eslint.config.*` / `.eslintrc*` — create; config ESLint (Next.js).
- `vitest.config.*` — create; config de test runner.
- `next.config.*` — create; config Next.js.
- `src/app/layout.tsx`, `src/app/page.tsx` — create; layout raíz + home mínima.
- `.env.example` — create; `DATABASE_URL` y hueco para `DEVEXPERT_API_KEY` (vacío/documentado).
- `.env` — create (local, no commitear); `DATABASE_URL="file:./dev.db"`.
- `prisma/schema.prisma` (o config Drizzle equivalente) — create; datasource SQLite mínimo, sin modelos aún.
- `init.sh` — modify; gate real no bloqueante.
- `PROGRESS.md` — update; ruta de verificación deja de ser "provisional".

## Visual Design Impact

- UI involucrada: no (solo una home mínima de arranque; sin dirección visual que aplicar).
- Design source: `DESIGN.md` — no aplica a este slice.
- Screens/states afectados: ninguno.
- New design artifact required: no.

## Durable Documentation Impact

- `ARCHITECTURE.md`: **create** — esta feature establece el runtime surface (Next.js App Router, monolito simple), capas iniciales y la elección de ORM/persistencia.
- `CONSTRAINTS.md`: **create** — reglas durables: usar `pnpm`, persistencia SQLite local sin servicio externo, `init.sh` no arranca dev servers, claves via `.env` no commiteadas, ejecutar en local con un comando.
- `AGENTS.md`: **update** — registrar los comandos del gate (`pnpm lint`/`typecheck`/`test`) como ruta estándar de verificación, sustituyendo la descripción provisional.
- `docs/technical-discovery.md`: **update** (opcional) — reflejar la decisión de ORM tomada en la research task "Decidir ORM".
- `PROGRESS.md`: **update** — fin de sesión (evidencia).

## Implementation Plan

1. Scaffold de la app Next.js + TypeScript con pnpm (sin regen de docs ni Tailwind).
2. Configurar scripts (`lint`, `typecheck`, `test`) y añadir Vitest con un test de humo.
3. Elegir ORM (Prisma recomendado), instalar dependencia + driver SQLite, crear `.env`/`.env.example` y datasource mínimo.
4. Reescribir `init.sh` al gate real no bloqueante.
5. Ejecutar el gate completo y confirmar arranque con `pnpm dev`.
6. Actualizar docs durables (`ARCHITECTURE.md`, `CONSTRAINTS.md`, `AGENTS.md`) y registrar evidencia.

## Implementation Tasks

- [ ] Scaffold Next.js App Router + TS con `pnpm create next-app` en la raíz del repo.
- [ ] Verificar que `pnpm install` completa y genera `pnpm-lock.yaml`.
- [ ] Añadir `typecheck` (`tsc --noEmit`) y confirmar que pasa.
- [ ] Añadir/confirmar `lint` (ESLint + next) y confirmar que pasa.
- [ ] Añadir Vitest + config + un test de humo; confirmar `pnpm test` en verde.
- [ ] Instalar ORM elegido + driver SQLite; crear `prisma/schema.prisma` (datasource) o equivalente; `.env` y `.env.example`.
- [ ] Reescribir `init.sh` para ejecutar install + lint + typecheck + test (no bloqueante, sin dev server).
- [ ] Crear home mínima (`src/app/page.tsx` + `layout.tsx`) y confirmar `pnpm dev` sirve 200.
- [ ] Crear `ARCHITECTURE.md` y `CONSTRAINTS.md`; actualizar `AGENTS.md` y (opcional) `technical-discovery.md`.
- [ ] Actualizar `feature_list.json` (evidence) y `PROGRESS.md`.

## Verification Plan

- `pnpm install` → completa sin errores; genera lockfile.
- `pnpm lint` → exit 0.
- `pnpm typecheck` → exit 0.
- `pnpm test` → al menos 1 test verde, exit 0.
- `./init.sh` → ejecuta install + lint + typecheck + test, exit 0, sin dejar procesos dev.
- `pnpm dev` (manual) → home responde HTTP 200 en navegador.
- No hay comando E2E persistente todavía (repo pre-bootstrap). Esta feature no cambia comportamiento de usuario/API/routing, así que no se requiere cobertura E2E; el test de humo de Vitest basta. La cobertura E2E se introducirá cuando exista un flujo de usuario observable (a partir de `catalog-list`).

## Evidence To Capture

- Salida de `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` y `./init.sh` (capturar en `PROGRESS.md` y/o `feature_list.json`).
- Versión de Node/pnpm y versión final de Next.js/React/ORM en `package.json`.
- Confirmación manual de `pnpm dev` respondiendo HTTP 200.

## Validator Checklist

- [ ] La implementación se mantiene dentro del alcance de `bootstrap-stack` (sin modelo de dominio, sin seed, sin UI de producto).
- [ ] Los escenarios de aceptación pasan (install/lint/typecheck/test/init.sh/app mínima).
- [ ] `./init.sh` ejecuta el gate no bloqueante y no arranca dev servers.
- [ ] La evidencia de verificación está registrada.
- [ ] La decisión de ORM quedó registrada (en `ARCHITECTURE.md` y/o `technical-discovery.md`) y no se dejó ambigua.
- [ ] `feature_list.json` y `PROGRESS.md` fueron actualizados correctamente.
- [ ] No se añadió trabajo de producto ni funcionalidad extra fuera del slice.
