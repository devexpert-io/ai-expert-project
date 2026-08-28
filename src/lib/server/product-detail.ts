import "server-only";

import { prisma } from "./prisma";

const canonicalSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type ProductVariant = Readonly<{
  id: string;
  size: string;
  color: string;
  stock: number;
  priceCents: number;
}>;

export type ProductDetail = Readonly<{
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  basePriceCents: number;
  categoryName: string;
  variants: readonly ProductVariant[];
}>;

export type ProductSelection = Readonly<{
  size: string | null;
  color: string | null;
  variant: ProductVariant | null;
  hasInvalidValue: boolean;
  hasInvalidCombination: boolean;
}>;

type SelectionParams = Readonly<
  Record<string, string | string[] | undefined>
>;

export function parseProductSlug(slug: string): string | null {
  return canonicalSlugPattern.test(slug) ? slug : null;
}

export async function getProductDetailBySlug(
  slug: string,
): Promise<ProductDetail | null> {
  const canonicalSlug = parseProductSlug(slug);

  if (!canonicalSlug) {
    return null;
  }

  const product = await prisma.product.findUnique({
    where: { slug: canonicalSlug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      imageUrl: true,
      basePriceCents: true,
      category: { select: { name: true } },
      variants: {
        orderBy: [{ size: "asc" }, { color: "asc" }, { id: "asc" }],
        select: {
          id: true,
          size: true,
          color: true,
          stock: true,
          priceCents: true,
        },
      },
    },
  });

  if (!product) {
    return null;
  }

  const { category, ...detail } = product;

  return { ...detail, categoryName: category.name };
}

function parseVariantValue(
  value: string | string[] | undefined,
  allowedValues: readonly string[],
): { value: string | null; invalid: boolean } {
  if (value === undefined) {
    return { value: null, invalid: false };
  }

  if (typeof value !== "string" || value.trim() === "") {
    return { value: null, invalid: true };
  }

  const normalizedValue = value.trim().toLocaleLowerCase("es");
  const canonicalValue = allowedValues.find(
    (allowed) => allowed.toLocaleLowerCase("es") === normalizedValue,
  );

  return canonicalValue
    ? { value: canonicalValue, invalid: false }
    : { value: null, invalid: true };
}

export function parseProductSelection(
  params: SelectionParams,
  variants: readonly ProductVariant[],
): ProductSelection {
  const sizes = [...new Set(variants.map((variant) => variant.size))];
  const colors = [...new Set(variants.map((variant) => variant.color))];
  const size = parseVariantValue(params.size, sizes);
  const color = parseVariantValue(params.color, colors);
  const variant =
    size.value && color.value
      ? (variants.find(
          (candidate) =>
            candidate.size === size.value && candidate.color === color.value,
        ) ?? null)
      : null;

  return {
    size: size.value,
    color: color.value,
    variant,
    hasInvalidValue: size.invalid || color.invalid,
    hasInvalidCombination: Boolean(size.value && color.value && !variant),
  };
}
