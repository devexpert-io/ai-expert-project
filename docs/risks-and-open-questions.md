# Risks and Open Questions

## Blocking Next Phase

- **Calidad/viabilidad del try-on realista**. Probarse una prenda sobre la propia foto es muy costoso técnicamente; DevExpert Inference expone la edición de imagen (`image-edit`) pero no garantiza un try-on virtual fiel. Acotar expectativas y configurar prompt/modelo antes de construir el feature. (Ver Research Tasks.)
- **Idioma de la interfaz** de la tienda. Asumimos español; confirmar para textos UI.
- **Cupo semanal compartido**: las funciones de IA comparten el límite semanal de cada clave; definir cómo manejar el agotamiento (mensaje claro) y evitar abusos de `chat-pro`/imagen.

## Implementation-Time Questions

- ¿Qué estados tiene un `Pedido` completo (enviado/entregado/devuelto) o basta con `Pagado`/`Cancelado`?
- ¿El carrito debe persistir en servidor para usuarios y solo en localStorage para invitados?
- ¿Dónde se guardan/almacenan las imágenes generadas del try-on (disco local vs URL temporal)?
- ¿El chatbot guarda historial por sesión o por usuario?
- ¿Cuántas variantes/tallas/colores por producto requiere el seed?

## Later / Not MVP

- Pasarela de pago real.
- Panel de administración del catálogo.
- Chatbot que acceda a los pedidos del usuario.
- Aplicación móvil nativa.
- Multi-idiioma y moneda.

## Assumptions

- Idioma de la interfaz: español (por confirmar).
- Los pedidos solo existen para usuarios creados en el checkout; un invitado nunca tiene pedido.
- La IA se sirve de **DevExpert Inference** (`https://inference.devexpert.io/v1`) con la `DEVEXPERT_API_KEY` de cada estudiante; sin clave o con cupo agotado, la función degrada con un mensaje claro en vez de romper.
- Seed data suficiente para demostrar catálogo, filtros y un flujo de compra.

## Risks

- **Try-on realista** (alto): resultado poco fiel o rechazo del endpoint de edición de imagen; mitigar con proveedor/modelo configurable y expectativas acotadas.
- **Cupo semanal de IA**: uso limitado por clave y por semana; peticiones rechazadas al 100%. Mitigar con modos sin clave, mensajes claros y evitando abusos.
- **Privacidad**: la foto del usuario viaja a `inference.devexpert.io`; mitigar con aviso y no persistirla innecesariamente.
- **Alcance del MVP amplio** (7 features): riesgo de sobrecarga; priorizar el slice de compra y dejar IA como incremento.
- **Dependencia de red** para IA: sin red, chatbot/try-on no funcionan; degradar con claridad.

## Research Tasks

- Investigar cómo lograr el mejor resultado de **try-on** con el endpoint de edición (`image-edit`, multipart con foto + prompt de la prenda) de DevExpert Inference, y cómo acotar expectativas realistas.
- Confirmar si conviene **RAG con embeddings** (`embedding`, `POST /embeddings`) para que el chatbot recomiende productos de forma semántica, o basta con inyectar contexto del catálogo en el prompt.
- Decidir ORM y configuración SQLite para arrancar en local con `pnpm`. **Resuelto (bootstrap-stack)**: Prisma v6 + SQLite (`DATABASE_URL="file:./dev.db"`), datasource mínimo cableado; modelos/migraciones en `bootstrap-seed`.
