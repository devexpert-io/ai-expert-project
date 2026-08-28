import "server-only";

import type { Prisma } from "@prisma/client";

import type {
  CatalogFilterOptions,
  CatalogFilterState,
} from "./catalog-filters";
import type { CatalogSort } from "./catalog-sort";
import { prisma } from "./prisma";

export type CatalogProduct = Readonly<{
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  basePriceCents: number;
  categoryName: string;
}>;

export async function getCatalogProducts(
  filters?: CatalogFilterState,
  sort: CatalogSort = "name",
): Promise<CatalogProduct[]> {
  if (filters?.priceRangeInvalid) {
    return [];
  }

  const where = filters
    ? {
        ...(filters.categorySlug
          ? { category: { slug: filters.categorySlug } }
          : {}),
        ...(filters.size || filters.color
          ? {
              variants: {
                some: {
                  ...(filters.size ? { size: filters.size } : {}),
                  ...(filters.color ? { color: filters.color } : {}),
                },
              },
            }
          : {}),
        ...(filters.minPriceCents !== null || filters.maxPriceCents !== null
          ? {
              basePriceCents: {
                ...(filters.minPriceCents !== null
                  ? { gte: filters.minPriceCents }
                  : {}),
                ...(filters.maxPriceCents !== null
                  ? { lte: filters.maxPriceCents }
                  : {}),
              },
            }
          : {}),
      }
    : undefined;

  const products = await prisma.product.findMany({
    orderBy: getCatalogOrderBy(sort),
    ...(where && Object.keys(where).length > 0 ? { where } : {}),
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

function getCatalogOrderBy(
  sort: CatalogSort,
): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price-asc":
      return [
        { basePriceCents: "asc" },
        { name: "asc" },
        { id: "asc" },
      ];
    case "price-desc":
      return [
        { basePriceCents: "desc" },
        { name: "asc" },
        { id: "asc" },
      ];
    case "newest":
      return [{ createdAt: "desc" }, { name: "asc" }, { id: "asc" }];
    case "name":
      return [{ name: "asc" }, { id: "asc" }];
    default:
      return [{ name: "asc" }, { id: "asc" }];
  }
}

function sortUniqueValues(values: readonly string[]): string[] {
  const uniqueValues = new Map<string, string>();

  for (const value of values) {
    const trimmedValue = value.trim();
    const normalizedValue = trimmedValue.toLowerCase();

    if (trimmedValue && !uniqueValues.has(normalizedValue)) {
      uniqueValues.set(normalizedValue, trimmedValue);
    }
  }

  return [...uniqueValues.values()].sort(
    (left, right) =>
      left.localeCompare(right, "es", { sensitivity: "base" }) ||
      left.localeCompare(right),
  );
}

export async function getCatalogFilterOptions(): Promise<CatalogFilterOptions> {
  const [categories, variants, prices] = await Promise.all([
    prisma.category.findMany({
      where: { products: { some: {} } },
      orderBy: [{ name: "asc" }, { slug: "asc" }],
      select: { slug: true, name: true },
    }),
    prisma.variant.findMany({
      select: { size: true, color: true },
    }),
    prisma.product.aggregate({
      _min: { basePriceCents: true },
      _max: { basePriceCents: true },
    }),
  ]);

  return {
    categories,
    sizes: sortUniqueValues(variants.map((variant) => variant.size)),
    colors: sortUniqueValues(variants.map((variant) => variant.color)),
    minPriceCents: prices._min.basePriceCents,
    maxPriceCents: prices._max.basePriceCents,
  };
}
