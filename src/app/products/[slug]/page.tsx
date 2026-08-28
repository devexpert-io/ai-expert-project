import { notFound } from "next/navigation";

import ProductDetail from "../../../components/product/ProductDetail";
import {
  getProductDetailBySlug,
  parseProductSelection,
} from "../../../lib/server/product-detail";

export const dynamic = "force-dynamic";

type ProductPageProps = Readonly<{
  params: Promise<{ slug: string }>;
  searchParams?: Promise<
    Record<string, string | string[] | undefined>
  >;
}>;

export default async function ProductPage({
  params,
  searchParams,
}: ProductPageProps) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({}),
  ]);
  const product = await getProductDetailBySlug(slug);

  if (!product) {
    notFound();
  }

  const selection = parseProductSelection(
    resolvedSearchParams,
    product.variants,
  );

  return <ProductDetail product={product} selection={selection} />;
}
