# Build Brief

## Problem

Una tienda de ropa necesita vender su catálogo online. No existe aún ningún canal de venta ni gestión de pedidos. Además se quiere diferenciar con IA útil: responder dudas del cliente y permitir probarse la ropa virtualmente.

## Current Workaround / Existing System

No hay sistema previo. Es un producto nuevo (greenfield). No hay pasarela de pago ni catálogo digital actual; los datos de producto son seed data de ejemplo.

## Target Users

- **Comprador final (principal)**: cliente que navega, filtra, ve productos, usa el carrito y compra. Puede ser `Invitado` o `Usuario`.
- **Invitado**: usa catálogo, carrito, detalle y chatbot sin cuenta.
- **Usuario**: se crea en el checkout y pasa a tener pedidos asociados.

## Goals

- Mostrar el catálogo con listado, filtrado y ordenación.
- Ver el detalle de cada producto (variantes, tallas/colores, stock, precio, imagen).
- Gestionar un carrito de compras persistente, utilizable sin registro.
- Completar un flujo de compra (checkout) con pasarela de pago simulada.
- Crear la cuenta del usuario solo en el momento de pagar.
- Listar los pedidos del usuario registrado.
- Ofrecer un chatbot que responda dudas de tienda/catálogo y recomiende productos.
- Ofrecer una prueba virtual (try-on) en el detalle: subir foto y ver la prenda puesta, con modelo de imagen vía API externa.
- Todo ejecutable en local con un único comando.

## Non-Goals

- Pasarela de pago real (solo simulada en el MVP).
- Panel de administración para gestionar el catálogo.
- Carrito/pedidos para invitados sin registrarse (los pedidos exigen usuario).
- Acceso del chatbot a los pedidos del usuario (fuera del MVP).
- Aplicación móvil nativa (se cubre con web responsive).
- Diseño de marca final completo (solo dirección inicial de diseño).

## MVP Slice

Un flujo vertical completo y verificable:

1. Catálogo con categorías y variantes; listado con filtros (categoría, talla, color, precio) y ordenación.
2. Detalle de producto con selector de talla/color y stock.
3. Carrito persistente con ajuste de cantidades.
4. Checkout: revisión, datos de contacto/envío, creación de usuario y pago simulado (éxito/fallo).
5. Listado de pedidos para usuarios registrados.
6. Chatbot de dudas de catálogo + recomendación.
7. Try-on: subir foto y generar la prenda puesta, proveedor de IA configurable.

## Validation Plan

- Ejecutar la app en local con un comando y recorrer el flujo completo de compra (catálogo → detalle → carrito → checkout → pedidos) como invitado y como usuario.
- Verificar que un invitado no llega a pedidos sin registrarse.
- Probar el chatbot con dudas reales del catálogo.
- Probar el try-on subiendo una foto de ejemplo.

## Success Criteria

- Un usuario puede comprar de extremo a extremo en local en < 5 minutos sin configuración externa.
- Catálogo, filtros, detalle, carrito y checkout funcionan sin errores.
- El pago simulado produce un pedido con estado correcto y visible en "mis pedidos".
- El chatbot responde con datos coherentes del catálogo y recomienda productos válidos.
- El try-on devuelve una imagen de la prenda puesta sobre la foto aportada.

## Notes

- Lenguaje de documentos: español.
- Idioma de la interfaz: por confirmar (asumimos español; no es restrictivo para el MVP).
- Formación AI Expert: la IA se sirve desde **DevExpert Inference** (`https://inference.devexpert.io/v1`), gateway compatible con OpenAI. Cada estudiante usa su propia `DEVEXPERT_API_KEY` de `.env`; chatbot con modelo `chat`/`chat-pro` y try-on con edición de imagen (`image-edit`). El proveedor debe ser configurable.
