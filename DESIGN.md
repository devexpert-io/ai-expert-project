---
name: Tienda de ropa (e-commerce)
description: Dirección visual inicial para una tienda de ropa responsive con catálogo, detalle, carrito y funciones de IA.
designAssets:
  sourceOfTruth: []
  generatedConcepts: []
colors:
  primary: "#111827"
  secondary: "#4B5563"
  accent: "#D97706"
  background: "#FFFFFF"
  surface: "#F3F4F6"
  text: "#111827"
  textMuted: "#6B7280"
  success: "#16A34A"
  danger: "#DC2626"
typography:
  h1:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, sans-serif
    fontSize: 28px
    fontWeight: 700
  h2:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, sans-serif
    fontSize: 20px
    fontWeight: 600
  body:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, sans-serif
    fontSize: 16px
    fontWeight: 400
rounded:
  sm: 6px
  md: 10px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
  button-accent:
    backgroundColor: "{colors.accent}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
---

# Design Direction

## Overview

Tienda de ropa moderna y limpia. El producto protagoniza: fotografía grande, jerarquía clara y navegación sencilla. Estética minimalista y atemporal, con un color de acento cálido para acciones y destacados de IA. Esta es dirección inicial; no hay assets de marca previos.

## Existing Design Assets

No hay. Se parte de cero con esta dirección.

## Generated Concept Images

No se han generado conceptos aún. Opcional: generar 1-3 conceptos (listado, detalle, try-on) con `imagegen` y marcarlos como inspiración antes de lockear la UI.

## Product Feel

- Limpio, airy, confiable. Mucho espacio en blanco y superficies suaves.
- La ropa es la estrella: imágenes grandes y nítidas.
- Tono tranquilo con toques cálidos (amarillo/gold) para CTA y elementos de IA.
- Sensación de comercio online moderno (referencia de referencia: concepto tipo vogue/modern minimal).

## Colors

- **Primary** negro azulado (`#111827`): texto y acciones principales (botones principales).
- **Secondary** gris (`#4B5563`) / **Text muted** (`#6B7280`): textos secundarios.
- **Accent** `#D97706` (ámbar): destacados, ofertas, y elementos vinculados a IA.
- **Surfaces**: fondo blanco, superficies gris claro `#F3F4F6` (tarjetas, inputs).
- **Éxito/Error**: verde `#16A34A` / rojo `#DC2626` para stock y estados de pedido.

## Typography

- Familia: Inter (sistema). Títulos con pesos 600-700, cuerpo 400 a 16px.
- Jerarquía clara: `h1` para página, `h2` para secciones, cuerpo para contenido.

## Layout

- Sistema de grid de 12 columnas; margen generoso (`spacing.lg` = 24px).
- Header fijo con logo, navegación, acceso/cuenta, carrito y chatbot.
- Catálogo: sidebar o barra de filtros + grid de tarjetas de producto responsive (2-4 columnas).
- Detalle: dos columnas (galería de imagen + info/compra).
- Checkout: flujo centrado en una tarjeta; pasos claros.

## Shapes

- Radios pequeños-medios (`6px`/`10px`). Tarjetas de producto ligeramente redondeadas.
- Sin exceso de sombras; bordes sutilmente definidos (`surface` + `border`).

## Components

- **Button primary**: fondo negro, texto blanco.
- **Button accent**: fondo ámbar para CTAs de IA y destacados.
- **Card producto**: imagen + nombre + categoría + precio + tallas disponibles.
- **Badge**: stock (verde/rojo), "IA", "Novedad".
- **Chip filtro**: píldoras seleccionables para talla/color.
- **Chatbot widget**: panel flotante accesible desde el header/botón.
- **Try-on**: caja de subida de foto en la página de detalle con preview y resultado.

## Core Screens

1. **Listado/Catálogo**: filtros + ordenación + grid.
2. **Detalle de producto**: galería, selector talla/color, stock, try-on, añadir al carrito.
3. **Carrito**: línea de ítems con cantidades.
4. **Checkout**: revisión, datos, pago simulado.
5. **Pedidos (mis pedidos)**: listado y detalle por usuario.
6. **Chatbot IA**: ventana de conversación.
7. **Try-on**: subida, procesando, resultado.

## Responsive Baseline

- Móvil: header compacto, filtros desplegables, grid de 1-2 columnas, detalle apilado.
- Tableta: 2-3 columnas.
- Escritorio: 3-4 columnas y sidebar de filtros.
- Touch targets ≥ 44px; botones alcanzables con el pulgar.

## Accessibility Baseline

- Contraste suficiente de texto sobre superficies (AA).
- Controles con `label` y focus visible.
- Imágenes de producto con `alt` descriptivo.
- Estados de carga/error accesibles (aria-live en IA y try-on).
- Semántica HTML correcta (nav, main, headings).

## Do's and Don'ts

- **Do**: imagen protagonista, espacios amplios, CTA claros, jerarquía tipográfica, estados vacíos/carga/error amigables.
- **Don't**: sobrecargar con colores, contrastes bajos, botones ambiguos, ignorar estados de stock/error.

## Open Design Questions

- ¿Paleta exacta de marca (negro vs tonos más cálidos/vivos)?
- ¿Generar conceptos con `imagegen` como inspiración antes de fijar la UI?
- ¿Iconografía propia o librería (p. ej. lucide/phosphor)?
- Comportamiento del try-on en móvil (gaveta vs sección).
