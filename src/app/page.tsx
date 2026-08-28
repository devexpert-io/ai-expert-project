import Image from "next/image";
import Link from "next/link";

import CatalogFilters from "../components/catalog/CatalogFilters";
import CatalogGrid from "../components/catalog/CatalogGrid";
import {
  getCatalogFilterOptions,
  getCatalogProducts,
} from "../lib/server/catalog";
import {
  hasActiveCatalogFilters,
  parseCatalogFilters,
} from "../lib/server/catalog-filters";
import { parseCatalogSort } from "../lib/server/catalog-sort";

export const dynamic = "force-dynamic";

type HomeProps = Readonly<{
  searchParams?: Promise<
    Record<string, string | string[] | undefined>
  >;
}>;

export default async function Home({ searchParams }: HomeProps) {
  const [options, resolvedSearchParams] = await Promise.all([
    getCatalogFilterOptions(),
    searchParams ?? Promise.resolve({}),
  ]);
  const filters = parseCatalogFilters(resolvedSearchParams, options);
  const sort = parseCatalogSort(resolvedSearchParams);
  const products = filters.priceRangeInvalid
    ? []
    : await getCatalogProducts(filters, sort);
  const hasActiveFilters = hasActiveCatalogFilters(filters);

  return (
    <main className="catalog-page">
      <header className="catalog-header">
        <Image
          alt=""
          aria-hidden="true"
          className="catalog-hero-image"
          fill
          priority
          sizes="100vw"
          src="/storefront-hero.webp"
        />
        <div className="catalog-hero-copy">
          <p className="catalog-eyebrow">Catálogo</p>
          <h1 className="catalog-title">
            Nueva temporada
          </h1>
          <p className="catalog-intro">
            Piezas esenciales, formas atemporales y materiales ligeros para el
            día a día.
          </p>
        </div>
        <Link
          aria-label="Ver Abrigo ligero, pieza destacada"
          className="catalog-hero-product"
          href="/products/abrigo-ligero"
        >
          <span>Pieza destacada</span>
          Abrigo ligero · 89,90 €
        </Link>
      </header>
      <CatalogFilters
        filters={filters}
        options={options}
        resultCount={products.length}
        sort={sort}
      />
      <CatalogGrid
        emptyMessage={
          filters.priceRangeInvalid
            ? "Corrige el rango de precio para ver el catálogo."
            : hasActiveFilters
              ? "No encontramos productos con estos filtros."
              : undefined
        }
        products={products}
      />
    </main>
  );
}
