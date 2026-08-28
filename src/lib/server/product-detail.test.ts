import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("./prisma", () => ({
  prisma: { product: { findUnique } },
}));

import {
  getProductDetailBySlug,
  parseProductSelection,
  parseProductSlug,
  type ProductVariant,
} from "./product-detail";

const variants: readonly ProductVariant[] = [
  {
    id: "variant-s-black",
    size: "S",
    color: "Negro",
    stock: 12,
    priceCents: 1990,
  },
  {
    id: "variant-m-black",
    size: "M",
    color: "Negro",
    stock: 0,
    priceCents: 1990,
  },
  {
    id: "variant-xl-blue",
    size: "XL",
    color: "Azul",
    stock: 5,
    priceCents: 2090,
  },
];

describe("parseProductSlug", () => {
  it("accepts only canonical lowercase slugs", () => {
    expect(parseProductSlug("camiseta-basica")).toBe("camiseta-basica");
    expect(parseProductSlug("Camiseta-basica")).toBeNull();
    expect(parseProductSlug("camiseta--basica")).toBeNull();
    expect(parseProductSlug("camiseta básica")).toBeNull();
    expect(parseProductSlug("../camiseta")).toBeNull();
  });
});

describe("getProductDetailBySlug", () => {
  beforeEach(() => findUnique.mockReset());

  it("uses findUnique with a closed select and maps the category", async () => {
    findUnique.mockResolvedValue({
      id: "product-1",
      slug: "camiseta-basica",
      name: "Camiseta básica",
      description: "Camiseta de algodón",
      imageUrl: "https://placehold.co/image.png",
      basePriceCents: 1990,
      category: { name: "Camisetas" },
      variants,
    });

    await expect(
      getProductDetailBySlug("camiseta-basica"),
    ).resolves.toEqual({
      id: "product-1",
      slug: "camiseta-basica",
      name: "Camiseta básica",
      description: "Camiseta de algodón",
      imageUrl: "https://placehold.co/image.png",
      basePriceCents: 1990,
      categoryName: "Camisetas",
      variants,
    });

    expect(findUnique).toHaveBeenCalledWith({
      where: { slug: "camiseta-basica" },
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
  });

  it("returns null without querying for an invalid slug", async () => {
    await expect(getProductDetailBySlug("NO-valid")).resolves.toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("returns null when the unique product does not exist", async () => {
    findUnique.mockResolvedValue(null);
    await expect(getProductDetailBySlug("no-existe")).resolves.toBeNull();
  });
});

describe("parseProductSelection", () => {
  it("resolves an exact pair without approximating", () => {
    expect(
      parseProductSelection({ size: " s ", color: "negro" }, variants),
    ).toEqual({
      size: "S",
      color: "Negro",
      variant: variants[0],
      hasInvalidValue: false,
      hasInvalidCombination: false,
    });
  });

  it("preserves a valid partial selection", () => {
    expect(parseProductSelection({ size: "XL" }, variants)).toEqual({
      size: "XL",
      color: null,
      variant: null,
      hasInvalidValue: false,
      hasInvalidCombination: false,
    });
  });

  it("rejects duplicate, empty, and unknown values", () => {
    expect(
      parseProductSelection(
        { size: ["S", "M"], color: "" },
        variants,
      ),
    ).toEqual({
      size: null,
      color: null,
      variant: null,
      hasInvalidValue: true,
      hasInvalidCombination: false,
    });

    expect(
      parseProductSelection({ size: "XXL", color: "Negro" }, variants),
    ).toEqual({
      size: null,
      color: "Negro",
      variant: null,
      hasInvalidValue: true,
      hasInvalidCombination: false,
    });
  });

  it("reports a nonexistent pair without choosing another variant", () => {
    expect(
      parseProductSelection({ size: "S", color: "Azul" }, variants),
    ).toEqual({
      size: "S",
      color: "Azul",
      variant: null,
      hasInvalidValue: false,
      hasInvalidCombination: true,
    });
  });
});
