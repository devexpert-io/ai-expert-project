import "server-only";

import { prisma } from "./prisma";

export type CatalogProduct = Readonly<{
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  basePriceCents: number;
  categoryName: string;
}>;

export async function getCatalogProducts(): Promise<CatalogProduct[]> {
  const products = await prisma.product.findMany({
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      imageUrl: true,
      basePriceCents: true,
      category: {
        select: {
          name: true,
        },
      },
    },
  });

  return products.map(({ category, ...product }) => ({
    ...product,
    categoryName: category.name,
  }));
}
