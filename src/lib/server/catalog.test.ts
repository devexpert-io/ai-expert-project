import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("./prisma", () => ({
  prisma: {
    product: {
      findMany,
    },
  },
}));

import { getCatalogProducts } from "./catalog";

describe("getCatalogProducts", () => {
  beforeEach(() => {
    findMany.mockReset();
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
});
