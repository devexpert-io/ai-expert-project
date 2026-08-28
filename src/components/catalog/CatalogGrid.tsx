import Image from "next/image";
import Link from "next/link";

import { formatPrice } from "../../lib/format-price";
import type { CatalogProduct } from "../../lib/server/catalog";

import styles from "./catalog.module.css";

const colorSwatches: Readonly<Record<string, string>> = {
  Arena: "#cbb99d",
  Azul: "#65778a",
  Beige: "#d7c6aa",
  Blanco: "#f0ede5",
  Gris: "#8b8a85",
  Kaki: "#737259",
  Marino: "#27323c",
  Negro: "#1d1b18",
  Rojo: "#99493d",
  Verde: "#5d6b52",
};

export function formatCatalogPrice(priceCents: number): string {
  return formatPrice(priceCents);
}

type CatalogGridProps = Readonly<{
  products: readonly CatalogProduct[];
  emptyMessage?: string;
}>;

export default function CatalogGrid({
  products,
  emptyMessage = "No hay productos disponibles ahora mismo.",
}: CatalogGridProps) {
  if (products.length === 0) {
    return (
      <p className={styles.empty} role="status">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul
      className={styles.grid}
      aria-label="Productos del catálogo"
      id="catalog-results"
    >
      {products.map((product, index) => (
        <li className={styles.gridItem} key={product.id}>
          <article className={styles.card}>
            <Link
              aria-label={`Ver ${product.name}`}
              className={styles.cardLink}
              href={`/products/${product.slug}`}
            >
              <div className={styles.imageFrame}>
                <Image
                  alt={`Imagen de ${product.name}`}
                  className={styles.image}
                  fill
                  sizes="(max-width: 639px) 100vw, (max-width: 899px) 50vw, (max-width: 1199px) 33vw, 25vw"
                  src={product.imageUrl}
                />
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardMeta}>
                  <p className={styles.category}>{product.categoryName}</p>
                  <span className={styles.productIndex} aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className={styles.cardTitleRow}>
                  <h2 className={styles.name}>{product.name}</h2>
                  <p className={styles.price}>
                    {formatCatalogPrice(product.basePriceCents)}
                  </p>
                </div>
                <div className={styles.variantMeta}>
                  <span
                    aria-label={`Colores: ${product.colors.join(", ")}`}
                    className={styles.swatchList}
                    role="img"
                  >
                    {product.colors.slice(0, 4).map((color) => (
                      <span
                        className={styles.swatch}
                        key={color}
                        style={{ backgroundColor: colorSwatches[color] ?? "#a39d93" }}
                      />
                    ))}
                  </span>
                  <span className={styles.sizeList}>
                    {product.sizes.join("  ")}
                  </span>
                </div>
              </div>
            </Link>
          </article>
        </li>
      ))}
    </ul>
  );
}
