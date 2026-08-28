import Image from "next/image";
import Link from "next/link";

import { formatPrice } from "../../lib/format-price";
import type { CatalogProduct } from "../../lib/server/catalog";

import styles from "./catalog.module.css";

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
    <ul className={styles.grid} aria-label="Productos del catálogo">
      {products.map((product) => (
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
                <p className={styles.category}>{product.categoryName}</p>
                <h2 className={styles.name}>{product.name}</h2>
                <p className={styles.price}>
                  {formatCatalogPrice(product.basePriceCents)}
                </p>
              </div>
            </Link>
          </article>
        </li>
      ))}
    </ul>
  );
}
