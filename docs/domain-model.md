# Domain Model

## Core Concepts

- **Producto**: artículo de ropa. Tiene nombre, descripción, categoría, imagen/es y precio base. 1..n variantes.
- **Variante**: combina talla y color únicos; tiene su propia referencia, stock y precio (puede heredar el del producto). Es la unidad comprable.
- **Categoría**: etiqueta de agrupación (camisetas, pantalones, abrigos, ...). Un producto pertenece a una categoría.
- **Carrito**: colección de ítems (variante + cantidad). Existente para invitados y usuarios; no requiere cuenta.
- **Usuario**: cuenta creada en el checkout. Tiene datos de contacto/envío y credenciales.
- **Pedido**: compra completada. Pertenenece a un usuario. Contiene líneas (variante + cantidad) y un estado.
- **Pago simulado**: acto de compra sobre la pasarela simulada; devuelve éxito o fallo y determina el estado del pedido.
- **Chat**: conversación del chatbot con el usuario (puede ser anónima o ligada al usuario).
- **Imagen try-on**: resultado (o trabajo encolado) de generar la prenda sobre la foto del usuario.

## Relationships

```
Categoría 1 ──< Producto >── 1..n Variante (talla+color, stock)
Producto 1 ──< Variante
Variante 1 ──< ItemCarrito >── Carrito
Variante 1 ──< LineaPedido >── Pedido >── 1 Usuario
Usuario 1 ──< Pedido
Producto 1 ──< (dato de contexto) Chatbot
Usuario o Invitado 1 ──< Chat
Foto usuario + Producto/Variante ──> Imagen try-on
```

## States and Lifecycles

- **Variante**: `Disponible` (stock > 0) / `Agotada` (stock = 0).
- **Carrito**: estado volátil persistente; sus ítems consultan stock vigente al llegar al checkout.
- **Pago**: `Pendiente` → (`Aprobado` | `Rechazado`).
- **Pedido**: `Pendiente pago` → (`Pagado` | `Cancelado`). Por confirmar si hay más estados (enviado/entregado) fuera del MVP.
- **Try-on**: `Solicitado` → (`Generado` | `Error`).

## Important Scenarios

1. **Compra completa**: invitado navega → añade variante al carrito → va al checkout → introduce datos → crea usuario → pago simulado aprobado → se crea pedido `Pagado` vinculado al usuario.
2. **Pago rechazado**: el usuario sigue en el checkout; el pedido queda `Pendiente`/`Cancelado` y puede reintentar.
3. **Invitado sin cuenta**: puede llegar a la puerta del checkout, pero no se materializa pedido hasta crear usuario.
4. **Catalogo filtrado/ordenado**: selección de categoría/talla/color/precio + orden temporal; no cambia datos.
5. **Chatbot**: el usuario pregunta; el sistema responde usando contexto del catálogo y puede recomendar una variante/producto.
6. **Try-on**: el usuario sube una foto en el detalle; el sistema genera la prenda puesta sobre la foto y devuelve la imagen.

## Edge Cases

- Añadir más unidades de una variante de las que hay en stock (el checkout debe validar stock).
- Variante agotada: no se puede añadir/comprar; se muestra como agotada.
- Stock cambiado entre el carrito y el pago (validar en checkout).
- Carrito de invitado que luego crea cuenta: el carrito persiste y se asocia al nuevo usuario.
- Try-on con imagen no válida o fallo del proveedor: mostrar error controlado, no romper la página.
- Intento de crear pedido sin sesión: bloqueado/redirigido a checkout.
