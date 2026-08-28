# Architecture

## Runtime Surface

Monolito simple sobre **Next.js (App Router)** en TypeScript. Una única app sirve tanto el frontend (React Server Components / páginas) como el backend (API routes / server actions) sin procesos separados.

- **Framework**: Next.js 15 (App Router, `src/app`).
- **Lenguaje**: TypeScript (estricto).
- **Runtime**: Node 22 (versión exacta en `.nvmrc`, compatible con Prisma 6).
- **Gestor de paquetes**: pnpm 10.18.3 (lockfile commiteado y versión fijada en `packageManager`).
- **Persistencia**: SQLite vía **Prisma** (sin servicio externo; un único archivo de base de datos local).

## Layers

1. **UI / páginas** — `src/app/*`: rutas, layouts y componentes React. Home mínima de arranque en `src/app/page.tsx`.
2. **Lógica de dominio / servicios** — se añadirá en features posteriores (`bootstrap-seed` en adelante). El adapter de IA vive en `src/lib/server/ai/` y está marcado `server-only`.
3. **Persistencia** — Prisma (`prisma/schema.prisma`) sobre SQLite. El esquema
   contiene las diez tablas del dominio y sus relaciones; la migración inicial
   vive en `prisma/migrations/` y el fixture de catálogo en `prisma/seed.ts`.
   Los importes persistidos usan enteros en céntimos.
4. **Configuración de entorno** — `.env` (local, no commiteado) y `.env.example` (commiteado). Claves de IA vía variables de entorno.

## Dependency Direction

`src/app` → (futuro) dominio/servicios → Prisma (`@prisma/client`) → SQLite.

Los consumidores futuros de IA en rutas, server actions o servicios de servidor
usarán `src/lib/server/ai/provider.ts` → OpenAI SDK → DevExpert Inference. Los
módulos de `src/lib/server/ai/` no se importan desde componentes cliente y la
clave se lee solo en runtime de servidor.

No hay dependencia inversa ni servicios externos obligatorios para arrancar.

El catálogo público mantiene el acceso a datos en servidor: `src/lib/server/prisma.ts`
expone un singleton `PrismaClient` protegido por `server-only`, y
`src/lib/server/catalog.ts` selecciona únicamente los campos de tarjeta y
devuelve un view-model plano antes de que `src/app/page.tsx` lo pase a la UI.
Los filtros del catálogo viven en query params GET; `catalog-filters.ts` los
normaliza contra las opciones actuales y convierte precios a céntimos antes de
que `catalog.ts` construya el `where` Prisma con condiciones AND.
La ordenación sigue la misma frontera: `catalog-sort.ts` reduce `sort` a una
unión cerrada y `catalog.ts` aplica un mapa fijo de `orderBy` con desempates
`name`/`id` (o `createdAt`/`name`/`id` para novedades), sin ordenar en el cliente.

## Decisions

- **ORM**: Prisma (v6) con SQLite, decisión tomada en `bootstrap-stack`. `DATABASE_URL="file:./dev.db"`. Alternativa evaluada: Drizzle; descartada por familiaridad y tooling de migraciones integrado de Prisma.
- **Migraciones y seed**: el arranque local ejecuta `prisma generate`,
  `prisma migrate deploy` y `prisma db seed` mediante `pnpm db:setup`. El seed
  hace upsert únicamente de categorías, productos y variantes, por slug/SKU,
  y no borra usuarios, carritos, pedidos, chats ni imágenes existentes.
- **Preparación automática**: `predev` y `prestart` llaman a `pnpm db:setup`;
  `.env` se copia desde `.env.example` solo cuando falta. `pnpm db:verify`
  comprueba la estructura y los mínimos del fixture sin escribir en la base.
- **Proveedor de IA**: `src/lib/server/ai/config.ts` normaliza y valida
  `DEVEXPERT_BASE_URL` y los modelos (`chat`, `chat-pro`, `image-edit`,
  `embedding` por defecto) sin devolver la clave. `provider.ts` construye el
  cliente OpenAI solo al ejecutar una operación con clave válida, fija
  `maxRetries: 0` y devuelve degradaciones tipadas para errores de configuración,
  autenticación, cupo, red y proveedor; no hace llamadas durante el build.
- **Testing**: Vitest + Testing Library + jsdom. El gate de verificación es lint + typecheck + test + build, ejecutable desde `./init.sh`.
- **Lint**: ESLint 9 (flat config) con `eslint-config-next`.

## Constraints

Ver `CONSTRAINTS.md` para reglas MUST/MUST NOT durables.
