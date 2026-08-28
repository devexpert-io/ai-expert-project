# Feature Implementation Spec: Modelo de datos y seed del catálogo

## Source Feature

- `id`: `bootstrap-seed`
- `area`: `bootstrap`
- `depends_on`: `bootstrap-stack` (satisfecha; estado `accepted`)
- `status`: `not_started` (estado al planificar)
- `source`: `feature_list.json`

## Goal

Definir en Prisma el modelo persistente mínimo de la tienda, generar una
migración SQLite reproducible y cargar un catálogo de ejemplo suficiente para
listar, filtrar, añadir al carrito y comprar variantes en features posteriores.
Al preparar o arrancar la app local, la base debe quedar migrada y poblada sin
servicios externos ni datos reales.

El setup debe ser repetible: el seed no duplica categorías, productos o
variantes y no borra usuarios, carritos, pedidos, chats o imágenes existentes.

## Non-Goals

- No crear UI, endpoints de catálogo/carrito/checkout ni funciones de IA.
- No implementar autenticación, sesiones, inventario concurrente o pagos; solo
  dejar las tablas y relaciones preparadas para esas features.
- No crear administración, importar catálogo real, almacenar imágenes binarias,
  añadir base remota o desplegar.
- No truncar la base ni ejecutar `prisma migrate reset` durante el arranque.
- No marcar `bootstrap-seed` como `accepted`; eso corresponde al validador con
  evidencia reproducible.

## Job Story

Cuando clono el repositorio y necesito empezar a desarrollar la tienda, quiero
que el arranque local aplique el esquema y cargue un catálogo de ejemplo, para
probar las siguientes features con datos relacionales sin preparar filas a mano.

## Users And Permissions

- **Desarrollador/agente local**: puede ejecutar `pnpm db:setup`, `pnpm db:verify`,
  `./init.sh`, `pnpm dev` o `pnpm start`; el setup solo actualiza filas de su
  fixture.
- **Invitado/usuario registrado**: no participa aún; el seed no crea cuentas,
  credenciales, carritos, pedidos, chats ni try-ons.
- Las features posteriores deben conservar que `Order` pertenece a `User`; no
  introducir una cuenta demo que pueda aparecer en producción.

## Acceptance Scenarios

### Scenario 1: Migración de las tablas del dominio

Given un SQLite nuevo y `DATABASE_URL` local configurado
When se ejecuta `pnpm db:setup` (o `prisma migrate deploy` tras generar el cliente)
Then la migración crea `User`, `Product`, `Variant`, `Category`, `Cart`,
`CartItem`, `Order`, `OrderLine`, `Chat` y `TryonImage`, además de la tabla
interna de Prisma; no se sustituye por `db push`.

### Scenario 2: Catálogo de ejemplo navegable

Given la migración aplicada en una base vacía
When termina el seed
Then hay al menos 4 categorías, 6 productos y 18 variantes; cada producto
pertenece a una categoría y cada variante tiene talla, color, SKU único,
`priceCents` positivo y `stock` no negativo.

El fixture cubre `camisetas`, `pantalones`, `abrigos` y `sudaderas`, tallas
`S`/`M`/`L`/`XL`, varios colores y un rango de precios, con al menos una variante
agotada (`stock = 0`) y otra disponible. Los slugs/SKU son estables (se
recomiendan `camiseta-basica`, `pantalon-recto` y `abrigo-ligero`); las
`imageUrl` son placeholders deterministas que no requieren descargar assets.

### Scenario 3: Seed idempotente

Given una base migrada y poblada
When se ejecuta `pnpm db:seed` dos veces
Then los conteos y SKU permanecen estables, no se duplican relaciones y una fila
de usuario/carrito/pedido creada entre ejecuciones no se borra ni modifica.

### Scenario 4: Preparación automática al arrancar

Given un checkout sin `.env` ni SQLite, pero con `.env.example`
When se ejecuta `pnpm dev` o `pnpm start`
Then el hook crea `.env` solo si falta, sin sobrescribirlo, ejecuta `prisma
generate`, aplica migraciones pendientes y hace seed antes de Next.js. No exige
`DEVEXPERT_API_KEY` ni servicios externos.

### Scenario 5: Verificación reproducible

Given que `pnpm db:setup` terminó
When se ejecuta `pnpm db:verify`
Then un script de solo lectura comprueba tablas, mínimos, slugs de referencia,
relaciones, precio/stock y estados disponible/agotado, y sale 0; cualquier
incumplimiento produce mensaje claro y código distinto de 0.

## Repository Research

### Files Inspected

- `AGENTS.md`, `PROGRESS.md`, `feature_list.json` — workflow, gate estándar,
  `bootstrap-stack` aceptada y contrato de las diez tablas/seed.
- `CONTEXT.md`, `docs/build-brief.md`, `docs/domain-model.md` — conceptos,
  invitados, checkout, relaciones y estados; `technical-discovery.md` y
  `risks-and-open-questions.md` — Prisma 6/SQLite, `DATABASE_URL` y riesgos.
- `ARCHITECTURE.md`, `CONSTRAINTS.md`, `docs/specs/bootstrap-stack.md` — capas,
  restricciones y formato/alcance de specs.
- `prisma/schema.prisma` — solo generator/datasource; no hay modelos ni
  `prisma/migrations/`. `package.json`, `init.sh`, `vitest.config.ts` y
  `src/app/*` — app mínima sin scripts/helper/test de base de datos.
- `.env.example`, `.gitignore` — documentan `DATABASE_URL` y excluyen `.env`,
  `*.db` y diarios; `.env` no existe en este checkout.

### Existing Patterns To Follow

- Usar Prisma 6.19.x, `prisma/schema.prisma` y `DATABASE_URL="file:./dev.db"`
  (la ruta relativa queda bajo `prisma/`).
- Usar `pnpm` y conservar el lockfile; el gate es `lint`, `typecheck`, `test` y
  `build` desde `./init.sh`.
- Mantener el arranque local sin servicios externos y sin procesos largos en
  `init.sh`; `predev`/`prestart` pueden preparar la base antes de Next.js.

### Current Gaps

- Faltan diez modelos, migración, cliente generado, seed idempotente y script de
  verificación.
- Falta resolver `.env` ausente e integrar setup en `dev`/`start`.
- No existe runner E2E; la verificación debe ser un script de integración SQLite.

## Technical Approach

### Modelo Prisma

No usar `@@map`, para que las tablas tengan los nombres requeridos. Usar IDs
`String @id @default(cuid())`, fechas `createdAt @default(now())` y
`updatedAt @updatedAt`. Guardar dinero como enteros en céntimos (`priceCents`,
`basePriceCents`, `unitPriceCents`), nunca `Float`.

| Modelo | Campos/relaciones mínimos | Constraints |
| --- | --- | --- |
| `User` | `id`, `email`, `passwordHash`, `name?`, `phone?`, `shippingAddress?`, fechas; `Cart?`, `Order[]`, `Chat[]`, `TryonImage[]` | `email @unique`; sin seed |
| `Category` | `id`, `slug`, `name`, `description?`, fechas; `Product[]` | `slug @unique` |
| `Product` | `id`, `slug`, `name`, `description`, `imageUrl`, `basePriceCents`, `categoryId`, fechas; `Category`, `Variant[]`, `TryonImage[]` | `slug @unique`, índice `categoryId`, base > 0 |
| `Variant` | `id`, `sku`, `productId`, `size`, `color`, `stock`, `priceCents`, fechas; `Product`, `CartItem[]`, `OrderLine[]`, `TryonImage[]` | `sku @unique`, `@@unique([productId,size,color])`, índices de filtro |
| `Cart` | `id`, `guestToken?`, `userId?`, fechas; `User?`, `CartItem[]` | `guestToken @unique`, `userId @unique`; propietario invitado o usuario en lógica |
| `CartItem` | `id`, `cartId`, `variantId`, `quantity`, fechas; `Cart`, `Variant` | `@@unique([cartId,variantId])`; quantity >= 1 en dominio |
| `Order` | `id`, `userId`, `status`, `totalCents`, fechas; `User`, `OrderLine[]` | estado inicial `PENDING_PAYMENT` |
| `OrderLine` | `id`, `orderId`, `variantId`, `productName`, `size`, `color`, `quantity`, `unitPriceCents`; `Order`, `Variant` | snapshots; quantity >= 1 |
| `Chat` | `id`, `sessionKey`, `userId?`, `messagesJson`, fechas; `User?` | `sessionKey @unique`, `messagesJson` inicial `[]` |
| `TryonImage` | `id`, `userId?`, `productId?`, `variantId?`, `inputImageUrl?`, `resultImageUrl?`, `status`, `errorMessage?`, fechas | referencias temporales, no binarios |

Los estados son `String` validados por constantes (SQLite sencillo): `Order`
admite `PENDING_PAYMENT`, `PAID`, `CANCELLED`; `TryonImage` admite `REQUESTED`,
`GENERATED`, `ERROR`. Impedir borrar variantes referenciadas desde carrito o
pedido; las relaciones opcionales de historial pueden usar `SetNull`. Las
cantidades/precios/stock se validan en dominio, sin restricciones prematuras.

### Migración, seed y arranque

1. Formatear el schema y crear `prisma/migrations/<timestamp>_bootstrap_seed`
   con `prisma migrate dev --name bootstrap_seed`; commitear el SQL.
2. Añadir `prisma/seed.ts`, `prisma.seed` en `package.json` y `tsx`. Sembrar en
   transacción con upsert por `Category.slug`, `Product.slug` y `Variant.sku`,
   desconectando el cliente en `finally`.
3. Añadir `scripts/db-setup.mjs`: copiar `.env.example` a `.env` solo si falta,
   luego ejecutar `prisma generate`, `prisma migrate deploy` y `prisma db seed`.
   Propagar errores; nunca resetear ni borrar filas fuera del fixture.
4. Añadir `scripts/verify-seed.mjs` (o `.ts` con `tsx`) y scripts `db:setup` y
   `db:verify`; `predev`/`prestart` llaman a setup e `init.sh` llama setup +
   verify antes del gate existente, sin iniciar `pnpm dev`.

El seed solo escribe categorías/productos/variantes y actualiza sus campos del
fixture al repetirlo. El verificador consulta `sqlite_master` para las tablas y
Prisma para conteos, relaciones, precio, stock y SKU.

## Expected File Changes

- `prisma/schema.prisma` — modificar con los diez modelos, relaciones, índices,
  unicidades y estados indicados; `prisma/migrations/<timestamp>_bootstrap_seed/migration.sql`
  — crear y commitear desde `prisma migrate dev`.
- `prisma/seed.ts` — crear fixture español, sin datos reales, transaccional e
  idempotente; `scripts/db-setup.mjs` y `scripts/verify-seed.mjs` — crear setup
  seguro y verificación de solo lectura.
- `package.json` y `pnpm-lock.yaml` — añadir scripts/hooks, `prisma.seed` y
  `tsx` si se usan scripts TypeScript; `init.sh` — añadir setup + verify sin
  servidores persistentes.
- `ARCHITECTURE.md`, `CONSTRAINTS.md`, `docs/technical-discovery.md` — actualizar
  decisiones durables; `PROGRESS.md`/`feature_list.json` — registrar evidencia
  tras verificar, sin cambiar a `accepted` desde implementación.

## Visual Design Impact

- UI involucrada: no; no hay pantallas ni estados visuales nuevos.
- Design source: `DESIGN.md`, no aplicable a persistencia/fixture.
- Screens/states: ninguno. New design artifact: no; las imágenes son
  placeholders técnicos, no assets de marca.

## Durable Documentation Impact

- `ARCHITECTURE.md`: actualizar con persistencia, migración inicial, `db:setup` y
  céntimos; `CONSTRAINTS.md`: retirar la prohibición temporal de esta fase y
  conservar SQLite local, migraciones, seed no destructivo y cero secretos.
- `AGENTS.md`: actualizar solo si `init.sh` incorpora setup/verify, documentando
  que siguen sin procesos largos; `docs/technical-discovery.md`: actualizar
  fixture mínimo, setup y generación.
- `docs/domain-model.md`: no necesario mientras se conserven semántica/estados;
  `docs/risks-and-open-questions.md`: cerrar cantidad de variantes y ausencia
  de datos reales. No duplicar el schema.

## Implementation Plan

1. Definir/formatear schema y crear la migración desde SQLite limpio.
2. Implementar fixture y seed idempotente; añadir setup/verify y fallback seguro
   de `.env`.
3. Integrar setup en `predev`/`prestart` e `init.sh`; ejecutar dos ciclos y
   comprobar que no hay duplicados ni borrados.
4. Ejecutar gate completo, registrar evidencia y dejar la feature para validación
   independiente.

## Implementation Tasks

- [ ] Añadir los diez modelos Prisma con relaciones y unicidades.
- [ ] Formatear schema, generar migración `bootstrap_seed` y revisar sus tablas.
- [ ] Añadir al menos 4 categorías, 6 productos y 18 variantes, con stock
  agotado/disponible y variedad de precio/talla/color.
- [ ] Hacer el seed idempotente por slug/SKU y no destructivo para compra/usuario.
- [ ] Añadir setup/verify, scripts npm y hooks de arranque.
- [ ] Actualizar `init.sh`, documentación y evidencia sin marcar `accepted`.
- [ ] Ejecutar dos ciclos, gate completo y revisión Git sin `.env`/SQLite.

## Verification Plan

- `pnpm install --frozen-lockfile` — dependencias y lockfile coherentes.
- `pnpm exec prisma validate` y `pnpm exec prisma format --check` — schema válido.
- En SQLite limpio, `pnpm db:setup` — genera cliente, migra y siembra con exit 0.
- `pnpm db:verify` — tablas, mínimos, relaciones, estados y SKU en verde.
- Repetir `pnpm db:setup && pnpm db:verify` — mismos conteos, sin duplicados y
  preservando una fila fuera del fixture.
- `./init.sh` — setup + verify + lint/typecheck/test/build, exit 0 y sin procesos.
- `pnpm dev`/`pnpm start` — hook prepara DB antes de Next y no exige API key.
- `pnpm test` — gate existente en verde. No hay `pnpm test:e2e`; no se añade
  ruta/UI, por lo que el script de integración SQLite es suficiente.

## Evidence To Capture

- Salida de `prisma validate`, `migrate deploy`, `db:setup` y `db:verify`.
- Lista de tablas y conteos finales de categorías/productos/variantes.
- Segunda ejecución con conteos idénticos y prueba de no borrar una fila ajena.
- Resultados de `./init.sh`, lint, typecheck, test y build; ningún servidor activo.
- Git demuestra que `.env`, `*.db` y diarios SQLite no se añadieron.

## Validator Checklist

- [ ] La migración crea las diez tablas requeridas.
- [ ] Schema Prisma/SQLite usa céntimos, unicidades y relaciones para catálogo,
  carrito y compra.
- [ ] Seed reproducible, idempotente, no destructivo y sin usuarios/pedidos demo.
- [ ] Fixture suficiente para categorías, filtros, stock agotado/disponible y
  una compra de variante con stock.
- [ ] `pnpm dev`/`pnpm start` preparan DB aun sin `.env`, sin sobrescribirlo.
- [ ] `db:verify`/`./init.sh` pasan; no quedan procesos ni secretos/SQLite en Git.
- [ ] Evidencia registrada en `feature_list.json`/`PROGRESS.md`, sin aceptación
  prematura.
- [ ] No se añadió UI, endpoint, auth, pago, IA ni otra feature.
