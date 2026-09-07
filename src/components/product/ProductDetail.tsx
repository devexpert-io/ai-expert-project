import Image from "next/image";
import Link from "next/link";

import { formatPrice } from "../../lib/format-price";
import type {
  ProductDetail as ProductDetailViewModel,
  ProductSelection,
} from "../../lib/server/product-detail";
import { TryOnUpload } from "../tryon/TryOnUpload";

import styles from "./product-detail.module.css";

type ProductDetailProps = Readonly<{
  product: ProductDetailViewModel;
  selection: ProductSelection;
}>;

function getUniqueValues(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) =>
    left.localeCompare(right, "es", { sensitivity: "base" }),
  );
}

function getSelectionMessage(selection: ProductSelection): string {
  if (selection.hasInvalidValue) {
    return "Algún valor de la selección no es válido. Elige una talla y un color disponibles.";
  }

  if (selection.hasInvalidCombination) {
    return "Esa combinación de talla y color no existe. Elige otra variante.";
  }

  if (selection.variant) {
    return selection.variant.stock === 0
      ? "Agotada · 0 unidades"
      : `Disponible · ${selection.variant.stock} ${selection.variant.stock === 1 ? "unidad" : "unidades"}`;
  }

  if (selection.size) {
    return `Talla ${selection.size} seleccionada. Elige un color.`;
  }

  if (selection.color) {
    return `Color ${selection.color} seleccionado. Elige una talla.`;
  }

  return "Elige una talla y un color para consultar el stock exacto.";
}

export default function ProductDetail({
  product,
  selection,
}: ProductDetailProps) {
  const sizes = getUniqueValues(product.variants.map((variant) => variant.size));
  const colors = getUniqueValues(
    product.variants.map((variant) => variant.color),
  );
  const displayedPrice =
    selection.variant?.priceCents ?? product.basePriceCents;

  const getSizeState = (size: string) => {
    if (!selection.color) {
      return null;
    }

    const variant = product.variants.find(
      (candidate) =>
        candidate.size === size && candidate.color === selection.color,
    );
    return variant?.stock === 0 ? "Agotada" : null;
  };

  const getColorState = (color: string) => {
    if (!selection.size) {
      return null;
    }

    const variant = product.variants.find(
      (candidate) =>
        candidate.size === selection.size && candidate.color === color,
    );
    return variant?.stock === 0 ? "Agotada" : null;
  };

  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/">
        <span aria-hidden="true">←</span> Volver al catálogo
      </Link>
      <article className={styles.detail}>
        <div className={styles.imageFrame}>
          <Image
            alt={`Imagen de ${product.name}`}
            className={styles.image}
            fill
            priority
            sizes="(max-width: 767px) 100vw, 50vw"
            src={product.imageUrl}
          />
        </div>

        <div className={styles.information}>
          <div className={styles.metaLine}>
            <p className={styles.category}>{product.categoryName}</p>
            <p className={styles.edition}>Edición 01</p>
          </div>
          <h1 className={styles.title}>{product.name}</h1>
          <p className={styles.description}>{product.description}</p>
          <p className={styles.price}>{formatPrice(displayedPrice)}</p>
          <p className={styles.taxNote}>Impuestos incluidos · Envío calculado más adelante</p>

          <form
            action={`/products/${product.slug}`}
            aria-label="Selector de variante"
            className={styles.form}
            method="get"
          >
            <fieldset className={styles.fieldset}>
              <legend>Talla</legend>
              <div className={styles.options}>
                {sizes.map((size) => {
                  const unavailableReason = getSizeState(size);
                  return (
                    <label className={styles.option} key={size}>
                      <input
                        defaultChecked={selection.size === size}
                        disabled={Boolean(unavailableReason)}
                        name="size"
                        type="radio"
                        value={size}
                      />
                      <span>
                        {size}
                        {unavailableReason ? (
                          <small className={styles.optionState}>
                            {unavailableReason}
                          </small>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend>Color</legend>
              <div className={styles.options}>
                {colors.map((color) => {
                  const unavailableReason = getColorState(color);
                  return (
                    <label className={styles.option} key={color}>
                      <input
                        defaultChecked={selection.color === color}
                        disabled={Boolean(unavailableReason)}
                        name="color"
                        type="radio"
                        value={color}
                      />
                      <span>
                        {color}
                        {unavailableReason ? (
                          <small className={styles.optionState}>
                            {unavailableReason}
                          </small>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className={styles.actions}>
              <button className={styles.applyButton} type="submit">
                Consultar variante
              </button>
              <Link
                className={styles.clearLink}
                href={`/products/${product.slug}`}
              >
                Quitar selección
              </Link>
            </div>
          </form>

          <p
            aria-live="polite"
            className={
              selection.variant?.stock === 0
                ? `${styles.status} ${styles.soldOut}`
                : `${styles.status} ${styles.available}`
            }
            role="status"
          >
            {getSelectionMessage(selection)}
          </p>

          <TryOnUpload />
        </div>
      </article>
    </main>
  );
}
