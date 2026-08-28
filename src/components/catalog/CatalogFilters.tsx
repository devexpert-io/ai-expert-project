import Link from "next/link";

import type {
  CatalogFilterOptions,
  CatalogFilterState,
} from "../../lib/server/catalog-filters";
import {
  CATALOG_SORT_OPTIONS,
  type CatalogSort,
} from "../../lib/server/catalog-sort";

import styles from "./catalog.module.css";

const euroFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

type CatalogFiltersProps = Readonly<{
  options: CatalogFilterOptions;
  filters: CatalogFilterState;
  resultCount: number;
  sort?: CatalogSort;
}>;

function formatPriceInput(priceCents: number | null): string {
  if (priceCents === null) {
    return "";
  }

  return `${Math.floor(priceCents / 100)}.${String(priceCents % 100).padStart(2, "0")}`;
}

function formatPriceHelp(priceCents: number | null): string | null {
  return priceCents === null ? null : euroFormatter.format(priceCents / 100);
}

export default function CatalogFilters({
  options,
  filters,
  resultCount,
  sort = "name",
}: CatalogFiltersProps) {
  const minimumPrice = formatPriceHelp(options.minPriceCents);
  const maximumPrice = formatPriceHelp(options.maxPriceCents);

  return (
    <section
      aria-labelledby="catalog-filters-title"
      className={styles.filtersSection}
    >
      <form action="/" className={styles.filterForm} method="get">
        <div className={styles.filterToolbar}>
          <div className={styles.filterLead}>
            <span aria-hidden="true" className={styles.filterIcon} />
            <div>
              <h2 className={styles.filtersTitle} id="catalog-filters-title">
                Filtrar<span className={styles.srOnly}> catálogo</span>
              </h2>
              <p
                aria-live="polite"
                className={styles.filterSummary}
                role="status"
              >
                {filters.priceRangeInvalid
                  ? "Corrige el rango de precio para ver resultados."
                  : `${resultCount} ${resultCount === 1 ? "producto" : "productos"}${resultCount > 0 ? " encontrados" : ""}.`}
              </p>
            </div>
          </div>

          <details className={styles.filterMenu}>
            <summary>Categoría</summary>
            <div className={styles.filterPanel}>
              <div className={styles.filterControl}>
                <label htmlFor="catalog-category">Categoría</label>
                <select
                  className={styles.select}
                  defaultValue={filters.categorySlug ?? ""}
                  id="catalog-category"
                  name="category"
                >
                  <option value="">Todas las categorías</option>
                  {options.categories.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </details>

          <details className={styles.filterMenu}>
            <summary>Talla</summary>
            <div className={styles.filterPanel}>
              <fieldset className={styles.filterFieldset}>
                <legend>Talla</legend>
                <div className={styles.chipList}>
                  {options.sizes.map((size) => (
                    <label className={styles.chip} key={size}>
                      <input
                        defaultChecked={filters.size === size}
                        name="size"
                        type="radio"
                        value={size}
                      />
                      <span>{size}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </details>

          <details className={styles.filterMenu}>
            <summary>Color</summary>
            <div className={`${styles.filterPanel} ${styles.colorPanel}`}>
              <fieldset className={styles.filterFieldset}>
                <legend>Color</legend>
                <div className={styles.chipList}>
                  {options.colors.map((color) => (
                    <label className={styles.chip} key={color}>
                      <input
                        defaultChecked={filters.color === color}
                        name="color"
                        type="radio"
                        value={color}
                      />
                      <span>{color}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </details>

          <details className={styles.filterMenu}>
            <summary>Precio</summary>
            <div className={`${styles.filterPanel} ${styles.pricePanel}`}>
              <fieldset className={styles.filterFieldset}>
                <legend>Precio</legend>
                <p className={styles.priceHelp} id="catalog-price-help">
                  {minimumPrice && maximumPrice
                    ? `Entre ${minimumPrice} y ${maximumPrice}.`
                    : "Introduce un precio en euros."}
                </p>
                <div className={styles.priceFields}>
                  <label className={styles.priceControl} htmlFor="catalog-min-price">
                    <span>Mínimo</span>
                    <input
                      aria-describedby="catalog-price-help"
                      className={styles.numberInput}
                      defaultValue={formatPriceInput(filters.minPriceCents)}
                      id="catalog-min-price"
                      inputMode="decimal"
                      min="0"
                      name="minPrice"
                      placeholder="19.90"
                      step="0.01"
                      type="number"
                    />
                  </label>
                  <label className={styles.priceControl} htmlFor="catalog-max-price">
                    <span>Máximo</span>
                    <input
                      aria-describedby="catalog-price-help"
                      className={styles.numberInput}
                      defaultValue={formatPriceInput(filters.maxPriceCents)}
                      id="catalog-max-price"
                      inputMode="decimal"
                      min="0"
                      name="maxPrice"
                      placeholder="89.90"
                      step="0.01"
                      type="number"
                    />
                  </label>
                </div>
                {filters.priceRangeInvalid ? (
                  <p className={styles.filterError} role="alert">
                    El precio mínimo no puede superar al máximo.
                  </p>
                ) : null}
              </fieldset>
            </div>
          </details>

          <div className={`${styles.filterControl} ${styles.sortControl}`}>
            <label htmlFor="catalog-sort">Ordenar por</label>
            <select
              className={styles.select}
              defaultValue={sort}
              id="catalog-sort"
              name="sort"
            >
              {CATALOG_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filterActions}>
            <button className={styles.applyButton} type="submit">
              Aplicar
              <span className={styles.srOnly}> filtros</span>
            </button>
            <Link className={styles.clearLink} href="/">
              Limpiar
              <span className={styles.srOnly}> filtros</span>
            </Link>
          </div>
        </div>
      </form>
    </section>
  );
}
