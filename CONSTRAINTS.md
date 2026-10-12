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
- **Identificar el carrito de invitado únicamente con `cart_guest_token` HTTP-only, SameSite=Lax, Path=/ y caducidad de 30 días**; el token lo genera el servidor y no se acepta en el cuerpo. Razón: conservar el carrito entre recargas sin exponer identidad o estado durable al cliente.
- **Validar en servidor la variante y `stock > 0` antes de crear o incrementar un `CartItem`, dentro de una transacción Prisma; no confiar en precio, nombre o stock del navegador.** Razón: la selección del cliente es no confiable y el carrito debe mantener una única línea por variante.
- **El carrito no reserva ni descuenta stock y puede acumular una cantidad superior al stock vigente; checkout debe revalidar antes de cobrar.** Razón: añadir al carrito expresa intención y no garantiza disponibilidad futura.
- **Mantener cada `CartItem.quantity` entre 1 y `2_147_483_647` y rechazar una suma acumulada que exceda ese máximo antes de cualquier escritura.** Razón: Prisma representa `Int` como Int32 y un desbordamiento tardío produciría un 500 o una mutación parcial.
- **Leer y mutar el carrito de invitado solo mediante `cart_guest_token` existente en `/cart`, `PATCH` y `DELETE`; esas operaciones no deben crear cookie ni fila `Cart` nuevas.** Razón: revisar o corregir una identidad ausente no debe crear carritos huérfanos ni cambiar el estado durable de un visitante.
- **Construir cada snapshot y subtotal desde `Variant.priceCents` en enteros seguros, con una línea única por variante y sin confiar en precios del navegador.** Razón: el cliente solo expresa cantidad; el servidor conserva la exactitud monetaria y evita overflow en totales.
- **Leer `/checkout` únicamente con el `cart_guest_token` HTTP-only existente y construir el resumen desde `getGuestCart`/`CartView`; sin cookie o sin líneas se debe devolver un vacío sin crear identidad.** Razón: la revisión no debe crear carritos huérfanos ni aceptar precios, cantidades o tokens del navegador.
- **Limitar el borrador de checkout a exactamente `name`, `email`, `phone` y `shippingAddress`, con validación cerrada y límites antes de persistirlo en `sessionStorage["checkout_draft_v1"]`.** Razón: el siguiente slice necesita un contrato pequeño, versionado y libre de campos no previstos.
- **Guardar contraseñas únicamente como hash bcrypt con coste fijo 12; rechazar sin truncar cualquier contraseña de menos de 8 caracteres o de más de 72 bytes UTF-8.** Razón: bcrypt tiene un límite de entrada por bytes y una contraseña recortada cambiaría las credenciales que el usuario cree haber elegido.
- **Persistir sesiones opacas solo como hash SHA-256 en `Session`; enviar el token crudo exclusivamente en la cookie HTTP-only `auth_session` de 30 días.** Razón: permite revocación individual y evita tokens en JSON, HTML, URL, `localStorage` o logs.
- **Realizar registro/login, contacto, asociación o merge de carritos y creación de sesión en una transacción Prisma; comprobar overflow de merge antes de escribir.** Razón: un fallo de credenciales o cantidades no puede dejar usuario, sesión o carrito a medias.
- **Priorizar una sesión válida sobre `cart_guest_token` en páginas y APIs del carrito; al completar auth invalidar el token invitado y expirar su cookie.** Razón: evita que un bearer token antiguo o una cuenta distinta lea o modifique líneas ajenas.
- **Exigir una sesión `auth_session` válida para `POST /api/checkout/payment` y derivar `userId` únicamente con `getSessionUser`; el navegador no puede enviar `userId`, `cartId`, cantidades, precios ni totales.** Razón: los pedidos y el stock pertenecen al usuario autenticado y toda la información de cobro debe releerse en servidor.
- **Hashear y guardar cada `Idempotency-Key` en `Order.idempotencyKeyHash`, con unicidad por usuario y nulabilidad histórica; un replay debe devolver el pedido original aunque cambie el outcome o el carrito.** Razón: doble click, pérdida de respuesta y concurrencia no pueden crear pedidos o descuentos duplicados.
- **Crear snapshots de `OrderLine` y `totalCents` desde las variantes actuales en una transacción; un aprobado debe decrementar con condición `stock >= quantity` y vaciar el carrito de forma atómica, mientras un rechazo crea `CANCELLED` sin descontar stock ni líneas.** Razón: evitar precios manipulados, overselling y pérdida del carrito al reintentar.
- **Exigir una sesión `auth_session` válida para `/orders`, derivar `userId` únicamente con `getSessionUser` y consultar `Order` con `where.userId` antes de construir la lista.** Razón: el historial pertenece a la cuenta autenticada y un visitante o una sesión caducada no debe activar lecturas de pedidos.
- **Exigir la sesión antes de consultar `/orders/[id]` y resolver el detalle con `findFirst` usando simultáneamente `{ id, userId }`; un pedido ajeno y uno inexistente deben terminar en el mismo `404`.** Razón: la autorización de propietario debe ser una condición de lectura y no una comprobación posterior que revele existencia.
- **Construir `/orders/[id]` únicamente desde los cinco snapshots persistidos de `OrderLine` (`productName`, `size`, `color`, `quantity`, `unitPriceCents`), derivar cada subtotal con enteros seguros y exigir que su suma coincida con `Order.totalCents`.** Razón: el historial debe conservar el precio y descripción comprados aunque cambie el catálogo, sin aceptar datos actuales o aritmética desbordada.
- **Mantener `prisma/seed.ts` no reponedor: el `update` de una SKU existente nunca escribe `stock`; `db:verify` exige mezcla disponible/agotada solo cuando no hay pedidos y después solo exige stock no negativo y variantes presentes.** Razón: reiniciar la app no puede deshacer una venta ni hacer fallar la verificación por el stock legítimamente agotado.

## MUST NOT

- **No commitear claves/secrets** (p. ej. `DEVEXPERT_API_KEY`) ni el archivo `.env`. Las claves van en `.env` (ignorado) y se documentan en `.env.example` (commiteado). Razón: seguridad y formación AI Expert (clave personal).
- **No exponer `DEVEXPERT_API_KEY` ni cuerpos/headers de errores en `NEXT_PUBLIC_*`, logs o respuestas públicas**. Razón: preservar credenciales y datos de prompts/respuestas frente al navegador.
- **No crear cuentas demo ni datos reales en el seed**; los usuarios, carritos, pedidos, chats e imágenes se crean en sus features y flujos propios. Razón: evitar que credenciales o pedidos de ejemplo aparezcan en producción.
- **No persistir el estado del carrito de invitado en `localStorage` ni aceptar un token de carrito en el JSON público.** Razón: la identidad y la persistencia del carrito viven en SQLite detrás de la cookie HTTP-only.
- **No enviar ni persistir el borrador de checkout en SQLite, cookies, URL, logs, respuestas públicas o APIs; no usar `localStorage`.** Razón: los datos de contacto y envío son PII efímera de una sola pestaña hasta que `checkout-user` decida cómo materializarlos.
- **No crear usuarios, sesiones, pedidos, pagos ni reservar/descontar stock durante `checkout-review`.** Razón: esas mutaciones pertenecen a `checkout-user` y `checkout-payment`, y la intención del carrito se mantiene separada de la compra.
- **No exponer en el listado de pedidos líneas, variantes, cantidades, dirección, email, nombre, tokens, `userId`, `cartId`, claves de idempotencia ni IDs de pedido visibles; traducir estados con un mapa cerrado.** Razón: `/orders` solo necesita estado, total y fecha, y un valor de estado desconocido no debe convertirse en texto de datos internos.
- **No consultar catálogo/stock/usuario desde `/orders/[id]`, no mostrar IDs opacos como texto y rechazar con `404` estados desconocidos, snapshots vacíos o totales inconsistentes.** Razón: el detalle es histórico y owner-scoped; los datos inválidos no deben convertirse en información interna o en una vista parcialmente fiable.
- **No incluir contraseñas, hashes, tokens, userId ni PII en respuestas o logs de auth; una sesión válida debe devolver 409 hasta que se revoque mediante logout.** Razón: el cambio de cuenta requiere una frontera explícita y los secretos no deben cruzar al navegador.
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

- **Tratar la foto de entrada como dato personal**. Razón: viaja a
  `inference.devexpert.io` para la edición de imagen.
- **Mostrar el aviso de privacidad y el consentimiento antes de cualquier envío**.
  El aviso debe nombrar que es un dato personal, el destino
  `inference.devexpert.io` y que la tienda no guarda la foto. Razón: el usuario
  decide con información suficiente.
- **MUST revalidar el consentimiento en el servidor** (`consent=true` en
  `POST /api/tryon`) además del checkbox de la isla. Razón: el cliente no es
  una frontera de confianza.
- **MUST generar con `images.edit` vía `aiProvider`** y el modelo
  `DEVEXPERT_IMAGE_MODEL` (`image-edit` por defecto), sin
  `images/generations` y sin que el navegador elija modelo, URL o prompt.
  Razón: mantener la frontera server-only y el contrato del proveedor.
- **MUST NOT persistir la foto de entrada ni el resultado** en `TryonImage`,
  disco, `public/`, cookies ni `localStorage`; solo memoria del navegador
  (object URL de preview y data URL del resultado). Recargar descarta ambos.
  Razón: no retener un dato personal ni una imagen generada más de lo necesario.
- **MUST NOT importar `src/lib/server/ai/` desde la isla de subida**. Razón:
  la foto no debe acercar secretos ni el adapter al bundle del cliente.
- **MUST NOT fetchear una URL devuelta por el proveedor** si falta `b64_json`.
  Razón: evitar SSRF y no exponer destinos del proveedor al cliente.
