# Context

## Glossary

### Tienda
Web app responsive de e-commerce de ropa. Es el producto completo: catálogo, carrito, checkout, pedidos, y funcionalidades de IA.

### Producto
Artículo de ropa del catálogo (p. ej. "Camiseta básica"). Un producto se materializa en varias variantes. Es el ítem de nivel de visualización y detalle.

### Variante
Combinación concreta de talla y color de un producto, con su propio stock y referencia. Es el ítem unitario que se añade al carrito y se compra.

### Categoría
Agrupación de productos usada para filtrar y navegar el catálogo (p. ej. camisetas, pantalones, abrigos).

### Catálogo
Conjunto visible de productos, con filtrado (categoría, talla, color, precio) y ordenación (precio, novedad, nombre).

### Carrito
Lista de variantes que el usuario va a comprar, con cantidades. Persistente y utilizable sin estar registrado.

### Checkout
Flujo de compra: revisar carrito, datos de contacto/envío, registrar acceso y simular el pago.

### Pasarela de pago simulada
Sustituto del pago real: simula éxito/fallo sin procesar dinero. No hay pasarela real en el MVP.

### Usuario
Cuenta creada necesariamente antes de completar la compra. Tras el registro, los pedidos quedan vinculados a ella.

### Invitado (Guest)
Usuario sin cuenta que navega, filtra, ve detalles, usa el carrito y el chatbot. No puede tener pedidos ni listar pedidos.

### Pedido
Registro de una compra completada, vinculado a un usuario, con sus líneas (variantes + cantidades) y estado.

### Chatbot IA
Asistente conversacional que responde dudas sobre la tienda y el catálogo y recomienda productos.

### Prueba virtual (Try-on)
Funcionalidad de la página de detalle: el usuario sube una foto y ve la prenda puesta sobre ella mediante generación de imagen IA.

### Seed data
Datos de ejemplo del catálogo (productos, variantes, categorías) cargados al iniciar. Sin panel de administración en el MVP.

## Rejected / Ambiguous Terms

### "Registro"
Uso preferido: `Usuario` creado en el momento del `Checkout`. Evita "registro" como paso independiente al inicio, porque el acceso anónimo es la norma antes de pagar.

### "Pago real"
Uso preferido: `Pasarela de pago simulada`. No hay integración con proveedores de pago en el MVP.

### "AI / Inteligencia Artificial"
Uso preferido: términos específicos `Chatbot IA` y `Prueba virtual (Try-on)`. Razón: "IA" es vago; cada funcionalidad tiene requisitos y proveedores distintos.
