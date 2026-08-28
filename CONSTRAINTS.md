# Constraints

Reglas durables que las features futuras deben respetar.

## MUST

- **Usar Node 22 (la versión exacta de `.nvmrc`) y pnpm 10.18.3** para Prisma 6. Razón: Node 26 queda fuera del soporte de Prisma 6 y pnpm 11 ignora la política de builds definida por este proyecto.
- **Usar `pnpm`** como gestor de paquetes y commitear `pnpm-lock.yaml`. Razón: reproducibilidad del arranque (`./init.sh` usa `--frozen-lockfile` cuando el lockfile existe).
- **Ejecutar en local con un único comando** (`pnpm dev`) sin servicios externos obligatorios. Razón: criterio de éxito del producto.
- **Persistencia SQLite local** (archivo) vía Prisma; sin base de datos remota ni servicio de persistencia externo en el MVP. Razón: cero configuración externa.
- **`./init.sh` no debe arrancar dev servers** ni procesos de larga vida; solo ejecuta la preparación/verificación local (install + `db:setup` + `db:verify` + lint + typecheck + test + build) de forma no bloqueante. Razón: dejar el repo limpio para la siguiente sesión.
- **Mantener el gate de calidad** (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`) ejecutándose desde `./init.sh`. Razón: verificación reproducible de la base.
- **Aplicar cambios de esquema mediante migraciones Prisma** (`prisma migrate deploy` desde `pnpm db:setup`); no usar `db push` como ruta de arranque. Razón: conservar una historia reproducible y revisable.
- **Guardar dinero como enteros en céntimos**, nunca como `Float`. Razón: evitar errores de redondeo en catálogo, carrito y pedidos.
- **Mantener el seed idempotente y no destructivo**: solo actualiza el fixture de categorías, productos y variantes por sus claves estables; no borrar ni modificar usuarios, carritos, pedidos, chats o imágenes. Razón: permitir repetir el arranque sin perder trabajo local.

## MUST NOT

- **No commitear claves/secrets** (p. ej. `DEVEXPERT_API_KEY`) ni el archivo `.env`. Las claves van en `.env` (ignorado) y se documentan en `.env.example` (commiteado). Razón: seguridad y formación AI Expert (clave personal).
- **No crear cuentas demo ni datos reales en el seed**; los usuarios, carritos, pedidos, chats e imágenes se crean en sus features y flujos propios. Razón: evitar que credenciales o pedidos de ejemplo aparezcan en producción.
- **No truncar la base ni ejecutar `prisma migrate reset` durante el arranque**. Razón: preservar datos locales y permitir que el setup sea seguro de repetir.
- **No añadir despliegue cloud ni CI remoto** en el MVP; solo scripts locales. Razón: non-goal del slice.
