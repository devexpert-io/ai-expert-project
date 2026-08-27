# Architecture

## Runtime Surface

Monolito simple sobre **Next.js (App Router)** en TypeScript. Una única app sirve tanto el frontend (React Server Components / páginas) como el backend (API routes / server actions) sin procesos separados.

- **Framework**: Next.js 15 (App Router, `src/app`).
- **Lenguaje**: TypeScript (estricto).
- **Gestor de paquetes**: pnpm (lockfile commiteado).
- **Persistencia**: SQLite vía **Prisma** (sin servicio externo; un único archivo de base de datos local).

## Layers

1. **UI / páginas** — `src/app/*`: rutas, layouts y componentes React. Home mínima de arranque en `src/app/page.tsx`.
2. **Lógica de dominio / servicios** — se añadirá en features posteriores (`bootstrap-seed` en adelante).
3. **Persistencia** — Prisma (`prisma/schema.prisma`). En esta fase solo está definido el `datasource` SQLite (`DATABASE_URL`) y el `generator client`; **sin modelos ni migraciones todavía** (se definen en `bootstrap-seed`).
4. **Configuración de entorno** — `.env` (local, no commiteado) y `.env.example` (commiteado). Claves de IA vía variables de entorno.

## Dependency Direction

`src/app` → (futuro) dominio/servicios → Prisma (`@prisma/client`) → SQLite.

No hay dependencia inversa ni servicios externos obligatorios para arrancar.

## Decisions

- **ORM**: Prisma (v6) con SQLite, decisión tomada en `bootstrap-stack`. `DATABASE_URL="file:./dev.db"`. Alternativa evaluada: Drizzle; descartada por familiaridad y tooling de migraciones integrado de Prisma.
- **Testing**: Vitest + Testing Library + jsdom. El gate de verificación es lint + typecheck + test + build, ejecutable desde `./init.sh`.
- **Lint**: ESLint 9 (flat config) con `eslint-config-next`.

## Constraints

Ver `CONSTRAINTS.md` para reglas MUST/MUST NOT durables.
