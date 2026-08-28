import CatalogGrid from "../components/catalog/CatalogGrid";
import { getCatalogProducts } from "../lib/server/catalog";

export const dynamic = "force-dynamic";

export default async function Home() {
  const products = await getCatalogProducts();

  return (
    <main className="catalog-page">
      <header className="catalog-header">
        <p className="catalog-eyebrow">Tienda de ropa</p>
        <h1 className="catalog-title">Catálogo</h1>
        <p className="catalog-intro">
          Descubre prendas pensadas para acompañarte todos los días.
        </p>
      </header>
      <CatalogGrid products={products} />
    </main>
  );
}
