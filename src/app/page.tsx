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
  const products = filters.priceRangeInvalid
    ? []
    : await getCatalogProducts(filters);
  const hasActiveFilters = hasActiveCatalogFilters(filters);

  return (
    <main className="catalog-page">
      <header className="catalog-header">
        <p className="catalog-eyebrow">Tienda de ropa</p>
        <h1 className="catalog-title">Catálogo</h1>
        <p className="catalog-intro">
          Descubre prendas pensadas para acompañarte todos los días.
        </p>
      </header>
      <CatalogFilters
        filters={filters}
        options={options}
        resultCount={products.length}
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
