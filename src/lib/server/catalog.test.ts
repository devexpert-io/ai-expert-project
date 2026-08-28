import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.hoisted(() => vi.fn());
const categoryFindMany = vi.hoisted(() => vi.fn());
const variantFindMany = vi.hoisted(() => vi.fn());
const aggregate = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("./prisma", () => ({
  prisma: {
    product: {
      findMany,
      aggregate,
    },
    category: {
      findMany: categoryFindMany,
    },
    variant: {
      findMany: variantFindMany,
    },
  },
}));

import {
  getCatalogFilterOptions,
  getCatalogProducts,
} from "./catalog";

describe("getCatalogProducts", () => {
  beforeEach(() => {
    findMany.mockReset();
    categoryFindMany.mockReset();
    variantFindMany.mockReset();
    aggregate.mockReset();
  });

  it("selects the minimal card view-model and maps category names", async () => {
    findMany.mockResolvedValue([
      {
        id: "product-1",
        slug: "camiseta-basica",
        name: "Camiseta básica",
        imageUrl: "https://placehold.co/800x1000/png?text=camiseta-basica",
        basePriceCents: 1990,
        category: { name: "Camisetas" },
      },
    ]);

    await expect(getCatalogProducts()).resolves.toEqual([
      {
        id: "product-1",
        slug: "camiseta-basica",
        name: "Camiseta básica",
        imageUrl: "https://placehold.co/800x1000/png?text=camiseta-basica",
        basePriceCents: 1990,
        categoryName: "Camisetas",
      },
    ]);

    expect(findMany).toHaveBeenCalledOnce();
    expect(findMany).toHaveBeenCalledWith({
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
  });

  it("returns an empty view-model when Prisma has no products", async () => {
    findMany.mockResolvedValue([]);

    await expect(getCatalogProducts()).resolves.toEqual([]);
  });

  it("combines validated category, same-variant, and inclusive price filters", async () => {
    findMany.mockResolvedValue([]);

    await getCatalogProducts(
      {
        categorySlug: "camisetas",
        size: "M",
        color: "Negro",
        minPriceCents: 1990,
        maxPriceCents: 5990,
        priceRangeInvalid: false,
      },
      "price-desc",
    );

    expect(findMany).toHaveBeenCalledWith({
      where: {
        category: { slug: "camisetas" },
        variants: { some: { size: "M", color: "Negro" } },
        basePriceCents: { gte: 1990, lte: 5990 },
      },
      orderBy: [
        { basePriceCents: "desc" },
        { name: "asc" },
        { id: "asc" },
      ],
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
  });

  it("does not query Prisma for an inverted range", async () => {
    await expect(
      getCatalogProducts({
        categorySlug: null,
        size: null,
        color: null,
        minPriceCents: 5990,
        maxPriceCents: 1990,
        priceRangeInvalid: true,
      }),
    ).resolves.toEqual([]);

    expect(findMany).not.toHaveBeenCalled();
  });

  it("uses deterministic tie-breakers for ascending price and newest", async () => {
    findMany.mockResolvedValue([]);

    await getCatalogProducts(undefined, "price-asc");
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [
          { basePriceCents: "asc" },
          { name: "asc" },
          { id: "asc" },
        ],
      }),
    );

    await getCatalogProducts(undefined, "newest");
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { name: "asc" }, { id: "asc" }],
      }),
    );
  });
});

describe("getCatalogFilterOptions", () => {
  beforeEach(() => {
    categoryFindMany.mockReset();
    variantFindMany.mockReset();
    aggregate.mockReset();
  });

  it("loads product-backed categories and stable unique size/color/price options", async () => {
    categoryFindMany.mockResolvedValue([
      { slug: "camisetas", name: "Camisetas" },
      { slug: "pantalones", name: "Pantalones" },
    ]);
    variantFindMany.mockResolvedValue([
      { size: "M", color: "Negro" },
      { size: "S", color: "Azul" },
      { size: "M", color: "Negro" },
      { size: "XL", color: "Blanco" },
    ]);
    aggregate.mockResolvedValue({
      _min: { basePriceCents: 1990 },
      _max: { basePriceCents: 8990 },
    });

    await expect(getCatalogFilterOptions()).resolves.toEqual({
      categories: [
        { slug: "camisetas", name: "Camisetas" },
        { slug: "pantalones", name: "Pantalones" },
      ],
      sizes: ["M", "S", "XL"],
      colors: ["Azul", "Blanco", "Negro"],
      minPriceCents: 1990,
      maxPriceCents: 8990,
    });

    expect(categoryFindMany).toHaveBeenCalledWith({
      where: { products: { some: {} } },
      orderBy: [{ name: "asc" }, { slug: "asc" }],
      select: { slug: true, name: true },
    });
    expect(variantFindMany).toHaveBeenCalledWith({
      select: { size: true, color: true },
    });
    expect(aggregate).toHaveBeenCalledWith({
      _min: { basePriceCents: true },
      _max: { basePriceCents: true },
    });
  });
});
