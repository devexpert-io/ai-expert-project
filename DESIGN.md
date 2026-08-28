---
name: Tienda de ropa (e-commerce)
description: Dirección visual inicial para una tienda de ropa responsive con catálogo, detalle, carrito y funciones de IA.
designAssets:
  sourceOfTruth: []
  generatedConcepts:
    - "docs/design/catalog-editorial-reference.webp"
colors:
  primary: "#1D1B18"
  secondary: "#665F57"
  accent: "#9C4F35"
  background: "#F7F4ED"
  surface: "#EDE8DE"
  text: "#1D1B18"
  textMuted: "#665F57"
  success: "#3F5C3F"
  danger: "#8B2C22"
typography:
  h1:
    fontFamily: Georgia, Times New Roman, serif
    fontSize: clamp(48px, 8vw, 136px)
    fontWeight: 400
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

Tienda editorial cálida y contemporánea. El producto protagoniza mediante fotografía grande, jerarquía tipográfica expresiva y controles sobrios. La interfaz combina marfil, terracota, tinta y oliva; usa serif editorial para titulares y sans-serif para datos y acciones. La función sigue siendo evidente y accesible sin parecer un panel administrativo.

## Existing Design Assets

- `docs/design/catalog-editorial-reference.webp`: concepto de catálogo generado con ImageGen; referencia de composición, tono y jerarquía, no captura contractual pixel-perfect.
- `public/storefront-hero.webp`: fotografía panorámica derivada de la referencia para reproducir su composición sin incrustar texto ni controles en la imagen.
- `public/products/*.webp`: seis fotografías editoriales de producto generadas con ImageGen, una por producto sembrado.

## Generated Concept Images

El concepto `catalog-editorial-reference.webp` fija la narrativa visual: cabecera ligera, hero dividido en terracota y fotografía, filtros compactos y grid de moda aireado. La implementación adapta esa referencia a la semántica y funcionalidad reales del repositorio.

## Product Feel

- Editorial, cálido y confiable. Mucho espacio negativo y superficies marfil.
- La ropa es la estrella: imágenes grandes y nítidas.
- Tono tranquilo con terracota para identidad y oliva para estados positivos.
- Sensación de estudio de moda europeo contemporáneo sin clichés de lujo negro.

## Colors

- **Primary** tinta (`#1D1B18`): texto y acciones principales.
- **Secondary** gris cálido (`#665F57`): textos secundarios.
- **Accent** terracota (`#9C4F35`): hero e identidad editorial.
- **Surfaces**: fondo marfil `#F7F4ED` y superficie arena `#EDE8DE`.
- **Éxito/Error**: oliva `#3F5C3F` / rojo óxido `#8B2C22`.

## Typography

- Familias: Georgia/Times para titulares editoriales e Inter/sistema para UI y cuerpo.
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
