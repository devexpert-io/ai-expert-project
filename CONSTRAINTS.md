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
- **Mantener el proveedor de IA server-only**: leer `DEVEXPERT_API_KEY`, base URL y modelos únicamente desde módulos bajo `src/lib/server/ai/`; no importar esos módulos desde componentes cliente. Razón: impedir que secretos o configuración privada lleguen al bundle del navegador.
- **Degradar el proveedor de IA de forma tipada y sin reintentos automáticos**: mapear errores de configuración, autenticación, cupo, red y proveedor a códigos/mensajes constantes y seguros. Razón: las features posteriores deben poder funcionar sin clave o servicio disponible.

## MUST NOT

- **No commitear claves/secrets** (p. ej. `DEVEXPERT_API_KEY`) ni el archivo `.env`. Las claves van en `.env` (ignorado) y se documentan en `.env.example` (commiteado). Razón: seguridad y formación AI Expert (clave personal).
- **No exponer `DEVEXPERT_API_KEY` ni cuerpos/headers de errores en `NEXT_PUBLIC_*`, logs o respuestas públicas**. Razón: preservar credenciales y datos de prompts/respuestas frente al navegador.
- **No crear cuentas demo ni datos reales en el seed**; los usuarios, carritos, pedidos, chats e imágenes se crean en sus features y flujos propios. Razón: evitar que credenciales o pedidos de ejemplo aparezcan en producción.
- **No truncar la base ni ejecutar `prisma migrate reset` durante el arranque**. Razón: preservar datos locales y permitir que el setup sea seguro de repetir.
- **No añadir despliegue cloud ni CI remoto** en el MVP; solo scripts locales. Razón: non-goal del slice.

## Conversaciones IA

- **Acotar el contrato público del chat**: 64 KiB efectivos de cuerpo, pregunta
  de 1–2000 caracteres, hasta 10 mensajes alternos de historial (pares completos),
  cada contenido/respuesta de 1–4000 caracteres. Razón: limitar recursos y contexto
  no fiable antes del proveedor; el cliente no puede elegir roles privilegiados,
  modelos ni configuración.
- **Usar únicamente contexto público de catálogo y renderizar texto escapado**.
  No registrar conversaciones ni persistirlas sin una decisión explícita posterior.
  Razón: evitar acceso a datos privados e interpretación de contenido generativo
  como HTML; la conversación actual solo vive en memoria del navegador.
- **Limitar la salida estructurada del chat a JSON acotado y candidatos por IDs**:
  validar producto/variante contra el catálogo fresco, exigir stock positivo,
  deduplicar y mostrar como máximo tres recomendaciones. El modelo nunca controla
  nombres, precios, imágenes, stock, slugs ni URLs visibles; para un producto sin
  variante debe existir alguna variante disponible. Razón: mantener la garantía de
  pertenencia y disponibilidad de las tarjetas sin convertir texto generativo en
  datos de catálogo.

## Foto de prueba virtual

- **Tratar la foto de entrada como dato personal**. Razón: viajará a
  `inference.devexpert.io` cuando se conecte la generación.
- **Mostrar el aviso de privacidad y el consentimiento antes de cualquier envío**.
  El aviso debe nombrar que es un dato personal, el destino
  `inference.devexpert.io` y que la tienda no guarda la foto. Razón: el usuario
  decide con información suficiente.
- **MUST NOT persistir la foto de entrada** en `TryonImage`, disco, cookies ni
  `localStorage` en este slice; solo memoria del navegador y object URLs
  revocadas al cambiar, limpiar o desmontar. Razón: no retener un dato personal
  más de lo necesario.
- **MUST NOT importar `src/lib/server/ai/` desde la isla de subida**. Razón:
  la foto no debe acercar secretos ni el adapter al bundle del cliente.
