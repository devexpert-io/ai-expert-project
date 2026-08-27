# Constraints

Reglas durables que las features futuras deben respetar.

## MUST

- **Usar `pnpm`** como gestor de paquetes y commitear `pnpm-lock.yaml`. Razón: reproducibilidad del arranque (`./init.sh` usa `--frozen-lockfile` cuando el lockfile existe).
- **Ejecutar en local con un único comando** (`pnpm dev`) sin servicios externos obligatorios. Razón: criterio de éxito del producto.
- **Persistencia SQLite local** (archivo) vía Prisma; sin base de datos remota ni servicio de persistencia externo en el MVP. Razón: cero configuración externa.
- **`./init.sh` no debe arrancar dev servers** ni procesos de larga vida; solo ejecuta el gate de verificación (install + lint + typecheck + test + build) de forma no bloqueante. Razón: dejar el repo limpio para la siguiente sesión.
- **Mantener el gate de calidad** (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`) ejecutándose desde `./init.sh`. Razón: verificación reproducible de la base.

## MUST NOT

- **No commitear claves/secrets** (p. ej. `DEVEXPERT_API_KEY`) ni el archivo `.env`. Las claves van en `.env` (ignorado) y se documentan en `.env.example` (commiteado). Razón: seguridad y formación AI Expert (clave personal).
- **No definir el modelo de dominio, migraciones ni seed en esta fase**; eso corresponde a `bootstrap-seed`. Razón: mantener el alcance por feature.
- **No añadir despliegue cloud ni CI remoto** en el MVP; solo scripts locales. Razón: non-goal del slice.
