import Image from "next/image";

import type { CatalogProduct } from "../../lib/server/catalog";

import styles from "./catalog.module.css";

const euroFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

export function formatCatalogPrice(priceCents: number): string {
  return euroFormatter.format(priceCents / 100);
}

type CatalogGridProps = Readonly<{
  products: readonly CatalogProduct[];
}>;

export default function CatalogGrid({ products }: CatalogGridProps) {
  if (products.length === 0) {
    return (
      <p className={styles.empty} role="status">
        No hay productos disponibles ahora mismo.
      </p>
    );
  }

  return (
    <ul className={styles.grid} aria-label="Productos del catálogo">
      {products.map((product) => (
        <li className={styles.gridItem} key={product.id}>
          <article className={styles.card}>
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
          </article>
        </li>
      ))}
    </ul>
  );
}
